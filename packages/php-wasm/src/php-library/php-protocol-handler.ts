import { PHPBrowser } from '.';
import { responseTo } from './messaging';

type RespondFunction = (response: any) => void;

/**
 * Handles messages from PHPProtocolClient
 */
export class PHPProtocolHandler {
	#phpBrowser: PHPBrowser;
	#scope: string;
	#respond: RespondFunction;

	constructor(phpBrowser: PHPBrowser, scope: string, respond: RespondFunction) {
		this.#phpBrowser = phpBrowser;
		this.#scope = scope;
		this.#respond = respond;
	}
	
	async onEvent(event) {
		const result = await this.handle(event.data);

		// When `requestId` is present, the other thread expects a response:
		if (event.data.requestId) {
			const response = responseTo(event.data.requestId, result);
			this.#respond(response);
		}
	}

	/**
	 * @param  code
	 * @see {PHP.run}
	 */
	handle(message: any): any {
		const args = message.args;
		const phpBrowser = this.#phpBrowser;
		if (message.type === 'isAlive') {
			return true;
		} else if (message.type === 'getAbsoluteUrl') {
			return this.#phpBrowser.server.absoluteUrl;
		} else if (message.type === 'getScope') {
			return this.#scope;
		} else if (message.type === 'readFile') {
			return this.#phpBrowser.server.php.readFileAsText(args.path);
		} else if (message.type === 'readFileAsBuffer') {
			return this.#phpBrowser.server.php.readFileAsBuffer(args.path);
		} else if (message.type === 'listFiles') {
			return this.#phpBrowser.server.php.listFiles(args.path);
		} else if (message.type === 'unlink') {
			return this.#phpBrowser.server.php.unlink(args.path);
		} else if (message.type === 'isDir') {
			return this.#phpBrowser.server.php.isDir(args.path);
		} else if (message.type === 'mkdirTree') {
			return this.#phpBrowser.server.php.mkdirTree(args.path);
		} else if (message.type === 'writeFile') {
			return this.#phpBrowser.server.php.writeFile(
				args.path,
				args.contents
			);
		} else if (message.type === 'fileExists') {
			return this.#phpBrowser.server.php.fileExists(args.path);
		} else if (message.type === 'run') {
			return this.#phpBrowser.server.php.run(args.code);
		} else if (message.type === 'HTTPRequest') {
			return this.#phpBrowser.request(args.request);
		} else {
			throw new Error(`Unknown message type: ${message.type}`);
		}
	}

}
