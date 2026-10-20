/*
 * Ability tools use Zod v4 (the rest of the MCP tools use `zod/v3`)
 * because only v4 lets us attach an ability's raw JSON Schema through
 * `.meta()`, which the SDK merges verbatim into the advertised
 * inputSchema. WordPress validates the input against the same schema.
 */
import * as z from 'zod/v4';
import type {
	McpServer,
	RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { AbilityResult } from '@wp-playground/remote';
import type {
	ExposedAbilitiesBySite,
	PlaygroundBridge,
} from '../bridge-server';
import { abilityToolName, EXECUTE_ABILITY_COMMAND } from '../exposed-abilities';
import type { ExposedAbility } from '../exposed-abilities';
import { stringifyError } from './tool-definitions';

/** Everything the MCP server needs to advertise one ability tool. */
export interface AbilityToolSpec {
	toolName: string;
	abilityName: string;
	title: string;
	description: string;
	inputSchema: Record<string, unknown> | null;
	annotations: ToolAnnotations;
	siteIds: string[];
}

type AbilityToolBridge = Pick<
	PlaygroundBridge,
	'listExposedAbilities' | 'onAbilitiesChanged' | 'sendCommand'
>;

type AbilityToolServer = Pick<McpServer, 'registerTool'>;

type ToolResult = {
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
};

/**
 * Keeps one `wp_ability_*` MCP tool per exposed ability name in sync
 * with the abilities browser tabs expose. The SDK emits
 * `notifications/tools/list_changed` whenever a tool is added,
 * updated or removed. Returns a function that stops syncing and
 * removes all ability tools.
 */
export function registerAbilityTools(
	server: AbilityToolServer,
	bridge: AbilityToolBridge
): () => void {
	const tools = new Map<
		string,
		{ tool: RegisteredTool; signature: string }
	>();

	const sync = (abilities: ExposedAbilitiesBySite) => {
		const specs = buildAbilityToolSpecs(abilities);
		for (const [toolName, entry] of tools) {
			if (!specs.has(toolName)) {
				entry.tool.remove();
				tools.delete(toolName);
			}
		}
		for (const [toolName, spec] of specs) {
			const signature = JSON.stringify(spec);
			const existing = tools.get(toolName);
			if (existing?.signature === signature) {
				continue;
			}
			const config = {
				title: spec.title,
				description: spec.description,
				annotations: spec.annotations,
			};
			if (existing) {
				existing.tool.update({
					...config,
					paramsSchema: abilityInputShape(spec.inputSchema),
				});
				existing.signature = signature;
				continue;
			}
			const tool = server.registerTool(
				toolName,
				{ ...config, inputSchema: abilityInputShape(spec.inputSchema) },
				async ({ siteId, input }) =>
					await callAbilityTool(
						bridge,
						spec.abilityName,
						siteId,
						input
					)
			);
			tools.set(toolName, { tool, signature });
		}
	};

	sync(bridge.listExposedAbilities());
	const unsubscribe = bridge.onAbilitiesChanged(sync);
	return () => {
		unsubscribe();
		for (const { tool } of tools.values()) {
			tool.remove();
		}
		tools.clear();
	};
}

/**
 * Groups exposed abilities by tool name. When several sites expose the
 * same ability, the first site (by ID) provides the description and
 * schema, and every exposing site is listed as a valid `siteId`.
 */
export function buildAbilityToolSpecs(
	abilities: ExposedAbilitiesBySite
): Map<string, AbilityToolSpec> {
	const bySite = [...abilities].sort(([a], [b]) => a.localeCompare(b));
	const specs = new Map<string, AbilityToolSpec>();
	for (const [siteId, siteAbilities] of bySite) {
		for (const ability of siteAbilities) {
			const toolName = abilityToolName(ability.name);
			const existing = specs.get(toolName);
			if (existing) {
				if (!existing.siteIds.includes(siteId)) {
					existing.siteIds.push(siteId);
				}
				continue;
			}
			specs.set(toolName, {
				toolName,
				abilityName: ability.name,
				title: ability.label || ability.name,
				description:
					ability.description || ability.label || ability.name,
				inputSchema: ability.input_schema ?? null,
				annotations: abilityAnnotations(ability),
				siteIds: [siteId],
			});
		}
	}
	for (const spec of specs.values()) {
		spec.description +=
			`\n\nWordPress ability "${spec.abilityName}", exposed by the ` +
			`user in the Playground Abilities panel. Available on siteId: ` +
			`${spec.siteIds.join(', ')}.`;
	}
	return specs;
}

/**
 * Maps WordPress ability annotations to MCP tool annotations. The
 * Abilities API stores them under `meta.annotations`.
 */
export function abilityAnnotations(ability: ExposedAbility): ToolAnnotations {
	const source = ability.meta?.['annotations'];
	const annotations: ToolAnnotations = {
		title: ability.label || ability.name,
	};
	if (!source || typeof source !== 'object') {
		return annotations;
	}
	const { readonly, destructive, idempotent } = source as Record<
		string,
		unknown
	>;
	if (typeof readonly === 'boolean') {
		annotations.readOnlyHint = readonly;
	}
	if (typeof destructive === 'boolean') {
		annotations.destructiveHint = destructive;
	}
	if (typeof idempotent === 'boolean') {
		annotations.idempotentHint = idempotent;
	}
	return annotations;
}

/**
 * Converts an ability result into an MCP tool result. Failed abilities
 * become `isError` results carrying WordPress' error messages.
 */
export function abilityResultToToolResult(result: AbilityResult): ToolResult {
	if (result && result.success === false) {
		const messages = (result.errors ?? []).map(
			(error) => `${error.message} (${error.code})`
		);
		return {
			content: [
				{
					type: 'text',
					text:
						'Ability failed: ' +
						(messages.join('; ') || 'Unknown error'),
				},
			],
			isError: true,
		};
	}
	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(result?.data ?? null),
			},
		],
	};
}

async function callAbilityTool(
	bridge: AbilityToolBridge,
	abilityName: string,
	siteId: string,
	input: unknown
): Promise<ToolResult> {
	const exposedBySite = bridge.listExposedAbilities().get(siteId) ?? [];
	if (!exposedBySite.some((ability) => ability.name === abilityName)) {
		return errorResult(
			new Error(
				`Site ${siteId} does not expose the ability "${abilityName}". ` +
					'The user can enable it in the Abilities panel.'
			)
		);
	}
	try {
		const result = (await bridge.sendCommand(
			siteId,
			EXECUTE_ABILITY_COMMAND,
			[abilityName, input]
		)) as AbilityResult;
		return abilityResultToToolResult(result);
	} catch (error) {
		return errorResult(error);
	}
}

function abilityInputShape(inputSchema: Record<string, unknown> | null) {
	return {
		siteId: z
			.string()
			.describe(
				'Target site ID. Must be one of the sites listed in this ' +
					"tool's description."
			),
		input: abilityInputSchema(inputSchema),
	};
}

/**
 * Accepts any JSON value and advertises the ability's JSON Schema.
 * `id` is dropped because Zod's registry treats it as a unique key.
 */
function abilityInputSchema(inputSchema: Record<string, unknown> | null) {
	const input = z.unknown().optional();
	if (!inputSchema || typeof inputSchema !== 'object') {
		return input.describe('Ability input. This ability takes no schema.');
	}
	const meta = structuredClone(inputSchema);
	delete meta['id'];
	return input.meta(meta);
}

function errorResult(error: unknown): ToolResult {
	return {
		content: [
			{
				type: 'text',
				text: `Error executing ability: ${stringifyError(error)}`,
			},
		],
		isError: true,
	};
}
