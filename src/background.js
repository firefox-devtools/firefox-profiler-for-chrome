/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @ts-check

import { state } from "./state.js";
import { isTabAllowedToProfile } from "./permissions.js";
import { startTracing, stopTracingAndCollect, stopTracing } from "./tracing.js";

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

chrome.commands.onCommand.addListener(async (command) => {
  console.log(`Command: ${command}`);

  const tab = await getCurrentTab();
  if (!isTabAllowedToProfile(tab)) {
    return;
  }

  if (!state.tabId) {
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

async function getCurrentTab() {
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tab;
}
