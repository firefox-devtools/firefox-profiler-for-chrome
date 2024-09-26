const state = {
  isTracing: false,
  tabId: null,

  startTracing() {
    this.isTracing = true;
    chrome.action.setBadgeText({ text: "ON", tabId: this.tabId });
  },

  reset() {
    // Reset the state
    chrome.action.setBadgeText({ text: "", tabId: this.tabId });
    this.isTracing = false;
    this.tabId = null;
    this.traceEvents = [];
  },
};

chrome.action.onClicked.addListener(async (tab) => {
  if (!state.tabId) {
    state.tabId = tab.id;
  }

  if (!state.isTracing) {
    await startTracing();
  } else {
    await stopTracingAndCollect();
  }
});

async function startTracing() {
  console.log("start tracing");
  const { tabId } = state;
  await chrome.debugger.attach({ tabId: tabId }, "1.3");

  // Define tracing categories
  const tracingConfig = {
    includedCategories: [
      "devtools.timeline", // Timeline events
      "v8.execute", // J/* a */vaScript execution
      "blink.user_timing", // User timing events
      // "disabled-by-default-v8.cpu_profiler", // CPU profiling events
      // "disabled-by-default-devtools.timeline", // Detailed timeline events
      // "toplevel", // High-level events
    ],
    transferMode: "ReportEvents", // This ensures events are reported in chunks
  };

  await chrome.debugger.sendCommand({ tabId: tabId }, "Tracing.start", {
    tracingConfig,
  });

  state.startTracing(tabId);
}

async function stopTracingAndCollect() {
  console.log("stop tracing and open the profile");
  const { tabId } = state;

  const traceEvents = [];

  // Collect the tracing data
  chrome.debugger.onEvent.addListener((source, method, params) => {
    if (method === "Tracing.dataCollected") {
      // console.log("canova got the event");
      // Once data is collected, concatenate it
      traceEvents.push(...params.value);
    }
  });

  // Stop tracing and collect the trace data
  await chrome.debugger.sendCommand({ tabId: tabId }, "Tracing.end");

  await waitForTracingComplete(tabId);

  // This will only get executed if the debugger gets attached by the user.
  // TODO: We might need to move this to start actually.
  chrome.debugger.onDetach.addListener(async (source, reason) => {
    console.log("canova ondetach listener");
    onDetach(traceEvents);
  });

  // Detach the debugger
  await chrome.debugger.detach({ tabId: tabId });
  onDetach(traceEvents);
}

async function onDetach(traceEvents) {
  console.log("on detach");
  // Convert the trace data into JSON
  const traceData = { traceEvents };

  // Open profiler.firefox.com and send the trace data
  const jsonProfile = JSON.stringify(traceData);

  // console.log("canova profile.length", jsonProfile.length);
  await openProfile(jsonProfile);

  state.reset();
}

// Function to wait for Tracing.tracingComplete event
function waitForTracingComplete(tabId) {
  console.log("waiting for tracing to complete");
  return new Promise((resolve) => {
    chrome.debugger.onEvent.addListener(
      function tracingCompleteListener(debuggeeId, message, params) {
        if (
          debuggeeId.tabId === tabId &&
          message === "Tracing.tracingComplete"
        ) {
          console.log("done waiting for tracing data.");
          // Remove the listener after receiving Tracing.tracingComplete
          chrome.debugger.onEvent.removeListener(tracingCompleteListener);
          resolve(); // Resolve the promise when tracing is complete
        }
      },
    );
  });
}

/**
 * Open a profile in https://profiler.firefox.com/
 */
async function openProfile(profile) {
  // const origin = "https://profiler.firefox.com";
  const origin = "http://localhost:4242";
  const profilerURL = origin + "/from-post-message/";

  chrome.tabs.create({ url: profilerURL }, async (newTab) => {
    const newTabId = newTab.id;

    let startedLoading = false;

    chrome.tabs.onUpdated.addListener(
      async function listener(updatedTabId, changeInfo) {
        if (updatedTabId === newTabId && changeInfo.status === "complete") {
          if (startedLoading) {
            return;
          }
          startedLoading = true;
          console.log("on load complete", newTabId);
          await chrome.scripting.executeScript({
            target: { tabId: newTabId },
            func: (profile) => {
              // const jsonProfile = JSON.stringify(profile);
              console.log("executing the content script");
              let isReady = false;

              /**
               * @param {MessageEvent} event
               */
              const listener = ({ data }) => {
                if (data?.name === "ready") {
                  isReady = true;
                  const message = {
                    name: "inject-profile",
                    profile: profile,
                  };
                  window.postMessage(message, origin);
                  window.removeEventListener("message", listener);
                }
              };

              window.addEventListener("message", listener);
              while (!isReady) {
                // await new Promise((resolve) => setTimeout(resolve, 100));
                window.postMessage({ name: "is-ready" }, origin);
              }

              console.log("done injecting the profile");

              window.removeEventListener("message", listener);
            },
            args: [profile],
            injectImmediately: true,
            // world: "MAIN",
          });
          chrome.tabs.onUpdated.removeListener(listener);
        }
      },
    );
  });
}
