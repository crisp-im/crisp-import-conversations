import { defineConfig } from "eslint/config";
import crisp from "eslint-plugin-crisp";

export default defineConfig([
  crisp.configs["recommended"],

  {
    rules: {
      "crisp/header-check": "off"
    }
  }
]);
