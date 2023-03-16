import type {
  Filesystem,
  PHP,
  PHPBrowser,
  PHPServer,
  PHPServerRequest,
  PHPIni,
  PHPRequest,
  PHPResponse,
  HandlesRun,
  HandlesRequest,
} from '@wordpress/php-wasm-common';
import type { Remote } from 'comlink';
import { EmscriptenDownloadMonitor } from '@wordpress/php-wasm-progress';

export type Promisify<T> = {
  [P in keyof T]: T[P] extends (...args: infer A) => infer R
    ? R extends void | Promise<any>
      ? T[P]
      : (...args: A) => Promise<ReturnType<T[P]>>
    : Promise<T[P]>;
};

interface WithPathConversion {
  pathToInternalUrl(path: string): Promise<string>;
  internalUrlToPath(internalUrl: string): Promise<string>;
}

interface WithProgress {
  onDownloadProgress(
    callback: (progress: CustomEvent<ProgressEvent>) => void
  ): Promise<void>;
}

const _private = new WeakMap<
  PHPClient,
  {
    php: PHP;
    phpServer: PHPServer;
    phpBrowser: PHPBrowser;
    monitor?: EmscriptenDownloadMonitor;
  }
>();

/*
 * All the Promise<> wraping is to make this class interchangeable
 * for the Remote<PHPClient> type that will be typically consumed.
 * This way, all the code working with same-thread PHPClient can
 * also work with the remote PHPClient.
 */

/**
 * A PHP client that can be used to run PHP code in the browser.
 */
export class PHPClient
  implements
    Promisify<
      HandlesRequest &
      PHPIni &
      Filesystem &
      HandlesRun &
      WithProgress &
      WithPathConversion
    >
{
  absoluteUrl: Promise<string>;
  documentRoot: Promise<string>;

  constructor(browser: PHPBrowser, monitor?: EmscriptenDownloadMonitor) {
    /**
     * Workaround for TypeScript limitation.
     * Declaring a private field using the EcmaScript syntax like this:
     *
     *     #php: PHP
     *
     * Makes that field a part of the public API of the class. This means
     * you can no longer assign seemingly compatible objects:
     *
     * ```ts
     *     class PrivateEcma {
     *       #privateProp: string = '';
     *       callback() { }
     *     }
     *     interface CompatibleInterface {
     *       callback(): void;
     *     }
     *     const compatObj: CompatibleInterface = {} as any;
     *     const tsObj: PrivateEcma = compatObj;
     *     // Property '#privateProp' is missing in type 'CompatibleInterface' but
     *     // required in type 'PrivateEcma'
     * ```
     */
    _private.set(this, {
      php: browser.server.php,
      phpServer: browser.server,
      phpBrowser: browser,
      monitor,
    });
    this.absoluteUrl = Promise.resolve(browser.server.absoluteUrl);
    this.documentRoot = Promise.resolve(browser.server.documentRoot);
  }

  async pathToInternalUrl(path: string): Promise<string> {
    return _private.get(this)!.phpServer.pathToInternalUrl(path);
  }

  async internalUrlToPath(internalUrl: string): Promise<string> {
    return _private.get(this)!.phpServer.internalUrlToPath(internalUrl);
  }

  async onDownloadProgress(
    callback: (progress: CustomEvent<ProgressEvent>) => void
  ): Promise<void> {
    _private.get(this)!.monitor?.addEventListener('progress', callback as any);
  }

  request(request: PHPServerRequest, redirects?: number): Promise<PHPResponse> {
    return _private.get(this)!.phpBrowser.request(request, redirects);
  }

  async run(request?: PHPRequest | undefined): Promise<PHPResponse> {
    return _private.get(this)!.php.run(request);
  }

  setPhpIniPath(path: string): void {
    return _private.get(this)!.php.setPhpIniPath(path);
  }

  setPhpIniEntry(key: string, value: string): void {
    _private.get(this)!.php.setPhpIniEntry(key, value);
  }

  mkdirTree(path: string): void {
    _private.get(this)!.php.mkdirTree(path);
  }

  async readFileAsText(path: string): Promise<string> {
    return _private.get(this)!.php.readFileAsText(path);
  }

  async readFileAsBuffer(path: string): Promise<Uint8Array> {
    return _private.get(this)!.php.readFileAsBuffer(path);
  }

  writeFile(path: string, data: string | Uint8Array): void {
    _private.get(this)!.php.writeFile(path, data);
  }

  unlink(path: string): void {
    _private.get(this)!.php.unlink(path);
  }

  async listFiles(path: string): Promise<string[]> {
    return _private.get(this)!.php.listFiles(path);
  }

  async isDir(path: string): Promise<boolean> {
    return _private.get(this)!.php.isDir(path);
  }

  async fileExists(path: string): Promise<boolean> {
    return _private.get(this)!.php.fileExists(path);
  }
}

// An asssertion to make sure Playground Client is compatible
// with Remote<PlaygroundClient>
export const isAssignableToRemoteClient: PHPClient = {} as any as Remote<PHPClient>;
