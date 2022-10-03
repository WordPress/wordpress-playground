(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined")
      return require.apply(this, arguments);
    throw new Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // src/shared/php-wrapper.mjs
  var STR = "string";
  var NUM = "number";
  var PHPWrapper = class {
    _initPromise;
    call;
    stdout = [];
    stderr = [];
    async init(PhpBinary, args = {}) {
      if (this._initPromise) {
        return this._initPromise;
      }
      const defaults = {
        onAbort(reason) {
          console.error("WASM aborted: ");
          console.error(reason);
        },
        print: (...chunks) => {
          this.stdout.push(...chunks);
        },
        printErr: (...chunks) => {
          this.stderr.push(...chunks);
        }
      };
      this._initPromise = new PhpBinary(Object.assign({}, defaults, args)).then(({ ccall }) => {
        ccall("pib_init", NUM, [STR], []);
        this.call = ccall;
      });
      return this._initPromise;
    }
    async run(code) {
      if (!this.call) {
        throw new Error(`Run init() first!`);
      }
      const exitCode = this.call("pib_run", NUM, [STR], [`?>${code}`]);
      const response = {
        exitCode,
        stdout: this.stdout.join("\n"),
        stderr: this.stderr
      };
      this.clear();
      return response;
    }
    async clear() {
      if (!this.call) {
        throw new Error(`Run init() first!`);
      }
      this.call("pib_refresh", NUM, [], []);
      this.stdout = [];
      this.stderr = [];
    }
    refresh = this.clear;
  };

  // src/shared/wordpress.mjs
  if (typeof XMLHttpRequest === "undefined") {
    import("xmlhttprequest").then(({ XMLHttpRequest: XMLHttpRequest2 }) => {
      global.XMLHttpRequest = XMLHttpRequest2;
    });
    global.atob = function(data) {
      return Buffer.from(data).toString("base64");
    };
  }

  // src/web/web-worker.js
  if ("function" === typeof importScripts) {
    console.log("[WebWorker] Spawned");
    document = {};
    importScripts("/webworker-php.js");
    let isReady = false;
    async function init() {
      const php = new PHPWrapper();
      await php.init(PHP, {
        async onPreInit(FS, phpModule) {
          globalThis.PHPModule = phpModule;
          importScripts("/wp.js");
          FS.mkdirTree("/usr/local/etc");
          FS.createLazyFile("/usr/local/etc", "php.ini", "/etc/php.ini", true, false);
          importScripts("/wp-lazy-files.js");
          getLazyFiles().forEach(({ path, filename, fullPath }) => {
            FS.mkdirTree("/usr/local/etc");
            FS.createLazyFile(path, filename, fullPath, true, false);
          });
        }
      });
    }
    const browser = init();
    browser.then(async () => {
      console.log("test");
    });
  }
})();
