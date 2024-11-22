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
 * Return whether the url is privileged or not.
 *
 * @param {string | undefined} url
 */
export function isPrivilegedUrl(url) {
  return (
    !url ||
    url.startsWith("chrome://") ||
    url.startsWith("about://") ||
    url.startsWith("https://chromewebstore.google.com/")
  );
}

/**
 * Check if the tab is allowed to be attached and show a notification if not.
 * Chrome privileged pages are not allowed.
 *
 * @param {chrome.tabs.Tab} tab
 */
export function isTabAllowedToAttach(tab) {
  if (isPrivilegedUrl(tab.url)) {
    // We are not allowed in a privileged page, warn the user and return false.
    console.warn("Tab is not allowed to trace");
    return false;
  }

  return true;
}
