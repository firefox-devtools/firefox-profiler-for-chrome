# Firefox Profiler extension for Chrome

This is a Chrome extension that allows you to start and stop Chrome's built-in
tracing profiler. After capturing a trace, the extension opens it directly in
the [Firefox Profiler](https://profiler.firefox.com/) for analysis. By
integrating Chrome's tracing features with the Firefox Profiler, it simplifies
performance diagnostics, making it easier to analyze and compare results across
both browsers.

## How to install

- Clone the repository.
- Navigate to `chrome://extensions/` and enable the developer mode on the top
  right corner.
- Click "Load unpacked" and select the extension folder.
- Once loaded, the extension icon should appear in your Chrome toolbar.

## Development

Currently there is no bunlder in the project for faster development. But we do
rely on [TypeScript using JSDoc](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
and we have `eslint` and `prettier` to ensure basic code formatting and linting
standards are consistently applied across the codebase.

Run `yarn` or `yarn install` for installing the development dependencies.

After your changes, please make sure to have successful `yarn ts`, `yarn lint`,
and `yarn prettier` results.

Alternatively you can run `yarn test-all` to run all of them.

## Important Note

It's still Work in progress. Also, currently it requires a patched Firefox
Profiler frontend, that's why it currently opens up a deploy preview URL.
Alternatively you can clone the repo and pull [this PR](https://github.com/firefox-devtools/profiler/pull/5148)
to be able to use localhost.
