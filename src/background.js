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
  switch (state.recordingState) {
    case "idle":
      // Only check this when we need to start profiling. We can stop at any time.
      if (!isTabAllowedToAttach(tab)) {
        return;
      }
      // Adopt the tab only after we know we're allowed to attach to it, so a
      // rejected privileged page doesn't leave a stale tabId pointing at the
      // wrong tab for the next recording.
      if (tab.id !== undefined) {
        state.tabId = tab.id;
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

  switch (command) {
    case "start-stop-profiler": {
      switch (state.recordingState) {
        case "idle":
          // Only check this when we need to start profiling. We can stop at any time.
          if (!isTabAllowedToAttach(tab)) {
            return;
          }
          // Adopt the tab only after we know we're allowed to attach to it, so
          // a rejected privileged page doesn't leave a stale tabId pointing at
          // the wrong tab for the next recording.
          if (tab.id !== undefined) {
            state.tabId = tab.id;
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

// Listener for when the debugger is detached. Users might detach the debugger
// using the "cancel" button on the debugger toolbar instead of the profiler
// button or keyboard shortcut, in which case we should reset the state. This is
// registered once to avoid accumulating a new listener on every recording.
chrome.debugger.onDetach.addListener((source) => {
  // Ignore detaches for tabs we aren't tracing.
  if (source.tabId !== state.tabId) {
    return;
  }

  console.log("Debugger onDetach listener");
  state.reset();
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
