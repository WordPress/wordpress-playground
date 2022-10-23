const STR = "string";
const NUM = "number";

const defaultPhpIni = `[PHP]
error_reporting = E_ERROR | E_PARSE
display_errors = 1
html_errors = 1
display_startup_errors = On
session.save_path=/home/web_user
`;

export default class PHP {

  static async create(PHPLoader, { phpIni = defaultPhpIni, ...args } = {}) {
    const streams = {
      stdout: [],
      stderr: [],
    };
    const PHPModule = await PHPLoader({
      onAbort(reason) {
        console.error("WASM aborted: ");
        console.error(reason);
      },
      print: (...chunks) => streams.stdout.push(...chunks),
      printErr: (...chunks) => streams.stderr.push(...chunks),
      ...args
    });

    PHPModule.FS.mkdirTree('/usr/local/etc');
    PHPModule.FS.writeFile('/usr/local/etc/php.ini', phpIni);

    return new PHP(PHPModule, streams);
  }

  constructor(PHPModule, streams) {
    // @TODO: Keep PHPModule private, don't expose it at all.
    this.PHPModule = PHPModule;
    this.streams = streams;

    this.mkdirTree = PHPModule.FS.mkdirTree;
    const textDecoder = new TextDecoder()
    this.readFile = path => textDecoder.decode(PHPModule.FS.readFile(path));
    this.writeFile = PHPModule.FS.writeFile;
    this.unlink = PHPModule.FS.unlink;
    this.pathExists = path => {
      try {
        PHPModule.FS.lookupPath(path);
        return true;
      } catch(e) {
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
        }
      });
    }

    this.call = PHPModule.ccall;
    this.call("pib_init", NUM, [STR], []);
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
    const exitCode = this.call("pib_run", NUM, [STR], [`?>${code}`]);
    const response = {
      exitCode,
      stdout: this.streams.stdout.join("\n"),
      stderr: this.streams.stderr,
    };
    this.clear();
    return response;
  }

  clear() {
    this.call("pib_refresh", NUM, [], []);
    this.streams.stdout = [];
    this.streams.stderr = [];
  }
  refresh = this.clear;
}
