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

  #streams;
  #PHPModule;

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
    this.#PHPModule = PHPModule;
    this.#streams = streams;

    PHPModule.ccall("pib_init", NUM, [STR], []);
  }

  mkdirTree(path) {
    return this.#PHPModule.FS.mkdirTree(path);
  }
  
  readFileAsText(path) {
    return new TextDecoder().decode(this.readFileAsBuffer(path));
  }

  readFileAsBuffer(path) {
    return this.#PHPModule.FS.readFile(path);
  }

  writeFile(path, data) {
    return this.#PHPModule.FS.writeFile(path, data);
  }

  unlink(path) {
    return this.#PHPModule.FS.unlink(path);
  }

  fileExists(path) {
    try {
      this.#PHPModule.FS.lookupPath(path);
      return true;
    } catch(e) {
      return false;
    }
  }

  async loadDataDependency(loadScriptFn, globalModuleName='PHPModule') {
    const PHPModule = this.#PHPModule;
    // The name PHPModule is baked into wp.js
    globalThis[globalModuleName] = PHPModule;
    // eslint-disable-next-line no-undef
    await loadScriptFn();
    delete globalThis[globalModuleName];
    await new Promise((resolve) => {
      PHPModule.monitorRunDependencies = (nbLeft) => {
        if (nbLeft === 0) {
          delete PHPModule.monitorRunDependencies;
          resolve();
        }
      }
    });
  }

  initUploadedFilesHash() {
    this.#PHPModule.ccall("pib_init_uploaded_files_hash", null, [], []);
  }

  registerUploadedFile(tmpPath) {
    this.#PHPModule.ccall("pib_register_uploaded_file", null, [STR], [tmpPath]);
  }

  destroyUploadedFilesHash() {
    this.#PHPModule.ccall("pib_destroy_uploaded_files_hash", null, [], []);
  }

  run(code) {
    const exitCode = this.#PHPModule.ccall("pib_run", NUM, [STR], [`?>${code}`]);
    const response = {
      exitCode,
      stdout: this.#streams.stdout.join("\n"),
      stderr: this.#streams.stderr,
    };
    this.#refresh();
    return response;
  }

  #refresh() {
    this.#PHPModule.ccall("pib_refresh", NUM, [], []);
    this.#streams.stdout = [];
    this.#streams.stderr = [];
  }
  
}
