export class PhpWasmError extends Error {
	constructor(message: string, public userFriendlyMessage?: string) {
		super(message);
		if (!this.userFriendlyMessage) {
			this.userFriendlyMessage = message;
		}
	}
}
