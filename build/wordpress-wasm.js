(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
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

  // node_modules/php-wasm/build/index.js
  var require_build = __commonJS({
    "node_modules/php-wasm/build/index.js"(exports, module) {
      var __defProp2 = Object.defineProperty;
      var __defProps = Object.defineProperties;
      var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
      var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
      var __getOwnPropNames2 = Object.getOwnPropertyNames;
      var __getOwnPropSymbols = Object.getOwnPropertySymbols;
      var __hasOwnProp2 = Object.prototype.hasOwnProperty;
      var __propIsEnum = Object.prototype.propertyIsEnumerable;
      var __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
      var __spreadValues = (a, b) => {
        for (var prop in b || (b = {}))
          if (__hasOwnProp2.call(b, prop))
            __defNormalProp(a, prop, b[prop]);
        if (__getOwnPropSymbols)
          for (var prop of __getOwnPropSymbols(b)) {
            if (__propIsEnum.call(b, prop))
              __defNormalProp(a, prop, b[prop]);
          }
        return a;
      };
      var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
      var __objRest = (source, exclude) => {
        var target = {};
        for (var prop in source)
          if (__hasOwnProp2.call(source, prop) && exclude.indexOf(prop) < 0)
            target[prop] = source[prop];
        if (source != null && __getOwnPropSymbols)
          for (var prop of __getOwnPropSymbols(source)) {
            if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
              target[prop] = source[prop];
          }
        return target;
      };
      var __export = (target, all) => {
        for (var name in all)
          __defProp2(target, name, { get: all[name], enumerable: true });
      };
      var __copyProps2 = (to, from, except, desc) => {
        if (from && typeof from === "object" || typeof from === "function") {
          for (let key of __getOwnPropNames2(from))
            if (!__hasOwnProp2.call(to, key) && key !== except)
              __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
        }
        return to;
      };
      var __toCommonJS = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
      var __publicField = (obj, key, value) => {
        __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
        return value;
      };
      var src_exports = {};
      __export(src_exports, {
        PHP: () => PHP,
        PHPBrowser: () => PHPBrowser,
        PHPServer: () => PHPServer,
        phpWasmHash: () => phpWasmHash2,
        phpWebWasmSize: () => phpWebWasmSize2
      });
      module.exports = __toCommonJS(src_exports);
      var STR = "string";
      var NUM = "number";
      var defaultPhpIni = `[PHP]
error_reporting = E_ERROR | E_PARSE
display_errors = 1
html_errors = 1
display_startup_errors = On
`;
      var PHP = class {
        constructor() {
          __publicField(this, "_initPromise");
          __publicField(this, "call");
          __publicField(this, "stdout", []);
          __publicField(this, "stderr", []);
          __publicField(this, "refresh", this.clear);
        }
        init(PHPLoader2, args) {
          if (!this._initPromise) {
            this._initPromise = this._init(PHPLoader2, args || {});
          }
          return this._initPromise;
        }
        async _init(PHPLoader2, _a) {
          var _b = _a, {
            phpIni = defaultPhpIni
          } = _b, args = __objRest(_b, [
            "phpIni"
          ]);
          const PHPModule = await loadPHP(PHPLoader2, __spreadValues({
            onAbort(reason) {
              console.error("WASM aborted: ");
              console.error(reason);
            },
            print: (...chunks) => this.stdout.push(...chunks),
            printErr: (...chunks) => this.stderr.push(...chunks)
          }, args));
          this.PHPModule = PHPModule;
          this.mkdirTree = PHPModule.FS.mkdirTree;
          this.readFile = PHPModule.FS.readFile;
          this.writeFile = PHPModule.FS.writeFile;
          this.unlink = PHPModule.FS.unlink;
          this.pathExists = (path) => {
            try {
              PHPModule.FS.lookupPath(path);
              return true;
            } catch (e) {
              return false;
            }
          };
          this.awaitDataDependencies = () => {
            return new Promise((resolve) => {
              PHPModule.monitorRunDependencies = (nbLeft) => {
                if (nbLeft === 0) {
                  delete PHPModule.monitorRunDependencies;
                  resolve();
                }
              };
            });
          };
          PHPModule.FS.mkdirTree("/usr/local/etc");
          PHPModule.FS.writeFile(
            "/usr/local/etc/php.ini",
            phpIni
          );
          this.call = PHPModule.ccall;
          await this.call("pib_init", NUM, [STR], []);
          return PHPModule;
        }
        initUploadedFilesHash() {
          this.call("pib_init_uploaded_files_hash", null, [], []);
        }
        registerUploadedFile(tmpPath) {
          this.call("pib_register_uploaded_file", null, [STR], [tmpPath]);
        }
        destroyUploadedFilesHash() {
          this.call("pib_destroy_uploaded_files_hash", null, [], []);
        }
        run(code) {
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
        clear() {
          if (!this.call) {
            throw new Error(`Run init() first!`);
          }
          this.call("pib_refresh", NUM, [], []);
          this.stdout = [];
          this.stderr = [];
        }
      };
      async function loadPHP(PHPLoader2, args) {
        const ModulePointer = __spreadValues({}, args);
        await new PHPLoader2(ModulePointer);
        return ModulePointer;
      }
      if (false) {
        null.then(({ XMLHttpRequest }) => {
          global.XMLHttpRequest = XMLHttpRequest;
        });
        global.atob = function(data) {
          return Buffer.from(data).toString("base64");
        };
      }
      var PHPServer = class {
        constructor(php, {
          documentRoot = "/var/www/",
          absoluteUrl,
          isStaticFile: isStaticFile2 = () => false,
          beforeRequest = (request, server) => ""
        }) {
          __publicField(this, "DOCROOT");
          __publicField(this, "SCHEMA");
          __publicField(this, "HOSTNAME");
          __publicField(this, "PORT");
          __publicField(this, "HOST");
          __publicField(this, "PATHNAME");
          __publicField(this, "ABSOLUTE_URL");
          this.php = php;
          this.DOCROOT = documentRoot;
          this.isStaticFile = isStaticFile2;
          this.beforeRequest = beforeRequest;
          const url = new URL(absoluteUrl);
          this.HOSTNAME = url.hostname;
          this.PORT = url.port ? url.port : url.protocol === "https:" ? 443 : 80;
          this.SCHEMA = (url.protocol || "").replace(":", "");
          this.HOST = `${this.HOSTNAME}:${this.PORT}`;
          this.PATHNAME = url.pathname.replace(/\/+$/, "");
          this.ABSOLUTE_URL = `${this.SCHEMA}://${this.HOSTNAME}:${this.PORT}${this.PATHNAME}`;
        }
        async request(request) {
          if (this.isStaticFile(request.path)) {
            return this.serveStaticFile(request.path);
          } else {
            return await this.dispatchToPHP(request);
          }
        }
        serveStaticFile(requestedPath) {
          const fsPath = `${this.DOCROOT}${requestedPath.substr(this.PATHNAME.length)}`;
          if (!this.php.pathExists(fsPath)) {
            return {
              body: "404 File not found",
              headers: {},
              statusCode: 404,
              exitCode: 0,
              rawError: ""
            };
          }
          const arrayBuffer = this.php.readFile(fsPath);
          return {
            body: arrayBuffer,
            headers: {
              "Content-length": arrayBuffer.byteLength,
              "Content-type": inferMimeType(fsPath),
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=0"
            },
            exitCode: 0,
            rawError: ""
          };
        }
        async dispatchToPHP(request) {
          const _FILES = await this.prepare_FILES(request.files);
          try {
            const output = await this.php.run(`<?php
			${this._setupErrorReportingCode()}
			${this._setupRequestCode(__spreadProps(__spreadValues({}, request), {
              _FILES
            }))}
            ${this._requireRequestHandler(request)}
		`);
            return this.parseResponse(output);
          } finally {
            this.cleanup_FILES(_FILES);
          }
        }
        _requireRequestHandler(request) {
          const phpFilePath = this.resolvePHPFilePath(request.path);
          return `
        // Ensure the resolved path points to an existing file. If not,
        // let's fall back to index.php
        $candidate_path = '${this.DOCROOT}/' . ltrim('${phpFilePath}', '/');
        if ( file_exists( $candidate_path ) ) {
            require_once $candidate_path;
        } else {
            require_once '${this.DOCROOT}/index.php';
        }
        `;
        }
        resolvePHPFilePath(requestedPath) {
          let filePath = requestedPath;
          if (this.PATHNAME) {
            filePath = filePath.substr(this.PATHNAME.length);
          }
          if (filePath.includes(".php")) {
            filePath = filePath.split(".php")[0] + ".php";
          } else {
            if (!filePath.endsWith("/")) {
              filePath += "/";
            }
            if (!filePath.endsWith("index.php")) {
              filePath += "index.php";
            }
          }
          return filePath;
        }
        async prepare_FILES(files = {}) {
          if (Object.keys(files).length) {
            this.php.initUploadedFilesHash();
          }
          const _FILES = {};
          for (const [key, value] of Object.entries(files)) {
            const tmpName = Math.random().toFixed(20);
            const tmpPath = `/tmp/${tmpName}`;
            this.php.writeFile(
              tmpPath,
              new Uint8Array(await value.arrayBuffer())
            );
            _FILES[key] = {
              name: value.name,
              type: value.type,
              tmp_name: tmpPath,
              error: 0,
              size: value.size
            };
            this.php.registerUploadedFile(tmpPath);
          }
          return _FILES;
        }
        cleanup_FILES(_FILES = {}) {
          if (Object.keys(_FILES).length) {
            this.php.destroyUploadedFilesHash();
          }
          for (const [, value] of Object.entries(_FILES)) {
            if (this.php.pathExists(value.tmp_name)) {
              this.php.unlink(value.tmp_name);
            }
          }
        }
        parseResponse(result) {
          const response = {
            body: result.stdout,
            headers: {},
            exitCode: result.exitCode,
            rawError: result.stderr
          };
          for (const row of result.stderr) {
            if (!row || !row.trim()) {
              continue;
            }
            try {
              const [name, value] = JSON.parse(row);
              if (name === "headers") {
                response.headers = this.parseHeaders(value);
                break;
              }
              if (name === "status_code") {
                response.statusCode = value;
              }
            } catch (e) {
            }
          }
          if (!response.statusCode) {
            response.statusCode = 200;
          }
          delete response.headers["x-frame-options"];
          return response;
        }
        parseHeaders(rawHeaders) {
          const parsed = {};
          for (const header of rawHeaders) {
            const splitAt = header.indexOf(":");
            const [name, value] = [
              header.substring(0, splitAt).toLowerCase(),
              header.substring(splitAt + 2)
            ];
            if (!(name in parsed)) {
              parsed[name] = [];
            }
            parsed[name].push(value);
          }
          return parsed;
        }
        _setupErrorReportingCode() {
          return `
			$stdErr = fopen('php://stderr', 'w');
			$errors = [];
			register_shutdown_function(function() use($stdErr){
				fwrite($stdErr, json_encode(['status_code', http_response_code()]) . "
");
				fwrite($stdErr, json_encode(['session_id', session_id()]) . "
");
				fwrite($stdErr, json_encode(['headers', headers_list()]) . "
");
				fwrite($stdErr, json_encode(['errors', error_get_last()]) . "
");
				if(isset($_SESSION)) {
                    fwrite($stdErr, json_encode(['session', $_SESSION]) . "
");
                }
			});

			set_error_handler(function(...$args) use($stdErr){
				fwrite($stdErr, print_r($args,1));
			});
			error_reporting(E_ALL);
		`;
        }
        _setupRequestCode({
          path = "/",
          method = "GET",
          headers,
          _GET = "",
          _POST = {},
          _FILES = {},
          _COOKIE = {},
          _SESSION = {}
        } = {}) {
          const request = {
            path,
            method,
            headers,
            _GET,
            _POST,
            _FILES,
            _COOKIE,
            _SESSION
          };
          const https = this.ABSOLUTE_URL.startsWith("https://") ? "on" : "";
          return `
            ${this.beforeRequest(request, this)}

			$request = (object) json_decode(<<<'REQUEST'
        ${JSON.stringify(request)}
REQUEST,
        JSON_OBJECT_AS_ARRAY
      );

			parse_str(substr($request->_GET, 1), $_GET);

			$_POST = $request->_POST;
			$_FILES = $request->_FILES;

			if ( !is_null($request->_COOKIE) ) {
				foreach ($request->_COOKIE as $key => $value) {
					fwrite($stdErr, 'Setting Cookie: ' . $key . " => " . $value . "
");
					$_COOKIE[$key] = urldecode($value);
				}
			}

			$_SESSION = $request->_SESSION;

			foreach( $request->headers as $name => $value ) {
				$server_key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
				$_SERVER[$server_key] = $value;
			}

			ini_set('session.save_path', '/home/web_user');
			session_id('fake-cookie');
			session_start();

			fwrite($stdErr, json_encode(['session' => $_SESSION]) . "
");

			$docroot = '${this.DOCROOT}';

			$script  = ltrim($request->path, '/');

			$path = $request->path;
			$path = preg_replace('/^\\/php-wasm/', '', $path);

			$_SERVER['PATH']     = '/';
			$_SERVER['REQUEST_URI']     = $path . ($request->_GET ?: '');
			$_SERVER['HTTP_HOST']       = '${this.HOST}';
			$_SERVER['REMOTE_ADDR']     = '${this.HOSTNAME}';
			$_SERVER['SERVER_NAME']     = '${this.ABSOLUTE_URL}';
			$_SERVER['SERVER_PORT']     = ${this.PORT};
			$_SERVER['HTTP_USER_AGENT'] = ${JSON.stringify(navigator.userAgent)};
			$_SERVER['SERVER_PROTOCOL'] = 'HTTP/1.1';
			$_SERVER['REQUEST_METHOD']  = $request->method;
			$_SERVER['SCRIPT_FILENAME'] = $docroot . '/' . $script;
			$_SERVER['SCRIPT_NAME']     = $docroot . '/' . $script;
			$_SERVER['PHP_SELF']        = $docroot . '/' . $script;
			$_SERVER['DOCUMENT_ROOT']   = '/';
			$_SERVER['HTTPS']           = '${https}';
			chdir($docroot);
		`;
        }
      };
      function inferMimeType(path) {
        const extension = path.split(".").pop();
        switch (extension) {
          case "css":
            return "text/css";
          case "js":
            return "application/javascript";
          case "png":
            return "image/png";
          case "jpg":
          case "jpeg":
            return "image/jpeg";
          case "gif":
            return "image/gif";
          case "svg":
            return "image/svg+xml";
          case "woff":
            return "font/woff";
          case "woff2":
            return "font/woff2";
          case "ttf":
            return "font/ttf";
          case "otf":
            return "font/otf";
          case "eot":
            return "font/eot";
          case "ico":
            return "image/x-icon";
          case "html":
            return "text/html";
          case "json":
            return "application/json";
          case "xml":
            return "application/xml";
          case "txt":
          case "md":
            return "text/plain";
          default:
            return "application-octet-stream";
        }
      }
      var PHPBrowser = class {
        constructor(server, config = {}) {
          this.server = server;
          this.cookies = {};
          this.config = __spreadValues({
            handleRedirects: false,
            maxRedirects: 4
          }, config);
        }
        async request(request, redirects = 0) {
          const response = await this.server.request(__spreadProps(__spreadValues({}, request), {
            _COOKIE: this.cookies
          }));
          if (response.headers["set-cookie"]) {
            this.setCookies(response.headers["set-cookie"]);
          }
          if (this.config.handleRedirects && response.headers.location && redirects < this.config.maxRedirects) {
            const parsedUrl = new URL(
              response.headers.location[0],
              this.server.ABSOLUTE_URL
            );
            return this.request(
              {
                path: parsedUrl.pathname,
                method: "GET",
                _GET: parsedUrl.search,
                headers: {}
              },
              redirects + 1
            );
          }
          return response;
        }
        setCookies(cookies) {
          for (const cookie of cookies) {
            try {
              const value = cookie.split("=")[1].split(";")[0];
              const name = cookie.split("=")[0];
              this.cookies[name] = value;
            } catch (e) {
              console.error(e);
            }
          }
        }
      };
      var phpWebWasmSize2 = 0;
      var phpWasmHash2 = "";
    }
  });

  // node_modules/php-wasm-browser/build/index.js
  var require_build2 = __commonJS({
    "node_modules/php-wasm-browser/build/index.js"(exports, module) {
      var __defProp2 = Object.defineProperty;
      var __defProps = Object.defineProperties;
      var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
      var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
      var __getOwnPropNames2 = Object.getOwnPropertyNames;
      var __getOwnPropSymbols = Object.getOwnPropertySymbols;
      var __hasOwnProp2 = Object.prototype.hasOwnProperty;
      var __propIsEnum = Object.prototype.propertyIsEnumerable;
      var __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
      var __spreadValues = (a, b) => {
        for (var prop in b || (b = {}))
          if (__hasOwnProp2.call(b, prop))
            __defNormalProp(a, prop, b[prop]);
        if (__getOwnPropSymbols)
          for (var prop of __getOwnPropSymbols(b)) {
            if (__propIsEnum.call(b, prop))
              __defNormalProp(a, prop, b[prop]);
          }
        return a;
      };
      var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
      var __export = (target, all) => {
        for (var name in all)
          __defProp2(target, name, { get: all[name], enumerable: true });
      };
      var __copyProps2 = (to, from, except, desc) => {
        if (from && typeof from === "object" || typeof from === "function") {
          for (let key of __getOwnPropNames2(from))
            if (!__hasOwnProp2.call(to, key) && key !== except)
              __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
        }
        return to;
      };
      var __toCommonJS = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
      var src_exports = {};
      __export(src_exports, {
        awaitReply: () => awaitReply2,
        cloneResponseMonitorProgress: () => cloneResponseMonitorProgress,
        getWorkerThreadBackend: () => getWorkerThreadBackend2,
        initializeServiceWorker: () => initializeServiceWorker,
        initializeWorkerThread: () => initializeWorkerThread,
        isPHPFile: () => isPHPFile,
        messageHandler: () => messageHandler,
        postMessageExpectReply: () => postMessageExpectReply2,
        registerServiceWorker: () => registerServiceWorker2,
        removeURLScope: () => removeURLScope2,
        responseTo: () => responseTo2,
        startPHPWorkerThread: () => startPHPWorkerThread2
      });
      module.exports = __toCommonJS(src_exports);
      var import_php_wasm2 = require_build();
      var DEFAULT_REPLY_TIMEOUT = 25e3;
      var lastMessageId = 0;
      function postMessageExpectReply2(messageTarget, message, ...postMessageArgs) {
        const messageId = ++lastMessageId;
        messageTarget.postMessage(
          __spreadProps(__spreadValues({}, message), {
            messageId
          }),
          ...postMessageArgs
        );
        return messageId;
      }
      async function awaitReply2(messageTarget, messageId, timeout = DEFAULT_REPLY_TIMEOUT) {
        return new Promise((resolve, reject) => {
          const responseHandler = (event) => {
            if (event.data.type === "response" && event.data.messageId === messageId) {
              messageTarget.removeEventListener("message", responseHandler);
              clearTimeout(failOntimeout);
              resolve(event.data.result);
            }
          };
          const failOntimeout = setTimeout(() => {
            reject(new Error("Request timed out"));
            messageTarget.removeEventListener("message", responseHandler);
          }, timeout);
          messageTarget.addEventListener("message", responseHandler);
        });
      }
      function responseTo2(messageId, result) {
        return {
          type: "response",
          messageId,
          result
        };
      }
      function messageHandler(handler) {
        return async function(event, respond) {
          const result = await handler(event.data);
          if (event.data.messageId) {
            respond(responseTo2(event.data.messageId, result));
          }
        };
      }
      var DEFAULT_BASE_URL = "http://example.com";
      function getPathQueryFragment(url) {
        return url.toString().substring(url.origin.length);
      }
      function isURLScoped(url) {
        return url.pathname.startsWith(`/scope:`);
      }
      function getURLScope(url) {
        if (isURLScoped(url)) {
          return url.pathname.split("/")[1].split(":")[1];
        }
        return null;
      }
      function setURLScope(url, scope) {
        if (!scope) {
          return url;
        }
        const newUrl = new URL(url);
        if (isURLScoped(newUrl)) {
          const parts = newUrl.pathname.split("/");
          parts[1] = `scope:${scope}`;
          newUrl.pathname = parts.join("/");
        } else {
          const suffix = newUrl.pathname === "/" ? "" : newUrl.pathname;
          newUrl.pathname = `/scope:${scope}${suffix}`;
        }
        return newUrl;
      }
      function removeURLScope2(url) {
        if (!isURLScoped(url)) {
          return url;
        }
        const newUrl = new URL(url);
        const parts = newUrl.pathname.split("/");
        newUrl.pathname = "/" + parts.slice(2).join("/");
        return newUrl;
      }
      var FALLBACK_FILE_SIZE = 5 * 1024 * 1024;
      var DownloadMonitor = class extends EventTarget {
        constructor({ assetsSizes }) {
          super();
          this.assetsSizes = assetsSizes;
          this.dataFileDownloadsProxy = this._createDataFileDownloadsProxy();
        }
        _createDataFileDownloadsProxy() {
          const self2 = this;
          const dataFileDownloads = {};
          return new Proxy(dataFileDownloads, {
            set(obj, file, progress) {
              self2._notify(file, progress.loaded, progress.total);
              obj[file] = new Proxy(progress, {
                set(nestedObj, prop, value) {
                  nestedObj[prop] = value;
                  self2._notify(file, nestedObj.loaded, nestedObj.total);
                }
              });
            }
          });
        }
        plugIntoWebAssembly_instantiateStreaming() {
          const self2 = this;
          const _instantiateStreaming = WebAssembly.instantiateStreaming;
          WebAssembly.instantiateStreaming = (response, ...args) => {
            const file = response.url.substring(
              new URL(response.url).origin.length + 1
            );
            const reportingResponse = cloneResponseMonitorProgress(
              response,
              ({ loaded, total }) => self2._notify(file, loaded, total)
            );
            return _instantiateStreaming(reportingResponse, ...args);
          };
        }
        _notify(file, loaded, total) {
          if (!total) {
            const filename = new URL(file, DEFAULT_BASE_URL).pathname.split("/").pop();
            total = this.assetsSizes[filename];
          }
          this.dispatchEvent(
            new CustomEvent("progress", {
              detail: {
                file,
                loaded,
                total: total || Math.min(loaded, FALLBACK_FILE_SIZE),
                fallbackUsed: !total
              }
            })
          );
        }
      };
      function cloneResponseMonitorProgress(response, onProgress) {
        const contentLength = response.headers.get("content-length");
        let total = parseInt(contentLength, 10) || FALLBACK_FILE_SIZE;
        return new Response(
          new ReadableStream(
            {
              async start(controller) {
                const reader = response.body.getReader();
                let loaded = 0;
                for (; ; ) {
                  try {
                    const { done, value } = await reader.read();
                    if (value) {
                      loaded += value.byteLength;
                    }
                    if (done) {
                      onProgress({ loaded, total: loaded, done });
                      controller.close();
                      break;
                    } else {
                      onProgress({ loaded, total, done });
                      controller.enqueue(value);
                    }
                  } catch (e) {
                    console.error({ e });
                    controller.error(e);
                    break;
                  }
                }
              }
            }
          ),
          {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          }
        );
      }
      function getCurrentEnvironment(options) {
        if (typeof window !== "undefined") {
          return getIframeEnvironment(options);
        } else if (typeof SharedWorkerGlobalScope !== "undefined" && self instanceof SharedWorkerGlobalScope) {
          return getSharedWorkerEnvironment(options);
        } else if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
          return getWebWorkerEnvironment(options);
        } else {
          throw new Error(`Unsupported environment`);
        }
      }
      var getIframeEnvironment = ({ locateFile }) => ({
        name: "iframe",
        getPHPLoaderScript() {
          return "/php-web.js";
        },
        importScripts: async (...urls) => {
          return Promise.all(
            urls.map(locateFile).map((url) => {
              const script = document.createElement("script");
              script.src = url;
              script.async = false;
              document.body.appendChild(script);
              return new Promise((resolve) => {
                script.onload = resolve;
              });
            })
          );
        },
        addMessageListener(handler) {
          window.addEventListener(
            "message",
            (event) => handler(
              event,
              (response) => event.source.postMessage(response, "*")
            ),
            false
          );
          const postMessageToParent = (message) => window.parent.postMessage(message, "*");
          return postMessageToParent;
        }
      });
      var getWebWorkerEnvironment = ({ locateFile }) => ({
        name: "webWorker",
        getPHPLoaderScript() {
          return "/php-webworker.js";
        },
        importScripts: (...urls) => importScripts(...urls.map(locateFile)),
        addMessageListener(handler) {
          onmessage = (event) => {
            handler(event, postMessage);
          };
          const postMessageToParent = postMessage;
          return postMessageToParent;
        }
      });
      var getSharedWorkerEnvironment = ({ locateFile }) => ({
        name: "sharedWorker",
        getPHPLoaderScript() {
          return "/php-webworker.js";
        },
        importScripts: (...urls) => importScripts(...urls.map(locateFile)),
        addMessageListener(handler) {
          let postMessageToParent;
          self.onconnect = (e) => {
            const port = e.ports[0];
            port.addEventListener("message", (event) => {
              handler(event, (r) => port.postMessage(r));
            });
            postMessageToParent = port.postMessage;
            port.start();
          };
          return (message) => postMessageToParent(message);
        }
      });
      function initializeWorkerThread({
        assetsSizes,
        bootBrowser = ({ php, message }) => new import_php_wasm2.PHPBrowser(new import_php_wasm2.PHPServer(php, {
          absoluteUrl: message.absoluteUrl
        })),
        locateFile = (file) => file
      }) {
        const workerEnv = getCurrentEnvironment({
          locateFile
        });
        const postMessageToParent = workerEnv.addMessageListener(
          messageHandler(handleMessage)
        );
        let phpBrowser;
        async function handleMessage(message) {
          if (message.type === "initialize_php") {
            const downloadMonitor = new DownloadMonitor({ assetsSizes });
            downloadMonitor.plugIntoWebAssembly_instantiateStreaming();
            downloadMonitor.addEventListener(
              "progress",
              (e) => postMessageToParent(__spreadValues({
                type: "download_progress"
              }, e.detail))
            );
            const php = new import_php_wasm2.PHP();
            await workerEnv.importScripts(workerEnv.getPHPLoaderScript());
            await php.init(PHPLoader, {
              dataFileDownloads: downloadMonitor.dataFileDownloadsProxy,
              locateFile
            });
            phpBrowser = await bootBrowser({ php, workerEnv, message });
            return true;
          }
          if (message.type === "is_alive") {
            return true;
          }
          if (message.type === "run_php") {
            return await phpBrowser.server.php.run(message.code);
          }
          if (message.type === "request" || message.type === "httpRequest") {
            const parsedUrl = new URL(
              message.request.path,
              DEFAULT_BASE_URL
            );
            return await phpBrowser.request(__spreadProps(__spreadValues({}, message.request), {
              path: parsedUrl.pathname,
              _GET: parsedUrl.search
            }));
          }
          console.warning(
            `[WASM Worker] "${message.type}" event received but it has no handler.`
          );
        }
      }
      var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      async function startPHPWorkerThread2({
        backend,
        absoluteUrl,
        scope,
        onDownloadProgress = noop
      }) {
        while (true) {
          try {
            await backend.sendMessage({ type: "is_alive" }, 50);
            break;
          } catch (e) {
          }
          await sleep(50);
        }
        absoluteUrl = setURLScope(new URL(absoluteUrl), scope).toString();
        backend.addMessageListener((e) => {
          if (e.data.type === "download_progress") {
            onDownloadProgress(e.data);
          }
        });
        await backend.sendMessage({
          type: "initialize_php",
          absoluteUrl
        });
        return {
          pathToInternalUrl(path) {
            return `${absoluteUrl}${path}`;
          },
          internalUrlToPath(internalUrl) {
            return getPathQueryFragment(removeURLScope2(new URL(internalUrl)));
          },
          async eval(code) {
            return await backend.sendMessage({
              type: "run_php",
              code
            });
          },
          async HTTPRequest(request) {
            return await backend.sendMessage({
              type: "request",
              request
            });
          }
        };
      }
      function getWorkerThreadBackend2(key, url) {
        const backends = {
          webworker: webWorkerBackend,
          shared_worker: sharedWorkerBackend,
          iframe: iframeBackend
        };
        const backend = backends[key];
        if (!backend) {
          const availableKeys = Object.keys(backends).join(", ");
          throw new Error(
            `Unknown worker backend: "${key}". Choices: ${availableKeys}`
          );
        }
        return backend(url);
      }
      function webWorkerBackend(workerURL) {
        const worker = new Worker(workerURL);
        return {
          async sendMessage(message, timeout) {
            const messageId = postMessageExpectReply2(worker, message);
            const response = await awaitReply2(worker, messageId, timeout);
            return response;
          },
          addMessageListener(listener) {
            worker.onmessage = listener;
          }
        };
      }
      function sharedWorkerBackend(workerURL) {
        const worker = new SharedWorker(workerURL);
        worker.port.start();
        return {
          async sendMessage(message, timeout) {
            const messageId = postMessageExpectReply2(worker.port, message);
            const response = await awaitReply2(worker.port, messageId, timeout);
            return response;
          },
          addMessageListener(listener) {
            worker.port.onmessage = listener;
          }
        };
      }
      function iframeBackend(workerDocumentURL) {
        const iframe = document.createElement("iframe");
        iframe.src = workerDocumentURL;
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        return {
          async sendMessage(message, timeout) {
            const messageId = postMessageExpectReply2(
              iframe.contentWindow,
              message,
              "*"
            );
            const response = await awaitReply2(window, messageId, timeout);
            return response;
          },
          addMessageListener(listener) {
            window.addEventListener(
              "message",
              (e) => {
                if (e.source === iframe.contentWindow) {
                  listener(e);
                }
              },
              false
            );
          }
        };
      }
      async function registerServiceWorker2({ broadcastChannel, url, onRequest, scope }) {
        if (!broadcastChannel) {
          throw new Error("Missing the required `broadcastChannel` option.");
        }
        if (!navigator.serviceWorker) {
          throw new Error("Service workers are not supported in this browser.");
        }
        const registration = await navigator.serviceWorker.register(url);
        await registration.update();
        broadcastChannel.addEventListener(
          "message",
          async function onMessage(event) {
            if (scope && event.data.scope !== scope) {
              return;
            }
            console.debug(
              `[Main] "${event.data.type}" message received from a service worker`
            );
            let result;
            if (event.data.type === "request" || event.data.type === "httpRequest") {
              result = await onRequest(event.data.request);
            } else {
              throw new Error(
                `[Main] Unexpected message received from the service-worker: "${event.data.type}"`
              );
            }
            if (event.data.messageId) {
              broadcastChannel.postMessage(
                responseTo2(event.data.messageId, result)
              );
            }
            console.debug(`[Main] "${event.data.type}" message processed`, {
              result
            });
          }
        );
        navigator.serviceWorker.startMessages();
      }
      function initializeServiceWorker({
        broadcastChannel,
        shouldHandleRequest = isPHPFile
      }) {
        if (!broadcastChannel) {
          throw new Error("Missing the required `broadcastChannel` option.");
        }
        self.addEventListener("activate", (event) => {
          event.waitUntil(clients.claim());
        });
        self.addEventListener("fetch", (event) => {
          const url = new URL(event.request.url);
          const scope = getURLScope(url);
          const unscopedUrl = removeURLScope2(url);
          if (!shouldHandleRequest(unscopedUrl)) {
            if (isURLScoped(url)) {
              event.preventDefault();
              return event.respondWith(
                new Promise(async (accept) => {
                  const newRequest = await cloneRequest(event.request, {
                    url: unscopedUrl
                  });
                  accept(fetch(newRequest));
                })
              );
            }
            return;
          }
          event.preventDefault();
          return event.respondWith(
            new Promise(async (accept) => {
              console.log(
                `[ServiceWorker] Serving request: ${getPathQueryFragment(
                  unscopedUrl
                )}`
              );
              const { post, files } = await parsePost(event.request);
              const requestHeaders = {};
              for (const pair of event.request.headers.entries()) {
                requestHeaders[pair[0]] = pair[1];
              }
              const requestedPath = getPathQueryFragment(url);
              let phpResponse;
              try {
                const message = {
                  type: "httpRequest",
                  scope,
                  request: {
                    path: requestedPath,
                    method: event.request.method,
                    files,
                    _POST: post,
                    headers: requestHeaders
                  }
                };
                console.log(
                  "[ServiceWorker] Forwarding a request to the main app",
                  {
                    message
                  }
                );
                const messageId = postMessageExpectReply2(
                  broadcastChannel,
                  message
                );
                phpResponse = await awaitReply2(broadcastChannel, messageId);
                console.log(
                  "[ServiceWorker] Response received from the main app",
                  {
                    phpResponse
                  }
                );
              } catch (e) {
                console.error(e, { requestedPath });
                throw e;
              }
              accept(
                new Response(phpResponse.body, {
                  headers: phpResponse.headers,
                  status: phpResponse.statusCode
                })
              );
            })
          );
        });
      }
      function isPHPFile(path) {
        return path.endsWith("/") || path.endsWith(".php");
      }
      async function parsePost(request) {
        if (request.method !== "POST") {
          return { post: void 0, files: void 0 };
        }
        try {
          const formData = await request.clone().formData();
          const post = {};
          const files = {};
          for (const key of formData.keys()) {
            const value = formData.get(key);
            if (value instanceof File) {
              files[key] = value;
            } else {
              post[key] = value;
            }
          }
          return { post, files };
        } catch (e) {
        }
        return { post: await request.clone().json(), files: {} };
      }
      async function cloneRequest(request, overrides) {
        const body = ["GET", "HEAD"].includes(request.method) || "body" in overrides ? void 0 : await request.blob();
        return new Request(overrides.url || request.url, __spreadValues({
          body,
          method: request.method,
          headers: request.headers,
          referrer: request.referrer,
          referrerPolicy: request.referrerPolicy,
          mode: request.mode,
          credentials: request.credentials,
          cache: request.cache,
          redirect: request.redirect,
          integrity: request.integrity
        }, overrides));
      }
    }
  });

  // packages/wordpress-wasm/build-module/index.js
  var import_php_wasm_browser = __toESM(require_build2());
  var import_php_wasm = __toESM(require_build());
  var serviceWorkerUrl = "http://127.0.0.1:8777/service-worker.js";
  var serviceWorkerOrigin = new URL(serviceWorkerUrl).origin;
  var wordPressSiteUrl = serviceWorkerOrigin;
  var wasmWorkerUrl = "http://127.0.0.1:8778/iframe-worker.html?9306942499988495";
  var wasmWorkerBackend = "iframe";
  async function bootWordPress({
    assignScope = true,
    onWasmDownloadProgress
  }) {
    assertNotInfiniteLoadingLoop();
    const scope = assignScope ? Math.random().toFixed(16) : void 0;
    const workerThread = await (0, import_php_wasm_browser.startPHPWorkerThread)({
      backend: (0, import_php_wasm_browser.getWorkerThreadBackend)(wasmWorkerBackend, wasmWorkerUrl),
      absoluteUrl: wordPressSiteUrl,
      scope,
      onDownloadProgress: onWasmDownloadProgress
    });
    await (0, import_php_wasm_browser.registerServiceWorker)({
      url: serviceWorkerUrl,
      broadcastChannel: new BroadcastChannel("wordpress-wasm"),
      onRequest: async (request) => {
        return await workerThread.HTTPRequest(request);
      },
      scope
    });
    return workerThread;
  }
  function assertNotInfiniteLoadingLoop() {
    let isBrowserInABrowser = false;
    try {
      isBrowserInABrowser = window.parent !== window && window.parent.IS_WASM_WORDPRESS;
    } catch (e) {
    }
    if (isBrowserInABrowser) {
      throw new Error(
        "The service worker did not load correctly. This is a bug, please report it on https://github.com/WordPress/wordpress-wasm/issues"
      );
    }
    window.IS_WASM_WORDPRESS = true;
  }
  var isStaticFile = (scopedPath) => {
    const unscopedPath = (0, import_php_wasm_browser.removeURLScope)(new URL(scopedPath, "http://127.0.0.1")).pathname;
    return unscopedPath.startsWith("/wp-content/uploads/") || unscopedPath.startsWith("/wp-content/plugins/") || unscopedPath.startsWith("/wp-content/themes/") && !unscopedPath.startsWith("/wp-content/themes/twentytwentytwo/");
  };
})();
