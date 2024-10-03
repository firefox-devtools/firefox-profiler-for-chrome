/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @ts-check

/**
 * @typedef {object} CustomWindowObject
 * @property {Array<any>} [receivedProfileChunks]
 */

/**
 * @typedef {Window & CustomWindowObject} CustomWindow
 */

const state = {
  /**
   * Tracing state.
   * @type {boolean}
   * @public
   */
  isTracing: false,
  /**
   * Tab ID of the current profiled tab.
   * @type {number | null}
   * @public
   */
  tabId: null,

  startTracing() {
    this.isTracing = true;
    setIcons("on", this.tabId);
  },

  reset() {
    // Reset the state
    setIcons("off", this.tabId);
    this.isTracing = false;
    this.tabId = null;
  },
};

chrome.action.onClicked.addListener(async (tab) => {
  if (!isTabAllowedToProfile(tab)) {
    return;
  }

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
  // The settings used by the devtools can be found here:
  // https://source.chromium.org/chromium/chromium/src/+/main:third_party/devtools-frontend/src/front_end/panels/timeline/TimelineController.ts;l=87-103;drc=a59de5d27b5977b0bb8d260634f1d8d45e69cfdf
  // and for puppeteer here:
  // https://github.com/puppeteer/puppeteer/blob/ce1ed7ad74a90acc37f2a5e284ad8d8da360e462/packages/puppeteer-core/src/cdp/Tracing.ts#L72-L84
  // Currently using puppeteer's categories.
  const defaultCategories = [
    "-*",
    "devtools.timeline",
    "v8.execute",
    "disabled-by-default-devtools.timeline",
    "disabled-by-default-devtools.timeline.frame",
    "toplevel",
    "blink.console",
    "blink.user_timing",
    "latencyInfo",
    "disabled-by-default-devtools.timeline.stack",
    "disabled-by-default-v8.cpu_profiler",
  ];

  await chrome.debugger.sendCommand({ tabId: tabId }, "Tracing.start", {
    traceConfig: {
      includedCategories: defaultCategories,
    },
    transferMode: "ReturnAsStream",
  });

  state.startTracing();
}

async function stopTracingAndCollect() {
  console.log("stop tracing and open the profile");
  const { tabId } = state;

  // Add the event listener first and then stop the tracing.
  chrome.debugger.onEvent.addListener(
    /**
     * @param {{stream?: string}} params
     */
    async function tracingCompleteListener(debuggeeId, message, params) {
      if (message === "Tracing.tracingComplete") {
        console.log("done waiting for tracing data.");
        const streamHandle = params.stream;
        if (!streamHandle) {
          console.warn("Failed to find the stream!");
          return;
        }

        const profileChunks = await readStreamAsync(tabId, streamHandle);

        console.log("Trace data complete, total chunks:", profileChunks.length);
        chrome.debugger.detach({ tabId }, () => {
          console.log("Debugger detached");
        });
        state.reset();

        openProfile(profileChunks);

        // Remove the listener after receiving Tracing.tracingComplete
        chrome.debugger.onEvent.removeListener(tracingCompleteListener);
      }
    },
  );

  // Stop tracing and collect the trace data
  await chrome.debugger.sendCommand({ tabId: tabId }, "Tracing.end");
}

async function readStreamAsync(tabId, streamHandle) {
  let profileChunks = [];

  try {
    let eof = false;
    while (!eof) {
      const response = await asyncReadStream(tabId, streamHandle);

      if (response.base64Encoded) {
        profileChunks.push(atob(response.data));
      } else {
        profileChunks.push(response.data);
      }

      eof = response.eof;
    }

    return profileChunks;
  } catch (error) {
    console.error("Error reading the stream:", error);
    return null;
  }
}

function asyncReadStream(tabId, streamHandle) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(
      { tabId: tabId },
      "IO.read",
      { handle: streamHandle },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      },
    );
  });
}

/**
 * Open a profile in https://profiler.firefox.com/
 * @param {Array<string>} profileChunks
 */
async function openProfile(profileChunks) {
  // const origin = "https://profiler.firefox.com";
  // FIXME: Currently using localhost since I'm waiting for:
  // https://github.com/firefox-devtools/profiler/pull/5148
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

          /** @type {number} */
          let chunkIndex = 0;
          const totalChunks = profileChunks.length;

          async function sendNextChunk() {
            const chunk = profileChunks[chunkIndex];

            await chrome.scripting.executeScript({
              target: { tabId: newTabId },
              /**
               * @param {string} chunk
               * @param {number} chunkIndex
               * @param {number} totalChunks
               */
              func: (chunk, chunkIndex, totalChunks) => {
                // Initialize a global array in the content script if it doesn't exist
                // NOTE: We have to cast the Window into CustomWindow to be able
                // to use the new field we add in typescript.
                /** @type {CustomWindow} */
                const customWindow = window;
                if (!customWindow.receivedProfileChunks) {
                  customWindow.receivedProfileChunks = [];
                }

                // Add the received chunk to the array
                customWindow.receivedProfileChunks.push(chunk);

                console.log(`Received chunk ${chunkIndex + 1}/${totalChunks}`);

                // If all chunks are received, assemble the profile and send it
                if (customWindow.receivedProfileChunks.length === totalChunks) {
                  const fullProfile =
                    customWindow.receivedProfileChunks.join("");

                  let isReady = false;

                  /**
                   * @param {MessageEvent} event
                   */
                  const listener = ({ data }) => {
                    if (data?.name === "ready") {
                      isReady = true;
                      const message = {
                        name: "inject-profile",
                        profile: fullProfile,
                      };
                      customWindow.postMessage(message, origin);
                      customWindow.removeEventListener("message", listener);
                    }
                  };

                  customWindow.addEventListener("message", listener);

                  async function waitForReady() {
                    while (!isReady) {
                      await new Promise((resolve) => setTimeout(resolve, 100));
                      customWindow.postMessage({ name: "is-ready" }, origin);
                    }

                    console.log("done injecting the profile");
                    customWindow.removeEventListener("message", listener);
                    // Clean up the chunks after sending the full profile
                    delete customWindow.receivedProfileChunks;
                  }

                  waitForReady();
                }
              },
              args: [chunk, chunkIndex, totalChunks],
              injectImmediately: true,
            });

            chunkIndex++;

            // If there are more chunks, send the next one
            if (chunkIndex < totalChunks) {
              setTimeout(sendNextChunk, 50); // Small delay between chunks
            } else {
              console.log("All chunks sent!");
            }
          }

          sendNextChunk();
          chrome.tabs.onUpdated.removeListener(listener);
        }
      },
    );
  });
}

function isTabAllowedToProfile(tab) {
  if (!tab.url?.startsWith("chrome://")) {
    // It's not a privileged page.
    return true;
  }

  // We are not allowed in a privileged page, warn the user and return false.
  const notificationId = "firefox-profiler-not-allowed" + Math.random();
  const options = {
    /** @type {chrome.notifications.TemplateType} */
    type: "basic",
    iconUrl: "icons/off/icon128.png",
    title: "Firefox Profiler Error",
    message: "Profiling a priviledged page is not allowed.",
  };

  chrome.notifications.create(notificationId, options, () => {});
  return false;
}

/**
 * Sets the icon of the extension
 * @param {"on" | "off"} variant
 * @param {number} tabId
 */
function setIcons(variant, tabId) {
  chrome.action.setIcon({
    path: {
      16: `icons/${variant}/icon16.png`,
      32: `icons/${variant}/icon32.png`,
      48: `icons/${variant}/icon48.png`,
      128: `icons/${variant}/icon128.png`,
    },
    tabId,
  });
}
