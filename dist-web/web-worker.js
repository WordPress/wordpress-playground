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

  // src/shared/wordpress.mjs
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
    async init(urlString) {
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
      console.log(request);
      if (request.path.endsWith("/")) {
        request.path += "index.php";
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
				touch("${this.DOCROOT}/.wordpress-patched");
				
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
                // For some reason, the in-browser WordPress is eager to redirect the
				// browser to http://127.0.0.1 when the site URL is http://127.0.0.1:8000.
				file_put_contents(
					'${this.DOCROOT}/wp-includes/canonical.php',
					str_replace(
						'function redirect_canonical( $requested_url = null, $do_redirect = true ) {',
						'function redirect_canonical( $requested_url = null, $do_redirect = true ) {return;',
						file_get_contents('${this.DOCROOT}/wp-includes/canonical.php')
					)
				);

				// WORKAROUND:
                // For some reason, the in-browser WordPress doesn't respect the site
				// URL preset during the installation. Also, it disables the block editing
				// experience by default.
				file_put_contents(
					'${this.DOCROOT}/wp-includes/plugin.php',
					file_get_contents('${this.DOCROOT}/wp-includes/plugin.php') . "
"
					.'add_filter( "option_home", function($url) { return file_get_contents("${this.DOCROOT}/.absolute-url"); }, 10000 );' . "
"
					.'add_filter( "option_siteurl", function($url) { return file_get_contents("${this.DOCROOT}/.absolute-url"); }, 10000 );' . "
"
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
			}
		`;
    }
    _setupErrorReportingCode() {
      return `
			$stdErr = fopen('php://stderr', 'w');
			$errors = [];
			register_shutdown_function(function() use($stdErr){
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
      console.log("WP request", request);
      const https = this.ABSOLUTE_URL.startsWith("https://") ? "on" : "";
      return `
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
			$_SERVER['REQUEST_URI']     = $path;
			$_SERVER['HTTP_HOST']       = '${this.HOST}';
			$_SERVER['REMOTE_ADDR']     = '${this.HOSTNAME}';
			$_SERVER['SERVER_NAME']     = '${this.ABSOLUTE_URL}';
			$_SERVER['SERVER_PORT']     = ${this.PORT};
			$_SERVER['REQUEST_METHOD']  = $request->method;
			$_SERVER['SCRIPT_FILENAME'] = $docroot . '/' . $script;
			$_SERVER['SCRIPT_NAME']     = $docroot . '/' . $script;
			$_SERVER['PHP_SELF']        = $docroot . '/' . $script;
			$_SERVER['DOCUMENT_ROOT']   = '/';
			$_SERVER['HTTPS']           = '${https}';
			chdir($docroot);
		`;
    }
    _runWordPressCode(path) {
      return `
		require_once '${this.DOCROOT}/' . ltrim('${path}', '/');
		`;
    }
  };

  // src/web/web-worker.js
  var WPBrowser = class {
    constructor(wp) {
      this.wp = wp;
      this.cookies = {};
    }
    async request(request, redirects = 0) {
      const response = await this.wp.request({
        ...request,
        _COOKIE: this.cookies
      });
      if (response.headers["set-cookie"]) {
        this.setCookies(response.headers["set-cookie"]);
      }
      if (response.headers.location && redirects < 4) {
        console.log("WP RESPONSE", response);
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
  if ("function" === typeof importScripts) {
    console.log("[WebWorker] Spawned");
    document = {};
    importScripts("/php-web.js");
    let isReady = false;
    async function init() {
      const php = new PHPWrapper();
      await php.init(PHP, {
        async onPreInit(FS, phpModule) {
          globalThis.PHPModule = phpModule;
          importScripts("/wp.js");
          importScripts("/wp-lazy-files.js");
          setupLazyFiles(FS);
          FS.mkdirTree("/usr/local/etc");
          FS.createLazyFile("/usr/local/etc", "php.ini", "/etc/php.ini", true, false);
        }
      });
      const wp = new WordPress(php);
      await wp.init(location.href);
      isReady = true;
      postMessage({
        type: "ready"
      });
      return new WPBrowser(wp);
    }
    const browser = init();
    const workerChannel = new BroadcastChannel("wordpress-service-worker");
    workerChannel.addEventListener("message", async (event) => {
      console.debug(`[WebWorker] "${event.data.type}" event received`);
      const _browser = await browser;
      let result;
      if (event.data.type === "run_php") {
        result = await _browser.wp.php.run(event.data.code);
      } else if (event.data.type === "request" || event.data.type === "httpRequest") {
        const parsedUrl = new URL(event.data.request.path, _browser.wp.ABSOLUTE_URL);
        console.log(parsedUrl);
        result = await _browser.request({
          ...event.data.request,
          path: parsedUrl.pathname,
          _GET: parsedUrl.search
        });
      } else if (event.data.type === "is_ready") {
        workerChannel.postMessage({
          type: "response",
          result: isReady,
          requestId: event.data.requestId
        });
        return;
      } else {
        console.debug(`[WebWorker] "${event.data.type}" event has no handler, short-circuiting`);
        return;
      }
      if (event.data.requestId) {
        workerChannel.postMessage({
          type: "response",
          result,
          requestId: event.data.requestId
        });
      }
      console.debug(`[WebWorker] "${event.data.type}" event processed`);
    });
  }
})();
