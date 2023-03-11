import type { PHPRequest, PHPResponse } from './php';
import { removeURLScope } from './scope';
import { getPathQueryFragment } from './urls';

type RPCHandler = (
	method: string,
	args?: Record<string, any>,
	timeout?: number
) => Promise<any>;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A base class for controlling the PHP instance running in another
 * contexts. Implement the `rpc` method to call the methods of the
 * remote PHP instance.
 */
export class PHPProtocolClient {

	#rpc: RPCHandler;
	#isAlive?: Promise<void>;
	#absoluteUrl?: string;

	constructor(rpcHandler: RPCHandler) {
		this.#rpc = rpcHandler;
	}

	async init() {
		if (!this.#isAlive) {
			this.#isAlive = new Promise(async (resolve) => {
				// Keep asking if the worker is alive until we get a response
				while (true) {
					try {
						await this.#rpc('isAlive', {}, 50);
						resolve();
						break;
					} catch (e) {
						// Ignore timeouts
					}
					await sleep(50);
				}
			});
			this.#absoluteUrl = await this.getAbsoluteUrl();
		}
		return await this.#isAlive;
	}

	async getAbsoluteUrl() {
		return await this.#rpc('getAbsoluteUrl');
	}

	async getScope() {
		return await this.#rpc('getScope');
	}

	/**
	 * Converts a path to an absolute URL based at the PHPServer
	 * root.
	 *
	 * @param  path The server path to convert to an absolute URL.
	 * @returns The absolute URL.
	 */
	pathToInternalUrl(path: string): string {
		return `${this.#absoluteUrl}${path}`;
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
	async run(code: string): Promise<PHPResponse> {
		return await this.#rpc('run', { code });
	}

	/**
	 * @param  request
	 * @see {PHP.request}
	 */
	async HTTPRequest(
		request: PHPRequest
	): Promise<PHPResponse & { text: string }> {
		const response = (await this.#rpc('HTTPRequest', {
			request,
		})) as PHPResponse;
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
	async readFile(path: string): Promise<string> {
		return await this.#rpc('readFile', { path });
	}

	/**
	 * @param  path
	 * @param  contents
	 * @see {PHP.writeFile}
	 */
	async writeFile(path: string, contents: string): Promise<void> {
		return await this.#rpc('writeFile', { path, contents });
	}

	/**
	 * @param  path
	 * @see {PHP.unlink}
	 */
	async unlink(path: string): Promise<void> {
		return await this.#rpc('unlink', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.mkdirTree}
	 */
	async mkdirTree(path: string): Promise<void> {
		return await this.#rpc('mkdirTree', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.listFiles}
	 */
	async listFiles(path: string): Promise<string[]> {
		return await this.#rpc('listFiles', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.isDir}
	 */
	async isDir(path: string): Promise<boolean> {
		return await this.#rpc('isDir', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.fileExists}
	 */
	async fileExists(path: string): Promise<boolean> {
		return await this.#rpc('fileExists', { path });
	}

}
