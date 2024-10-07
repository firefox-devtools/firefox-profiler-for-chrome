/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @ts-check

import { state } from "./state.js";
import { isTabAllowedToAttach, getCurrentTab } from "./tabs.js";
import { startTracing, stopTracingAndCollect, stopTracing } from "./tracing.js";

/**
 * onClick listener for the extension toolbar button.
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!isTabAllowedToAttach(tab)) {
    return;
  }

  if (!state.tabId && tab.id !== undefined) {
    state.tabId = tab.id;
  }

  if (!state.isTracing) {
    await startTracing();
  } else {
    await stopTracingAndCollect();
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

  if (!isTabAllowedToAttach(tab)) {
    return;
  }

  if (!state.tabId && tab.id !== undefined) {
    state.tabId = tab.id;
  }

  switch (command) {
    case "start-stop-profiler": {
      if (state.isTracing) {
        await stopTracing();
      } else {
        await startTracing();
      }
      break;
    }
    case "stop-profiler-and-capture": {
      if (state.isTracing) {
        await stopTracingAndCollect();
      }
      break;
    }
    default:
      console.error(`Unrecognized command: ${command}`);
  }
});

(() => {
  // Reset the state on the initial extension load.
  state.reset();
})();
