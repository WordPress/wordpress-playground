import { hasRuntimeImportInSource } from './executor';

describe('packageJsonExecutor', () => {
	it('excludes type-only package imports from runtime dependencies', () => {
		expect(
			hasRuntimeImportInSource(
				"import type { PHPLoaderModule } from '@php-wasm/universal';",
				'index.ts',
				'@php-wasm/universal'
			)
		).toBe(false);
		expect(
			hasRuntimeImportInSource(
				"import { type PHPLoaderModule } from '@php-wasm/universal';",
				'index.ts',
				'@php-wasm/universal'
			)
		).toBe(false);
	});

	it('includes static and dynamic runtime package imports', () => {
		expect(
			hasRuntimeImportInSource(
				"export { PHP } from '@php-wasm/universal';",
				'index.ts',
				'@php-wasm/universal'
			)
		).toBe(true);
		expect(
			hasRuntimeImportInSource(
				"await import('@php-wasm/universal');",
				'index.ts',
				'@php-wasm/universal'
			)
		).toBe(true);
	});
});
