/**
 * General data sources {{{
 *
 * These types can be used anywhere in the Blueprint schema where a
 * file or a directory is expected.
 */

/**
 * A reference to a HTTP or HTTPS URL.
 *
 * The URLs are parsed using the WHATWG URL standard, which means they can
 * optionally contain usernames and passwords if needed.
 *
 * @see https://url.spec.whatwg.org/
 */
export type URLReference = `http://${string}` | `https://${string}`;

/**
 * A reference to a file in the Blueprint Execution Context – see the
 * main proposal document for more context.
 *
 * The path must start with either ./ or / to distinguish it from a
 * plugin or theme slug. Regardless of the prefix (./ or /), the path
 * is relative to the Blueprint Execution Context root:
 *
 * * Relative paths (./) are relative to the location of blueprint.json file.
 * * Absolute paths (/) are chrooted at the Blueprint Execution Context root which is
 *   still the directory where blueprint.json is located.
 *
 * It is not possible to escape the Blueprint Execution Context via "../" sequences.
 */
export type ExecutionContextPath = `/${string}` | `./${string}`;

/**
 * A file that is inlined within the Blueprint JSON document.
 *
 * Example:
 *
 * ```json
 * {
 *     "filename": "index.php",
 *     "content": "<?php echo 'Hello, world!'; ?>"
 * }
 * ```
 */
export type InlineFile = {
	filename: string;
	content: InlineFileContent;
};
type InlineFileContent = string;

/**
 * A directory that is inlined within the Blueprint JSON document.
 *
 * Example:
 *
 * ```json
 * {
 *     "directoryName": "my-directory",
 *     "files": {
 *         "index.php": "<?php echo 'Hello, world!'; ?>",
 *         "my-sub-directory": {
 *             "files": {
 *                 "index.php": "<?php echo 'Hello, world!'; ?>"
 *             }
 *         }
 *     }
 * }
 * ```
 */
export type InlineDirectory = {
	directoryName: string;
	files: Record<string, InlineFileContent | InlineDirectory>;
};

/**
 * A reference to a remote git repository.
 */
export type GitPath = {
	/**
	 * A HTTP or HTTPS URL of the remote git repository.
	 */
	gitRepository: URLReference;

	/**
	 * A branch name, commit hash, or tag name.
	 *
	 * Defaults to HEAD.
	 */
	ref?: string;

	/**
	 * A path inside the git repository this data reference points to.
	 *
	 * Defaults to the root of the repository.
	 */
	pathInRepository?: string;
};

/**
 * A union of all general data reference types.
 */
export type DataReference =
	| URLReference
	| ExecutionContextPath
	| InlineFile
	| InlineDirectory
	| GitPath;

/**
 * }}}
 */

/**
 * Contextual data sources {{{
 *
 * These types are only meaningful in specific, well-known parts of
 * the Blueprint schema.
 */

/** Helper types {{{ */
/**
 * A slug is a string matching the following regex:
 *
 * ```
 * ^[a-zA-Z0-9_-]+$
 * ```
 *
 * This constraint may be expressed in TypeScript, but it would come at the
 * expense of readability. This document will thus alias the general `string`
 * type to `Slug`. Every reference to the `Slug` type should be treated as a
 * string matching the above regex.
 */
export type Slug = string;
export type SimpleVersionExpression =
	| 'latest'
	| `${number}.${number}`
	| `${number}.${number}.${number}`;
export type WordPressVersionSuffix = `beta${number}` | `rc${number}`;
/** }}} Helper types */

/**
 * Plugin directory reference, e.g. "jetpack", "jetpack@6.4", or "akismet@6.4.3".
 *
 * These refer to a specific plugin slugs in the WordPress.org plugin repository.
 *
 * For example, a reference to "wordpress-seo" means the Yoast SEO plugin as
 * seen on https://wordpress.org/plugins/wordpress-seo/.
 *
 * The Plugin Directory Reference are only meaningful in:
 *
 * * The top-level `plugins` array
 * * The `installPlugin` imperative step
 */
export type PluginDirectoryReference =
	| Slug
	| `${Slug}@${SimpleVersionExpression}`;

/**
 * Theme directory reference, e.g. "twentytwentythree", "adventurer@4.6.0", or "twentytwentyfour@latest".
 *
 * These refer to specific theme slugs in the WordPress.org theme repository.
 *
 * For example, a reference to "adventurer" means the Adventurer theme as
 * seen on https://wordpress.org/themes/adventurer/.
 *
 * These references are only meaningful in:
 *
 * * The top-level `themes` array
 * * The `installTheme` imperative step
 */
export type ThemeDirectoryReference =
	| Slug
	| `${Slug}@${SimpleVersionExpression}`;

/**
 * WordPress version, e.g. "6.4", "6.4.3", "6.8-RC1", or "6.7-beta2".
 *
 * These refer to slugs of specific WordPress releases as listed in
 * the first table column on https://wordpress.org/download/releases/.
 *
 * The WordPressVersion type is only meaningful in the top-level
 * `wordpressVersion` property.
 */
export type WordPressVersion =
	| SimpleVersionExpression
	| `${SimpleVersionExpression}-${WordPressVersionSuffix}`;

/**
 * PHP version, e.g. "8.1" or "8.1.3".
 *
 * These refer to PHP versions as listed in https://www.php.net/releases/.
 *
 * The PHPVersion type is only meaningful in the top-level
 * `phpVersion` property.
 */
export type PHPVersion = SimpleVersionExpression;

/**
 * A path within the built WordPress site, relative to the WordPress root
 * directory. For example, site:wp-content/uploads/2024/01/image.jpg.
 *
 * This type is only meaningful in imperative Blueprint steps for operations
 * such as creating new files or moving files and directories.
 */
export type TargetSitePath = `site:${string}`;

/**
 * }}}
 */
