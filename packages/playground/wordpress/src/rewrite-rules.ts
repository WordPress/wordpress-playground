import type { RewriteRule } from '@php-wasm/universal';

/**
 * WordPress rewrite rules adapted for Playground.
 *
 * These rules are matched against the requested path without the site path prefix.
 *
 * For example:
 *
 *     * The site URL is `https://playground.wordpress.net/scope:ambitious-chic-country/`.
 *     * The site path prefix is `/scope:ambitious-chic-country/`.
 *     * The requested URL is `https://playground.wordpress.net/scope:ambitious-chic-country/wp-admin/index.php`,
 *     * The requested path without the site path prefix is `/wp-admin/index.php`.
 *
 * And so, the rewrite rules are matched against `/wp-admin/index.php`.
 * This is similar to setting the `RewriteBase` to `/scope:ambitious-chic-country`.
 *
 * ## Rationale
 *
 * WordPress does not use a single, static set of rewrite rules. Rather, it generates
 * its own .htaccess file based on the current configuration using the save_mod_rewrite_rules()
 * function:
 *
 * https://developer.wordpress.org/reference/functions/save_mod_rewrite_rules/
 *
 * Here's a few examples of what that .htaccess might look like for different
 * WordPress configurations:
 *
 * ### Vanilla WordPress single-site installation
 *
 * ```apache
 * RewriteBase /
 * RewriteRule ^index\.php$ - [L]
 * RewriteCond %{REQUEST_FILENAME} !-f
 * RewriteCond %{REQUEST_FILENAME} !-d
 * RewriteRule . /index.php [L]
 * ```
 *
 * ### Single-site installation living at a /subdirectory/
 *
 * ```apache
 * # https://developer.wordpress.org/advanced-administration/server/wordpress-in-directory/:
 * RewriteCond %{REQUEST_URI} !^/subdirectory/
 * RewriteCond %{REQUEST_FILENAME} !-f
 * RewriteCond %{REQUEST_FILENAME} !-d
 * RewriteRule ^(.*)$ /subdirectory/$1
 * RewriteRule ^(/)?$ subdirectory/index.php [L]
 * ```
 *
 * Some sources also set the RewriteBase to `/subdirectory/`.
 *
 * ### Multisite installation using subfolder network type
 *
 * ```apache
 * # https://wordpress.org/documentation/article/htaccess/#multisite
 *
 * RewriteBase /
 * RewriteRule ^index\.php$ - [L]
 *
 * // add a trailing slash to /wp-admin
 * RewriteRule ^([_0-9a-zA-Z-]+/)?wp-admin$ $1wp-admin/ [R=301,L]
 *
 * RewriteCond %{REQUEST_FILENAME} -f [OR]
 * RewriteCond %{REQUEST_FILENAME} -d
 * RewriteRule ^ - [L]
 * RewriteRule ^([_0-9a-zA-Z-]+/)?(wp-(content|admin|includes).*) $2 [L]
 * RewriteRule ^([_0-9a-zA-Z-]+/)?(.*\.php)$ $2 [L]
 * RewriteRule . index.php [L]
 * ```
 *
 * # Multisite living at /scope:ambitious-chic-country/
 *
 * ```apache
 * RewriteBase /scope:ambitious-chic-country/
 * RewriteRule ^index\.php$ - [L]
 *
 * // Add a trailing slash to /wp-admin
 * RewriteRule ^([_0-9a-zA-Z-]+/)?wp-admin$ $1wp-admin/ [R=301,L]
 *
 * RewriteCond %{REQUEST_FILENAME} -f [OR]
 * RewriteCond %{REQUEST_FILENAME} -d
 * RewriteRule ^ - [L]
 *
 * // The `wordpress/` prefix matches the document root, but seeing
 * // it here is unexpected. @TODO: Why is it being added by WordPress?
 * RewriteRule ^([_0-9a-zA-Z-]+/)?(wp-(content|admin|includes).*) wordpress/$2 [L]
 * RewriteRule ^([_0-9a-zA-Z-]+/)?(.*\.php)$ wordpress/$2 [L]
 * RewriteRule . index.php [L]
 * ```
 *
 * ## .htaccess syntax
 *
 * Here's an excerpt/summary from the .htaccess documentation [^1][^2] for
 * convenience:
 *
 *     The mod_rewrite module uses a rule-based rewriting engine, based
 *     on a PCRE regular-expression parser, to rewrite requested URLs on
 *     the fly. By default, mod_rewrite maps a URL to a filesystem path.
 *     However, it can also be used to redirect one URL to another URL,
 *     or to invoke an internal proxy fetch.
 *
 *     ## RewriteBase Directive
 *
 *     The RewriteBase directive specifies the URL prefix to be used for
 *     per-directory (htaccess) RewriteRule directives that substitute a
 *     relative path.
 *
 *     Syntax:
 *          RewriteBase URL-path
 *
 *     (Setting RewriteBase to "/" makes it possible to use RewriteRule
 *      patterns that **do not** start with a slash.)
 *
 *     ## RewriteRule Directive
 *
 *     Defines rules for the rewriting engine.
 *
 *     Syntax:
 *          RewriteRule Pattern Substitution [flags]
 *
 *     ## Flags
 *
 *        - L|Last
 *            Stop processing the rule set. In most contexts, this means
 *            that if the rule matches, no further rules will be processed
 *
 *        - NC|No Case
 *            Ignore case when matching.
 *
 *        - R|Redirect
 *            Causes a HTTP redirect to be issued to the browser.
 *
 *        (Note that Playground does not implement analogs of these flags as
 *         there was no need for them yet. They're only described here for
 *         convenience to help you read the original .htaccess rules.)
 *
 * ## Differences with .htaccess
 *
 * [1] https://httpd.apache.org/docs/current/rewrite/intro.html
 * [2] https://httpd.apache.org/docs/current/rewrite/flags.html
 */
export const wordPressRewriteRules: RewriteRule[] = [
	/**
	 * Substitutes the multisite WordPress rewrite rule:
	 *
	 * RewriteBase /
	 * RewriteRule ^([_0-9a-zA-Z-]+/)?(wp-(content|admin|includes).*) $2 [L]
	 */
	{
		match: new RegExp(
			/* The .htaccess rule does not have an explicit initial slash,
				but it's still implied by `RewriteBase /` */
			`^(/[_0-9a-zA-Z-]+)?` +
				/**
				 * Avoid discarding the initial slash of the rewritten URL.
				 * .htaccess places the trailing slash in the first group. It
				 * relies on the implicit `RewriteBase /` again – the final,
				 * rewritten URL still has the `/` at the beginning. This rule
				 * does not have an implied RewriteBase, so the only way to preserve
				 * the `/` at the beginning is to avoid replacing it.
				 */
				'(/' +
				// The rest of the pattern is the same:
				`wp-(content|admin|includes)/.*)`
		),
		replacement: '$2',
	},
];
