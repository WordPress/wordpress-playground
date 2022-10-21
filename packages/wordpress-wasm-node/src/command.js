const {
  createWordPressClient,
  initDatabaseFromBase64File,
} = require("./bootstrap.js");
const { startExpressServer } = require("./express-server.js");
const yargs = require("yargs");

const path = require("path");
const  { fileURLToPath } = require("node:url");

// @TODO: Use a proper module import
const { PHPBrowser } = require("../../php-wasm/build/index.js");

exports.default = async function runCLICommand() {
  const argv = yargs(process.argv.slice(2))
    .command("server", "Starts a WordPress server")
    .options({
      port: {
        type: "number",
        default: 9854,
        describe: "Port to listen on",
      },
      initialUrl: {
        type: "string",
        default: "/wp-admin/index.php",
        describe: "The first URL to navigate to.",
      },
      mount: {
        type: "array",
        default: [],
        describe:
          "Paths to mount in the WASM runtime filesystem. Format: <host-path>:<wasm-path>. Based on the current working directory on host, and WordPress root directory in the WASM runtime.",
      },
    })
    .help()
    .alias("help", "h").argv;
  
    console.log("Starting server on port " + argv.port);
  
    const mounts = argv.mount.map((mount) => {
      try {
        const [relativeHostPath, relativeWasmPath] = mount.split(":");
        const absoluteHostPath = path.isAbsolute(relativeHostPath)
          ? relativeHostPath
          : path.resolve(process.cwd(), relativeHostPath);
        const absoluteWasmPath = path.isAbsolute(relativeWasmPath)
          ? relativeWasmPath
          : path.join("/preload/wordpress", relativeWasmPath);
        return {
          absoluteHostPath,
          absoluteWasmPath,
          relativeHostPath,
          relativeWasmPath,
        };
      } catch (e) {
        console.error(`Failed to mount ${mount}`);
        return process.exit(0);
      }
    });
    const wp = await createWordPressClient();
  
    const browser = new WPBrowser(wp);
    return await startExpressServer(browser, argv.port, {
      mounts,
      initialUrl: argv.initialUrl,
    });
}
