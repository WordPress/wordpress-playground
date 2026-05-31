import type { StepHandler, StepProgress } from '.';
import { writeFile } from './write-file';
import type { UniversalPHP } from '@php-wasm/universal';

/**
 * @inheritDoc importWxr
 * @example
 *
 * <code>
 * {
 * 		"step": "importWxr",
 * 		"file": {
 * 			"resource": "url",
 * 			"url": "https://your-site.com/starter-content.wxr"
 * 		}
 * }
 * </code>
 */
export interface ImportWxrStep<ResourceType> {
	step: 'importWxr';
	/** The file to import */
	file: ResourceType;
	/** Whether to fetch and import attachment files referenced by the WXR file. */
	fetchAttachments?: boolean;
	/** Whether to rewrite imported URLs to the current site URL. */
	rewriteUrls?: boolean;
	/** Explicit URL replacements to apply to imported content, metadata, and comments. */
	urlMap?: Record<string, string>;
	/** How to map WXR authors that do not exist in the target site. */
	authorsMode?: 'create' | 'default-author' | 'map';
	/** The local username used when authorsMode is "default-author". */
	defaultAuthorUsername?: string;
	/** Remote author login to local username/email mappings. */
	authorsMap?: Record<string, string>;
	/** Whether to import comments from the WXR file. */
	importComments?: boolean;
	/** Whether to import users from the WXR file. */
	importUsers?: boolean;
	/** Whether to import site options from the WXR file. */
	importSiteOptions?: boolean;
	/**
	 * The importer to use. Possible values:
	 *
	 * - `default`: The importer from https://github.com/humanmade/WordPress-Importer
	 * - `data-liberation`: The experimental Data Liberation WXR importer developed at
	 *                      https://github.com/WordPress/wordpress-playground/issues/1894
	 *
	 * This option is deprecated. The syntax will not be removed, but once the
	 * Data Liberation importer matures, it will become the only supported
	 * importer and the `importer` option will be ignored.
	 *
	 * @deprecated
	 */
	importer?: 'data-liberation' | 'default';
}

/**
 * Imports a WXR file into WordPress.
 *
 * @param playground Playground client.
 * @param file The file to import.
 */
export const importWxr: StepHandler<ImportWxrStep<File>> = async (
	playground,
	{
		file,
		fetchAttachments = true,
		rewriteUrls = true,
		urlMap = {},
		authorsMode = 'default-author',
		defaultAuthorUsername = 'admin',
		authorsMap = {},
		importComments = true,
		importUsers = false,
		importSiteOptions = false,
	},
	progress?
) => {
	await importWithDefaultImporter(playground, file, progress, {
		fetchAttachments,
		rewriteUrls,
		urlMap,
		authorsMode,
		defaultAuthorUsername,
		authorsMap,
		importComments,
		importUsers,
		importSiteOptions,
	});
};

