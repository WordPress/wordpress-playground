import { describe, it, expect } from 'vitest';
import { isTrustedSource } from './trusted-sources';
import type { BlueprintSource } from '../state/url/resolve-blueprint-from-url';

describe('isTrustedSource', () => {
	describe('trusted sources', () => {
		it('trusts type: none (query param blueprints like ?plugin=friends)', () => {
			const source: BlueprintSource = { type: 'none' };
			expect(isTrustedSource(source)).toBe(true);
		});

		it('trusts official WordPress blueprints repository', () => {
			const source: BlueprintSource = {
				type: 'remote-url',
				url: 'https://raw.githubusercontent.com/WordPress/blueprints/my-wordpress/apps/woocommerce.json',
			};
			expect(isTrustedSource(source)).toBe(true);
		});

		it('trusts WordPress blueprints repo root', () => {
			const source: BlueprintSource = {
				type: 'remote-url',
				url: 'https://raw.githubusercontent.com/WordPress/blueprints/main/blueprint.json',
			};
			expect(isTrustedSource(source)).toBe(true);
		});

		it('trusts wordpress.org plugin API', () => {
			const source: BlueprintSource = {
				type: 'remote-url',
				url: 'https://wordpress.org/plugins/wp-json/plugins/v1/plugin/woocommerce',
			};
			expect(isTrustedSource(source)).toBe(true);
		});

		it('trusts personal-blueprint type from trusted URLs', () => {
			const source: BlueprintSource = {
				type: 'personal-blueprint',
				url: 'https://raw.githubusercontent.com/WordPress/blueprints/my-wordpress/test.json',
			};
			expect(isTrustedSource(source)).toBe(true);
		});
	});

	describe('untrusted sources', () => {
		it('does not trust data: URLs (can contain arbitrary content)', () => {
			const source: BlueprintSource = {
				type: 'remote-url',
				url: 'data:application/json;base64,eyJzdGVwcyI6W119',
			};
			expect(isTrustedSource(source)).toBe(false);
		});

		it('does not trust inline-string type (hash fragments)', () => {
			const source: BlueprintSource = { type: 'inline-string' };
			expect(isTrustedSource(source)).toBe(false);
		});

		it('does not trust last-autosave type', () => {
			const source: BlueprintSource = { type: 'last-autosave' };
			expect(isTrustedSource(source)).toBe(false);
		});

		it('does not trust opfs-site type', () => {
			const source: BlueprintSource = { type: 'opfs-site' };
			expect(isTrustedSource(source)).toBe(false);
		});

		it('does not trust arbitrary external URLs', () => {
			const source: BlueprintSource = {
				type: 'remote-url',
				url: 'https://example.com/malicious-blueprint.json',
			};
			expect(isTrustedSource(source)).toBe(false);
		});

		it('does not trust other GitHub repositories', () => {
			const source: BlueprintSource = {
				type: 'remote-url',
				url: 'https://raw.githubusercontent.com/someone/their-repo/main/blueprint.json',
			};
			expect(isTrustedSource(source)).toBe(false);
		});

		it('does not trust URLs that look similar but are not exact prefix matches', () => {
			const source: BlueprintSource = {
				type: 'remote-url',
				url: 'https://raw.githubusercontent.com/WordPress/blueprints-fake/main/bp.json',
			};
			expect(isTrustedSource(source)).toBe(false);
		});

		it('does not trust personal-blueprint type from untrusted URLs', () => {
			const source: BlueprintSource = {
				type: 'personal-blueprint',
				url: 'https://untrusted.com/blueprint.json',
			};
			expect(isTrustedSource(source)).toBe(false);
		});
	});
});
