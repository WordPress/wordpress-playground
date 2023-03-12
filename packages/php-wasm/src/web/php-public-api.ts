import type { Filesystem, PHPIni, PHPRequest, PHPResponse, HandlesRun } from "../php-library/php";
import type { HandlesRequest } from "../php-library/php-browser";
import type { PHP, PHPBrowser, PHPServer, PHPServerRequest } from "../php-library";
import { EmscriptenDownloadMonitor } from ".";

export class PHPPublicAPI implements HandlesRequest, PHPIni, Filesystem, HandlesRun {

    #php: PHP;
    #phpServer: PHPServer;
    #phpBrowser: PHPBrowser;
    #monitor?: EmscriptenDownloadMonitor;

    absoluteUrl: string;

    constructor(browser: PHPBrowser, monitor?: EmscriptenDownloadMonitor) {
        this.#phpBrowser = browser;
        this.#phpServer = browser.server;
        this.#php = browser.server.php;
        this.absoluteUrl = this.#phpServer.absoluteUrl;
        this.#monitor = monitor;
    }

    pathToInternalUrl(path: string): string {
        return this.#phpServer.pathToInternalUrl(path);
    }

    internalUrlToPath(internalUrl: string): string {
        return this.#phpServer.internalUrlToPath(internalUrl);
    }

    onDownloadProgress(callback: (progress: CustomEvent<ProgressEvent>) => void) {
        this.#monitor?.addEventListener('progress', callback as any)
    }

    request(
		request: PHPServerRequest,
		redirects?: number
    ): Promise<PHPResponse> {
        return this.#phpBrowser.request(request, redirects);
    }

    run(request?: PHPRequest | undefined): PHPResponse {
        return this.#php.run(request);
    }

    setPhpIniPath(path: string): void {
        return this.#php.setPhpIniPath(path);
    }

    setPhpIniEntry(key: string, value: string): void {
        this.#php.setPhpIniEntry(key, value);
    }

    mkdirTree(path: string): void {
        this.#php.mkdirTree(path);
    }

    readFileAsText(path: string): string {
        return this.#php.readFileAsText(path);
    }

    readFileAsBuffer(path: string): Uint8Array {
        return this.#php.readFileAsBuffer(path);
    }

    writeFile(path: string, data: string | Uint8Array): void {
        this.#php.writeFile(path, data);
    }

    unlink(path: string): void {
        this.#php.unlink(path);
    }

    listFiles(path: string): string[] {
        return this.#php.listFiles(path);
    }

    isDir(path: string): boolean {
        return this.#php.isDir(path);
    }

    fileExists(path: string): boolean {
        return this.#php.fileExists(path);
    }

}
