/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @ts-check

import { state } from "./state.js";
import { isTabAllowedToAttach, getCurrentTab } from "./tabs.js";
import { startTracing, stopTracingAndCollect, stopTracing } from "./tracing.js";
import { assertExhaustiveCheck } from "./ts.js";

/**
 * onClick listener for the extension toolbar button.
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!state.tabId && tab.id !== undefined) {
    state.tabId = tab.id;
  }

  switch (state.recordingState) {
    case "idle":
      // Only check this when we need to start profiling. We can stop at any time.
      if (!isTabAllowedToAttach(tab)) {
        return;
      }
      await startTracing();
      break;
    case "recording":
      await stopTracingAndCollect();
      break;
    case "starting":
    case "stopping":
      break;
    default:
      assertExhaustiveCheck(state.recordingState);
  }
});

/**
 * Command listener for the keyboard shortcuts.
 */
chrome.commands.onCommand.addListener(async (command) => {
  console.log(`Command: ${command}`);

  const tab = await getCurrentTab();
  if (!tab) {
    console.error("Failed to find the current tab");
    return;
  }

  if (!state.tabId && tab.id !== undefined) {
    state.tabId = tab.id;
  }

  switch (command) {
    case "start-stop-profiler": {
      switch (state.recordingState) {
        case "idle":
          // Only check this when we need to start profiling. We can stop at any time.
          if (!isTabAllowedToAttach(tab)) {
            return;
          }
          await startTracing();
          break;
        case "recording":
          await stopTracing();
          break;
        case "starting":
        case "stopping":
          break;
        default:
          assertExhaustiveCheck(state.recordingState);
      }

      break;
    }
    case "stop-profiler-and-capture": {
      switch (state.recordingState) {
        case "recording":
          await stopTracingAndCollect();
          break;
        case "idle":
        case "starting":
        case "stopping":
          break;
        default:
          assertExhaustiveCheck(state.recordingState);
      }
      break;
    }
    default:
      console.error(`Unrecognized command: ${command}`);
  }
});

// Listener for tab updates, like navigation.
chrome.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
  state.updatePopupForTab(tabId, tab.url);
});

// Listener for tab activation (e.g., switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  state.updatePopupForTab(activeInfo.tabId, tab.url);
});

// Listener for when the extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  const tab = await getCurrentTab();
  if (!tab || !tab.id) {
    console.error("Failed to find the current tab");
    return;
  }

  state.updatePopupForTab(tab.id, tab.url);
});

(() => {
  // Reset the state on the initial extension load.
  state.reset();
})();
