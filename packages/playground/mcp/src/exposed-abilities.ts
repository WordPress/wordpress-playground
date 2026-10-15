import type { AbilityDescriptor } from '@wp-playground/remote';

/**
 * The serializable subset of a WordPress ability that a browser tab
 * reports to the MCP server when the user exposes it in the Abilities
 * panel.
 */
export type ExposedAbility = Pick<
	AbilityDescriptor,
	'name' | 'label' | 'description' | 'input_schema' | 'meta'
>;

/**
 * Bridge command a site-level MCP tool sends to execute an exposed
 * ability. Arguments: `[name, input]`.
 */
export const EXECUTE_ABILITY_COMMAND = 'executeAbility';

/**
 * Tool name shared by WebMCP and the MCP server. WordPress restricts
 * ability names to `namespace/slug`, so replacing the slash with a dot
 * yields a valid, collision-free tool name.
 */
export function abilityToolName(abilityName: string): string {
	return `wp_ability_${abilityName.replace('/', '.')}`;
}

/**
 * Strips an ability down to the fields the MCP server needs, so the
 * bridge does not ship output schemas or other unused data.
 */
export function toExposedAbility(ability: ExposedAbility): ExposedAbility {
	return {
		name: ability.name,
		label: ability.label,
		description: ability.description,
		input_schema: ability.input_schema ?? null,
		meta: ability.meta ?? {},
	};
}
