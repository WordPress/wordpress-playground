var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/xmlhttprequest/lib/XMLHttpRequest.js
var require_XMLHttpRequest = __commonJS({
  "node_modules/xmlhttprequest/lib/XMLHttpRequest.js"(exports) {
    var Url = require("url");
    var spawn = require("child_process").spawn;
    var fs2 = require("fs");
    exports.XMLHttpRequest = function() {
      "use strict";
      var self = this;
      var http = require("http");
      var https = require("https");
      var request;
      var response;
      var settings = {};
      var disableHeaderCheck = false;
      var defaultHeaders = {
        "User-Agent": "node-XMLHttpRequest",
        "Accept": "*/*"
      };
      var headers = {};
      var headersCase = {};
      var forbiddenRequestHeaders = [
        "accept-charset",
        "accept-encoding",
        "access-control-request-headers",
        "access-control-request-method",
        "connection",
        "content-length",
        "content-transfer-encoding",
        "cookie",
        "cookie2",
        "date",
        "expect",
        "host",
        "keep-alive",
        "origin",
        "referer",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "via"
      ];
      var forbiddenRequestMethods = [
        "TRACE",
        "TRACK",
        "CONNECT"
      ];
      var sendFlag = false;
      var errorFlag = false;
      var listeners = {};
      this.UNSENT = 0;
      this.OPENED = 1;
      this.HEADERS_RECEIVED = 2;
      this.LOADING = 3;
      this.DONE = 4;
      this.readyState = this.UNSENT;
      this.onreadystatechange = null;
      this.responseText = "";
      this.responseXML = "";
      this.status = null;
      this.statusText = null;
      this.withCredentials = false;
      var isAllowedHttpHeader = function(header) {
        return disableHeaderCheck || header && forbiddenRequestHeaders.indexOf(header.toLowerCase()) === -1;
      };
      var isAllowedHttpMethod = function(method) {
        return method && forbiddenRequestMethods.indexOf(method) === -1;
      };
      this.open = function(method, url, async, user, password) {
        this.abort();
        errorFlag = false;
        if (!isAllowedHttpMethod(method)) {
          throw new Error("SecurityError: Request method not allowed");
        }
        settings = {
          "method": method,
          "url": url.toString(),
          "async": typeof async !== "boolean" ? true : async,
          "user": user || null,
          "password": password || null
        };
        setState(this.OPENED);
      };
      this.setDisableHeaderCheck = function(state) {
        disableHeaderCheck = state;
      };
      this.setRequestHeader = function(header, value) {
        if (this.readyState !== this.OPENED) {
          throw new Error("INVALID_STATE_ERR: setRequestHeader can only be called when state is OPEN");
        }
        if (!isAllowedHttpHeader(header)) {
          console.warn('Refused to set unsafe header "' + header + '"');
          return;
        }
        if (sendFlag) {
          throw new Error("INVALID_STATE_ERR: send flag is true");
        }
        header = headersCase[header.toLowerCase()] || header;
        headersCase[header.toLowerCase()] = header;
        headers[header] = headers[header] ? headers[header] + ", " + value : value;
      };
      this.getResponseHeader = function(header) {
        if (typeof header === "string" && this.readyState > this.OPENED && response && response.headers && response.headers[header.toLowerCase()] && !errorFlag) {
          return response.headers[header.toLowerCase()];
        }
        return null;
      };
      this.getAllResponseHeaders = function() {
        if (this.readyState < this.HEADERS_RECEIVED || errorFlag) {
          return "";
        }
        var result = "";
        for (var i in response.headers) {
          if (i !== "set-cookie" && i !== "set-cookie2") {
            result += i + ": " + response.headers[i] + "\r\n";
          }
        }
        return result.substr(0, result.length - 2);
      };
      this.getRequestHeader = function(name) {
        if (typeof name === "string" && headersCase[name.toLowerCase()]) {
          return headers[headersCase[name.toLowerCase()]];
        }
        return "";
      };
      this.send = function(data) {
        if (this.readyState !== this.OPENED) {
          throw new Error("INVALID_STATE_ERR: connection must be opened before send() is called");
        }
        if (sendFlag) {
          throw new Error("INVALID_STATE_ERR: send has already been called");
        }
        var ssl = false, local = false;
        var url = Url.parse(settings.url);
        var host;
        switch (url.protocol) {
          case "https:":
            ssl = true;
          case "http:":
            host = url.hostname;
            break;
          case "file:":
            local = true;
            break;
          case void 0:
          case null:
          case "":
            host = "localhost";
            break;
          default:
            throw new Error("Protocol not supported.");
        }
        if (local) {
          if (settings.method !== "GET") {
            throw new Error("XMLHttpRequest: Only GET method is supported");
          }
          if (settings.async) {
            fs2.readFile(url.pathname, "utf8", function(error, data2) {
              if (error) {
                self.handleError(error);
              } else {
                self.status = 200;
                self.responseText = data2;
                setState(self.DONE);
              }
            });
          } else {
            try {
              this.responseText = fs2.readFileSync(url.pathname, "utf8");
              this.status = 200;
              setState(self.DONE);
            } catch (e) {
              this.handleError(e);
            }
          }
          return;
        }
        var port = url.port || (ssl ? 443 : 80);
        var uri = url.pathname + (url.search ? url.search : "");
        for (var name in defaultHeaders) {
          if (!headersCase[name.toLowerCase()]) {
            headers[name] = defaultHeaders[name];
          }
        }
        headers.Host = host;
        if (!(ssl && port === 443 || port === 80)) {
          headers.Host += ":" + url.port;
        }
        if (settings.user) {
          if (typeof settings.password === "undefined") {
            settings.password = "";
          }
          var authBuf = new Buffer(settings.user + ":" + settings.password);
          headers.Authorization = "Basic " + authBuf.toString("base64");
        }
        if (settings.method === "GET" || settings.method === "HEAD") {
          data = null;
        } else if (data) {
          headers["Content-Length"] = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
          if (!headers["Content-Type"]) {
            headers["Content-Type"] = "text/plain;charset=UTF-8";
          }
        } else if (settings.method === "POST") {
          headers["Content-Length"] = 0;
        }
        var options = {
          host,
          port,
          path: uri,
          method: settings.method,
          headers,
          agent: false,
          withCredentials: self.withCredentials
        };
        errorFlag = false;
        if (settings.async) {
          var doRequest = ssl ? https.request : http.request;
          sendFlag = true;
          self.dispatchEvent("readystatechange");
          var responseHandler = function responseHandler2(resp2) {
            response = resp2;
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307) {
              settings.url = response.headers.location;
              var url2 = Url.parse(settings.url);
              host = url2.hostname;
              var newOptions = {
                hostname: url2.hostname,
                port: url2.port,
                path: url2.path,
                method: response.statusCode === 303 ? "GET" : settings.method,
                headers,
                withCredentials: self.withCredentials
              };
              request = doRequest(newOptions, responseHandler2).on("error", errorHandler);
              request.end();
              return;
            }
            response.setEncoding("utf8");
            setState(self.HEADERS_RECEIVED);
            self.status = response.statusCode;
            response.on("data", function(chunk) {
              if (chunk) {
                self.responseText += chunk;
              }
              if (sendFlag) {
                setState(self.LOADING);
              }
            });
            response.on("end", function() {
              if (sendFlag) {
                setState(self.DONE);
                sendFlag = false;
              }
            });
            response.on("error", function(error) {
              self.handleError(error);
            });
          };
          var errorHandler = function errorHandler2(error) {
            self.handleError(error);
          };
          request = doRequest(options, responseHandler).on("error", errorHandler);
          if (data) {
            request.write(data);
          }
          request.end();
          self.dispatchEvent("loadstart");
        } else {
          var contentFile = ".node-xmlhttprequest-content-" + process.pid;
          var syncFile = ".node-xmlhttprequest-sync-" + process.pid;
          fs2.writeFileSync(syncFile, "", "utf8");
          var execString = "var http = require('http'), https = require('https'), fs = require('fs');var doRequest = http" + (ssl ? "s" : "") + ".request;var options = " + JSON.stringify(options) + ";var responseText = '';var req = doRequest(options, function(response) {response.setEncoding('utf8');response.on('data', function(chunk) {  responseText += chunk;});response.on('end', function() {fs.writeFileSync('" + contentFile + "', JSON.stringify({err: null, data: {statusCode: response.statusCode, headers: response.headers, text: responseText}}), 'utf8');fs.unlinkSync('" + syncFile + "');});response.on('error', function(error) {fs.writeFileSync('" + contentFile + "', JSON.stringify({err: error}), 'utf8');fs.unlinkSync('" + syncFile + "');});}).on('error', function(error) {fs.writeFileSync('" + contentFile + "', JSON.stringify({err: error}), 'utf8');fs.unlinkSync('" + syncFile + "');});" + (data ? "req.write('" + JSON.stringify(data).slice(1, -1).replace(/'/g, "\\'") + "');" : "") + "req.end();";
          var syncProc = spawn(process.argv[0], ["-e", execString]);
          while (fs2.existsSync(syncFile)) {
          }
          var resp = JSON.parse(fs2.readFileSync(contentFile, "utf8"));
          syncProc.stdin.end();
          fs2.unlinkSync(contentFile);
          if (resp.err) {
            self.handleError(resp.err);
          } else {
            response = resp.data;
            self.status = resp.data.statusCode;
            self.responseText = resp.data.text;
            setState(self.DONE);
          }
        }
      };
      this.handleError = function(error) {
        this.status = 0;
        this.statusText = error;
        this.responseText = error.stack;
        errorFlag = true;
        setState(this.DONE);
        this.dispatchEvent("error");
      };
      this.abort = function() {
        if (request) {
          request.abort();
          request = null;
        }
        headers = defaultHeaders;
        this.status = 0;
        this.responseText = "";
        this.responseXML = "";
        errorFlag = true;
        if (this.readyState !== this.UNSENT && (this.readyState !== this.OPENED || sendFlag) && this.readyState !== this.DONE) {
          sendFlag = false;
          setState(this.DONE);
        }
        this.readyState = this.UNSENT;
        this.dispatchEvent("abort");
      };
      this.addEventListener = function(event, callback) {
        if (!(event in listeners)) {
          listeners[event] = [];
        }
        listeners[event].push(callback);
      };
      this.removeEventListener = function(event, callback) {
        if (event in listeners) {
          listeners[event] = listeners[event].filter(function(ev) {
            return ev !== callback;
          });
        }
      };
      this.dispatchEvent = function(event) {
        if (typeof self["on" + event] === "function") {
          self["on" + event]();
        }
        if (event in listeners) {
          for (var i = 0, len = listeners[event].length; i < len; i++) {
            listeners[event][i].call(self);
          }
        }
      };
      var setState = function(state) {
        if (state == self.LOADING || self.readyState !== state) {
          self.readyState = state;
          if (settings.async || self.readyState < self.OPENED || self.readyState === self.DONE) {
            self.dispatchEvent("readystatechange");
          }
          if (self.readyState === self.DONE && !errorFlag) {
            self.dispatchEvent("load");
            self.dispatchEvent("loadend");
          }
        }
      };
    };
  }
});

// src/node/index.mjs
var node_exports = {};
__export(node_exports, {
  command: () => command,
  createWordPressClient: () => createWordPressClient,
  initDatabaseFromBase64File: () => initDatabaseFromBase64File,
  install: () => install,
  login: () => login,
  startExpressServer: () => startExpressServer
});
module.exports = __toCommonJS(node_exports);

// src/node/bootstrap.mjs
var import_fs = __toESM(require("fs"), 1);
var import_node_php = __toESM(require("../src/node/node-php.js"), 1);
var import_path = __toESM(require("path"), 1);

// src/shared/php-wrapper.mjs
var STR = "string";
var NUM = "number";
var PHPWrapper = class {
  _initPromise;
  call;
  stdout = [];
  stderr = [];
  async init(PhpBinary, args = {}) {
    if (!this._initPromise) {
      this._initPromise = this._init(PhpBinary, args);
    }
    return this._initPromise;
  }
  async _init(PhpBinary, args = {}) {
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
    const PHPModule = Object.assign({}, defaults, args);
    await new PhpBinary(PHPModule);
    this.call = PHPModule.ccall;
    await this.call("pib_init", NUM, [STR], []);
    return PHPModule;
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
  Promise.resolve().then(() => __toESM(require_XMLHttpRequest(), 1)).then(({ XMLHttpRequest: XMLHttpRequest2 }) => {
    global.XMLHttpRequest = XMLHttpRequest2;
  });
  global.atob = function(data) {
    return Buffer.from(data).toString("base64");
  };
}
var WordPress = class {
  DOCROOT = "/preload/wordpress";
  SCHEMA = "http";
  HOSTNAME = "localhost";
  PORT = 80;
  HOST = ``;
  ABSOLUTE_URL = ``;
  constructor(php) {
    this.php = php;
  }
  async init(urlString, options = {}) {
    this.options = {
      useFetchForRequests: false,
      ...options
    };
    const url = new URL(urlString);
    this.HOSTNAME = url.hostname;
    this.PORT = url.port ? url.port : url.protocol === "https:" ? 443 : 80;
    this.SCHEMA = (url.protocol || "").replace(":", "");
    this.HOST = `${this.HOSTNAME}:${this.PORT}`;
    this.ABSOLUTE_URL = `${this.SCHEMA}://${this.HOSTNAME}:${this.PORT}`;
    await this.php.refresh();
    const result = await this.php.run(`<?php
			${this._setupErrorReportingCode()}
			${this._patchWordPressCode()}
		`);
    this.initialized = true;
    if (result.exitCode !== 0) {
      throw new Error(
        {
          message: "WordPress setup failed",
          result
        },
        result.exitCode
      );
    }
  }
  async request(request) {
    if (!this.initialized) {
      throw new Error("call init() first");
    }
    const output = await this.php.run(`<?php
			${this._setupErrorReportingCode()}
			${this._setupRequestCode(request)}
			${this._runWordPressCode(request.path)}
		`);
    return this.parseResponse(output);
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
  _patchWordPressCode() {
    return `
			file_put_contents( "${this.DOCROOT}/.absolute-url", "${this.ABSOLUTE_URL}" );
			if ( ! file_exists( "${this.DOCROOT}/.wordpress-patched" ) ) {
				// Patching WordPress in the worker provides a faster feedback loop than
				// rebuilding it every time. Follow the example below to patch WordPress
				// before the first request is dispatched:
				//
				// file_put_contents(
				// 	'${this.DOCROOT}/wp-content/db.php',
				// 	str_replace(
				// 		'$exploded_parts = $values_data;',
				// 		'$exploded_parts = array( $values_data );',
				// 		file_get_contents('${this.DOCROOT}/wp-content/db.php')
				// 	)
				// );

				// WORKAROUND:
				// For some reason, the in-browser WordPress doesn't respect the site
				// URL preset during the installation. Also, it disables the block editing
				// experience by default.
				file_put_contents(
					'${this.DOCROOT}/wp-includes/plugin.php',
					file_get_contents('${this.DOCROOT}/wp-includes/plugin.php') . "
"
					.'add_filter( "option_home", function($url) { return getenv("HOST") ?: file_get_contents(__DIR__ . "/../.absolute-url"); }, 10000 );' . "
"
					.'add_filter( "option_siteurl", function($url) { return getenv("HOST") ?: file_get_contents(__DIR__."/../.absolute-url"); }, 10000 );' . "
"
				);

				// WORKAROUND:
				// The fsockopen transport erroneously reports itself as a working transport. Let's force
				// it to report it won't work.
				file_put_contents(
					'${this.DOCROOT}/wp-includes/Requests/Transport/fsockopen.php',
					str_replace(
						'public static function test',
						'public static function test( $capabilities = array() ) { return false; } public static function test2',
						file_get_contents( '${this.DOCROOT}/wp-includes/Requests/Transport/fsockopen.php' )
					)
				);
				file_put_contents(
					'${this.DOCROOT}/wp-includes/Requests/Transport/cURL.php',
					str_replace(
						'public static function test',
						'public static function test( $capabilities = array() ) { return false; } public static function test2',
						file_get_contents( '${this.DOCROOT}/wp-includes/Requests/Transport/cURL.php' )
					)
				);
				
				mkdir( '${this.DOCROOT}/wp-content/mu-plugins' );
				file_put_contents(
					'${this.DOCROOT}/wp-content/mu-plugins/requests_transport_fetch.php',
<<<'PATCH'
<?php
class Requests_Transport_Fetch implements Requests_Transport { public $headers = ''; public function __construct() { } public function __destruct() { } public function request( $url, $headers = array(), $data = array(), $options = array() ) { if ( str_contains( $url, '/wp-cron.php' ) ) { return false; } $headers = Requests::flatten( $headers ); if ( ! empty( $data ) ) { $data_format = $options['data_format']; if ( $data_format === 'query' ) { $url = self::format_get( $url, $data ); $data = ''; } elseif ( ! is_string( $data ) ) { $data = http_build_query( $data, null, '&' ); } } $request = json_encode( json_encode( array( 'headers' => $headers, 'data' => $data, 'url' => $url, 'method' => $options['type'], ) ) );
$js = <<<JAVASCRIPT
const request = JSON.parse({$request});
console.log("Requesting " + request.url);
const xhr = new XMLHttpRequest();
xhr.open(
	request.method,
	request.url,
	false // false makes the xhr synchronous
);
xhr.withCredentials = false;
for ( var name in request.headers ) {
	if(name.toLowerCase() !== "content-type") {
		// xhr.setRequestHeader(name, request.headers[name]);
	}
}
xhr.send(request.data);

[
	"HTTP/1.1 " + xhr.status + " " + xhr.statusText,
	xhr.getAllResponseHeaders(),
	"",
	xhr.responseText
].join("\\\\r\\\\n");
JAVASCRIPT;
$this->headers = vrzno_eval( $js ); return $this->headers; } public function request_multiple( $requests, $options ) { $responses = array(); $class = get_class( $this ); foreach ( $requests as $id => $request ) { try { $handler = new $class(); $responses[ $id ] = $handler->request( $request['url'], $request['headers'], $request['data'], $request['options'] ); $request['options']['hooks']->dispatch( 'transport.internal.parse_response', array( &$responses[ $id ], $request ) ); } catch ( Requests_Exception $e ) { $responses[ $id ] = $e; } if ( ! is_string( $responses[ $id ] ) ) { $request['options']['hooks']->dispatch( 'multiple.request.complete', array( &$responses[ $id ], $id ) ); } } return $responses; } protected static function format_get( $url, $data ) { if ( ! empty( $data ) ) { $query = ''; $url_parts = parse_url( $url ); if ( empty( $url_parts['query'] ) ) { $url_parts['query'] = ''; } else { $query = $url_parts['query']; } $query .= '&' . http_build_query( $data, null, '&' ); $query = trim( $query, '&' ); if ( empty( $url_parts['query'] ) ) { $url .= '?' . $query; } else { $url = str_replace( $url_parts['query'], $query, $url ); } } return $url; } public static function test( $capabilities = array() ) { if ( ! function_exists( 'vrzno_eval' ) ) { return false; } if ( vrzno_eval( "typeof XMLHttpRequest;" ) !== 'function' ) {  return false; } return true; } }

if(defined('USE_FETCH_FOR_REQUESTS') && USE_FETCH_FOR_REQUESTS) {
	Requests::add_transport( 'Requests_Transport_Fetch' );
}
PATCH
				);

                if ( false ) {
                    // Activate the development plugin.
                    $file_php_path = '${this.DOCROOT}/wp-includes/functions.php';
                    $file_php = file_get_contents($file_php_path);

                    if (strpos($file_php, "start-test-snippet") !== false) {
                        $file_php = substr($file_php, 0, strpos($file_php, "// start-test-snippet"));
                    }

                    $file_php .= <<<'ADMIN'
                        // start-test-snippet
                        add_action('init', function() {
                            require_once '${this.DOCROOT}/wp-admin/includes/plugin.php';
                            $plugin = 'my-plugin/my-plugin.php';
                            if(!is_plugin_active($plugin)) {
                                $result = activate_plugin( $plugin, '', is_network_admin() );
                                if ( is_wp_error( $result ) ) {
                                    if ( 'unexpected_output' === $result->get_error_code() ) {
                                        var_dump($result->get_error_data());
                                        die();
                                    } else {
                                        wp_die( $result );
                                    }
                                }
                            }
                        });
                        // end-test-snippet
ADMIN;

                    file_put_contents(
                        $file_php_path,
                        $file_php
                    );
                }
				touch("${this.DOCROOT}/.wordpress-patched");
			}
		`;
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
    path: path4 = "/wp-login.php",
    method = "GET",
    headers,
    _GET = "",
    _POST = {},
    _COOKIE = {},
    _SESSION = {}
  } = {}) {
    const request = {
      path: path4,
      method,
      headers,
      _GET,
      _POST,
      _COOKIE,
      _SESSION
    };
    console.log("Incoming request: ", request.path);
    const https = this.ABSOLUTE_URL.startsWith("https://") ? "on" : "";
    return `
			define('USE_FETCH_FOR_REQUESTS', ${this.options.useFetchForRequests ? "true" : "false"});
			define('WP_HOME', '${this.DOCROOT}');
			$request = (object) json_decode(
				'${JSON.stringify(request)}'
				, JSON_OBJECT_AS_ARRAY
			);

			parse_str(substr($request->_GET, 1), $_GET);

			$_POST = $request->_POST;

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
  _runWordPressCode(requestPath) {
    let filePath = requestPath;
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
    return `
		// The original version of this function crashes WASM WordPress, let's define an empty one instead.
		function wp_new_blog_notification(...$args){} 

		// Ensure the resolved path points to an existing file. If not,
		// let's fall back to index.php
		$candidate_path = '${this.DOCROOT}/' . ltrim('${filePath}', '/');
		if ( file_exists( $candidate_path ) ) {
			require_once $candidate_path;
		} else {
			require_once '${this.DOCROOT}/index.php';
		}
		`;
  }
};

// src/node/bootstrap.mjs
var import_node_url = require("node:url");
var import_meta = {};
__dirname = __dirname || (0, import_node_url.fileURLToPath)(new URL(".", import_meta.url));
async function createWordPressClient(options = {}) {
  options = {
    preInit() {
    },
    phpWasmPath: `./node-php.wasm`,
    etcPath: import_path.default.join(__dirname, "etc"),
    wpPath: import_path.default.join(__dirname, "wordpress"),
    ...options
  };
  const php = new PHPWrapper();
  await php.init(import_node_php.default, {
    locateFile() {
      return import_path.default.join(__dirname, options.phpWasmPath);
    },
    onPreInit(FS, NODEFS) {
      FS.mkdirTree("/usr/local/etc");
      FS.mount(NODEFS, { root: options.etcPath }, "/usr/local/etc");
      FS.mkdirTree("/preload/wordpress");
      FS.mount(NODEFS, { root: options.wpPath }, "/preload/wordpress");
      options.preInit(FS, NODEFS);
    }
  });
  return new WordPress(php);
}
async function install(browser, siteUrl, options = {}) {
  options = {
    siteTitle: "WordPress",
    username: "admin",
    password: "password",
    email: "admin@localhost.com",
    ...options
  };
  await browser.request({
    path: "/wp-admin/install.php"
  });
  return await browser.request({
    path: "/wp-admin/install.php",
    method: "POST",
    headers: {
      siteUrl,
      "content-type": "application/x-www-form-urlencoded"
    },
    _GET: "?step=2",
    _POST: {
      weblog_title: options.siteTitle,
      user_name: options.username,
      admin_password: options.password,
      admin_password2: options.password,
      admin_email: options.email,
      Submit: "Install WordPress",
      language: ""
    }
  });
}
async function login(browser, username = "admin", password = "password") {
  await browser.request({
    path: "/wp-login.php"
  });
  await browser.request({
    path: "/wp-login.php",
    method: "POST",
    _POST: {
      log: username,
      pwd: password,
      rememberme: "forever"
    }
  });
}
function initDatabaseFromBase64File(base64FilePath, wpPath = __dirname + "/wordpress") {
  const wpdbFilePath = import_path.default.join(wpPath, "/wp-content/database/.ht.sqlite");
  try {
    import_fs.default.unlinkSync(wpdbFilePath);
  } catch (e) {
  }
  base64DecodeFile(base64FilePath, wpdbFilePath);
}
function base64DecodeFile(inputFile, outputFile) {
  const base64 = import_fs.default.readFileSync(inputFile, "utf8");
  const data = Buffer.from(base64, "base64");
  import_fs.default.writeFileSync(outputFile, data);
}

// src/node/express-server.mjs
var import_express = __toESM(require("express"), 1);
var import_cookie_parser = __toESM(require("cookie-parser"), 1);
var import_body_parser = __toESM(require("body-parser"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_node_url2 = require("node:url");
var import_node_fs = require("node:fs");
var import_meta2 = {};
__dirname = __dirname || (0, import_node_url2.fileURLToPath)(new URL(".", import_meta2.url));
async function startExpressServer(browser, port, options = {}) {
  options = {
    mounts: {},
    initialUrl: "/wp-admin/index.php",
    ...options
  };
  const app = (0, import_express.default)();
  app.use((0, import_cookie_parser.default)());
  app.use(import_body_parser.default.urlencoded({ extended: true }));
  app.all("*", async (req, res) => {
    var _a;
    if (!browser.wp.initialized) {
      if ((_a = req.query) == null ? void 0 : _a.domain) {
        await browser.wp.init(
          new URL(req.query.domain).toString(),
          { useFetchForRequests: true }
        );
        await login(browser, "admin", "password");
        res.status(302);
        res.setHeader("location", options.initialUrl);
        res.end();
      } else {
        res.setHeader("content-type", "text/html");
        res.send(
          `<!DOCTYPE html><html><head><script>window.location.href = '/?domain=' + encodeURIComponent(window.location.href);<\/script></head></html>`
        );
        res.end();
      }
      return;
    }
    if (req.path.endsWith(".php") || req.path.endsWith("/")) {
      const parsedUrl = new URL(req.url, browser.wp.ABSOLUTE_URL);
      const pathToUse = parsedUrl.pathname.replace("/preload/wordpress", "");
      const wpResponse = await browser.request({
        path: pathToUse,
        method: req.method,
        headers: req.headers,
        _GET: parsedUrl.search,
        _POST: req.body
      });
      for (const [key, values] of Object.entries(wpResponse.headers)) {
        res.setHeader(key, values);
      }
      if ("location" in wpResponse.headers) {
        res.status(302);
        res.end();
      } else {
        if (wpResponse.statusCode) {
          res.status(wpResponse.statusCode);
        }
        res.send(wpResponse.body);
      }
    } else {
      for (let { absoluteHostPath, relativeWasmPath } of options.mounts) {
        if (relativeWasmPath.startsWith("./")) {
          relativeWasmPath = relativeWasmPath.slice(1);
        }
        if (!relativeWasmPath.startsWith("/")) {
          relativeWasmPath = "/" + relativeWasmPath;
        }
        if (!relativeWasmPath.endsWith("/")) {
          relativeWasmPath = relativeWasmPath + "/";
        }
        if (req.path.startsWith(relativeWasmPath)) {
          const filePath = import_path2.default.join(absoluteHostPath, req.path.replace(relativeWasmPath, ""));
          if ((0, import_node_fs.existsSync)(filePath)) {
            res.sendFile(filePath);
            return;
          }
        }
      }
      res.sendFile(
        import_path2.default.join(__dirname, "wordpress", req.path)
      );
    }
  });
  app.listen(port, async () => {
    console.log(`WordPress server is listening on port ${port}`);
  });
  return app;
}

// src/node/command.mjs
var import_yargs = __toESM(require("yargs"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_node_url3 = require("node:url");

// src/shared/wp-browser.mjs
var WPBrowser = class {
  constructor(wp, config = {}) {
    this.wp = wp;
    this.cookies = {};
    this.config = {
      handleRedirects: false,
      maxRedirects: 4,
      ...config
    };
  }
  async request(request, redirects = 0) {
    const response = await this.wp.request({
      ...request,
      _COOKIE: this.cookies
    });
    if (response.headers["set-cookie"]) {
      this.setCookies(response.headers["set-cookie"]);
    }
    if (this.config.handleRedirects && response.headers.location && redirects < this.config.maxRedirects) {
      const parsedUrl = new URL(response.headers.location[0], this.wp.ABSOLUTE_URL);
      return this.request({
        path: parsedUrl.pathname,
        method: "GET",
        _GET: parsedUrl.search,
        headers: {}
      }, redirects + 1);
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

// src/node/command.mjs
var import_meta3 = {};
__dirname = __dirname || (0, import_node_url3.fileURLToPath)(new URL(".", import_meta3.url));
async function command(argv) {
  console.log("Starting server on port " + argv.port);
  initDatabaseFromBase64File(import_path3.default.join(__dirname, "/base64-encoded-database"));
  const mounts = argv.mount.map((mount) => {
    try {
      const [relativeHostPath, relativeWasmPath] = mount.split(":");
      const absoluteHostPath = import_path3.default.isAbsolute(relativeHostPath) ? relativeHostPath : import_path3.default.resolve(process.cwd(), relativeHostPath);
      const absoluteWasmPath = import_path3.default.isAbsolute(relativeWasmPath) ? relativeWasmPath : import_path3.default.join("/preload/wordpress", relativeWasmPath);
      return { absoluteHostPath, absoluteWasmPath, relativeHostPath, relativeWasmPath };
    } catch (e) {
      console.error(`Failed to mount ${mount}`);
      process.exit(0);
    }
  });
  const wp = await createWordPressClient({
    preInit(FS, NODE_FS) {
      for (const { absoluteHostPath, absoluteWasmPath } of mounts) {
        FS.mkdirTree(absoluteWasmPath);
        FS.mount(NODE_FS, { root: absoluteHostPath }, absoluteWasmPath);
      }
    }
  });
  const browser = new WPBrowser(wp);
  return await startExpressServer(browser, argv.port, {
    mounts,
    initialUrl: argv.initialUrl
  });
}
var nodePath = import_path3.default.resolve(process.argv[1]);
var modulePath = __dirname ? `${__filename}` : import_path3.default.resolve((0, import_node_url3.fileURLToPath)(import_meta3.url));
var isRunningDirectlyViaCLI = nodePath === modulePath;
if (isRunningDirectlyViaCLI) {
  const argv = (0, import_yargs.default)(process.argv.slice(2)).command("server", "Starts a WordPress server").options({
    port: {
      type: "number",
      default: 9854,
      describe: "Port to listen on"
    },
    initialUrl: {
      type: "string",
      default: "/wp-admin/index.php",
      describe: "The first URL to navigate to."
    },
    mount: {
      type: "array",
      default: [],
      describe: "Paths to mount in the WASM runtime filesystem. Format: <host-path>:<wasm-path>. Based on the current working directory on host, and WordPress root directory in the WASM runtime."
    }
  }).help().alias("help", "h").argv;
  command(argv);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  command,
  createWordPressClient,
  initDatabaseFromBase64File,
  install,
  login,
  startExpressServer
});
/**
 * Wrapper for built-in http.js to emulate the browser XMLHttpRequest object.
 *
 * This can be used with JS designed for browsers to improve reuse of code and
 * allow the use of existing libraries.
 *
 * Usage: include("XMLHttpRequest.js") and use XMLHttpRequest per W3C specs.
 *
 * @author Dan DeFelippi <dan@driverdan.com>
 * @contributor David Ellis <d.f.ellis@ieee.org>
 * @license MIT
 */
