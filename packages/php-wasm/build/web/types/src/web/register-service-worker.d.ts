import type { Remote } from "comlink";
import { PHPPublicAPI } from "./php-public-api";
/**
 * Run this in the main application to register the service worker or
 * reload the registered worker if the app expects a different version
 * than the currently registered one.
 *
 * @param {string} scriptUrl       The URL of the service worker script.
 * @param {string} expectedVersion The expected version of the service worker script. If
 *                                 mismatched with the actual version, the service worker
 *                                 will be re-registered.
 */
export declare function registerServiceWorker(phpApi: Remote<PHPPublicAPI>, scope: string, scriptUrl: any, expectedVersion: any): Promise<void>;
