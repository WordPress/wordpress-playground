const fs = require("fs");
const path = require("path");

// @TODO: Use proper module imports
const PHPLoader = require("../../php-wasm/build-wasm/php-node.js");
const { PHP, PHPServer } = require("../../php-wasm/build/index.js");
const { fileURLToPath } = require("node:url");

async function createWordPressClient(options = {}) {
  options = {
    preInit() {},
    phpWasmPath: __dirname + `/../../php-wasm/build-wasm/php.wasm`,
    wpPath: path.join(__dirname, "..", "build-wp"),
    ...options,
  };
  const php = new PHP();
  const PHPModule = await php.init(PHPLoader, {
    locateFile() {
      return path.join(__dirname, options.phpWasmPath);
    }
  });
  // PHPModule.FS.mkdirTree("/preload/wordpress");
  // PHPModule.FS.mount(PHPModule.NODEFS, { root: options.wpPath }, "/preload/wordpress");

  return new PHPServer(php);
}

async function install(browser, siteUrl, options = {}) {
  options = {
    siteTitle: "WordPress",
    username: "admin",
    password: "password",
    email: "admin@localhost.com",
    ...options,
  };

  await browser.request({
    path: "/wp-admin/install.php",
  });

  return await browser.request({
    path: "/wp-admin/install.php",
    method: "POST",
    headers: {
      siteUrl,
      "content-type": "application/x-www-form-urlencoded",
    },
    _GET: "?step=2",
    _POST: {
      weblog_title: options.siteTitle,
      user_name: options.username,
      admin_password: options.password,
      admin_password2: options.password,
      admin_email: options.email,
      Submit: "Install WordPress",
      language: "",
    },
  });
}

async function login(
  browser,
  username = "admin",
  password = "password"
) {
  await browser.request({
    path: "/wp-login.php",
  });
  await browser.request({
    path: "/wp-login.php",
    method: "POST",
    _POST: {
      log: username,
      pwd: password,
      rememberme: "forever",
    },
  });
}


module.exports = {
  createWordPressClient,
  install,
  login
}
