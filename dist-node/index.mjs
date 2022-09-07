// src/node/bootstrap.mjs
import fs from "fs";
import PHP from "./node-php.js";
import path from "path";

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
    console.log("WP request", request);
    const https = this.ABSOLUTE_URL.startsWith("https://") ? "on" : "";
    return `
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
			$_SERVER['REQUEST_URI']     = $path;
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
  _runWordPressCode(path4) {
    return `
		// The original version of this function crashes WASM WordPress, let's define an empty one instead.
		function wp_new_blog_notification(...$args){} 

		require_once '${this.DOCROOT}/' . ltrim('${path4}', '/');
		`;
  }
};

// src/node/bootstrap.mjs
import { fileURLToPath } from "node:url";
var __dirname = fileURLToPath(new URL(".", import.meta.url));
async function createWordPressClient(options = {}) {
  options = {
    preInit() {
    },
    phpWasmPath: `./node-php.wasm`,
    etcPath: path.join(__dirname, "etc"),
    wpPath: path.join(__dirname, "wordpress"),
    ...options
  };
  const php = new PHPWrapper();
  await php.init(PHP, {
    locateFile() {
      return fileURLToPath(new URL(options.phpWasmPath, import.meta.url));
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
  const wpdbFilePath = path.join(wpPath, "/wp-content/database/.ht.sqlite");
  try {
    fs.unlinkSync(wpdbFilePath);
  } catch (e) {
  }
  base64DecodeFile(base64FilePath, wpdbFilePath);
}
function base64DecodeFile(inputFile, outputFile) {
  const base64 = fs.readFileSync(inputFile, "utf8");
  const data = Buffer.from(base64, "base64");
  fs.writeFileSync(outputFile, data);
}

// src/node/express-server.mjs
import express from "express";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { existsSync } from "node:fs";
var __dirname2 = fileURLToPath2(new URL(".", import.meta.url));
async function startExpressServer(browser, port, options = {}) {
  options = {
    mounts: {},
    initialUrl: "/wp-login.php",
    ...options
  };
  const app = express();
  app.use(cookieParser());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.all("*", async (req, res) => {
    var _a;
    if (!browser.wp.initialized) {
      if ((_a = req.query) == null ? void 0 : _a.domain) {
        await browser.wp.init(new URL(req.query.domain).toString());
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
      console.log({ pathToUse });
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
          const filePath = path2.join(absoluteHostPath, req.path.replace(relativeWasmPath, ""));
          if (existsSync(filePath)) {
            res.sendFile(filePath);
            return;
          }
        }
      }
      res.sendFile(
        path2.join(__dirname2, "wordpress", req.path)
      );
    }
  });
  app.listen(port, async () => {
    console.log(`WordPress server is listening on port ${port}`);
  });
  return app;
}

// src/node/command.mjs
import yargs from "yargs";
import path3 from "path";
import { fileURLToPath as fileURLToPath3 } from "node:url";

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
var __dirname3 = fileURLToPath3(new URL(".", import.meta.url));
async function command(argv) {
  console.log("Starting server on port " + argv.port);
  initDatabaseFromBase64File(path3.join(__dirname3, "/base64-encoded-database"));
  const mounts = argv.mount.map((mount) => {
    try {
      const [relativeHostPath, relativeWasmPath] = mount.split(":");
      const absoluteHostPath = path3.isAbsolute(relativeHostPath) ? relativeHostPath : path3.resolve(process.cwd(), relativeHostPath);
      const absoluteWasmPath = path3.isAbsolute(relativeWasmPath) ? relativeWasmPath : path3.join("/preload/wordpress", relativeWasmPath);
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
var nodePath = path3.resolve(process.argv[1]);
var modulePath = path3.resolve(fileURLToPath3(import.meta.url));
var isRunningDirectlyViaCLI = nodePath === modulePath;
if (isRunningDirectlyViaCLI) {
  const argv = yargs(process.argv.slice(2)).command("server", "Starts a WordPress server").options({
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
export {
  command,
  createWordPressClient,
  initDatabaseFromBase64File,
  install,
  login,
  startExpressServer
};
