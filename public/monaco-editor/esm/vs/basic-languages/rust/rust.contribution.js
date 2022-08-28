/*!-----------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Version: 0.34.0(9d278685b078158491964f8fd7ac9628fffa0f30)
 * Released under the MIT license
 * https://github.com/microsoft/monaco-editor/blob/main/LICENSE.txt
 *-----------------------------------------------------------------------------*/

// src/basic-languages/rust/rust.contribution.ts
import { registerLanguage } from "../_.contribution.js";
registerLanguage({
  id: "rust",
  extensions: [".rs", ".rlib"],
  aliases: ["Rust", "rust"],
  loader: () => {
    if (false) {
      return new Promise((resolve, reject) => {
        __require(["vs/basic-languages/rust/rust"], resolve, reject);
      });
    } else {
      return import("./rust.js");
    }
  }
});
