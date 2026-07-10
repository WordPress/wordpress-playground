import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	getSiteToolDefinitions,
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

describe('README tool list', () => {
	// Guards against the README "Available tools" section drifting out of
	// sync with the registered tools. The README is hand-maintained, so this
	// fails whenever a tool is added, removed, or renamed without an update.
	it('lists exactly the registered tools', () => {
		const registered = [
			...Object.keys(toolDefinitions),
			...Object.keys(getSiteToolDefinitions()),
		].sort();

		const readme = readFileSync(
			fileURLToPath(new URL('../../README.md', import.meta.url)),
			'utf8'
		);
		const documented = [
			...new Set(readme.match(/playground_[a-z_]+/g) ?? []),
		].sort();

		expect(documented).toEqual(registered);
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
