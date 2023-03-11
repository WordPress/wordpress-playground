import type { PHPRequest, PHPResponse } from './php';
import type { PHPServerRequest } from './php-server';
import type { PHPBrowser } from './php-browser';
import { getURLScope, removeURLScope } from './scope';
import { getPathQueryFragment } from './urls';

/**
 * A base class for controlling the PHP instance running in another
 * contexts. Implement the `rpc` method to call the methods of the
 * remote PHP instance.
 */
export class PHPProtocolHandler {
	#phpBrowser: PHPBrowser;
	#scope: string;

	constructor(phpBrowser: PHPBrowser) {
		this.#phpBrowser = phpBrowser;
		this.#scope = getURLScope(new URL(phpBrowser.server.absoluteUrl))!;
	}

	isAlive() {
		return true;
	}

	getAbsoluteUrl() {
		return this.#phpBrowser.server.absoluteUrl;
	}

	getScope() {
		return this.#scope;
	}

	/**
	 * Converts a path to an absolute URL based at the PHPServer
	 * root.
	 *
	 * @param  path The server path to convert to an absolute URL.
	 * @returns The absolute URL.
	 */
	pathToInternalUrl(path: string): string {
		return `${this.getAbsoluteUrl()}${path}`;
	}

	/**
	 * Converts an absolute URL based at the PHPServer to a relative path
	 * without the server pathname and scope.
	 *
	 * @param  internalUrl An absolute URL based at the PHPServer root.
	 * @returns The relative path.
	 */
	internalUrlToPath(internalUrl: string): string {
		return getPathQueryFragment(removeURLScope(new URL(internalUrl)));
	}

	/**
	 * @param  code
	 * @see {PHP.run}
	 */
	run(request: PHPRequest): PHPResponse {
		return this.#phpBrowser.server.php.run(request);
	}

	/**
	 * @param  request
	 * @see {PHP.request}
	 */
	async HTTPRequest(request: PHPServerRequest): Promise<PHPResponse & { text: string }> {
		const response = await this.#phpBrowser.request(request);
		return {
			...response,
			get text() {
				return new TextDecoder().decode(response.body);
			},
		};
	}

	/**
	 * @param  path
	 * @see {PHP.readFile}
	 */
	readFile(path: string): string {
		return this.#phpBrowser.server.php.readFileAsText(path);
	}

	/**
	 * @param  path
	 * @param  contents
	 * @see {PHP.writeFile}
	 */
	writeFile(path: string, contents: string): void {
		return this.#phpBrowser.server.php.writeFile(path, contents);
	}

	/**
	 * @param  path
	 * @see {PHP.unlink}
	 */
	unlink(path: string): void {
		return this.#phpBrowser.server.php.unlink(path);
	}

	/**
	 * @param  path
	 * @see {PHP.mkdirTree}
	 */
	mkdirTree(path: string): void {
		return this.#phpBrowser.server.php.mkdirTree(path);
	}

	/**
	 * @param  path
	 * @see {PHP.listFiles}
	 */
	listFiles(path: string): string[] {
		return this.#phpBrowser.server.php.listFiles(path);
	}

	/**
	 * @param  path
	 * @see {PHP.isDir}
	 */
	isDir(path: string): boolean {
		return this.#phpBrowser.server.php.isDir(path);
	}

	/**
	 * @param  path
	 * @see {PHP.fileExists}
	 */
	fileExists(path: string): boolean {
		return this.#phpBrowser.server.php.fileExists(path);
	}

}

// type HandlerType = Record<string, any>;

// type MethodsOf<T extends object> = Pick<T, {
// 	[K in keyof T]: T[K] extends (...args:any)=>any ? K : never
// }[keyof T]>;

// type ProtocolClientOf<T extends HandlerType> = 
// 	_ProtocolClientOf<MethodsOf<T>>;

// type _ProtocolClientOf<HandlerClass extends Record<string, (...args: any) => any>> = {
// 	[k in keyof HandlerClass]: (...args: Parameters<HandlerClass[k]>) => Promise<ReturnType<HandlerClass[k]>>
// }

// type ProtocolMessage = {
// 	method: string;
// 	args: any;
// }

// function clientOf<Handler extends HandlerType>(
// 	relay: (msg: ProtocolMessage) => Promise<any>,
// 	overrides: HandlerType = {}
// ) {
// 	return new Proxy(overrides, {
// 		get(target, prop:string) {
// 			if (prop in target) {
// 				return target[prop];
// 			}
// 			return (...args: any[]) => relay({
// 				method: prop,
// 				args
// 			});
// 		}
// 	}) as ProtocolClientOf<Handler>;
// }

// const c = clientOf<PHPProtocolHandler>();
// c.listFiles('/');

// const handler = {} as PHPProtocolHandler;
// const serverEventHandler = (data: ProtocolMessage) => {
// 	if(!(data.method in handler)) {
// 		throw new Error(`Unknown method ${data.method}`);
// 	}
// 	return handler[data.method](...data.args);
// }

// const relayEventHandler = (data: ProtocolMessage) => {
// 	return c[data.method](...data.args);
// }