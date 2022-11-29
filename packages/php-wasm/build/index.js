var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/php-wasm/src/index.js
var src_exports = {};
__export(src_exports, {
  PHPBrowser: () => PHPBrowser,
  PHPServer: () => PHPServer,
  phpJsHash: () => phpJsHash,
  startPHP: () => startPHP
});
module.exports = __toCommonJS(src_exports);

// packages/php-wasm/src/php.js
var STR = "string";
var NUM = "number";
async function startPHP(phpLoaderModule, phpEnv, phpModuleArgs = {}, dataDependenciesModules = []) {
  let resolvePhpReady, resolveDepsReady;
  const depsReady = new Promise((resolve) => {
    resolveDepsReady = resolve;
  });
  const phpReady = new Promise((resolve) => {
    resolvePhpReady = resolve;
  });
  const streams = {
    stdout: [],
    stderr: []
  };
  const loadPHPRuntime = phpLoaderModule.default;
  const PHPRuntime = loadPHPRuntime(phpEnv, {
    onAbort(reason) {
      console.error("WASM aborted: ");
      console.error(reason);
    },
    print: (...chunks) => streams.stdout.push(...chunks),
    printErr: (...chunks) => streams.stderr.push(...chunks),
    ...phpModuleArgs,
    noInitialRun: true,
    onRuntimeInitialized() {
      if (phpModuleArgs.onRuntimeInitialized) {
        phpModuleArgs.onRuntimeInitialized();
      }
      resolvePhpReady();
    },
    monitorRunDependencies(nbLeft) {
      if (nbLeft === 0) {
        delete PHPRuntime.monitorRunDependencies;
        resolveDepsReady();
      }
    }
  });
  for (const { default: loadDataModule } of dataDependenciesModules) {
    loadDataModule(PHPRuntime);
  }
  if (!dataDependenciesModules.length) {
    resolveDepsReady();
  }
  await depsReady;
  await phpReady;
  return new PHP(
    PHPRuntime,
    streams
  );
}
var PHP = class {
  #streams;
  #Runtime;
  constructor(Runtime, streams) {
    this.#Runtime = Runtime;
    this.#streams = streams;
    this.mkdirTree("/usr/local/etc");
    this.writeFile("/usr/local/etc/php.ini", `[PHP]
error_reporting = E_ERROR | E_PARSE
display_errors = 1
html_errors = 1
display_startup_errors = On
session.save_path=/home/web_user
    `);
    Runtime.ccall("pib_init", NUM, [STR], []);
  }
  run(code) {
    const exitCode = this.#Runtime.ccall("pib_run", NUM, [STR], [`?>${code}`]);
    const response = {
      exitCode,
      stdout: this.#streams.stdout.join("\n"),
      stderr: this.#streams.stderr
    };
    this.#refresh();
    return response;
  }
  #refresh() {
    this.#Runtime.ccall("pib_refresh", NUM, [], []);
    this.#streams.stdout = [];
    this.#streams.stderr = [];
  }
  mkdirTree(path) {
    this.#Runtime.FS.mkdirTree(path);
  }
  readFileAsText(path) {
    return new TextDecoder().decode(this.readFileAsBuffer(path));
  }
  readFileAsBuffer(path) {
    return this.#Runtime.FS.readFile(path);
  }
  writeFile(path, data) {
    return this.#Runtime.FS.writeFile(path, data);
  }
  unlink(path) {
    this.#Runtime.FS.unlink(path);
  }
  fileExists(path) {
    try {
      this.#Runtime.FS.lookupPath(path);
      return true;
    } catch (e) {
      return false;
    }
  }
  initUploadedFilesHash() {
    this.#Runtime.ccall("pib_init_uploaded_files_hash", null, [], []);
  }
  registerUploadedFile(tmpPath) {
    this.#Runtime.ccall("pib_register_uploaded_file", null, [STR], [tmpPath]);
  }
  destroyUploadedFilesHash() {
    this.#Runtime.ccall("pib_destroy_uploaded_files_hash", null, [], []);
  }
};

