import { applyRewriteRules } from '@php-wasm/universal';
import { wordPressRewriteRules } from '../rewrite-rules';

describe('Test WordPress rewrites', () => {
	it('Should return root folder PHP file', async () => {
		expect(applyRewriteRules('/index.php', wordPressRewriteRules)).toBe(
			'/index.php'
		);
	});

	it('Should keep query string', async () => {
		expect(
			applyRewriteRules('/index.php?test=1', wordPressRewriteRules)
		).toBe('/index.php?test=1');
	});

	it('Should return subfolder PHP file', async () => {
		expect(
			applyRewriteRules('/wp-admin/index.php', wordPressRewriteRules)
		).toBe('/wp-admin/index.php');
	});

	it('Should strip multisite prefix from path', async () => {
		expect(
			applyRewriteRules('/test/wp-admin/index.php', wordPressRewriteRules)
		).toBe('/wp-admin/index.php');
	});

	it('Should strip multisite prefix from asset path', async () => {
		expect(
			applyRewriteRules(
				'/test/wp-content/themes/twentytwentyfour/assets/images/windows.webp',
				wordPressRewriteRules
			)
		).toBe(
			'/wp-content/themes/twentytwentyfour/assets/images/windows.webp'
		);
	});

	it('Should only target the first instance of a wp-admin|wp-content|wp-includes dir in a path (1)', async () => {
		expect(
			applyRewriteRules(
				'/wp-content/themes/Newspaper/includes/wp-booster/wp-admin/images/plugins/tagdiv-small.png',
				wordPressRewriteRules
			)
		).toBe(
			'/wp-content/themes/Newspaper/includes/wp-booster/wp-admin/images/plugins/tagdiv-small.png'
		);
	});

	it('Should only target the first instance of a wp-admin|wp-content|wp-includes dir in a path (2)', async () => {
		expect(
			applyRewriteRules(
				'/wp-content/themes/Newspaper/includes/wp-booster/wp-content/images/plugins/tagdiv-small.png',
				wordPressRewriteRules
			)
		).toBe(
			'/wp-content/themes/Newspaper/includes/wp-booster/wp-content/images/plugins/tagdiv-small.png'
		);
	});

	it('Should not strip wp-content prefix from a path', async () => {
		expect(
			applyRewriteRules(
				'/wp-content/themes/twentytwentyfour/assets/images/windows.webp',
				wordPressRewriteRules
			)
		).toBe(
			'/wp-content/themes/twentytwentyfour/assets/images/windows.webp'
		);
	});
});
