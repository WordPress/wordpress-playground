import { describe, expect, it } from 'vitest';
import { RecommendedPHPVersion } from '@wp-playground/common';
import type { BlueprintV1Declaration } from '../lib/v1/types';
import { mergeBlueprintVersions } from '../lib/merge-blueprint-versions';

describe('mergeBlueprintVersions', () => {
	it('returns defaults when neither blueprint nor overrides specify versions', () => {
		const result = mergeBlueprintVersions({}, {});
		expect(result.preferredVersions).toEqual({
			php: RecommendedPHPVersion,
			wp: 'latest',
		});
	});

	it('uses blueprint versions when no override is provided', () => {
		const blueprint: BlueprintV1Declaration = {
			preferredVersions: { php: '8.2', wp: '6.5' },
		};
		const result = mergeBlueprintVersions(blueprint, {});
		expect(result.preferredVersions).toEqual({ php: '8.2', wp: '6.5' });
	});

	it('lets external overrides win over blueprint-declared versions', () => {
		const blueprint: BlueprintV1Declaration = {
			preferredVersions: { php: '8.2', wp: '6.5' },
		};
		const result = mergeBlueprintVersions(blueprint, {
			php: '8.4',
			wp: '6.8',
		});
		expect(result.preferredVersions).toEqual({ php: '8.4', wp: '6.8' });
	});

	it('applies partial overrides without clobbering the other field', () => {
		const blueprint: BlueprintV1Declaration = {
			preferredVersions: { php: '8.2', wp: '6.5' },
		};
		expect(
			mergeBlueprintVersions(blueprint, { wp: '6.8' }).preferredVersions
		).toEqual({ php: '8.2', wp: '6.8' });
		expect(
			mergeBlueprintVersions(blueprint, { php: '8.4' }).preferredVersions
		).toEqual({ php: '8.4', wp: '6.5' });
	});

	it('treats empty-string overrides as "no override"', () => {
		// Matches the historical `URLSearchParams.get(...) || fallback` behavior.
		const blueprint: BlueprintV1Declaration = {
			preferredVersions: { php: '8.2', wp: '6.5' },
		};
		const result = mergeBlueprintVersions(blueprint, {
			php: '',
			wp: '',
		});
		expect(result.preferredVersions).toEqual({ php: '8.2', wp: '6.5' });
	});

	it('falls back to defaults when overrides are absent and blueprint omits versions', () => {
		const result = mergeBlueprintVersions({} as BlueprintV1Declaration, {
			php: undefined,
			wp: undefined,
		});
		expect(result.preferredVersions).toEqual({
			php: RecommendedPHPVersion,
			wp: 'latest',
		});
	});

	it('preserves PHP-only opt-out (wp: false) and ignores overrides', () => {
		const blueprint: BlueprintV1Declaration = {
			preferredVersions: { php: '8.2', wp: false },
		};
		const result = mergeBlueprintVersions(blueprint, {
			php: '8.4',
			wp: '6.8',
		});
		expect(result).toBe(blueprint);
		expect(result.preferredVersions).toEqual({ php: '8.2', wp: false });
	});

	it('does not mutate the input blueprint', () => {
		const blueprint: BlueprintV1Declaration = {
			preferredVersions: { php: '8.2', wp: '6.5' },
		};
		const snapshot = JSON.parse(JSON.stringify(blueprint));
		mergeBlueprintVersions(blueprint, { php: '8.4', wp: '6.8' });
		expect(blueprint).toEqual(snapshot);
	});

	it('preserves unrelated blueprint fields', () => {
		const blueprint: BlueprintV1Declaration = {
			landingPage: '/wp-admin/',
			login: true,
			steps: [{ step: 'login' as const }],
		};
		const result = mergeBlueprintVersions(blueprint, { php: '8.4' });
		expect(result.landingPage).toBe('/wp-admin/');
		expect(result.login).toBe(true);
		expect(result.steps).toEqual([{ step: 'login' }]);
		expect(result.preferredVersions).toEqual({
			php: '8.4',
			wp: 'latest',
		});
	});
});
