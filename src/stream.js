/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @ts-check

/**
 *
 * Read a stream asynchronously.
 *
 * @param {number} tabId
 * @param {string} streamHandle
 * @returns {Promise<Array<string>>}
 */
export async function readStreamAsync(tabId, streamHandle) {
  const chunks = [];

  try {
    let eof = false;
    while (!eof) {
      const response = await asyncReadDebuggerIOStream(tabId, streamHandle);

      if (response.base64Encoded) {
        chunks.push(atob(response.data));
      } else {
        chunks.push(response.data);
      }

      eof = response.eof;
    }

    return chunks;
  } catch (error) {
    console.error("Error reading the stream:", error);
    return null;
  }
}

/**
 *
 * Read a chunk of the IO stream.
 *
 * @param {number} tabId
 * @param {string} streamHandle
 * @returns {Promise<{data: string, eof: boolean, base64Encoded?: boolean}>}
 */
function asyncReadDebuggerIOStream(tabId, streamHandle) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(
      { tabId: tabId },
      "IO.read",
      { handle: streamHandle },
      /** @param {any} response */
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      },
    );
  });
}
