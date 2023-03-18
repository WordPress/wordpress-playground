import type { Filesystem, PHPIni, PHPRequest, PHPResponse, HandlesRun } from '../php-library/php';
import type { HandlesRequest } from '../php-library/php-browser';
import type { PHPBrowser, PHPServerRequest } from '../php-library/index';
import { EmscriptenDownloadMonitor } from '.';
type Promisify<T> = {
    [P in keyof T]: T[P] extends (...args: infer A) => infer R ? R extends void | Promise<any> ? T[P] : (...args: A) => Promise<ReturnType<T[P]>> : Promise<T[P]>;
};
type PublicAPI = Promisify<HandlesRequest & PHPIni & Filesystem & HandlesRun>;
export declare class PHPPublicAPI implements PublicAPI {
    #private;
    absoluteUrl: string;
    constructor(browser: PHPBrowser, monitor?: EmscriptenDownloadMonitor);
    pathToInternalUrl(path: string): string;
    internalUrlToPath(internalUrl: string): string;
    onDownloadProgress(callback: (progress: CustomEvent<ProgressEvent>) => void): void;
    request(request: PHPServerRequest, redirects?: number): Promise<PHPResponse>;
    run(request?: PHPRequest | undefined): Promise<PHPResponse>;
    setPhpIniPath(path: string): void;
    setPhpIniEntry(key: string, value: string): void;
    mkdirTree(path: string): void;
    readFileAsText(path: string): Promise<string>;
    readFileAsBuffer(path: string): Promise<Uint8Array>;
    writeFile(path: string, data: string | Uint8Array): void;
    unlink(path: string): void;
    listFiles(path: string): Promise<string[]>;
    isDir(path: string): Promise<boolean>;
    fileExists(path: string): Promise<boolean>;
}
export {};
