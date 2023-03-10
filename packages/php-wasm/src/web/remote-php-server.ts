import type { PHPRequest, PHPResponse } from '../php-library/php';

/**
 * A base class for controlling the PHP instance running in another
 * contexts. Implement the `rpc` method to call the methods of the
 * remote PHP instance.
 */
export abstract class PHPBackend {
	/**
	 * @param  code
	 * @see {PHP.run}
	 */
	async run(code: string): Promise<PHPResponse> {
		return await this.rpc('run', { code });
	}

	/**
	 * @param  request
	 * @see {PHP.request}
	 */
	async HTTPRequest(
		request: PHPRequest
	): Promise<PHPResponse & { text: string }> {
		const response = (await this.rpc('HTTPRequest', {
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
		return await this.rpc('readFile', { path });
	}

	/**
	 * @param  path
	 * @param  contents
	 * @see {PHP.writeFile}
	 */
	async writeFile(path: string, contents: string): Promise<void> {
		return await this.rpc('writeFile', { path, contents });
	}

	/**
	 * @param  path
	 * @see {PHP.unlink}
	 */
	async unlink(path: string): Promise<void> {
		return await this.rpc('unlink', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.mkdirTree}
	 */
	async mkdirTree(path: string): Promise<void> {
		return await this.rpc('mkdirTree', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.listFiles}
	 */
	async listFiles(path: string): Promise<string[]> {
		return await this.rpc('listFiles', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.isDir}
	 */
	async isDir(path: string): Promise<boolean> {
		return await this.rpc('isDir', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.fileExists}
	 */
	async fileExists(path: string): Promise<boolean> {
		return await this.rpc('fileExists', { path });
	}

	protected abstract rpc<T>(
		type: string,
		args?: Record<string, any>
	): Promise<T>;
}
