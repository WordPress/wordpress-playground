import { DataReference } from './appendix-B-data-sources';

type MySQLConfiguration = (
	| {
			/** Hostname or IP address of the MySQL server. Mutually exclusive with `socket`. */
			host?: string;
			/** TCP port (defaults to `3306`). */
			port?: number;
	  }
	| {
			/** Path to a Unix‑domain socket. Mutually exclusive with `host`. */
			unixSocket?: string;
	  }
) & {
	username: string;
	/** Plain‑text password */
	password: string;
	databaseName: string;
};

type SQLiteConfiguration = {
	/**
	 * Defaults to `wp-content/database/.ht.sqlite`
	 */
	databasePath?: string;
	/**
	 * A custom SQLite database integration plugin to use.
	 */
	pluginOverride?: DataReference;
};

/**
 * User‑supplied configuration for the Blueprint Runner.
 *
 * These settings are provided out‑of‑band (CLI flags, ENV variables, etc.)
 * and are never stored inside a Blueprint document.
 */
export type RunnerConfiguration = {
	executionMode: 'create-new-site' | 'apply-to-existing-site';

	/**
	 * File‑system directory in which the Blueprint will be executed.
	 *
	 * When `executionMode` is:
	 *
	 *  - "create‑new‑site", this **MUST** point to an existing *empty* directory.
	 *  - "apply‑to‑existing‑site", it **MUST** point to a directory containing at
	 *    least the `wp-load.php` file.
	 */
	targetSiteRef: string;

	/**
	 * Database engine to use when executing the Blueprint.
	 *
	 * If the targetSiteRef is an existing WordPress install running on a different
	 * database backend, the runner **MUST** fail with a clear error message.
	 *
	 * This option is open to a future inclusion of other database backends.
	 *
	 * @default "mysql"
	 */
	databaseEngine?: /**
	 * The default choice and the default WordPress database engine.
	 *
	 * The runner **MUST** require MySQL credentials and validate their correctness
	 * when database engine is "mysql" and execution mode is "create-new-site".
	 *
	 * For "apply-to-existing-site" execution mode, the runner relies on the
	 * configuration already provided in the target site.
	 */
	| 'mysql'
		/*
		 * Use SQLite via the `sqlite-database-integration` plugin.
		 *
		 * When database engine is "sqlite", the runner **MUST**:
		 *
		 *  - Assert the SQLite PHP extension is installed and enabled.
		 *  - Install the `sqlite-database-integration` plugin before any
		 *    database operations is performed.
		 */
		| 'sqlite';

	/**
	 * Connection parameters. The runner **MUST** require the credentials when
	 * `databaseEngine` is "mysql".
	 */
	databaseConfiguration?: MySQLConfiguration | SQLiteConfiguration;

	/**
	 * Whether to override the user passwords set in the Blueprint with
	 * randomly-generated passwords.
	 *
	 * @default false
	 */
	generatePasswords?: false;

	/**
	 * Path to the JSON file where the randomly-generated passwords will be saved.
	 *
	 * Only used when `generatePasswords` is true.
	 */
	savePasswords?: false | string;

	/**
	 * What to do if the Blueprint specifies a plugin or theme that is already
	 * installed on the target site.
	 *
	 * @default "skip"
	 */
	ifPluginOrThemeAlreadyInstalled?: 'overwrite' | 'skip' | 'error';

	/**
	 * Strategy for importing `content` objects. The details are left to the
	 * Data Liberation importer and will be discussed in another proposal.
	 *
	 * The comments below are only meant to illustrate the overall strategy
	 * and generally expected behaviours.
	 *
	 * **IMPORTANT:** The runner **MUST NOT** provide a default value for this
	 * property at the pretense of convenience. This vital choice may lead to
	 * data loss when not considered carefully. The user **MUST** make an
	 * explicit decision.
	 */
	contentImportMode: /**
	 * Appends the imported content to the existing content.
	 *
	 * Example:
	 *
	 * * Target site has a post with a slug "my-homepage".
	 * * Blueprint imports a post with a slug "my-homepage".
	 * * Result: The imported post's slug will be changed to "my-homepage-2".
	 */
	| 'append'
		/**
		 * Removes all existing content. Then appends the imported content.
		 *
		 * Example:
		 *
		 * * Target site has 15 posts, 10 pages, and 5 users.
		 * * Blueprint imports 2 posts and 2 users.
		 * * Result: The target site will have 2 posts and 2 users.
		 */
		| 'replace-all'
		/**
		 * Merges the imported content with the existing content.
		 *
		 * Example:
		 *
		 * * Target site has a post with a slug "my-homepage".
		 * * Blueprint imports a post with a slug "my-homepage".
		 * * Result: The existing post will be updated with the imported post's
		 *           content and metadata.
		 */
		| 'merge';
};
