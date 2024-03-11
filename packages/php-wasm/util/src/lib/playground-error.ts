export class PlaygroundError extends Error {
	constructor(message: string, public userFriendlyMessage?: string) {
		super(message);
		if (!this.userFriendlyMessage) {
			this.userFriendlyMessage = message;
		}
	}
}
