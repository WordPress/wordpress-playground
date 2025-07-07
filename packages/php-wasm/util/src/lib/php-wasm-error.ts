export class PhpWasmError extends Error {
	userFriendlyMessage?: string;
	constructor(message: string, userFriendlyMessage?: string) {
		super(message);
		this.userFriendlyMessage = userFriendlyMessage ?? message;
	}
}
