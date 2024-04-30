# Changelog

All notable changes to this project are documented in this file by a CI job
that runs on every NPM release. The file follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
format.

## [v0.7.2] (2024-04-29)

### **Breaking Changes**

-   PHP: Remove setSapiName, setPhpIniEntry, setPhpIniPath methods from the remote PHP API client. ([1321](https://github.com/WordPress/wordpress-playground/pull/1321))
-   Remove the wp-playground/node package. ([1323](https://github.com/WordPress/wordpress-playground/pull/1323))

#### PHP WebAssembly

-   Breaking: Loopback Request Support. ([1287](https://github.com/WordPress/wordpress-playground/pull/1287))

### Tools

-   Centralize log storage. ([1315](https://github.com/WordPress/wordpress-playground/pull/1315))

### Documentation

-   Link to Installing Nx Globally in the README. ([1325](https://github.com/WordPress/wordpress-playground/pull/1325))

### PHP WebAssembly

-   Add PHPResponse.forHttpCode() shorthand. ([1322](https://github.com/WordPress/wordpress-playground/pull/1322))
-   Asyncify: List ZEND_FETCH_OBJ_R_SPEC_CV_CV_HANDLER. ([1342](https://github.com/WordPress/wordpress-playground/pull/1342))
-   Curl extension for the Node.js build of PHP.wasm. ([1273](https://github.com/WordPress/wordpress-playground/pull/1273))
-   Explore curl support. ([1133](https://github.com/WordPress/wordpress-playground/pull/1133))
-   PHP Process Manager. ([1301](https://github.com/WordPress/wordpress-playground/pull/1301))
-   PHPProcessManager: Clear nextInstance when the concurrency limit is exhausted. ([1324](https://github.com/WordPress/wordpress-playground/pull/1324))
-   Spawn handler: Wrap the program call with try/catch, exit gracefully on error. ([1320](https://github.com/WordPress/wordpress-playground/pull/1320))

### Website

-   Add initial workflow for deploying the website to WP Cloud. ([1293](https://github.com/WordPress/wordpress-playground/pull/1293))

-   Eliminate 404s due to nested files-to-serve-via-php dir. ([1333](https://github.com/WordPress/wordpress-playground/pull/1333))
-   Stop WP rewrite rules from matching files like wp-admin.css. ([1317](https://github.com/WordPress/wordpress-playground/pull/1317))
-   Stop using PHP to serve most static files on WP Cloud. ([1331](https://github.com/WordPress/wordpress-playground/pull/1331))
-   WP Cloud: Relay secrets for error logger. ([1337](https://github.com/WordPress/wordpress-playground/pull/1337))

#### Documentation

-   Document WP Cloud website setup. ([1338](https://github.com/WordPress/wordpress-playground/pull/1338))

### Reliability

-   Add log methods, log handlers, and separate log collection. ([1264](https://github.com/WordPress/wordpress-playground/pull/1264))

### Contributors

The following contributors merged PRs in this release:

@adamziel @bgrgicak @brandonpayton @juanmaguitar @mho22

## [v0.7.1] (2024-04-24)

## [v0.7.0] (2024-04-24)

### **Breaking Changes**

#### PHP WebAssembly

-   Breaking: Remove PHPBrowser. ([#1302](https://github.com/WordPress/wordpress-playground/pull/1302))

### Enhancements

-   Bump TypeScript to 5.4.5. ([#1299](https://github.com/WordPress/wordpress-playground/pull/1299))
-   Semaphore: Add timeout option. ([#1300](https://github.com/WordPress/wordpress-playground/pull/1300))

### Blueprints

-   Builder: Fix stuck loader bar. ([#1284](https://github.com/WordPress/wordpress-playground/pull/1284))
-   Remove setPhpIniEntry step. ([#1288](https://github.com/WordPress/wordpress-playground/pull/1288))

### Tools

#### GitHub integration

-   GitHub: Don't delete all the files when exporting a theme. ([#1308](https://github.com/WordPress/wordpress-playground/pull/1308))
-   Urlencode branch name. ([#1275](https://github.com/WordPress/wordpress-playground/pull/1275))

#### Blueprints

-   Blueprints builder: Support ?blueprint-url. ([#1309](https://github.com/WordPress/wordpress-playground/pull/1309))

### Documentation

-   Use new learning resources in Playground documentation. ([#1276](https://github.com/WordPress/wordpress-playground/pull/1276))

### PHP WebAssembly

-   Browser: Remove setSpawnHandler function from the public API. ([#1303](https://github.com/WordPress/wordpress-playground/pull/1303))
-   PHP: Add a cwd argument to hotSwapPHPRuntime(). ([#1304](https://github.com/WordPress/wordpress-playground/pull/1304))
-   PHP: Remove addServerGlobalEntry() method, accept $\_SERVER as php.run() property. ([#1286](https://github.com/WordPress/wordpress-playground/pull/1286))
-   PHPRequestHandler: Add a generic PHP argument. ([#1310](https://github.com/WordPress/wordpress-playground/pull/1310))
-   nit: Clean up after node PHP popen() test. ([#1280](https://github.com/WordPress/wordpress-playground/pull/1280))

### Website

-   Add more info to crash reports. ([#1253](https://github.com/WordPress/wordpress-playground/pull/1253))
-   Memoize fetch() responses when requesting php.wasm. ([#1306](https://github.com/WordPress/wordpress-playground/pull/1306))
-   Progress monitoring: Use a custom instantiateWasm handler to avoid monkey-patching WebAssembly.instantiateStreaming. ([#1305](https://github.com/WordPress/wordpress-playground/pull/1305))
-   Remove sandbox attribute from iframe. ([#1313](https://github.com/WordPress/wordpress-playground/pull/1313))
-   Service Worker: Fetch credentialless to play more nicely with server caches (#1311). ([#1311](https://github.com/WordPress/wordpress-playground/pull/1311))

### Internal

-   Automate Changelog generation after each npm release. ([#1312](https://github.com/WordPress/wordpress-playground/pull/1312))
-   CI: Fix intermittent documentation build failures. ([#1307](https://github.com/WordPress/wordpress-playground/pull/1307))

### Bug Fixes

-   Add styles to ensure `iframes` are responsive. ([#1267](https://github.com/WordPress/wordpress-playground/pull/1267))
-   Docs: Fix the Blueprint example of the Gutenberg PR preview. ([#1268](https://github.com/WordPress/wordpress-playground/pull/1268))
-   Docs: Move Steps Shorthands to a separate page to fix Steps TOC. ([#1265](https://github.com/WordPress/wordpress-playground/pull/1265))

### Reliability

-   Add network error message. ([#1281](https://github.com/WordPress/wordpress-playground/pull/1281))
-   Explore logging to a file. ([#1292](https://github.com/WordPress/wordpress-playground/pull/1292))

### Various

-   Add PDF to infer mime type list. ([#1298](https://github.com/WordPress/wordpress-playground/pull/1298))

### Contributors

The following contributors merged PRs in this release:

@adamziel @bgrgicak @brandonpayton @ironnysh @peeranat-dan

## [v0.6.16] (2024-04-17)

### Blueprints

-   Replace set_current_user call with wp_set_current_user to fix a PHP notice. ([#1262](https://github.com/WordPress/playground/pull/1262))

### Tools

-   Install themes and plugins using the ReadableStream API. ([#919](https://github.com/WordPress/playground/pull/919))

### Documentation

-   Docs: Update WordPress versions used in the documentation, document using older releases. ([#1235](https://github.com/WordPress/playground/pull/1235))

### PHP WebAssembly

-   Filter Requests library to use the Fetch handler. ([#1048](https://github.com/WordPress/playground/pull/1048))

-   PHP: Handle request errors in PHPRequestHandler, return response code 500. ([#1249](https://github.com/WordPress/playground/pull/1249))
-   PHP: Reset exit code before dispatching a request. ([#1251](https://github.com/WordPress/playground/pull/1251))

### Various

-   Add documentation for `shorthand` alternatives of Blueprint steps. ([#1261](https://github.com/WordPress/playground/pull/1261))

### Contributors

The following contributors merged PRs in this release:

@adamziel @dd32 @ironnysh @kozer

## [v0.6.15] (2024-04-16)

### Blueprints

-   Add ifAlreadyInstalled to installPlugin and installTheme steps. ([#1244](https://github.com/WordPress/playground/pull/1244))
-   Support a landingPage value without the initial slash. ([#1227](https://github.com/WordPress/playground/pull/1227))

### PHP WebAssembly

-   Investigate OOB: Run unit tests with instrumented PHP 8.0 code. ([#1220](https://github.com/WordPress/playground/pull/1220))
-   Unit tests: Restore site-data.spec.ts. ([#1194](https://github.com/WordPress/playground/pull/1194))
-   Web PHP: Increase memory limit to 256 M. ([#1232](https://github.com/WordPress/playground/pull/1232))

### Website

-   Browser: Display PHP output when Fatal Error is trigerred. ([#1234](https://github.com/WordPress/playground/pull/1234))
-   Fix accessibility issues found by Axe. ([#1246](https://github.com/WordPress/playground/pull/1246))
-   Request Handler: Urldecode the requested path. ([#1228](https://github.com/WordPress/playground/pull/1228))

### Bug Fixes

-   fix: Set required engine version to 18.18.0. ([#1214](https://github.com/WordPress/playground/pull/1214))

### Various

-   Blueprints/json example. ([#1188](https://github.com/WordPress/playground/pull/1188))
-   Doc: Update 01-index.md. ([#1216](https://github.com/WordPress/playground/pull/1216))
-   Move DefineSiteUrlStep doc warning so it displays in documentation. ([#1245](https://github.com/WordPress/playground/pull/1245))
-   Updated link to native WordPress importer. ([#1243](https://github.com/WordPress/playground/pull/1243))
-   documentation update proposal: Provide more info on features, extensions?. ([#1208](https://github.com/WordPress/playground/pull/1208))
-   php-wasm/node: Update express to newest version, and move it to devDependencies. ([#1218](https://github.com/WordPress/playground/pull/1218))

### Contributors

The following contributors merged PRs in this release:

@adamziel @artpi @bph @brandonpayton @eliot-akira @flexseth @ironnysh @kirjavascript

## [v0.6.14] (2024-04-11)

### Bug Fixes

-   Revert changes to the documentation build. ([#1226](https://github.com/WordPress/playground/pull/1226))

### Reliability

-   Update error modal description label. ([#1224](https://github.com/WordPress/playground/pull/1224))

### Various

-   Try memory leak workaround with zeroed mem. ([#1229](https://github.com/WordPress/playground/pull/1229))

### Contributors

The following contributors merged PRs in this release:

@adamziel @bgrgicak @brandonpayton

## [v0.6.13] (2024-04-10)

### PHP WebAssembly

-   Try to repro memory out of bounds errors in CI. ([#1199](https://github.com/WordPress/playground/pull/1199))

### Bug Fixes

-   Fix docs-site build. ([#1222](https://github.com/WordPress/playground/pull/1222))

### Contributors

The following contributors merged PRs in this release:

@bgrgicak @brandonpayton

## [v0.6.11] (2024-04-09)

### Tools

-   Avoid Service Worker update issues on localhost. ([#1209](https://github.com/WordPress/playground/pull/1209))

#### Import/Export

-   importWxr: Preserve backslashes in the imported content. ([#1213](https://github.com/WordPress/playground/pull/1213))

### PHP WebAssembly

-   Catch DNS errors to avoid unhandled exceptions. ([#1215](https://github.com/WordPress/playground/pull/1215))

-   Revert "Avoid partial munmap memory leak". ([#1195](https://github.com/WordPress/playground/pull/1195))
-   Try to repro memory out of bounds errors in CI. ([#1198](https://github.com/WordPress/playground/pull/1198))

### Various

-   Adjust link to LICENSE file. ([#1210](https://github.com/WordPress/playground/pull/1210))
-   Try to reproduce the memory access error with files from 096a017. ([#1212](https://github.com/WordPress/playground/pull/1212))

### Contributors

The following contributors merged PRs in this release:

@adamziel @brandonpayton @emmanuel-ferdman @fluiddot

## [v0.6.10] (2024-04-04)

### Blueprints

-   Rename importFile to importWxr, switch to humanmade/WordPress importer. ([#1192](https://github.com/WordPress/playground/pull/1192))

### Tools

#### Blueprints

-   Explorations: Stream API. ([#851](https://github.com/WordPress/playground/pull/851))

### PHP WebAssembly

-   Avoid partial munmap memory leak. ([#1189](https://github.com/WordPress/playground/pull/1189))

### Website

-   Make kitchen sink extension bundle the default. ([#1191](https://github.com/WordPress/playground/pull/1191))

### Bug Fixes

-   Fix cross-device mv by switching to copy. ([#846](https://github.com/WordPress/playground/pull/846))

### Contributors

The following contributors merged PRs in this release:

@adamziel @brandonpayton @seanmorris

## [v0.6.9] (2024-04-03)

### Tools

-   Devex: Expose window.playground for quick testing and debugging. ([#1125](https://github.com/WordPress/playground/pull/1125))

#### GitHub integration

-   Website: Query API options to preconfigure the GitHub export form. ([#1174](https://github.com/WordPress/playground/pull/1174))

### Documentation

-   Update the wp-cli step code example. ([#1140](https://github.com/WordPress/playground/pull/1140))

### PHP WebAssembly

-   Add PHP iterator and yield support. ([#1181](https://github.com/WordPress/playground/pull/1181))
-   Fix fileinfo support. ([#1179](https://github.com/WordPress/playground/pull/1179))
-   Fix mbregex support. ([#1155](https://github.com/WordPress/playground/pull/1155))
-   PHP.run(): Throw JS exception on runtime error, remove throwOnError flag. ([#1137](https://github.com/WordPress/playground/pull/1137))

### Website

-   Add error report modal. ([#1102](https://github.com/WordPress/playground/pull/1102))
-   Ensure PromiseRejectionEvent has reason before logging it. ([#1150](https://github.com/WordPress/playground/pull/1150))
-   Request handler: Remove everything after # from the URL. ([#1126](https://github.com/WordPress/playground/pull/1126))
-   Web: Make the "Apply changes" button work in Playground settings form. ([#1122](https://github.com/WordPress/playground/pull/1122))

#### Plugin proxy

-   Allow requests to WordPress.org. ([#1154](https://github.com/WordPress/playground/pull/1154))

### Internal

-   Refresh WordPress with the latest SQLite integration plugin. ([#1151](https://github.com/WordPress/playground/pull/1151))

### Bug Fixes

-   Fix typo in blueprints/public/schema-readme.md. ([#1134](https://github.com/WordPress/playground/pull/1134))
-   Priority: Fix broken link to VS Code extension. ([#1141](https://github.com/WordPress/playground/pull/1141))

### Various

-   Docs/update - Add implied step. ([#1144](https://github.com/WordPress/playground/pull/1144))
-   Give brandonpayton permission to run Playground GH workflows. ([#1139](https://github.com/WordPress/playground/pull/1139))
-   Logger API: Add rate limiting. ([#1142](https://github.com/WordPress/playground/pull/1142))
-   Remove `--disable-all` configuration option in PHP compile process. ([#1132](https://github.com/WordPress/playground/pull/1132))

### Contributors

The following contributors merged PRs in this release:

@adamziel @bgrgicak @brandonpayton @flexseth @jblz @mho22

## [v0.6.8] (2024-03-21)

### Blueprints

-   Allow optional metadata. ([#1103](https://github.com/WordPress/playground/pull/1103))

### Tools

-   Add VSCode Chrome debugging support. ([#1088](https://github.com/WordPress/playground/pull/1088))
-   Website: Support Base64-encoding Blueprints passed in the URL. ([#1091](https://github.com/WordPress/playground/pull/1091))

### Documentation

-   Docs: Expand Details section. ([#1109](https://github.com/WordPress/playground/pull/1109))
-   Update activate-theme.ts to use `themeFolderName`. ([#1119](https://github.com/WordPress/playground/pull/1119))

### PHP WebAssembly

-   Blueprints: Explore switching to the PHP implementation. ([#1051](https://github.com/WordPress/playground/pull/1051))
-   Explore weird register_shutdown_function behavior. ([#1099](https://github.com/WordPress/playground/pull/1099))
-   Fix post_message_to_js memory out of bounds. ([#1114](https://github.com/WordPress/playground/pull/1114))
-   Fix shutdown errors. ([#1104](https://github.com/WordPress/playground/pull/1104))
-   Fixing build regression [BISON COMPILE]. ([#871](https://github.com/WordPress/playground/pull/871))
-   PHP : Set appropriate SCRIPT variables in $\_SERVER superglobal. ([#1092](https://github.com/WordPress/playground/pull/1092))

### Website

-   Add logger API. ([#1113](https://github.com/WordPress/playground/pull/1113))
-   Add multisite rewrite rules. ([#1083](https://github.com/WordPress/playground/pull/1083))
-   Service worker: Improve error reporting in non-secure contexts. ([#1098](https://github.com/WordPress/playground/pull/1098))

### Bug Fixes

-   Fix experimental notice in FF ESR. ([#1117](https://github.com/WordPress/playground/pull/1117))
-   Fix php bison dep for building on non-arm64 architectures. ([#1115](https://github.com/WordPress/playground/pull/1115))

### Reliability

-   Add fatal errror listener. ([#1095](https://github.com/WordPress/playground/pull/1095))

### Various

-   Update examples and demos in the documentation. ([#1107](https://github.com/WordPress/playground/pull/1107))

### Contributors

The following contributors merged PRs in this release:

@0aveRyan @adamziel @bgrgicak @brandonpayton @ironnysh @mho22 @seanmorris @StevenDufresne

## [v0.6.7] (2024-03-06)

### Website

-   Node polyfills: Only apply them in Node.js, not in web browsers. ([#1089](https://github.com/WordPress/playground/pull/1089))

### Contributors

The following contributors merged PRs in this release:

@adamziel

## [v0.6.6] (2024-03-06)

### Website

-   Comlink API: Pass the context argument to windowEndpoint, not wrap. ([#1087](https://github.com/WordPress/playground/pull/1087))
-   Fix: Playground not starting due to a race condition. ([#1084](https://github.com/WordPress/playground/pull/1084))
-   Hide the "This is experimental WordPress" notice on click. ([#1082](https://github.com/WordPress/playground/pull/1082))
-   Set the API context when using Comlink.wrap(). ([#1085](https://github.com/WordPress/playground/pull/1085))

### Contributors

The following contributors merged PRs in this release:

@adamziel

## [v0.6.5] (2024-03-05)

### Tools

#### Plugin proxy

-   Add Sensei to the allowed repositories for plugin proxy. ([#1079](https://github.com/WordPress/playground/pull/1079))

#### Blueprints

-   Snapshot Import Protocol v1. ([#1007](https://github.com/WordPress/playground/pull/1007))

### Internal

-   Build the php-wasm/util package as both ESM and CJS. ([#1081](https://github.com/WordPress/playground/pull/1081))

### Reliability

#### Blueprints

-   Add unit tests to the mkdir step. ([#1029](https://github.com/WordPress/playground/pull/1029))

### Various

-   Website query API: Continue plugin installs on error. ([#605](https://github.com/WordPress/playground/pull/605))

### Contributors

The following contributors merged PRs in this release:

@adamziel @eliot-akira @reimic @renatho

## [v0.6.4] (2024-03-04)

### Enhancements

-   Add logging support to Playground. ([#1035](https://github.com/WordPress/playground/pull/1035))

### Blueprints

-   PHP Blueprints: Display progress. ([#1077](https://github.com/WordPress/playground/pull/1077))
-   Set progress caption and communicate failures in the import file step. ([#1034](https://github.com/WordPress/playground/pull/1034))

### Tools

#### Blueprints

-   PHP Blueprints demo page. ([#1070](https://github.com/WordPress/playground/pull/1070))
-   PHP: Do not prepend a whitespace when encoding body as multipart form data. ([#1033](https://github.com/WordPress/playground/pull/1033))

### PHP WebAssembly

-   Fix response header escaping. ([#1050](https://github.com/WordPress/playground/pull/1050))
-   Fix: Networking broken when extra PHP extensions are enabled. ([#1045](https://github.com/WordPress/playground/pull/1045))
-   PHP.wasm: Yield 0 bytes read on fd_read failure to improve PHP's fread() and feof() behavior. ([#1053](https://github.com/WordPress/playground/pull/1053))
-   PHP: Support $env and $cwd proc_open arguments. ([#1064](https://github.com/WordPress/playground/pull/1064))
-   Parse shell commands in createSpawnHandler. ([#1065](https://github.com/WordPress/playground/pull/1065))
-   Prototype: Spawning PHP sub-processes in Web Workers. ([#1031](https://github.com/WordPress/playground/pull/1031))
-   Spawning PHP sub-processes in Web Workers. ([#1069](https://github.com/WordPress/playground/pull/1069))

### Website

-   Add Google Analytics events to Playground. ([#1040](https://github.com/WordPress/playground/pull/1040))
-   Fix error on reload site click. ([#1041](https://github.com/WordPress/playground/pull/1041))

### Internal

-   Rebuild WordPress every 20 minutes, short-circuit if no new version is found. ([#1061](https://github.com/WordPress/playground/pull/1061))
-   Rebuild WordPress within an hour of a beta release. ([#1059](https://github.com/WordPress/playground/pull/1059))

### Bug Fixes

-   Fix the login message so it doesn't override another. ([#1044](https://github.com/WordPress/playground/pull/1044))

### Various

-   Add arguments to default node spawn method. ([#1037](https://github.com/WordPress/playground/pull/1037))
-   Add bgrgicak to deployment allowlists. ([#1057](https://github.com/WordPress/playground/pull/1057))
-   Allow for CORS requests to api.wordpress.org to pass. ([#1009](https://github.com/WordPress/playground/pull/1009))
-   Default URL rewrites to /index.php. ([#1072](https://github.com/WordPress/playground/pull/1072))
-   Remove repository specific Code of Conduct. ([#1038](https://github.com/WordPress/playground/pull/1038))
-   Ship WordPress 6.5 beta 1. ([#1036](https://github.com/WordPress/playground/pull/1036))

### Contributors

The following contributors merged PRs in this release:

@adamziel @bgrgicak @dd32 @desrosj @johnbillion @mho22

## [v0.6.3] (2024-02-12)

### Blueprints

-   Wp-cli step. ([#1017](https://github.com/WordPress/playground/pull/1017))

### PHP WebAssembly

-   Calls proc_open two times in a row. ([#1012](https://github.com/WordPress/playground/pull/1012))
-   Experiment: Build PHP with OPFS support. ([#1030](https://github.com/WordPress/playground/pull/1030))
-   PHP: Pass request body as UInt8Array. ([#1018](https://github.com/WordPress/playground/pull/1018))

### Contributors

The following contributors merged PRs in this release:

@adamziel @mho22

## [v0.6.2] (2024-02-08)

### PHP WebAssembly

-   Networking: Swap Requests transports using the http_api_transports instead of patching the Requests library. ([#1004](https://github.com/WordPress/playground/pull/1004))
-   Remove `crypto.randomUUID` dependency in favor of a custom function. ([#1016](https://github.com/WordPress/playground/pull/1016))
-   Remove x-request-issuer header on cross-origin requests. ([#1010](https://github.com/WordPress/playground/pull/1010))
-   Update wp_http_fetch.php. ([#1002](https://github.com/WordPress/playground/pull/1002))

### Website

-   Remote.html: Always install the playground mu-plugin. ([#1005](https://github.com/WordPress/playground/pull/1005))

### Various

-   32bit integer workaround. ([#1014](https://github.com/WordPress/playground/pull/1014))
-   Test/hello world blueprint. ([#908](https://github.com/WordPress/playground/pull/908))

### Contributors

The following contributors merged PRs in this release:

@adamziel @bgrgicak @jdevalk @sejas @stoph

## [v0.6.1] (2024-02-05)

### Website

#### Blueprints

-   Remove the applyWordPressPatches step, enable the Site Health Plugin. ([#1001](https://github.com/WordPress/playground/pull/1001))

### Various

-   Add `crypto` to Polyfills improving Blueprint compatibility for Node. ([#1000](https://github.com/WordPress/playground/pull/1000))

### Contributors

The following contributors merged PRs in this release:

@adamziel @sejas

## [v0.6.0] (2024-02-05)

### Enhancements

-   Add wp-cli and code editor examples to the demos page. ([#965](https://github.com/WordPress/playground/pull/965))
-   WordPress: Preserve PHP attributes and wp-config.php whitespace. ([#964](https://github.com/WordPress/playground/pull/964))

### Blueprints

-   Add enableMultisite step. ([#888](https://github.com/WordPress/playground/pull/888))
-   Set_current_user to admin before activating plugins and themes. ([#984](https://github.com/WordPress/playground/pull/984))

### Tools

-   Use .zip files instead of .data files for loading WordPress. ([#978](https://github.com/WordPress/playground/pull/978))

#### Blueprints

-   Throw on failure. ([#982](https://github.com/WordPress/playground/pull/982))

#### PHP WebAssembly

-   Support wp-cli in the browser. ([#957](https://github.com/WordPress/playground/pull/957))

### PHP WebAssembly

-   Correcting OOB & Prevent Crash on Saving Large Post. ([#870](https://github.com/WordPress/playground/pull/870))
-   Memory leak: Add rotatedPHP to kill and recreate PHP instances after a certain number of requests. ([#990](https://github.com/WordPress/playground/pull/990))
-   PHP : Add args and descriptors dynamic arrays in proc open function. ([#969](https://github.com/WordPress/playground/pull/969))
-   PHP.wasm: Fix stack overflow in wasm_set_request_body. ([#993](https://github.com/WordPress/playground/pull/993))

### Website

-   Add .htaccess file to prevent caching of index.html and enable importing the client.js library. ([#989](https://github.com/WordPress/playground/pull/989))
-   Add og meta tags and meta description. ([#980](https://github.com/WordPress/playground/pull/980))
-   CORS headers for client/index.js. ([#893](https://github.com/WordPress/playground/pull/893))
-   wp-cli: Respect quotes when parsing shell commands. ([#966](https://github.com/WordPress/playground/pull/966))

### Internal

-   Remove the interactive block playground. ([#988](https://github.com/WordPress/playground/pull/988))

### Bug Fixes

-   Fix "WP-CLI" typos. ([#971](https://github.com/WordPress/playground/pull/971))
-   Fix footer styling issue in the "Code is Poetry" in wordpress.github.io/wordpress-playground. ([#959](https://github.com/WordPress/playground/pull/959))
-   WordPress build: Add newlines after PHP annotations. ([#986](https://github.com/WordPress/playground/pull/986))

### Various

-   Add a blueprint example. ([#946](https://github.com/WordPress/playground/pull/946))
-   Add terminal to playground site. ([#161](https://github.com/WordPress/playground/pull/161))
-   Match the .nvmrc node version to the changes made in commit ec2605b. ([#972](https://github.com/WordPress/playground/pull/972))
-   PHP : Dispatch available descriptor specs in js_open_process function. ([#963](https://github.com/WordPress/playground/pull/963))
-   PHP : Give access to command arguments if array type is given in php ^7.4 proc_open function. ([#944](https://github.com/WordPress/playground/pull/944))
-   Rebuild WordPress. ([#987](https://github.com/WordPress/playground/pull/987))
-   Update the networking disabled error messages in wp-admin for plugins and themes. ([#936](https://github.com/WordPress/playground/pull/936))

### Contributors

The following contributors merged PRs in this release:

@adamziel @bph @ironnysh @marcarmengou @mho22 @rowasc @seanmorris @swissspidy @tyrann0us

## [v0.5.9] - 2021-09-29

### Changed

– **Breaking:** Remoddsaved the PHPBrowser class ([##1302](https://github.com/WordPress/wordpress-playground/pull/1302))

### Added

– Added CHANGELOG.md to keep track of notable changes ([##1302](https://github.com/WordPress/wordpress-playground/pull/1302))
