import type { RewriteRule } from '@php-wasm/universal';

/**
 * The default rewrite rules for WordPress.
 */
export const wordPressRewriteRules: RewriteRule[] = [
	/**
	 * Substitutes this .htaccess rule:
	 * RewriteRule ^([_0-9a-zA-Z-]+/)?(wp-(content|admin|includes).*) $2 [L]
	 */
	{
		match: /^(.*?)(\/wp-(content|admin|includes)\/.*)/g,
		replacement: '$2',
	},
];
