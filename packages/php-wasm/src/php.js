const STR = "string";
const NUM = "number";

/**
 * @typedef {Object} Output
 * @property {number} exitCode Exit code of the PHP process.
 * @property {string} stdout Stdout data.
 * @property {string[]} stderr Stderr lines.
 */

  /**
   * 
   * @param {*} PHPLoader 
   * @param {*} param1 
   * @returns 
   */
export async function startPHP(phpLoaderModule, phpEnv, phpModuleArgs = {}, dataDependenciesModules = []) {
    let resolvePhpReady, resolveDepsReady;
    const depsReady = new Promise(resolve => { resolveDepsReady = resolve; });
    const phpReady = new Promise(resolve => { resolvePhpReady = resolve; });

    const streams = {
      stdout: [],
      stderr: [],
    };
    const loadPHPRuntime = phpLoaderModule.default;
    const PHPRuntime = loadPHPRuntime(phpEnv, {
      onAbort(reason) {
        console.error("WASM aborted: ");
        console.error(reason);
      },
      print: (...chunks) => streams.stdout.push(...chunks),
      printErr: (...chunks) => streams.stderr.push(...chunks),
      ...phpModuleArgs,
      noInitialRun: true,
      onRuntimeInitialized() {
        if (phpModuleArgs.onRuntimeInitialized) {
          phpModuleArgs.onRuntimeInitialized();
        }
        resolvePhpReady();
      },
      monitorRunDependencies(nbLeft) {
        if (nbLeft === 0) {
          delete PHPRuntime.monitorRunDependencies;
          resolveDepsReady();
        }
      }
    });
    for (const { default: loadDataModule } of dataDependenciesModules) {
      loadDataModule(PHPRuntime);
    }
    if (!dataDependenciesModules.length) {
      resolveDepsReady();
    }

    await depsReady;
    await phpReady;
    return new PHP(
      PHPRuntime,
      streams
    )
}
  
/**
 * Minimal, low level-ish, runtime-agnostic wrapper around the Emscripten's generated module.
 * 
 * 
 */
export class PHP {

  #streams;
  #Runtime;

  constructor(Runtime, streams) {
    this.#Runtime = Runtime;
    this.#streams = streams;

    this.mkdirTree('/usr/local/etc');
    // @TODO: make this customizable
    this.writeFile('/usr/local/etc/php.ini', `[PHP]
error_reporting = E_ERROR | E_PARSE
display_errors = 1
html_errors = 1
display_startup_errors = On
session.save_path=/home/web_user
    `);
    Runtime.ccall("pib_init", NUM, [STR], []);
  }

  /**
   * Runs a PHP script.
   * 
   * Example:
   * 
   * ```js
   * const output = php.run('<?php echo "Hello world!";');
   * console.log(output.stdout); // "Hello world!"
   * ```
   * 
   * @param {string} code The PHP code to run.
   * @returns {Output} The PHP process output.
   */
  run(code) {
    const exitCode = this.#Runtime.ccall("pib_run", NUM, [STR], [`?>${code}`]);
    const response = {
      exitCode,
      stdout: this.#streams.stdout.join("\n"),
      stderr: this.#streams.stderr,
    };
    this.#refresh();
    return response;
  }