// packages/php-wasm/src/php-server.js
var PHPServer = class {
  DOCROOT;
  SCHEMA;
  HOSTNAME;
  PORT;
  HOST;
  PATHNAME;
  ABSOLUTE_URL;
  constructor(php, {
    documentRoot = "/var/www/",
    absoluteUrl,
    isStaticFilePath = () => false
  }) {
    this.php = php;
    this.DOCROOT = documentRoot;
    this.isStaticFilePath = isStaticFilePath;
    const url = new URL(absoluteUrl);
    this.HOSTNAME = url.hostname;
    this.PORT = url.port ? url.port : url.protocol === "https:" ? 443 : 80;
    this.SCHEMA = (url.protocol || "").replace(":", "");
    this.HOST = `${this.HOSTNAME}:${this.PORT}`;
    this.PATHNAME = url.pathname.replace(/\/+$/, "");
    this.ABSOLUTE_URL = `${this.SCHEMA}://${this.HOSTNAME}:${this.PORT}${this.PATHNAME}`;
  }
  async request(request) {
    const unprefixedPath = this.withoutPathname(request.path);
    if (this.isStaticFilePath(unprefixedPath)) {
      return this.serveStaticFile(unprefixedPath);
    } else {
      return await this.dispatchToPHP(request);
    }
  }
  withoutPathname(path) {
    if (!this.PATHNAME) {
      return path;
    }
    return path.substr(this.PATHNAME.length);
  }
  serveStaticFile(path) {
    const fsPath = `${this.DOCROOT}${path}`;
    if (!this.php.fileExists(fsPath)) {
      return {
        body: "404 File not found",
        headers: {},
        statusCode: 404,
        exitCode: 0,
        rawError: ""
      };
    }
    const arrayBuffer = this.php.readFileAsBuffer(fsPath);
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
			// === EXPOSE THE RESPONSE INFORMATION TO PHPServer THROUGH STDERR ===
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

			// === POPULATE THE SUPERGLOBAL VARIABLES ===
			$request = (object) json_decode(<<<'REQUEST'
				${JSON.stringify({
        path: request.path,
        method: request.method || "GET",
        headers: request.headers || {},
        _GET: request._GET || "",
        _POST: request._POST || {},
        _FILES,
        _COOKIE: request._COOKIE || {},
        _SESSION: request._SESSION || {}
      })}
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

			fwrite($stdErr, json_encode(['session' => $_SESSION]) . "
");

			$docroot = ${JSON.stringify(this.DOCROOT)};

			$script  = ltrim($request->path, '/');

			$path = $request->path;
			$path = preg_replace('/^\\/php-wasm/', '', $path);

			$_SERVER['PATH']     = '/';
			$_SERVER['REQUEST_URI']     = $path . ($request->_GET ?: '');
			$_SERVER['HTTP_HOST']       = ${JSON.stringify(this.HOST)};
			$_SERVER['REMOTE_ADDR']     = ${JSON.stringify(this.HOSTNAME)};
			$_SERVER['SERVER_NAME']     = ${JSON.stringify(this.ABSOLUTE_URL)};
			$_SERVER['SERVER_PORT']     = ${JSON.stringify(this.PORT)};
			$_SERVER['HTTP_USER_AGENT'] = ${JSON.stringify(navigator.userAgent)};
			$_SERVER['SERVER_PROTOCOL'] = 'HTTP/1.1';
			$_SERVER['REQUEST_METHOD']  = $request->method;
			$_SERVER['SCRIPT_FILENAME'] = $docroot . '/' . $script;
			$_SERVER['SCRIPT_NAME']     = $docroot . '/' . $script;
			$_SERVER['PHP_SELF']        = $docroot . '/' . $script;
			$_SERVER['DOCUMENT_ROOT']   = '/';
			$_SERVER['HTTPS']           = ${JSON.stringify(this.ABSOLUTE_URL.startsWith("https://") ? "on" : "")};
			chdir($docroot);
			
			// === INCLUDE THE REQUESTED PHP FILE ===

			// Ensure the resolved path points to an existing file. If not,
			// let's fall back to index.php
			$candidate_path = $docroot . '/' . ltrim('${this.resolvePHPFilePath(request.path)}', '/');
			if ( file_exists( $candidate_path ) ) {
				require_once $candidate_path;
			} else {
				require_once $docroot . '/index.php';
			}
		`);
      return this.parseResponse(output);
    } finally {
      this.cleanup_FILES(_FILES);
    }
  }
  resolvePHPFilePath(requestedPath) {
    let filePath = this.withoutPathname(requestedPath);
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
      if (this.php.fileExists(value.tmp_name)) {
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

// packages/php-wasm/src/php-browser.js
var PHPBrowser = class {
  constructor(server, config = {}) {
    this.server = server;
    this.cookies = {};
    this.config = {
      handleRedirects: false,
      maxRedirects: 4,
      ...config
    };
  }
  async request(request, redirects = 0) {
    const response = await this.server.request({
      ...request,
      _COOKIE: this.cookies
    });
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

// packages/php-wasm/src/index.js
var phpJsHash = "";
