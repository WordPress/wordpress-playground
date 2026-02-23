import { z } from 'zod/v3';
import type { PHPResponseData } from '@php-wasm/universal';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PlaygroundBridge } from '../bridge-server';
import type { ToolParam } from './tool-definitions';

/**
 * PHPResponseData after JSON round-trip through the WebSocket bridge.
 * Uint8Array becomes {0: 72, 1: 101, ...} or [72, 101, ...].
 */
export type SerializedPHPResponse = Omit<PHPResponseData, 'bytes'> & {
	bytes: Record<string, number> | number[];
};

/**
 * Decode bytes from a JSON-serialized PHPResponse.
 * Uint8Array becomes {0: 72, 1: 101, ...} or [72, 101, ...]
 * after JSON round-trip through the WebSocket bridge.
 */
export function decodeResponseBytes(
	bytes: SerializedPHPResponse['bytes']
): string {
	const values = Array.isArray(bytes) ? bytes : Object.values(bytes);
	return new TextDecoder().decode(new Uint8Array(values));
}

export function stringifyError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'string') {
		return error;
	}
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

export function errorResult(prefix: string, error: unknown) {
	return {
		content: [
			{
				type: 'text' as const,
				text: `${prefix}: ${stringifyError(error)}`,
			},
		],
		isError: true,
	};
}

export const siteIdSchema = z
	.string()
	.describe(
		'Target site ID. Call playground_list_sites first to discover ' +
			'available site IDs.'
	);

export type ToolRegistrar = (
	server: McpServer,
	bridge: PlaygroundBridge
) => void;

/**
 * Convert shared ToolParam[] to a Zod schema object suitable
 * for McpServer.registerTool(). Always includes siteId as the
 * first parameter.
 */
export function paramsToZodSchema(
	params: ToolParam[]
): Record<string, z.ZodType> {
	const schema: Record<string, z.ZodType> = {
		siteId: siteIdSchema,
	};

	for (const param of params) {
		let zodType: z.ZodType;
		switch (param.type) {
			case 'boolean':
				zodType = z.boolean();
				break;
			case 'object':
				zodType = z.record(z.string(), z.string());
				break;
			default:
				zodType = z.string();
				break;
		}

		if (!param.required) {
			zodType = zodType.optional();
			if (param.default !== undefined) {
				zodType = (zodType as z.ZodOptional<z.ZodType>).default(
					param.default
				);
			}
		}

		zodType = zodType.describe(param.description);
		schema[param.name] = zodType;
	}

	return schema;
}
