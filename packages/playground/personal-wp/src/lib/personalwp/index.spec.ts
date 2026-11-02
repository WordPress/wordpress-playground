import { describe, it, expect } from 'vitest';
import { resolveRecoveryBlueprintFromUrl } from './index';

describe('Personal WP launch URLs', () => {
	it.each([
		'?blueprint-url=https://example.com/blueprint.json',
		'?plugin=woocommerce&theme=pendant',
		'?import-site=https://example.com/site.zip',
		'?import-wxr=https://example.com/content.xml',
		'?import-content=https://example.com/content.xml',
		'?php=7.4&wp=6.4&networking=no',
	])('does not apply Query API instructions from %s', (query) => {
		const url = new URL(`https://my.wordpress.net/${query}`);
		expect(resolveRecoveryBlueprintFromUrl(url)).toBeNull();
	});

	it('allows the dedicated Health Check recovery link', () => {
		const url = new URL(
			'https://my.wordpress.net/?playground-recovery-mode=health-check'
		);
		const blueprint = resolveRecoveryBlueprintFromUrl(url);
		expect(blueprint?.steps?.[0]).toMatchObject({
			step: 'installPlugin',
			pluginData: { slug: 'health-check' },
		});
	});
});
