/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @ts-check

/**
 * Get the current tab
 * @returns {Promise<chrome.tabs.Tab?>}
 */
export async function getCurrentTab() {
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tab;
}

/**
 * Check if the tab is allowed to be attached and show a notification if not.
 * Chrome privileged pages are not allowed.
 */
export function isTabAllowedToAttach(tab) {
  if (
    !tab.url?.startsWith("chrome://") &&
    !tab.url?.startsWith("chrome-extension://")
  ) {
    // It's not a privileged page.
    return true;
  }

  // We are not allowed in a privileged page, warn the user and return false.
  console.warn("Tab is not allowed to trace");
  const notificationId = "firefox-profiler-not-allowed" + Math.random();
  const options = {
    /** @type {chrome.notifications.TemplateType} */
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/off/icon128.png"),
    title: "Firefox Profiler Error",
    message: "Tracing a privileged page is not allowed.",
  };

  chrome.notifications.create(notificationId, options, () => {});
  return false;
}
