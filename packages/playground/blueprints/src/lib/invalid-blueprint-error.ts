/** Thrown when a Blueprint declaration does not conform to its schema. */
export class InvalidBlueprintError extends Error {
	public readonly validationErrors?: unknown;

	constructor(message: string, validationErrors?: unknown) {
		super(message);
		this.name = 'InvalidBlueprintError';
		this.validationErrors = validationErrors;
	}
}
