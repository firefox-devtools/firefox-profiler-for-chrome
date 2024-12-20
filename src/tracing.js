/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @ts-check

import { state } from "./state.js";
import { readStreamAsync } from "./stream.js";

/**
 * @typedef {object} CustomWindowObject
 * @property {Array<string>} [receivedProfileChunks]
 */

/**
 * @typedef {Window & CustomWindowObject} CustomWindow
 */

const PROFILER_ORIGIN = "https://profiler.firefox.com";
const PROFILER_URL = PROFILER_ORIGIN + "/from-post-message/";

/**
 * Start tracing the current tab.
 *
 * TODO: Currently it uses default puppeteer categories, but we should match
 * what Chrome devtools does. We chould also create a settings page like the
 * devtools performance panel.
 *
 * @returns {Promise<void>}
 */
export async function startTracing() {
  console.log("Start tracing");
  const { tabId } = state;

  if (tabId === null) {
    console.warn("Failed to get the Tab ID");
    return;
  }

  state.recordingState = "starting";

  await chrome.debugger.attach({ tabId }, "1.3");

  // Define tracing categories
  // The settings used by the devtools can be found here:
  // https://source.chromium.org/chromium/chromium/src/+/main:third_party/devtools-frontend/src/front_end/panels/timeline/TimelineController.ts;l=87-103;drc=a59de5d27b5977b0bb8d260634f1d8d45e69cfdf
  // and by puppeteer here:
  // https://github.com/puppeteer/puppeteer/blob/ce1ed7ad74a90acc37f2a5e284ad8d8da360e462/packages/puppeteer-core/src/cdp/Tracing.ts#L72-L84
  // Looks like puppeteer uses fewer categories than the devtools one, trying
  // to match the devtools here.
  const defaultCategories = [
    "-*",
    "devtools.timeline",
    "v8.execute",
    "v8",
    "disabled-by-default-devtools.timeline",
    "disabled-by-default-devtools.timeline.frame",
    "disabled-by-default-devtools.timeline.stack",
    "toplevel",
    "blink.console",
    "blink.user_timing",
    "loading",
    "latencyInfo",
    "disabled-by-default-v8.cpu_profiler",
    "disabled-by-default-v8.cpu_profiler.hires",
    "disabled-by-default-devtools.screenshot",
    "lighthouse",
    "cppgc",
    "navigation,rail",
  ];

  await chrome.debugger.sendCommand({ tabId }, "Tracing.start", {
    traceConfig: {
      includedCategories: defaultCategories,
    },
    transferMode: "ReturnAsStream",
  });

  state.startTracing();

  chrome.debugger.onDetach.addListener(() => {
    console.log("Debugger onDetach listener");

    // Users might detach the debugger using the "cancel" button on the debugger
    // toolbar instead of the profiler button or keyboard shortcut.
    // We should reset the state.
    state.reset();
  });
}

/**
 * Stop tracing and collect the tracing data. It opens up a new tab and loads
 * the Firefox Profiler.
 *
 * @returns {Promise<void>}
 */
export async function stopTracingAndCollect() {
  console.log("Stop tracing and open the profile");
  const { tabId } = state;
  if (tabId === null) {
    console.warn("Failed to get the Tab ID");
    return;
  }
  state.stopping();

  // Add the event listener first and then stop the tracing.
  chrome.debugger.onEvent.addListener(
    async function tracingCompleteListener(_debuggeeId, message, params) {
      if (message === "Tracing.tracingComplete") {
        console.log("Done waiting for tracing data");
        // Casting it from Object to its type
        const tracingCompleteParams = /** @type {{stream?: string}} */ (params);
        const streamHandle = tracingCompleteParams.stream;
        if (!streamHandle) {
          console.warn("Failed to find the stream");
          return;
        }

        const profileChunks = await readStreamAsync(tabId, streamHandle);

        if (!profileChunks) {
          console.warn("Failed to get tracing data chunks");
          return;
        }

        console.log("Trace data complete, total chunks:", profileChunks.length);
        chrome.debugger.detach({ tabId }, () => {
          console.log("Debugger detached");
        });

        openProfile(profileChunks);

        // Remove the listener after receiving Tracing.tracingComplete
        chrome.debugger.onEvent.removeListener(tracingCompleteListener);
      }
    },
  );

  // Stop tracing and collect the trace data
  await chrome.debugger.sendCommand({ tabId }, "Tracing.end");
}

