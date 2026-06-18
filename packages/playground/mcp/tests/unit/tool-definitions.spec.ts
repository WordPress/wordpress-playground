import { describe, expect, it } from 'vitest';
import {
	paramsToJsonSchema,
	playgroundUrl,
	toolDefinitions,
} from '../../src/tools/tool-definitions';

describe('playgroundUrl', () => {
	it('adds MCP query args to the default Playground URL', () => {
		expect(playgroundUrl(7999)).toBe(
			'https://playground.wordpress.net/?mcp-port=7999'
		);
	});

	it('adds MCP query args to a custom URL', () => {
		expect(playgroundUrl(7999, 'https://my.wordpress.net/')).toBe(
			'https://my.wordpress.net/?mcp-port=7999'
		);
	});

	it('preserves existing custom URL query args', () => {
		expect(playgroundUrl(7999, 'https://example.com/?foo=bar')).toBe(
			'https://example.com/?foo=bar&mcp-port=7999'
		);
	});
});

describe('paramsToJsonSchema', () => {
	it('represents playground_request body as string or object', () => {
		const schema = paramsToJsonSchema(
			toolDefinitions['playground_request'].params
		);

		expect(schema).toMatchObject({
			properties: {
				body: {
					oneOf: [{ type: 'string' }, { type: 'object' }],
				},
			},
		});
	});
});
