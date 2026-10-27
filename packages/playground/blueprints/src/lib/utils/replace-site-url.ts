import { phpVars } from '@php-wasm/util';
import type { UniversalPHP } from '@php-wasm/universal';

/**
 * Updates stored site URLs when a Playground moves to another host or scope.
 * Serialized settings must be decoded and encoded again because URL lengths
 * can change. Keep scope-only links working as they did during ZIP imports.
 * Serialized objects and references are preserved unchanged.
 * Matching rows are read into memory, as during ZIP imports.
 */
export async function replaceSiteUrl(
	playground: UniversalPHP,
	documentRoot: string,
	oldSiteUrl: string,
	newSiteUrl: string
) {
	for (const siteUrl of [oldSiteUrl, newSiteUrl]) {
		const url = new URL(siteUrl);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw new Error('Site URL must be an absolute HTTP or HTTPS URL.');
		}
	}
	oldSiteUrl = oldSiteUrl.replace(/\/+$/, '') + '/';
	newSiteUrl = newSiteUrl.replace(/\/+$/, '') + '/';
	if (oldSiteUrl === newSiteUrl) {
		return;
	}
	const replacements: Record<string, string> = {
		[oldSiteUrl]: newSiteUrl,
	};
	const oldScopePath = extractScopePath(oldSiteUrl);
	const newScopePath = extractScopePath(newSiteUrl);
	if (oldScopePath && newScopePath && oldScopePath !== newScopePath) {
		replacements[oldScopePath] = newScopePath;
	}
	// Home links may end at a quote, query, or fragment rather than a slash.
	for (const [oldUrl, newUrl] of Object.entries(replacements)) {
		for (const ending of ['"', "'", '?', '#']) {
			replacements[oldUrl.slice(0, -1) + ending] =
				newUrl.slice(0, -1) + ending;
		}
	}
	// Block attributes and some plugin settings store JSON-escaped slashes.
	for (const [oldUrl, newUrl] of Object.entries(replacements)) {
		replacements[oldUrl.replaceAll('/', '\\/')] = newUrl.replaceAll(
			'/',
			'\\/'
		);
	}
	const js = phpVars({ documentRoot, replacements });
	await playground.run({
		code: `<?php
		require_once ${js.documentRoot} . '/wp-load.php';
		global $wpdb;

		$replacements = ${js.replacements};
		$tables = array(
			// Update URLs in posts content, excerpts, and GUIDs.
			array($wpdb->posts, 'ID', array('post_content', 'post_excerpt', 'guid')),
			// Update URLs in post meta.
			array($wpdb->postmeta, 'meta_id', array('meta_value')),
			// Update URLs in options, decoding serialized data before changing it.
			array($wpdb->options, 'option_id', array('option_value')),
			// Update URLs in user meta.
			array($wpdb->usermeta, 'umeta_id', array('meta_value')),
			// Update URLs in term meta.
			array(isset($wpdb->termmeta) ? $wpdb->termmeta : '', 'meta_id', array('meta_value')),
			// Update URLs in comments.
			array($wpdb->comments, 'comment_ID', array('comment_content', 'comment_author_url')),
		);
		// Older WordPress releases do not have every current core table.
		$existing_tables = $wpdb->get_col('SHOW TABLES');
		if ($wpdb->last_error) {
			throw new Exception($wpdb->last_error);
		}
		foreach ($tables as $table) {
			list($name, $id, $columns) = $table;
			if (!in_array($name, $existing_tables, true)) {
				continue;
			}
			foreach ($columns as $column) {
				$conditions = array();
				foreach ($replacements as $old => $new) {
					$conditions[] = $wpdb->prepare(
						"\`$column\` LIKE %s", '%' . $wpdb->esc_like(rtrim($old, '/')) . '%'
					);
				}
				$rows = $wpdb->get_results(
					"SELECT \`$id\`, \`$column\` FROM \`$name\` WHERE " . implode(' OR ', $conditions),
					ARRAY_A
				);
				if ($wpdb->last_error) {
					throw new Exception($wpdb->last_error);
				}
				foreach ($rows as $row) {
					$value = playground_replace_site_url($row[$column], $replacements);
					if ($value !== $row[$column] && false === $wpdb->update(
						$name, array($column => $value), array($id => $row[$id])
					)) {
						throw new Exception($wpdb->last_error);
					}
				}
			}
		}
		if (function_exists('wp_cache_flush')) {
			wp_cache_flush();
		}

		function playground_replace_site_url($value, $replacements) {
			if (is_string($value) && (!function_exists('is_serialized') || is_serialized($value))) {
				// Keep plugin objects (including unavailable classes) and references
				// byte-for-byte. Restoring objects can run plugin code; references can cycle.
				if (preg_match('/(?:^|[;{}])(?:[OCE]:[0-9]+:|[rR]:[0-9]+;)/', $value)) {
					return $value;
				}
				$decoded = @unserialize($value);
				if (false !== $decoded) {
					// unserialize() can accept a valid prefix and ignore trailing text.
					// Preserve ambiguous values rather than dropping that text.
					if (serialize($decoded) !== $value) {
						return $value;
					}
					return serialize(playground_replace_site_url($decoded, $replacements));
				}
			}
			if (is_array($value)) {
				foreach ($value as $key => $item) {
					$value[$key] = playground_replace_site_url($item, $replacements);
				}
			} elseif (is_string($value)) {
				foreach ($replacements as $old => $new) {
					if ($value === rtrim($old, '/')) {
						return rtrim($new, '/');
					}
				}
				$value = strtr($value, $replacements);
			}
			return $value;
		}
		`,
	});
}

/**
 * Extracts the scope path segment from a Playground URL.
 * For example, "http://playground.wordpress.net/scope:abc123/" returns "/scope:abc123/".
 * Returns null if no scope is found.
 */
function extractScopePath(url: string): string | null {
	const match = url.match(/\/scope:[^/]+\/?/);
	return match ? match[0].replace(/\/?$/, '/') : null;
}
