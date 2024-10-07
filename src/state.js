/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @ts-check

export const state = {
  /**
   * Tracing state.
   * @type {boolean}
   * @public
   */
  isTracing: false,
  /**
   * Tab ID of the current traced tab.
   * @type {number | null}
   * @public
   */
  tabId: null,

  startTracing() {
    this.isTracing = true;
    setIcons("on");
    chrome.action.setTitle({ title: "Click to capture the trace" });
  },

  reset() {
    // Reset the state
    this.isTracing = false;
    this.tabId = null;
    setIcons("off");
    chrome.action.setTitle({ title: "Click to start tracing" });
  },
};

/**
 * Sets the icon of the extension
 * @param {"on" | "off"} variant
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
