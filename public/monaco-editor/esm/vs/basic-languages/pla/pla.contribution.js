/*!-----------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Version: 0.34.0(9d278685b078158491964f8fd7ac9628fffa0f30)
 * Released under the MIT license
 * https://github.com/microsoft/monaco-editor/blob/main/LICENSE.txt
 *-----------------------------------------------------------------------------*/

// src/basic-languages/pla/pla.contribution.ts
import { registerLanguage } from "../_.contribution.js";
registerLanguage({
  id: "pla",
  extensions: [".pla"],
  loader: () => {
    if (false) {
      return new Promise((resolve, reject) => {
        __require(["vs/basic-languages/pla/pla"], resolve, reject);
      });
    } else {
      return import("./pla.js");
    }
  }
});
