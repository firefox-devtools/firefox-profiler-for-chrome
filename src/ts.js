/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @ts-check

/**
 * @param {never} notValid - This should be a `never` type to make sure we have exhausted the enum values.
 * @param {string} [errorMessage] - Optional error message.
 */
export function assertExhaustiveCheck(
  notValid,
  errorMessage = `There was an unhandled case for the value: "${notValid}"`,
) {
  throw new Error(errorMessage);
}
