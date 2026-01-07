/**
 * Test that @php-wasm/node works directly in Jest (CommonJS environment).
 *
 * This test verifies that the published @php-wasm/node package can be used
 * directly in Jest without requiring --experimental-vm-modules or spawning
 * a separate process via runCLI().
 *
 * Related issue: The per-version packages (@php-wasm/node-8-3, etc.) contain
 * ESM syntax (import.meta.url) that breaks in Jest's CommonJS sandbox.
 */

const originalNode = jest.requireActual('@php-wasm/node');
const originalUniversal = jest.requireActual('@php-wasm/universal');

describe('@php-wasm/node direct usage in Jest', () => {
	// Test with PHP 8.3 as a representative version
	it('should load PHP runtime directly without spawning a child process', async () => {
		// This call will fail with:
		// - "TypeError: A dynamic import callback was invoked without --experimental-vm-modules"
		// - or "SyntaxError: Cannot use 'import.meta' outside a module"
		const runtimeId = await originalNode.loadNodeRuntime('8.3');

		const php = new originalUniversal.PHP(runtimeId);

		// Basic PHP execution test
		const result = await php.run({
			code: '<?php echo "Hello from PHP " . PHP_VERSION;',
		});

		expect(result.text).toContain('Hello from PHP 8.3');

		php.exit();
	}, 30000);
});
