import type { RewriteRule } from '@php-wasm/universal';

/**
 * The default rewrite rules for WordPress.
 */
export const wordPressRewriteRules: RewriteRule[] = [
	{
		match: /^\/(.*?)(\/wp-(content|admin|includes)\/.*)/g,
		replacement: '$2',
	},
];