  /**
   * Destroys the current PHP context and creates a new one.
   * Any variables, functions, classes, etc. defined in the previous
   * context will be lost. This methods needs to always be called after
   * running PHP code, or else the next call to `run` will be contaminated
   * with the previous context.
   * 
   * @private
   */
  #refresh() {
    this.#Runtime.ccall("pib_refresh", NUM, [], []);
    this.#streams.stdout = [];
    this.#streams.stderr = [];
  }

  /**
   * Recursively creates a directory with the given path in the PHP filesystem.
   * For example, if the path is "/root/php/data", and "/root" already exists,
   * it will create the directories "/root/php" and "/root/php/data".
   * 
   * @param {string} path The directory path to create.
   */
  mkdirTree(path) {
    this.#Runtime.FS.mkdirTree(path);
  }
  
  /**
   * Reads a file from the PHP filesystem and returns it as a string.
   * 
   * @throws {FS.ErrnoError} If the file doesn't exist.
   * @param {string} path The file path to read.
   * @returns {string} The file contents.
   */
  readFileAsText(path) {
    return new TextDecoder().decode(this.readFileAsBuffer(path));
  }

  /**
   * Reads a file from the PHP filesystem and returns it as an array buffer.
   * 
   * @throws {FS.ErrnoError} If the file doesn't exist.
   * @param {string} path The file path to read.
   * @returns {Uint8Array} The file contents.
   */
  readFileAsBuffer(path) {
    return this.#Runtime.FS.readFile(path);
  }

  /**
   * Overwrites data in a file in the PHP filesystem.
   * Creates a new file if one doesn't exist yet.
   * 
   * @param {string} path The file path to write to.
   * @param {string|Uint8Array} data The data to write to the file.
   */
  writeFile(path, data) {
    return this.#Runtime.FS.writeFile(path, data);
  }

  /**
   * Removes a file from the PHP filesystem.
   * 
   * @throws {FS.ErrnoError} If the file doesn't exist.
   * @param {string} path The file path to remove.
   */
  unlink(path) {
    this.#Runtime.FS.unlink(path);
  }

  /**
   * Checks if a file (or a directory) exists in the PHP filesystem.
   * 
   * @param {string} path The file path to check.
   * @returns {boolean} True if the file exists, false otherwise.
   */
  fileExists(path) {
    try {
      this.#Runtime.FS.lookupPath(path);
      return true;
    } catch(e) {
      return false;
    }
  }

  /**
   * Allocates an internal HashTable to keep track of the legitimate uploads.
   * 
   * Supporting file uploads via WebAssembly is a bit tricky.
   * Functions like `is_uploaded_file` or `move_uploaded_file` fail to work
   * with those $_FILES entries that are not in an internal hash table. This
   * is a security feature, see this exceprt from the `is_uploaded_file` documentation:
   * 
   * > is_uploaded_file
   * >
   * > Returns true if the file named by filename was uploaded via HTTP POST. This is
   * > useful to help ensure that a malicious user hasn't tried to trick the script into
   * > working on files upon which it should not be working--for instance, /etc/passwd.
   * >
   * > This sort of check is especially important if there is any chance that anything
   * > done with uploaded files could reveal their contents to the user, or even to other
   * > users on the same system.
   * >
   * > For proper working, the function is_uploaded_file() needs an argument like
   * > $_FILES['userfile']['tmp_name'], - the name of the uploaded file on the client's
   * > machine $_FILES['userfile']['name'] does not work.
   * 
   * This PHP.wasm implementation doesn't run any PHP request machinery, so PHP never has
   * a chance to note which files were actually uploaded. In practice, `is_uploaded_file()`
   * always returns false.
   * 
   * `initUploadedFilesHash()`, `registerUploadedFile()`, and `destroyUploadedFilesHash()`
   * are a workaround for this problem. They allow you to manually register uploaded
   * files in the internal hash table, so that PHP functions like `move_uploaded_file()`
   * can recognize them.
   *  
   * Usage:
   * 
   * ```js
   * // Create an uploaded file in the PHP filesystem.
   * php.writeFile(
   *    '/tmp/test.txt',
   *    'I am an uploaded file!'
   * );
   * 
   * // Allocate the internal hash table.
   * php.initUploadedFilesHash();
   * 
   * // Register the uploaded file.
   * php.registerUploadedFile('/tmp/test.txt');
   * 
   * // Run PHP code that uses the uploaded file.
   * php.run(`<?php
   * 	_FILES[key] = {
	 *		  name: value.name,
	 *			type: value.type,
	 *			tmp_name: tmpPath,
	 *			error: 0,
	 *			size: value.size,
	 *	};
   *  var_dump(is_uploaded_file($_FILES["file1"]["tmp_name"]));
   *  // true
   * `);
   * 
   * // Destroy the internal hash table to free the memory.
   * php.destroyUploadedFilesHash();
   * ```
   */
  initUploadedFilesHash() {
    this.#Runtime.ccall("pib_init_uploaded_files_hash", null, [], []);
  }

  /**
   * Registers an uploaded file in the internal hash table.
   * 
   * @see initUploadedFilesHash()
   * @param {string} tmpPath The temporary path of the uploaded file.
   */
  registerUploadedFile(tmpPath) {
    this.#Runtime.ccall("pib_register_uploaded_file", null, [STR], [tmpPath]);
  }

  /**
   * Destroys the internal hash table to free the memory.
   * 
   * @see initUploadedFilesHash()
   */
  destroyUploadedFilesHash() {
    this.#Runtime.ccall("pib_destroy_uploaded_files_hash", null, [], []);
  }

}
