# Firefox Profiler extension for Chrome

This is a Chrome extension that allows you to start and stop Chrome's built-in
tracing profiler. After capturing a trace, the extension opens it directly in
the [Firefox Profiler](https://profiler.firefox.com/) for analysis. By
integrating Chrome's tracing features with the Firefox Profiler, it simplifies
performance diagnostics, making it easier to analyze and compare results across
both browsers.

## How to install

[The Firefox Profiler extension can be installed from the Chrome Web Store.](https://chromewebstore.google.com/detail/firefox-profiler/ljmahpnflmbkgaipnfbpgjipcnahlghn)

### Manual install

If you would like to install the extension directly from its source code, you
can follow the steps below:

- Clone the repository.
- Navigate to `chrome://extensions/` and enable the developer mode on the top
  right corner.
- Click "Load unpacked" and select the extension folder.
- Once loaded, the extension icon should appear inside the "Extension" menu on
  your Chrome toolbar. Click on the "Pin" button to add it to the toolbar directly.

## Usage

Using the extension is straightforward:

1. Once you've installed the extension and added it to your toolbar, simply click the Firefox Profiler button to begin recording. Alternatively, you can start recording by pressing `Ctrl+Shift+1`.

2. Now that the profiler is recording, perform the actions you'd like to capture.

3. When you've completed the actions, click the Firefox Profiler button again to stop recording and capture the profile. You can also press `Ctrl+Shift+2` to finalize the profile and open it in Firefox Profiler.

## Development

Currently there is no bundler in the project for faster development. But we do
rely on [TypeScript using JSDoc](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
and we have `eslint` and `prettier` to ensure basic code formatting and linting
standards are consistently applied across the codebase.

Run `yarn` or `yarn install` for installing the development dependencies.

After your changes, please make sure to have successful `yarn ts`, `yarn lint`,
and `yarn prettier` results.

Alternatively you can run `yarn test-all` to run all of them.
