import { defineConfig } from "eslint/config";
import crisp from "eslint-plugin-crisp";

export default defineConfig([
  crisp.configs["recommended"],

  {
    rules: {
      "no-console": "off",

      "crisp/constructor-variables": "off",
      "crisp/header-check": "off"
    }
  }
]);
