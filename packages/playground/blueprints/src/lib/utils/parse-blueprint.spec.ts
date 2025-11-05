import { describe, it, expect } from 'vitest';
import { parseBlueprint } from './parse-blueprint';

describe('parseBlueprint', () => {
	it('should parse JSON blueprint string', () => {
		const blueprint = { landingPage: '/?p=4' };
		const result = parseBlueprint(JSON.stringify(blueprint));
		expect(result).toEqual(blueprint);
	});

	it('should parse base64-encoded blueprint string', () => {
		const blueprint = { landingPage: '/?p=4' };
		const base64 = Buffer.from(JSON.stringify(blueprint)).toString(
			'base64'
		);
		const result = parseBlueprint(base64);
		expect(result).toEqual(blueprint);
	});

	it('should throw error for invalid blueprint', () => {
		expect(() => parseBlueprint('not valid json or base64')).toThrow(
			'Invalid blueprint'
		);
	});
});
