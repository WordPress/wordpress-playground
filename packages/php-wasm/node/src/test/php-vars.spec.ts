import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { phpVar } from '@php-wasm/util';
import { NodePHP } from '../lib';

/**
 * This is an awkward place to test phpVar() which lives in a
 * different package, but it's convenient because we can use a
 * NodePHP instance here. Unfortunately, using NodePHP in
 * @php-wasm/util creates a circular dependency between the
 * two packages.
 */
describe('phpVar', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(LatestSupportedPHPVersion);
	});

	const data = [
		'Hello, World', // Basic string
		`This is \`Playground's\` "test suite"`, // Different types of quotes
		`This is \\\\\`Playground's\\\` \\"test suite\\"\\`, // Backslashes
		`$variables \\$variables $$variables`, // A dollar sign
		`\n\r\t`, // Special whitespace characters
		'こんにちは', // Unicode characters
		5, // Integers
		5.7, // Floats
		[5, 'test'], // Arrays
		[1, ['a', 'b'], 3], // Nested arrays
		{ a: 5, b: 'test' }, // Objects
		{ outer: { inner: 'value' } }, // Nested objects
	];
	it.each(data)('Encodes %s', async (data) => {
		const result = await php.run({
			code: `<?php
			echo json_encode(${phpVar(data)});
		`,
		});
		expect(JSON.parse(result.text)).toEqual(data);
	});
});
