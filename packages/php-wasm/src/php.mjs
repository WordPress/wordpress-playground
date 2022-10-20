const STR = "string";
const NUM = "number";

export default class PHP {
  _initPromise;
  call;

  stdout = [];
  stderr = [];

  init(PHPLoader, args = {}) {
    if (!this._initPromise) {
      this._initPromise = this._init(PHPLoader, args);
    }
    return this._initPromise;
  }

  async _init(PHPLoader, args = {}) {
    const PHPModule = await loadPHP(PHPLoader, {
      onAbort(reason) {
        console.error("WASM aborted: ");
        console.error(reason);
      },
      print: (...chunks) => this.stdout.push(...chunks),
      printErr: (...chunks) => this.stderr.push(...chunks),
      
      ...args
    });

    this.mkdirTree = PHPModule.FS.mkdirTree;
    this.readFile = PHPModule.FS.readFile;
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
    this.call = PHPModule.ccall;
    await this.call("pib_init", NUM, [STR], []);
    return PHPModule;
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
    if (!this.call) {
      throw new Error(`Run init() first!`);
    }
    const exitCode = this.call("pib_run", NUM, [STR], [`?>${code}`]);
    const response = {
      exitCode,
      stdout: this.stdout.join("\n"),
      stderr: this.stderr,
    };
    this.clear();
    return response;
  }

  clear() {
    if (!this.call) {
      throw new Error(`Run init() first!`);
    }
    this.call("pib_refresh", NUM, [], []);
    this.stdout = [];
    this.stderr = [];
  }
  refresh = this.clear;
}

async function loadPHP(PHPLoader, args) {
  const ModulePointer = {
    ...args
  };
  await new PHPLoader(ModulePointer);
  return ModulePointer;
}
