/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @ts-check

import { isPrivilegedUrl } from "./tabs.js";
import { assertExhaustiveCheck } from "./ts.js";

/**
 * @typedef {"idle" | "starting" | "recording" |  "stopping"} RecordingState
 */

export const state = {
  /**
   * Tracing state.
   * @type {RecordingState}
   * @public
   */
  recordingState: "idle",
  /**
   * Tab ID of the current traced tab.
   * @type {number | null}
   * @public
   */
  tabId: null,

  startTracing() {
    this.recordingState = "recording";
    setIcons("on");
    chrome.action.setTitle({ title: "Click to capture the trace" });
  },

  stopping() {
    this.recordingState = "stopping";
    setIcons("stopping");
    chrome.action.setTitle({ title: "Capturing a trace" });
  },

  reset() {
    // Reset the state
    this.recordingState = "idle";
    this.tabId = null;
    setIcons("off");
    chrome.action.setTitle({ title: "Click to start tracing" });
  },

  /**
   *
   * Update the popup state depending on the recording state as well as whether
   * we are in a privileged page.
   * @param {number} tabId
   * @param {string | undefined} url
   */
  updatePopupForTab(tabId, url) {
    if (!url) {
      // For some reason we don't know the url, return without doing anything.
      return;
    }

    // Update the popup state depending on the recording state that we are in.
    switch (this.recordingState) {
      case "recording":
      case "starting":
      case "stopping":
        // Make sure that we don't have a popup set while recording.
        chrome.action.setPopup({
          tabId,
          // Empty string means no popup.
          popup: "",
        });
        break;
      case "idle": {
        // We want to update the popup now.
        // Empty string means no popup will be shown.
        const popup = isPrivilegedUrl(url) ? "src/disabled_popup.html" : "";
        chrome.action.setPopup({ tabId, popup });
        break;
      }
      default:
        assertExhaustiveCheck(this.recordingState);
    }
  },
};

/**
 * Sets the icon of the extension
 * @param {"on" | "off" | "stopping"} variant
 */
function setIcons(variant) {
  chrome.action.setIcon({
    path: {
      16: chrome.runtime.getURL(`icons/${variant}/icon16.png`),
      32: chrome.runtime.getURL(`icons/${variant}/icon32.png`),
      48: chrome.runtime.getURL(`icons/${variant}/icon48.png`),
      128: chrome.runtime.getURL(`icons/${variant}/icon128.png`),
    },
  });
}
