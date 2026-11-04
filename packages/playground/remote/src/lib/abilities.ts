/** JSON values accepted by WordPress abilities. */
export type AbilityInput =
	| null
	| boolean
	| number
	| string
	| AbilityInput[]
	| { [key: string]: AbilityInput };

export interface AbilityDescriptor {
	name: string;
	label: string;
	description: string;
	category: string;
	input_schema: Record<string, unknown> | null;
	output_schema: Record<string, unknown> | null;
	meta: Record<string, unknown>;
}

export interface AbilityError {
	code: string;
	message: string;
	data?: unknown;
}

export type AbilityResult =
	| { success: true; data: unknown }
	| { success: false; errors: AbilityError[] };

export interface AbilitiesList {
	available: boolean;
	user: { id: number; name: string };
	abilities: AbilityDescriptor[];
}