/**
 *
 * Stop tracing and discard the tracing data.
 *
 * @returns {Promise<void>}
 */
export async function stopTracing() {
  console.log("Stop tracing");
  const { tabId } = state;
  if (tabId === null) {
    console.warn("Failed to get the Tab ID");
    return;
  }
  state.stopping();

  // Stop tracing without collecting the trace.
  await chrome.debugger.sendCommand({ tabId }, "Tracing.end");
  chrome.debugger.detach({ tabId }, () => {
    console.log("Debugger detached");
  });
  state.reset();
}

/**
 * Open a profile in https://profiler.firefox.com/.
 *
 * We get profile chunks and send them one by one instead of concatenating them
 * inside the extension's window because if the profile data is too large it
 * fails to send it to the tab silently while calling
 * chrome.scripting.executeScript. By sending in chunks we make sure to send it
 * successfully.
 *
 * @param {Array<string>} profileChunks
 * @returns {Promise<void>}
 */
async function openProfile(profileChunks) {
  chrome.tabs.create({ url: PROFILER_URL }, async (newTab) => {
    const newTabId = newTab.id;

    if (newTabId === undefined) {
      console.warn("Failed to get the Tab ID");
      return;
    }

    let startedLoading = false;

    chrome.tabs.onUpdated.addListener(
      async function listener(updatedTabId, changeInfo) {
        if (updatedTabId === newTabId && changeInfo.status === "complete") {
          if (startedLoading) {
            return;
          }
          startedLoading = true;
          console.log("On load complete");

          /** @type {number} */
          let chunkIndex = 0;
          const totalChunks = profileChunks.length;

          /**
           * Send the next chunk using chrome.scripting.executeScript API.
           * The reason why we have to send by chunks is that the aforementioned
           * API fails silently if we pass a longer string.
           *
           * @returns Promise<void>
           */
          async function sendNextChunk() {
            const chunk = profileChunks[chunkIndex];

            if (newTabId === undefined) {
              console.warn("Failed to get the Tab ID");
              return;
            }

            await chrome.scripting.executeScript({
              target: { tabId: newTabId },
              /**
               * @param {string} chunk
               * @param {number} chunkIndex
               * @param {number} totalChunks
               * @param {string} profilerOrigin
               */
              func: (chunk, chunkIndex, totalChunks, profilerOrigin) => {
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
                    if (data?.name === "ready:response") {
                      isReady = true;
                      const message = {
                        name: "inject-profile",
                        profile: fullProfile,
                      };
                      customWindow.postMessage(message, profilerOrigin);
                      customWindow.removeEventListener("message", listener);
                    }
                  };

                  customWindow.addEventListener("message", listener);

                  /**
                   * Wait for profiler frontend to be ready before sending the
                   * full profile. The listener above will get called with
                   * the 'ready:response' as a response to 'ready:request'.
                   *
                   * @returns {Promise<void>}
                   */
                  async function waitForReady() {
                    while (!isReady) {
                      await new Promise((resolve) => setTimeout(resolve, 100));
                      customWindow.postMessage(
                        { name: "ready:request" },
                        profilerOrigin,
                      );
                    }

                    console.log("Done injecting the profile");
                    customWindow.removeEventListener("message", listener);
                    // Clean up the chunks after sending the full profile
                    delete customWindow.receivedProfileChunks;
                  }

                  waitForReady();
                }
              },
              args: [chunk, chunkIndex, totalChunks, PROFILER_ORIGIN],
              injectImmediately: true,
            });

            chunkIndex++;

            // If there are more chunks, send the next one
            if (chunkIndex < totalChunks) {
              /**
               * @type {Promise<void>}
               */
              const promise = new Promise(
                (resolve) =>
                  setTimeout(async () => {
                    await sendNextChunk();
                    resolve();
                  }, 50), // Small delay between chunks
              );
              await promise;
            } else {
              console.log("All chunks sent");
            }
          }

          await sendNextChunk();
          state.reset();
          chrome.tabs.onUpdated.removeListener(listener);
        }
      },
    );
  });
}
