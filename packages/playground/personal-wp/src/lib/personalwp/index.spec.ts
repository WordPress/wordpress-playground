import { describe, it, expect, vi } from 'vitest';

// Set up browser globals before any imports that might need them
// @ts-ignore - minimal mock for testing
global.location = {
	origin: 'https://playground.wordpress.net',
	href: 'https://playground.wordpress.net/',
};
// @ts-ignore - minimal mock for testing
global.window = global.window || {};
// @ts-ignore
global.window.self = global.window;
// @ts-ignore
global.window.top = global.window;

// Mock fetch for potential network requests
global.fetch = vi.fn();

// Now we can import the module
const {
	resolveUrlParamsForExistingSite,
	shouldUsePersonalWPBlueprint,
	withoutUrlBlueprint,
} = await import('./index');

describe('Personal WP launch URLs', () => {
	it('ignores arbitrary Blueprints while retaining supported options', () => {
		const original = new URL(
			'https://my.wordpress.net/?plugin=woocommerce&blueprint-url=https://example.com/blueprint.json#{"steps":[]}'
		);
		const safeUrl = withoutUrlBlueprint(original);

		expect(safeUrl.searchParams.get('plugin')).toBe('woocommerce');
		expect(safeUrl.searchParams.has('blueprint-url')).toBe(false);
		expect(safeUrl.hash).toBe('');
		expect(original.searchParams.has('blueprint-url')).toBe(true);
	});

	it('uses the default Blueprint when only a blocked Blueprint was supplied', () => {
		const safeUrl = withoutUrlBlueprint(
			new URL(
				'https://my.wordpress.net/?blueprint-url=https://example.com/blueprint.json'
			)
		);
		expect(
			shouldUsePersonalWPBlueprint(
				safeUrl,
				'https://example.com/default.json'
			)
		).toBe(true);
	});
});

describe('resolveUrlParamsForExistingSite', () => {
	it('does not act on a blocked Blueprint URL', async () => {
		const url = withoutUrlBlueprint(
			new URL(
				'https://my.wordpress.net/?blueprint-url=https://example.com/blueprint.json'
			)
		);
		expect(await resolveUrlParamsForExistingSite(url)).toBeNull();
		expect(global.fetch).not.toHaveBeenCalled();
	});
	it('returns null when no actionable URL params are present', async () => {
		const url = new URL('https://playground.wordpress.net/');
		const result = await resolveUrlParamsForExistingSite(url);
		expect(result).toBeNull();
	});

	it('returns null for non-actionable params like ?mode=', async () => {
		const url = new URL('https://playground.wordpress.net/?mode=seamless');
		const result = await resolveUrlParamsForExistingSite(url);
		expect(result).toBeNull();
	});

	it('returns blueprint with plugins property for ?plugin= param', async () => {
		const url = new URL(
			'https://playground.wordpress.net/?plugin=woocommerce'
		);
		const result = await resolveUrlParamsForExistingSite(url);

		expect(result).not.toBeNull();
		expect(result?.plugins).toEqual(['woocommerce']);
	});

	it('returns blueprint with multiple plugins for multiple ?plugin= params', async () => {
		const url = new URL(
			'https://playground.wordpress.net/?plugin=woocommerce&plugin=jetpack'
		);
		const result = await resolveUrlParamsForExistingSite(url);

		expect(result).not.toBeNull();
		expect(result?.plugins).toEqual(['woocommerce', 'jetpack']);
	});

	it('returns blueprint with installTheme steps for ?theme= param', async () => {
		const url = new URL('https://playground.wordpress.net/?theme=flavor');
		const result = await resolveUrlParamsForExistingSite(url);

		expect(result).not.toBeNull();
		expect(result?.steps).toBeDefined();

		const themeStep = result?.steps?.find(
			(step: any) => step?.step === 'installTheme'
		);
		expect(themeStep).toBeDefined();
		expect((themeStep as any)?.themeData?.slug).toBe('flavor');
	});

	it('returns the built-in recovery blueprint for Health Check recovery mode', async () => {
		const url = new URL(
			'https://my.wordpress.net/?playground-recovery-mode=health-check'
		);
		const result = await resolveUrlParamsForExistingSite(url);
		const firstStep = result?.steps?.[0];

		expect(result).not.toBeNull();
		expect(typeof firstStep).toBe('object');
		expect((firstStep as any)?.step).toBe('installPlugin');
		expect((firstStep as any)?.pluginData?.slug).toBe('health-check');
	});

	it('ignores legacy ?url= params when applying query overrides', async () => {
		const url = new URL(
			'https://playground.wordpress.net/?plugin=woocommerce&url=/wp-admin/plugins.php'
		);
		const result = await resolveUrlParamsForExistingSite(url);

		expect(result).not.toBeNull();
		expect(result?.landingPage).toBeUndefined();
	});

	it('returns null for ?gutenberg-pr= (not supported for existing sites)', async () => {
		const url = new URL(
			'https://playground.wordpress.net/?gutenberg-pr=12345'
		);
		const result = await resolveUrlParamsForExistingSite(url);
		expect(result).toBeNull();
	});
});
