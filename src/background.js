/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @ts-check

import { state } from "./state.js";
import { isTabAllowedToProfile } from "./permissions.js";
import { startTracing, stopTracingAndCollect } from "./tracing.js";

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