async function importWithDefaultImporter(
	playground: UniversalPHP,
	file: File,
	progress: StepProgress | undefined,
	options: {
		fetchAttachments: boolean;
		rewriteUrls: boolean;
		urlMap: Record<string, string>;
		authorsMode: 'create' | 'default-author' | 'map';
		defaultAuthorUsername: string;
		authorsMap: Record<string, string>;
		importComments: boolean;
		importUsers: boolean;
		importSiteOptions: boolean;
	}
) {
	progress?.tracker?.setCaption('Importing content');
	await writeFile(playground, {
		path: '/tmp/import.wxr',
		data: file,
	});
	await playground.run({
		$_SERVER: {
			/**
			 * get_site_url() infers the protocol from $_SERVER['HTTPS'] instead of
			 * using the stored siteurl option. The importer relies on that behavior
			 * when rewriting links in the WXR payload, so we populate the flag here
			 * just as the web request layer would.
			 */
			HTTPS: (await playground.absoluteUrl).startsWith('https://')
				? 'on'
				: '',
		},
		code: `<?php
	define('WP_LOAD_IMPORTERS', true);
	require 'wp-load.php';
	require 'wp-admin/includes/admin.php';

	if (!function_exists('blueprint_wxr_author_mapping_post_data')) {
		function blueprint_wxr_author_mapping_post_data(array $authors, int $default_author_id): array {
			$mode = getenv('AUTHORS_MODE') ?: 'default-author';
			$authors_map = json_decode(getenv('AUTHORS_MAP') ?: '{}', true);
			if (!is_array($authors_map)) {
				throw new Exception('Invalid WXR authors map.');
			}
			if (!in_array($mode, array('create', 'default-author', 'map'), true)) {
				throw new Exception('Invalid WXR authors mode: ' . $mode);
			}

			$post_data = array(
				'imported_authors' => array(),
				'user_map' => array(),
				'user_new' => array(),
			);
			$index = 0;
			foreach ($authors as $old_login => $author) {
				$post_data['imported_authors'][$index] = $old_login;
				if ($mode === 'default-author') {
					$post_data['user_map'][$index] = $default_author_id;
				} elseif ($mode === 'map') {
					if (!isset($authors_map[$old_login])) {
						throw new Exception('Missing WXR author mapping for: ' . $old_login);
					}
					$user_id = blueprint_wxr_resolve_user_id($authors_map[$old_login]);
					if (!$user_id) {
						throw new Exception('Could not resolve mapped WXR author: ' . $authors_map[$old_login]);
					}
					$post_data['user_map'][$index] = $user_id;
				} elseif ($mode === 'create') {
					$post_data['user_map'][$index] = blueprint_wxr_imported_author_id($old_login, $author) ?: blueprint_wxr_create_author_user($old_login, $author) ?: $default_author_id;
				} else {
					$post_data['user_map'][$index] = blueprint_wxr_resolve_author_user_id($old_login, $author) ?: $default_author_id;
				}
				$index++;
			}
			return $post_data;
		}
	}

	if (!function_exists('blueprint_wxr_import_users')) {
		function blueprint_wxr_import_users(array $authors): array {
			$imported = array();
			foreach ($authors as $old_login => $author) {
				$user_id = blueprint_wxr_resolve_author_user_id($old_login, $author);
				if (!$user_id) {
					$user_id = blueprint_wxr_create_author_user($old_login, $author);
				}
				if ($user_id) {
					$imported[$old_login] = $user_id;
				}
			}
			return $imported;
		}
	}

	if (!function_exists('blueprint_wxr_imported_author_id')) {
		function blueprint_wxr_imported_author_id(string $old_login, array $author): int {
			if (
				isset($GLOBALS['blueprint_wxr_imported_author_ids']) &&
				is_array($GLOBALS['blueprint_wxr_imported_author_ids']) &&
				isset($GLOBALS['blueprint_wxr_imported_author_ids'][$old_login])
			) {
				return (int) $GLOBALS['blueprint_wxr_imported_author_ids'][$old_login];
			}
			return blueprint_wxr_resolve_author_user_id($old_login, $author);
		}
	}

	if (!function_exists('blueprint_wxr_create_author_user')) {
		function blueprint_wxr_create_author_user(string $old_login, array $author): int {
			$login = '';
			if (isset($author['author_login']) && is_string($author['author_login'])) {
				$login = $author['author_login'];
			}
			if ($login === '') {
				$login = $old_login;
			}
			$login = sanitize_user($login, true);
			if ($login === '') {
				return 0;
			}

			$user_data = array(
				'user_login' => $login,
				'user_pass' => wp_generate_password(),
			);
			foreach (array(
				'author_email' => 'user_email',
				'author_display_name' => 'display_name',
				'author_first_name' => 'first_name',
				'author_last_name' => 'last_name',
			) as $author_key => $user_key) {
				if (isset($author[$author_key]) && is_string($author[$author_key]) && $author[$author_key] !== '') {
					$user_data[$user_key] = $author[$author_key];
				}
			}

			$user_id = wp_insert_user($user_data);
			if (!is_wp_error($user_id)) {
				return (int) $user_id;
			}
			if (!empty($user_data['user_email'])) {
				$existing = get_user_by('email', $user_data['user_email']);
				if ($existing) {
					return (int) $existing->ID;
				}
			}
			$existing = get_user_by('login', $login);
			return $existing ? (int) $existing->ID : 0;
		}
	}

	if (!function_exists('blueprint_wxr_resolve_author_user_id')) {
		function blueprint_wxr_resolve_author_user_id(string $old_login, array $author): int {
			foreach (array('author_login', 'author_email') as $field) {
				if (isset($author[$field]) && is_string($author[$field])) {
					$user_id = blueprint_wxr_resolve_user_id($author[$field]);
					if ($user_id) {
						return $user_id;
					}
				}
			}
			$user_id = blueprint_wxr_resolve_user_id($old_login);
			if ($user_id) {
				return $user_id;
			}
			if (isset($author['author_display_name']) && is_string($author['author_display_name'])) {
				$users = get_users(array(
					'search' => $author['author_display_name'],
					'search_columns' => array('display_name'),
					'number' => 10,
				));
				foreach ($users as $user) {
					if ($user->display_name === $author['author_display_name']) {
						return (int) $user->ID;
					}
				}
			}
			return 0;
		}
	}

	if (!function_exists('blueprint_wxr_resolve_user_id')) {
		function blueprint_wxr_resolve_user_id(string $user): int {
			if (is_numeric($user)) {
				$found = get_userdata((int) $user);
				return $found ? (int) $found->ID : 0;
			}
			$found = get_user_by('login', $user);
			if (!$found && is_email($user)) {
				$found = get_user_by('email', $user);
			}
			return $found ? (int) $found->ID : 0;
		}
	}

	if (!function_exists('blueprint_wxr_import_site_options')) {
		function blueprint_wxr_import_site_options(string $file): void {
			if (!function_exists('simplexml_load_string')) {
				throw new Exception('The active PHP runtime does not support WXR site option imports.');
			}
			$contents = file_get_contents($file);
			if ($contents === false) {
				throw new Exception('Could not read WXR file for site option imports.');
			}

			$previous_libxml_errors = libxml_use_internal_errors(true);
			$xml = simplexml_load_string($contents);
			libxml_clear_errors();
			libxml_use_internal_errors($previous_libxml_errors);
			if ($xml === false || !isset($xml->channel)) {
				throw new Exception('Could not parse WXR file for site option imports.');
			}

			if (isset($xml->channel->title)) {
				update_option('blogname', (string) $xml->channel->title);
			}
		}
	}

	if (!function_exists('blueprint_wxr_rewrite_post_data')) {
		function blueprint_wxr_rewrite_post_data(array $postdata): array {
			foreach (array('post_content', 'post_excerpt', 'guid') as $field) {
				if (isset($postdata[$field])) {
					$postdata[$field] = blueprint_wxr_rewrite_value($postdata[$field]);
				}
			}
			return $postdata;
		}
	}

	if (!function_exists('blueprint_wxr_rewrite_post_meta')) {
		function blueprint_wxr_rewrite_post_meta(array $postmeta): array {
			foreach ($postmeta as $index => $meta) {
				if (isset($meta['value'])) {
					$postmeta[$index]['value'] = blueprint_wxr_rewrite_value($meta['value']);
				}
			}
			return $postmeta;
		}
	}

	if (!function_exists('blueprint_wxr_filter_post_comments')) {
		function blueprint_wxr_filter_post_comments(array $comments): array {
			if (empty($GLOBALS['blueprint_wxr_import_comments'])) {
				return array();
			}
			foreach ($comments as $index => $comment) {
				foreach (array('comment_author_url', 'comment_content') as $field) {
					if (isset($comment[$field])) {
						$comments[$index][$field] = blueprint_wxr_rewrite_value($comment[$field]);
					}
				}
			}
			return $comments;
		}
	}

	if (!function_exists('blueprint_wxr_expand_url_map')) {
		function blueprint_wxr_expand_url_map(array $url_map, string $source_base_url, string $target_base_url): array {
			$source_base_url = rtrim($source_base_url, '/');
			$target_base_url = rtrim($target_base_url, '/');
			if ($source_base_url === '' || $target_base_url === '') {
				return $url_map;
			}
			foreach ($url_map as $from => $to) {
				if (!is_string($from) || strpos($from, $source_base_url) !== 0) {
					continue;
				}
				$url_map[$target_base_url . substr($from, strlen($source_base_url))] = $to;
			}
			return $url_map;
		}
	}

	if (!function_exists('blueprint_wxr_rewrite_value')) {
		function blueprint_wxr_rewrite_value($value) {
			$url_map = $GLOBALS['blueprint_wxr_url_map'] ?? array();
			if (empty($url_map)) {
				return $value;
			}
			if (is_string($value)) {
				return strtr($value, $url_map);
			}
			if (is_array($value)) {
				foreach ($value as $key => $item) {
					$value[$key] = blueprint_wxr_rewrite_value($item);
				}
			}
			return $value;
		}
	}

	/**
	 * Disable all kses filters to prevent content sanitization during import.
	 * It messes up Playground URL scheme by mangling transforming code such as:
	 *
	 *     <a href="/scope:kind-quiet-lake/index.php">Test</a>
	 *
	 * into:
	 *
	 *     <a href="kind-quiet-lake/index.php">Test</a>
	 */
	kses_remove_filters();

	// Set current user for the importer to pick it up as the default
	// post author.
	$default_author_id = blueprint_wxr_resolve_user_id(getenv('DEFAULT_AUTHOR_USERNAME') ?: 'admin');
	if (!$default_author_id) {
		$admins = get_users(array('role' => 'Administrator', 'number' => 1, 'fields' => 'ID'));
		$default_author_id = !empty($admins) ? (int) $admins[0] : (int) get_current_user_id();
	}
	wp_set_current_user( $default_author_id );

	$blueprint_url_map = json_decode(getenv('URL_MAP') ?: '{}', true);
	if (!is_array($blueprint_url_map)) {
		throw new Exception('Invalid WXR URL map.');
	}
	$GLOBALS['blueprint_wxr_url_map'] = $blueprint_url_map;
	$GLOBALS['blueprint_wxr_import_comments'] = getenv('IMPORT_COMMENTS') !== 'false';
	$GLOBALS['blueprint_wxr_imported_author_ids'] = array();
	remove_filter('wp_import_post_data_processed', 'blueprint_wxr_rewrite_post_data', 10);
	remove_filter('wp_import_post_meta', 'blueprint_wxr_rewrite_post_meta', 10);
	remove_filter('wp_import_post_comments', 'blueprint_wxr_filter_post_comments', 10);
	add_filter('wp_import_post_data_processed', 'blueprint_wxr_rewrite_post_data', 10, 2);
	add_filter('wp_import_post_meta', 'blueprint_wxr_rewrite_post_meta', 10, 3);
	add_filter('wp_import_post_comments', 'blueprint_wxr_filter_post_comments', 10, 3);

	$wp_import                  = new WP_Import();
	$import_data                = $wp_import->parse( getenv('IMPORT_FILE') );
	$GLOBALS['blueprint_wxr_url_map'] = blueprint_wxr_expand_url_map(
		$blueprint_url_map,
		is_array($import_data) && isset($import_data['base_url']) ? $import_data['base_url'] : $wp_import->base_url,
		get_site_url()
	);

	// Prepare the data to be used in process_author_mapping();
	$wp_import->get_authors_from_import( $import_data );
	if (getenv('IMPORT_USERS') === 'true') {
		$GLOBALS['blueprint_wxr_imported_author_ids'] = blueprint_wxr_import_users($wp_import->authors);
	}
	if (getenv('IMPORT_SITE_OPTIONS') === 'true') {
		blueprint_wxr_import_site_options(getenv('IMPORT_FILE'));
	}

	// We no longer need the original data, so unset to avoid using excess
	// memory.
	unset( $import_data );

	// Drive the import
	$wp_import->fetch_attachments = getenv('FETCH_ATTACHMENTS') === 'true';

	$_GET  = array(
		'import' => 'wordpress',
		'step'   => 2,
	);
	$_POST = blueprint_wxr_author_mapping_post_data($wp_import->authors, $default_author_id);
	$_POST['fetch_attachments'] = $wp_import->fetch_attachments;

	$GLOBALS['wpcli_import_current_file'] = basename( $file );
	$wp_import->import( getenv('IMPORT_FILE'), [
		'rewrite_urls' => getenv('REWRITE_URLS') === 'true',
	] );
	`,
		env: {
			IMPORT_FILE: '/tmp/import.wxr',
			FETCH_ATTACHMENTS: options.fetchAttachments ? 'true' : 'false',
			REWRITE_URLS: options.rewriteUrls ? 'true' : 'false',
			URL_MAP: JSON.stringify(options.urlMap),
			AUTHORS_MODE: options.authorsMode,
			DEFAULT_AUTHOR_USERNAME: options.defaultAuthorUsername,
			AUTHORS_MAP: JSON.stringify(options.authorsMap),
			IMPORT_COMMENTS: options.importComments ? 'true' : 'false',
			IMPORT_USERS: options.importUsers ? 'true' : 'false',
			IMPORT_SITE_OPTIONS: options.importSiteOptions ? 'true' : 'false',
		},
	});
}
