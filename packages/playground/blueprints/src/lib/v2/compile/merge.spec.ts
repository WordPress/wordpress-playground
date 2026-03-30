import { describe, it, expect } from 'vitest';
import { mergeBlueprintsV2 } from './merge';
import type { BlueprintV2Declaration } from '../types';
import { BlueprintMergeConflictError } from '../types';

function bp(overrides: Record<string, unknown> = {}): BlueprintV2Declaration {
	return { version: 2, ...overrides } as BlueprintV2Declaration;
}

describe('mergeBlueprintsV2', () => {
	// ============================================================
	// Edge cases
	// ============================================================

	it('returns empty V2 blueprint for empty input', () => {
		const result = mergeBlueprintsV2([]);
		expect(result.version).toBe(2);
	});

	it('returns a copy of single blueprint', () => {
		const single = bp({ siteLanguage: 'en_US' });
		const result = mergeBlueprintsV2([single]);
		expect(result).toEqual(single);
		expect(result).not.toBe(single);
	});

	// ============================================================
	// version
	// ============================================================

	it('rejects blueprints with different versions', () => {
		expect(() =>
			mergeBlueprintsV2([
				bp(),
				{ version: 3 } as unknown as BlueprintV2Declaration,
			])
		).toThrow(BlueprintMergeConflictError);
	});

	// ============================================================
	// siteLanguage / activeTheme (scalar exclusive)
	// ============================================================

	it('merges siteLanguage when only one defines it', () => {
		const result = mergeBlueprintsV2([bp(), bp({ siteLanguage: 'fr_FR' })]);
		expect((result as any).siteLanguage).toBe('fr_FR');
	});

	it('allows same siteLanguage from both', () => {
		const result = mergeBlueprintsV2([
			bp({ siteLanguage: 'de_DE' }),
			bp({ siteLanguage: 'de_DE' }),
		]);
		expect((result as any).siteLanguage).toBe('de_DE');
	});

	it('rejects conflicting siteLanguage', () => {
		expect(() =>
			mergeBlueprintsV2([
				bp({ siteLanguage: 'en_US' }),
				bp({ siteLanguage: 'fr_FR' }),
			])
		).toThrow(BlueprintMergeConflictError);
	});

	it('rejects conflicting activeTheme', () => {
		expect(() =>
			mergeBlueprintsV2([
				bp({ activeTheme: 'astra' }),
				bp({ activeTheme: 'storefront' }),
			])
		).toThrow(BlueprintMergeConflictError);
	});

	// ============================================================
	// constants / siteOptions / postTypes / fonts (key-value maps)
	// ============================================================

	it('merges non-overlapping constants', () => {
		const result = mergeBlueprintsV2([
			bp({ constants: { WP_DEBUG: true } }),
			bp({ constants: { DISALLOW_FILE_EDIT: true } }),
		]);
		expect((result as any).constants).toEqual({
			WP_DEBUG: true,
			DISALLOW_FILE_EDIT: true,
		});
	});

	it('allows identical constant values', () => {
		const result = mergeBlueprintsV2([
			bp({ constants: { WP_DEBUG: true } }),
			bp({ constants: { WP_DEBUG: true } }),
		]);
		expect((result as any).constants).toEqual({ WP_DEBUG: true });
	});

	it('rejects conflicting constant values', () => {
		expect(() =>
			mergeBlueprintsV2([
				bp({ constants: { WP_DEBUG: true } }),
				bp({ constants: { WP_DEBUG: false } }),
			])
		).toThrow(BlueprintMergeConflictError);
	});

	it('merges non-overlapping siteOptions', () => {
		const result = mergeBlueprintsV2([
			bp({ siteOptions: { blogname: 'A' } }),
			bp({ siteOptions: { blogdescription: 'B' } }),
		]);
		expect((result as any).siteOptions).toEqual({
			blogname: 'A',
			blogdescription: 'B',
		});
	});

	it('rejects conflicting siteOptions', () => {
		expect(() =>
			mergeBlueprintsV2([
				bp({ siteOptions: { blogname: 'A' } }),
				bp({ siteOptions: { blogname: 'B' } }),
			])
		).toThrow(BlueprintMergeConflictError);
	});

	// ============================================================
	// phpVersion / wordpressVersion (version constraint intersection)
	// ============================================================

	it('merges string versions (last preferred wins)', () => {
		const result = mergeBlueprintsV2([
			bp({ phpVersion: '8.1' }),
			bp({ phpVersion: '8.2' }),
		]);
		expect((result as any).phpVersion).toEqual({
			preferred: '8.2',
		});
	});

	it('intersects version ranges', () => {
		const result = mergeBlueprintsV2([
			bp({ phpVersion: { min: '8.0', max: '8.4' } }),
			bp({ phpVersion: { min: '8.1', max: '8.3' } }),
		]);
		expect((result as any).phpVersion).toEqual({
			min: '8.1',
			max: '8.3',
		});
	});

	it('rejects empty intersection', () => {
		expect(() =>
			mergeBlueprintsV2([
				bp({ phpVersion: { min: '8.0', max: '8.1' } }),
				bp({ phpVersion: { min: '8.3', max: '8.4' } }),
			])
		).toThrow(BlueprintMergeConflictError);
	});

	it('merges version with only one defining it', () => {
		const result = mergeBlueprintsV2([
			bp(),
			bp({ wordpressVersion: '6.4' }),
		]);
		expect((result as any).wordpressVersion).toBe('6.4');
	});

	// ============================================================
	// plugins / themes / muPlugins (merge by slug)
	// ============================================================

	it('merges non-overlapping plugin lists', () => {
		const result = mergeBlueprintsV2([
			bp({ plugins: ['jetpack'] }),
			bp({ plugins: ['woocommerce'] }),
		]);
		expect((result as any).plugins).toEqual(['jetpack', 'woocommerce']);
	});

	it('deduplicates identical plugin entries', () => {
		const result = mergeBlueprintsV2([
			bp({ plugins: ['jetpack'] }),
			bp({ plugins: ['jetpack'] }),
		]);
		expect((result as any).plugins).toEqual(['jetpack']);
	});

	it('rejects conflicting plugin definitions', () => {
		expect(() =>
			mergeBlueprintsV2([
				bp({
					plugins: [{ source: 'jetpack', active: true }],
				}),
				bp({
					plugins: [{ source: 'jetpack', active: false }],
				}),
			])
		).toThrow(BlueprintMergeConflictError);
	});

	it('merges theme lists', () => {
		const result = mergeBlueprintsV2([
			bp({ themes: ['astra'] }),
			bp({ themes: ['storefront'] }),
		]);
		expect((result as any).themes).toEqual(['astra', 'storefront']);
	});

	// ============================================================
	// additionalStepsAfterExecution / content / media (append)
	// ============================================================

	it('appends additionalStepsAfterExecution', () => {
		const result = mergeBlueprintsV2([
			bp({
				additionalStepsAfterExecution: [{ step: 'login' }],
			}),
			bp({
				additionalStepsAfterExecution: [
					{ step: 'runPHP', code: '<?php ?>' },
				],
			}),
		]);
		expect((result as any).additionalStepsAfterExecution).toHaveLength(2);
	});

	it('appends content entries', () => {
		const result = mergeBlueprintsV2([
			bp({ content: [{ type: 'wxr', source: 'a.xml' }] }),
			bp({ content: [{ type: 'wxr', source: 'b.xml' }] }),
		]);
		expect((result as any).content).toHaveLength(2);
	});

	it('appends media entries', () => {
		const result = mergeBlueprintsV2([
			bp({ media: [{ source: 'a.jpg' }] }),
			bp({ media: [{ source: 'b.jpg' }] }),
		]);
		expect((result as any).media).toHaveLength(2);
	});

	// ============================================================
	// users (merge by username)
	// ============================================================

	it('merges non-overlapping users', () => {
		const result = mergeBlueprintsV2([
			bp({ users: [{ username: 'alice', role: 'editor' }] }),
			bp({ users: [{ username: 'bob', role: 'author' }] }),
		]);
		expect((result as any).users).toHaveLength(2);
	});

	it('deduplicates identical users', () => {
		const result = mergeBlueprintsV2([
			bp({ users: [{ username: 'alice', role: 'editor' }] }),
			bp({ users: [{ username: 'alice', role: 'editor' }] }),
		]);
		expect((result as any).users).toHaveLength(1);
	});

	it('rejects users with conflicting roles', () => {
		expect(() =>
			mergeBlueprintsV2([
				bp({ users: [{ username: 'alice', role: 'editor' }] }),
				bp({
					users: [{ username: 'alice', role: 'administrator' }],
				}),
			])
		).toThrow(BlueprintMergeConflictError);
	});

	// ============================================================
	// roles (merge by name)
	// ============================================================

	it('merges non-overlapping roles', () => {
		const result = mergeBlueprintsV2([
			bp({
				roles: [
					{
						name: 'shop_manager',
						capabilities: { manage_shop: true },
					},
				],
			}),
			bp({
				roles: [
					{ name: 'teacher', capabilities: { manage_courses: true } },
				],
			}),
		]);
		expect((result as any).roles).toHaveLength(2);
	});

	it('rejects roles with conflicting capabilities', () => {
		expect(() =>
			mergeBlueprintsV2([
				bp({
					roles: [
						{
							name: 'shop_manager',
							capabilities: { manage_shop: true },
						},
					],
				}),
				bp({
					roles: [
						{
							name: 'shop_manager',
							capabilities: { manage_shop: false },
						},
					],
				}),
			])
		).toThrow(BlueprintMergeConflictError);
	});

	// ============================================================
	// applicationOptions (shallow merge)
	// ============================================================

	it('merges applicationOptions from multiple blueprints', () => {
		const result = mergeBlueprintsV2([
			bp({
				applicationOptions: {
					'wordpress-playground': { landingPage: '/wp-admin/' },
				},
			}),
			bp({
				applicationOptions: {
					'wordpress-playground': { login: true },
				},
			}),
		]);
		expect(
			(result as any).applicationOptions['wordpress-playground']
		).toEqual({
			landingPage: '/wp-admin/',
			login: true,
		});
	});

	// ============================================================
	// Integration
	// ============================================================

	it('merges three blueprints', () => {
		const result = mergeBlueprintsV2([
			bp({
				plugins: ['jetpack'],
				constants: { WP_DEBUG: true },
			}),
			bp({
				plugins: ['woocommerce'],
				siteLanguage: 'en_US',
			}),
			bp({
				themes: ['storefront'],
				siteOptions: { blogname: 'Store' },
			}),
		]);
		expect((result as any).plugins).toEqual(['jetpack', 'woocommerce']);
		expect((result as any).themes).toEqual(['storefront']);
		expect((result as any).constants).toEqual({ WP_DEBUG: true });
		expect((result as any).siteOptions).toEqual({
			blogname: 'Store',
		});
		expect((result as any).siteLanguage).toBe('en_US');
	});
});
