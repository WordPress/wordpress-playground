(() => {
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

  // src/web/web-worker.js
  console.log("[WebWorker] Spawned");
  document = {};
  importScripts("/webworker-php.js");
  var php = new PHPWrapper();
  php.init(PHP, {}).then(() => {
    console.log("[WebWorker] PHP initialized");
  });
})();
