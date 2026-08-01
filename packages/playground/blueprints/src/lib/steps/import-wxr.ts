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
	/**
	 * Whether to fetch and import attachment files referenced by the WXR file.
	 *
	 * @default true
	 */
	fetchAttachments?: boolean;
	/**
	 * Whether to rewrite imported URLs to the current site URL.
	 *
	 * @default true
	 */
	rewriteUrls?: boolean;
	/**
	 * Explicit URL replacements to apply when URL rewriting is enabled.
	 */
	urlMapping?: Record<string, string>;
	/**
	 * Whether to import comments from the WXR file.
	 *
	 * @default true
	 */
	importComments?: boolean;
	/**
	 * The fallback local user for imported authors that cannot be mapped.
	 *
	 * @default "admin"
	 */
	defaultAuthorUsername?: string;
	/**
	 * How to assign imported WXR authors to local WordPress users.
	 *
	 * @default "default-author"
	 */
	authorsMode?: 'create' | 'default-author' | 'map';
	/**
	 * Remote WXR author usernames keyed to existing local usernames.
	 */
	authorsMap?: Record<string, string>;
	/**
	 * Whether to create local users for imported WXR authors.
	 *
	 * @default false
	 */
	importUsers?: boolean;
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
		urlMapping = {},
		importComments = true,
		defaultAuthorUsername = 'admin',
		authorsMode = 'default-author',
		authorsMap = {},
		importUsers = false,
	},
	progress?
) => {
	const fallbackAuthorUsername = defaultAuthorUsername.trim() || 'admin';
	await importWithDefaultImporter(playground, file, progress, {
		fetchAttachments,
		rewriteUrls,
		urlMapping,
		importComments,
		fallbackAuthorUsername,
		authorsMode,
		authorsMap,
		importUsers,
	});
};

