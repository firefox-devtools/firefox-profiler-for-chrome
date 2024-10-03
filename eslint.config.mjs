import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
  },
  pluginJs.configs.recommended,
];
