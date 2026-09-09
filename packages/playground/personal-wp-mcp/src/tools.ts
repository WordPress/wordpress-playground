import { z } from 'zod/v3';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface PersonalWpMcpBridge {
	sendCommand(
		siteId: string,
		command: string,
		args?: unknown[]
	): Promise<unknown>;
}

interface PhpRunResponse {
	text: string;
	errors?: string;
	exitCode?: number;
}

interface PluginGuidanceEntry {
	namespace: string;
	useWhen: string[];
	instructions: string;
	source: 'ai_assistant_ability_domains';
}

const siteIdSchema = z
	.string()
	.describe(
		'Target site ID. Call playground_list_sites first to discover available site IDs.'
	);

export function registerPersonalWpMcpTools(
	server: McpServer,
	bridge: PersonalWpMcpBridge
) {
	server.registerTool(
		'mywp_get_plugin_guidance',
		{
			title: 'Get MyWP Plugin Guidance',
			description: `Collect plugin-provided AI Assistant guidance from the
				connected WordPress site and return prompt-ready instructions
				for when an external client should prefer specific plugin
				abilities through the WordPress Abilities API. This applies
				the AI Assistant filters directly without requiring the AI
				Assistant plugin.`,
			inputSchema: {
				siteId: siteIdSchema,
			},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: true,
			},
		},
		async ({ siteId }) => {
			const response = (await bridge.sendCommand(siteId, 'run', [
				{ code: pluginGuidancePhp },
			])) as PhpRunResponse;

			if (response.exitCode && response.exitCode !== 0) {
				throw new Error(
					response.errors || 'Unable to collect guidance'
				);
			}

			const collected = parseCollectedGuidance(response.text);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(
							createMywpPluginGuidance(collected)
						),
					},
				],
			};
		}
	);
}

export function createMywpPluginGuidance(collected: unknown) {
	const collectedRecord = isRecord(collected) ? collected : {};
	const aiAssistantDomains = isRecord(collectedRecord['aiAssistantDomains'])
		? collectedRecord['aiAssistantDomains']
		: {};
	const aiAssistantWelcomeTips = isRecord(
		collectedRecord['aiAssistantWelcomeTips']
	)
		? collectedRecord['aiAssistantWelcomeTips']
		: {};
	const entries = normalizeAiAssistantDomainEntries(aiAssistantDomains);

	return {
		summary:
			'Use the systemPrompt field to extend an MCP client system prompt with MyWP plugin ability guidance. When a user asks about a listed category or domain, prefer the WordPress Abilities API through playground_request before lower-level tools such as db_query, find, or direct PHP inspection. The AI Assistant filters are applied directly in WordPress and do not require the AI Assistant plugin to be installed.',
		filters: ['ai_assistant_ability_domains', 'ai_assistant_welcome_tips'],
		entries,
		systemPrompt: createPluginGuidancePrompt(entries),
		welcomeTips: aiAssistantWelcomeTips,
		shape: {
			entries:
				'Structured category/domain mappings from ai_assistant_ability_domains.',
			systemPrompt:
				'Running text suitable for appending to an MCP client system prompt.',
			welcomeTips:
				'Structured contextual tips from ai_assistant_welcome_tips.',
		},
	};
}

function parseCollectedGuidance(text: string): unknown {
	try {
		return JSON.parse(text.trim() || '{}');
	} catch {
		return {};
	}
}

function normalizeAiAssistantDomainEntries(
	domains: Record<string, unknown>
): PluginGuidanceEntry[] {
	return Object.entries(domains)
		.map(([namespace, terms]) => {
			const useWhen = stringifyList(terms);
			return {
				namespace,
				useWhen,
				instructions:
					useWhen.length > 0
						? `Use ${namespace} abilities when the user asks about ${useWhen.join(', ')}.`
						: `Use ${namespace} abilities for requests in this plugin domain.`,
				source: 'ai_assistant_ability_domains' as const,
			};
		})
		.filter((entry) => entry.namespace !== '')
		.sort((a, b) => a.namespace.localeCompare(b.namespace));
}

function createPluginGuidancePrompt(entries: PluginGuidanceEntry[]): string {
	if (entries.length === 0) {
		return 'No plugin-specific MyWP guidance was registered for this site.';
	}

	return [
		'The following topics are handled by plugin abilities. For these, prefer the WordPress Abilities API via playground_request before lower-level tools such as db_query, find, or direct PHP inspection:',
		...entries.map((entry) => {
			const useWhen =
				entry.useWhen.length > 0
					? entry.useWhen.join(', ')
					: entry.namespace;
			const instructions = entry.instructions
				? ` ${entry.instructions}`
				: '';
			return `- ${entry.namespace}: ${useWhen}.${instructions}`;
		}),
		'These slugs are ability categories/domains, not executable ability IDs. First request the abilities list for the matching category or domain, then request details for the exact ability ID before executing it through the WordPress Abilities API.',
	].join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringify(value: unknown): string {
	if (typeof value === 'string') {
		return value.trim();
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return '';
}

function stringifyList(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map(stringify).filter(Boolean);
	}
	return stringify(value)
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

const pluginGuidancePhp = `<?php
require_once "/wordpress/wp-load.php";

$ai_assistant_domains = apply_filters( 'ai_assistant_ability_domains', [] );
$ai_assistant_welcome_tips = apply_filters(
    'ai_assistant_welcome_tips',
    [],
    [ 'path' => parse_url( home_url( add_query_arg( [] ) ), PHP_URL_PATH ) ?: '/' ]
);

echo wp_json_encode( [
    'aiAssistantDomains'     => is_array( $ai_assistant_domains ) ? $ai_assistant_domains : [],
    'aiAssistantWelcomeTips' => is_array( $ai_assistant_welcome_tips ) ? $ai_assistant_welcome_tips : [],
] );
`;