async function importWithDefaultImporter(
	playground: UniversalPHP,
	file: File,
	progress: StepProgress | undefined,
	options: {
		fetchAttachments: boolean;
		rewriteUrls: boolean;
		urlMapping: Record<string, string>;
		importComments: boolean;
		fallbackAuthorUsername: string;
		authorsMode: 'create' | 'default-author' | 'map';
		authorsMap: Record<string, string>;
		importUsers: boolean;
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

	// The WordPress importer assigns unmapped imported authors to the current
	// user, so set it to the requested fallback author before importing.
	$fallback_author_username = getenv('FALLBACK_AUTHOR_USERNAME');
	$fallback_author          = get_user_by('login', $fallback_author_username);
	if (!$fallback_author) {
		throw new Exception(
			sprintf('Could not find fallback WXR import author "%s".', $fallback_author_username)
		);
	}
	wp_set_current_user( $fallback_author->ID );

	$wp_import                  = new WP_Import();
	$import_data                = $wp_import->parse( getenv('IMPORT_FILE') );
	$authors_map                = json_decode(getenv('AUTHORS_MAP') ?: '{}', true);
	if (!is_array($authors_map)) {
		throw new Exception('Invalid WXR authors map payload.');
	}

	// Prepare the data to be used in process_author_mapping();
	$wp_import->get_authors_from_import( $import_data );
	$author_mapping_form = blueprint_prepare_wxr_author_mapping(
		$wp_import->authors,
		getenv('AUTHORS_MODE') ?: 'default-author',
		$authors_map,
		getenv('IMPORT_USERS') === 'true',
		(int) $fallback_author->ID
	);

	$url_mapping_payload = getenv('URL_MAPPING') ?: '{}';
	$url_mapping         = json_decode($url_mapping_payload, true);
	if (!is_array($url_mapping)) {
		throw new Exception(
			sprintf(
				'Invalid WXR URL mapping payload (%d bytes): %s.',
				strlen($url_mapping_payload),
				json_last_error_msg()
			)
		);
	}
	if (!empty($url_mapping) && getenv('REWRITE_URLS') === 'true') {
		add_filter('wp_import_post_data_raw', function($post) use ($url_mapping) {
			return blueprint_apply_wxr_url_mapping($post, $url_mapping);
		});
	}

	if (getenv('IMPORT_COMMENTS') === 'false') {
		add_filter('wp_import_post_comments', '__return_empty_array');
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
	$_POST = array(
		'imported_authors'  => $author_mapping_form['imported_authors'],
		'user_map'          => $author_mapping_form['user_map'],
		'user_new'          => $author_mapping_form['user_new'],
		'fetch_attachments' => $wp_import->fetch_attachments,
	);

	$GLOBALS['wpcli_import_current_file'] = basename( $file );
	$wp_import->import( getenv('IMPORT_FILE'), [
		'rewrite_urls' => getenv('REWRITE_URLS') === 'true',
	] );

	/**
	 * Builds the importer form payload for WXR author assignment.
	 */
	function blueprint_prepare_wxr_author_mapping(
		array $authors,
		string $authors_mode,
		array $authors_map,
		bool $import_users,
		int $fallback_author_id
	): array {
		$imported_authors = array();
		$user_map         = array();
		$user_new         = array();

		foreach ($authors as $index => $author) {
			$remote_username = $author['author_login'] ?? '';
			if (!is_string($remote_username) || $remote_username === '') {
				continue;
			}

			$imported_authors[$index] = $remote_username;
			if (array_key_exists($remote_username, $authors_map)) {
				$user_map[$index] = blueprint_wxr_author_id_for_username(
					$authors_map[$remote_username],
					$remote_username
				);
				continue;
			}

			if ($authors_mode === 'map') {
				throw new Exception(
					sprintf('Missing local user mapping for WXR author "%s".', $remote_username)
				);
			}

			if ($authors_mode === 'create' && $import_users) {
				$user_new[$index] = $remote_username;
				continue;
			}

			$user_map[$index] = $fallback_author_id;
		}

		return array(
			'imported_authors' => $imported_authors,
			'user_map'         => $user_map,
			'user_new'         => $user_new,
		);
	}

	/**
	 * Finds the local user ID for an explicit WXR author map entry.
	 */
	function blueprint_wxr_author_id_for_username(string $local_username, string $remote_username): int {
		if ($local_username === '') {
			throw new Exception(
				sprintf('Invalid local user mapping for WXR author "%s".', $remote_username)
			);
		}

		$local_user = get_user_by('login', $local_username);
		if (!$local_user) {
			throw new Exception(
				sprintf(
					'Could not find local user "%s" mapped from WXR author "%s".',
					$local_username,
					$remote_username
				)
			);
		}
		return (int) $local_user->ID;
	}

	/**
	 * Applies explicit Blueprint URL replacements to parsed WXR data.
	 */
	function blueprint_apply_wxr_url_mapping($value, array $url_mapping) {
		if (is_string($value)) {
			return strtr($value, $url_mapping);
		}
		if (is_array($value)) {
			foreach ($value as $key => $item) {
				$value[$key] = blueprint_apply_wxr_url_mapping($item, $url_mapping);
			}
		}
		return $value;
	}
	`,
		env: {
			IMPORT_FILE: '/tmp/import.wxr',
			FETCH_ATTACHMENTS: options.fetchAttachments ? 'true' : 'false',
			REWRITE_URLS: options.rewriteUrls ? 'true' : 'false',
			URL_MAPPING: JSON.stringify(options.urlMapping),
			IMPORT_COMMENTS: options.importComments ? 'true' : 'false',
			FALLBACK_AUTHOR_USERNAME: options.fallbackAuthorUsername,
			AUTHORS_MODE: options.authorsMode,
			AUTHORS_MAP: JSON.stringify(options.authorsMap),
			IMPORT_USERS: options.importUsers ? 'true' : 'false',
		},
	});
}
