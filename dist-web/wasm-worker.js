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
      path = "/wp-login.php",
      method = "GET",
      headers,
      _GET = "",
      _POST = {},
      _COOKIE = {},
      _SESSION = {}
    } = {}) {
      const request = {
        path,
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

  // src/shared/messaging.mjs
  function responseTo(messageId, result) {
    return {
      type: "response",
      messageId,
      result
    };
  }

  // src/web/wasm-worker.js
  console.log("[WASM Worker] Spawned");
  var IS_IFRAME = typeof window !== "undefined";
  var IS_SHARED_WORKER = typeof SharedWorkerGlobalScope !== "undefined" && self instanceof SharedWorkerGlobalScope;
  var IS_WEBWORKER = !IS_SHARED_WORKER && typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
  console.log("[WASM Worker] Environment", {
    IS_IFRAME,
    IS_WEBWORKER,
    IS_SHARED_WORKER
  });
  if (IS_IFRAME) {
    window.importScripts = function(...urls) {
      for (const url of urls) {
        const script = document.createElement("script");
        script.src = url;
        document.body.appendChild(script);
      }
    };
  }
  if (IS_IFRAME) {
    importScripts("/php-web.js");
    window.addEventListener(
      "message",
      (event) => handleMessageEvent(
        event,
        (response) => event.source.postMessage(response, "*")
      ),
      false
    );
  } else if (IS_WEBWORKER) {
    importScripts("/php-webworker.js");
    onmessage = (event) => {
      handleMessageEvent(
        event,
        postMessage
      );
    };
  } else if (IS_SHARED_WORKER) {
    importScripts("/php-webworker.js");
    self.onconnect = (e) => {
      const port = e.ports[0];
      port.addEventListener("message", (event) => {
        handleMessageEvent(
          event,
          (r) => port.postMessage(r)
        );
      });
      port.start();
    };
  }
  async function handleMessageEvent(event, respond) {
    console.debug(`[WASM Worker] "${event.data.type}" event received`, event);
    const result = await generateResponseForMessage(event.data);
    if (event.data.messageId) {
      respond(
        responseTo(
          event.data.messageId,
          result
        )
      );
    }
    console.debug(`[WASM Worker] "${event.data.type}" event processed`);
  }
  var wpBrowser;
  async function generateResponseForMessage(message) {
    if (message.type === "initialize_wordpress") {
      wpBrowser = await initWPBrowser(message.siteURL);
      return true;
    }
    if (message.type === "is_alive") {
      return true;
    }
    if (message.type === "run_php") {
      return await wpBrowser.wp.php.run(message.code);
    }
    if (message.type === "request" || message.type === "httpRequest") {
      const parsedUrl = new URL(message.request.path, wpBrowser.wp.ABSOLUTE_URL);
      return await wpBrowser.request({
        ...message.request,
        path: parsedUrl.pathname,
        _GET: parsedUrl.search
      });
    }
    console.debug(`[WASM Worker] "${message.type}" event has no handler, short-circuiting`);
  }
  async function initWPBrowser(siteUrl) {
    const php = new PHPWrapper();
    console.log("[WASM Worker] Before wp.init()");
    await php.init(PHP, {
      async onPreInit(FS, phpModule) {
        globalThis.PHPModule = phpModule;
        importScripts("/wp.js");
        FS.mkdirTree("/usr/local/etc");
        FS.writeFile("/usr/local/etc/php.ini", `[PHP]

			error_reporting = E_ERROR | E_PARSE
			display_errors = 1
			html_errors = 1
			display_startup_errors = On
			`);
      }
    });
    const wp = new WordPress(php);
    await wp.init(siteUrl);
    console.log("[WASM Worker] After wp.init()");
    return new WPBrowser(wp, { handleRedirects: true });
  }
})();
