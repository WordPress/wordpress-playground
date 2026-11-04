import type { AbilityDescriptor } from '@wp-playground/remote';

export type ExposedAbility = Pick<
	AbilityDescriptor,
	'name' | 'label' | 'description' | 'input_schema' | 'meta'
>;

/** WordPress names contain one slash; use a dot for WebMCP and MCP tool names. */
export function abilityToolName(abilityName: string): string {
	return `wp_ability_${abilityName.replace('/', '.')}`;
}

/** Omit output schemas and category data from bridge registrations. */
export function toExposedAbility(ability: ExposedAbility): ExposedAbility {
	return {
		name: ability.name,
		label: ability.label,
		description: ability.description,
		input_schema: ability.input_schema ?? null,
		meta: ability.meta ?? {},
	};
}
