/**
 * Bridge between JavaScript and the MariaDB embedded server compiled to
 * WebAssembly via Emscripten.
 *
 * The mariadb-wasm project (https://github.com/adamziel/mariadb-wasm)
 * compiles MariaDB's libmysqld into a WASM module that exposes the MySQL
 * C API through Emscripten's cwrap(). This bridge provides a clean
 * JavaScript interface on top of those raw C function wrappers.
 *
 * Key design constraints:
 * - All queries are synchronous from the WASM perspective (cwrap calls
 *   block until the C function returns).
 * - There is no InnoDB — only MyISAM and MEMORY storage engines.
 * - The embedded server runs single-threaded; concurrent access from
 *   multiple connection handles is not safe.
 */

/**
 * The shape of the Emscripten module returned by createMariaDB().
 * We only declare the methods we use.
 */
export interface MariaDBEmscriptenModule {
	cwrap(
		name: string,
		returnType: string | null,
		argTypes: string[]
	): (...args: any[]) => any;
	getValue(ptr: number, type: string): number;
	UTF8ToString(ptr: number): string;
	stringToUTF8(str: string, outPtr: number, maxBytes: number): void;
	_malloc(size: number): number;
	_free(ptr: number): void;
	FS: {
		mkdir(path: string): void;
		mount(type: any, opts: any, mountpoint: string): void;
	};
	NODEFS?: any;
}

/**
 * Wrapped MySQL C API functions. Each function corresponds to a
 * mysql_* C function from libmysqld.
 */
interface MariaDBAPI {
	mysql_server_init: (argc: number, argv: number, groups: number) => number;
	mysql_server_end: () => void;
	mysql_init: (mysql: number) => number;
	mysql_real_connect: (
		mysql: number,
		host: string | null,
		user: string | null,
		passwd: string | null,
		db: string | null,
		port: number,
		unix_socket: string | null,
		clientflag: number
	) => number;
	mysql_close: (mysql: number) => void;
	mysql_query: (mysql: number, query: string) => number;
	mysql_store_result: (mysql: number) => number;
	mysql_fetch_row: (result: number) => number;
	mysql_num_fields: (result: number) => number;
	mysql_num_rows: (result: number) => number;
	mysql_free_result: (result: number) => void;
	mysql_error: (mysql: number) => string;
	mysql_errno: (mysql: number) => number;
	mysql_affected_rows: (mysql: number) => number;
	mysql_field_count: (mysql: number) => number;
	mysql_fetch_field: (result: number) => number;
	mysql_fetch_lengths: (result: number) => number;
	mysql_real_escape_string: (
		mysql: number,
		to: number,
		from: number,
		length: number
	) => number;
	mysql_select_db: (mysql: number, db: string) => number;
	mysql_get_server_info: (mysql: number) => string;
	mysql_insert_id: (mysql: number) => number;
}

export interface ColumnInfo {
	name: string;
	/** The MySQL column type constant (e.g. MYSQL_TYPE_LONG = 3). */
	type: number;
	/** Maximum display width from the column definition. */
	length: number;
	/** Column flags (NOT_NULL, PRIMARY_KEY, etc.). */
	flags: number;
	/** Number of decimal places for numeric types. */
	decimals: number;
}

export interface QueryResult {
	/** Column metadata for SELECT-type queries. Empty for non-SELECT. */
	columns: ColumnInfo[];
	/**
	 * Row data as arrays of strings (or null for SQL NULL values).
	 * Empty for non-SELECT queries.
	 */
	rows: (string | null)[][];
	/** Number of rows affected by INSERT/UPDATE/DELETE. */
	affectedRows: number;
	/** Auto-generated ID from the last INSERT. */
	insertId: number;
	/** Number of warnings from the last query. */
	warningCount: number;
}

/**
 * Wraps a cwrap'd function that may return BigInt (when WASM_BIGINT=1)
 * so it always returns a plain Number. C functions like mysql_affected_rows
 * and mysql_insert_id return unsigned long long which becomes BigInt in
 * JavaScript with WASM_BIGINT enabled. We need plain Numbers for Buffer
 * operations and arithmetic in the protocol server.
 */
function wrapBigInt(fn: (...args: any[]) => any): (...args: any[]) => number {
	return (...args: any[]) => {
		const result = fn(...args);
		return typeof result === 'bigint' ? Number(result) : result;
	};
}

/**
 * High-level interface to a MariaDB embedded server running in WASM.
 */
export class MariaDBBridge {
	private module: MariaDBEmscriptenModule;
	private api: MariaDBAPI;
	private conn = 0;
	private initialized = false;

	constructor(module: MariaDBEmscriptenModule) {
		this.module = module;
		this.api = this.wrapAPI();
	}

	private wrapAPI(): MariaDBAPI {
		const m = this.module;
		return {
			mysql_server_init: m.cwrap('mysql_server_init', 'number', [
				'number',
				'number',
				'number',
			]),
			mysql_server_end: m.cwrap('mysql_server_end', null, []),
			mysql_init: m.cwrap('mysql_init', 'number', ['number']),
			mysql_real_connect: m.cwrap('mysql_real_connect', 'number', [
				'number',
				'string',
				'string',
				'string',
				'string',
				'number',
				'string',
				'number',
			]),
			mysql_close: m.cwrap('mysql_close', null, ['number']),
			mysql_query: m.cwrap('mysql_query', 'number', ['number', 'string']),
			mysql_store_result: m.cwrap('mysql_store_result', 'number', [
				'number',
			]),
			mysql_fetch_row: m.cwrap('mysql_fetch_row', 'number', ['number']),
			mysql_num_fields: m.cwrap('mysql_num_fields', 'number', ['number']),
			mysql_num_rows: m.cwrap('mysql_num_rows', 'number', ['number']),
			mysql_free_result: m.cwrap('mysql_free_result', null, ['number']),
			mysql_error: m.cwrap('mysql_error', 'string', ['number']),
			mysql_errno: m.cwrap('mysql_errno', 'number', ['number']),
			// mysql_affected_rows returns unsigned long long. With
			// WASM_BIGINT=1, cwrap returns BigInt which can't be
			// used directly in arithmetic or Buffer operations.
			// We wrap it to always return a plain Number.
			mysql_affected_rows: wrapBigInt(
				m.cwrap('mysql_affected_rows', 'number', ['number'])
			),
			mysql_field_count: m.cwrap('mysql_field_count', 'number', [
				'number',
			]),
			mysql_fetch_field: m.cwrap('mysql_fetch_field', 'number', [
				'number',
			]),
			mysql_fetch_lengths: m.cwrap('mysql_fetch_lengths', 'number', [
				'number',
			]),
			mysql_real_escape_string: m.cwrap(
				'mysql_real_escape_string',
				'number',
				['number', 'number', 'number', 'number']
			),
			mysql_select_db: m.cwrap('mysql_select_db', 'number', [
				'number',
				'string',
			]),
			mysql_get_server_info: m.cwrap('mysql_get_server_info', 'string', [
				'number',
			]),
			// mysql_insert_id returns unsigned long long (see above).
			mysql_insert_id: wrapBigInt(
				m.cwrap('mysql_insert_id', 'number', ['number'])
			),
		};
	}

	/**
	 * Initialize the embedded MariaDB server and open a connection.
	 * Must be called before any queries.
	 *
	 * The embedded server needs a data directory and several flags
	 * to work in WASM:
	 * - --skip-grant-tables: system tables don't exist (no mysql_install_db)
	 * - --datadir: where MyISAM data files are stored (in MEMFS)
	 * - --default-storage-engine=MyISAM: Aria is stubbed out in WASM
	 * - --skip-log-error: no error log file needed
	 */
	init(): void {
		if (this.initialized) {
			return;
		}

		// Create the data directories that the embedded server expects.
		// These live in Emscripten's in-memory filesystem (MEMFS).
		const DATA_DIR = '/usr/local/mysql/data';
		const requiredDirs = [
			'/usr',
			'/usr/local',
			'/usr/local/mysql',
			DATA_DIR,
			DATA_DIR + '/mysql',
			'/tmp',
		];
		for (const dir of requiredDirs) {
			try {
				this.module.FS.mkdir(dir);
			} catch {
				// Directory may already exist — that's fine.
			}
		}

		// Build the argv array for mysql_server_init. The embedded
		// server parses these like mysqld command-line arguments.
		const serverArgs = [
			'mariadbd',
			'--skip-grant-tables',
			`--datadir=${DATA_DIR}`,
			'--skip-log-error',
			'--default-storage-engine=MyISAM',
			'--default-tmp-storage-engine=MyISAM',
			// Disable Aria for internal temp tables. Aria's init is
			// stubbed in the WASM build (no threading), so any attempt
			// to create Aria temp files fails.
			'--loose-aria-used-for-temp-tables=OFF',
			// Emscripten can't detect the WASM stack size, so MariaDB
			// defaults thread_stack to 0 and rejects large queries.
			'--thread-stack=1048576',
		];
		const argPtrs = serverArgs.map((arg) => {
			const ptr = this.module._malloc(arg.length + 1);
			this.module.stringToUTF8(arg, ptr, arg.length + 1);
			return ptr;
		});
		const argv = this.module._malloc(argPtrs.length * 4);
		const heap32 = new Int32Array((this.module as any).HEAP8.buffer);
		for (let i = 0; i < argPtrs.length; i++) {
			heap32[(argv >> 2) + i] = argPtrs[i];
		}

		const rc = this.api.mysql_server_init(serverArgs.length, argv, 0);
		if (rc !== 0) {
			throw new Error(`mysql_server_init failed with code ${rc}`);
		}

		this.conn = this.api.mysql_init(0);
		if (this.conn === 0) {
			throw new Error('mysql_init returned null');
		}

		// The embedded server ignores host/user/password — everything
		// runs in-process. Passing nulls is correct here.
		const connected = this.api.mysql_real_connect(
			this.conn,
			null,
			null,
			null,
			null,
			0,
			null,
			0
		);
		if (connected === 0) {
			const err = this.api.mysql_error(this.conn);
			throw new Error(`mysql_real_connect failed: ${err}`);
		}

		this.initialized = true;

		// Bootstrap the mysql system database so MariaDB doesn't
		// complain about missing privilege tables. Without this,
		// every connection logs "Can't open and lock privilege tables."
		this.bootstrapSystemTables();
	}

	/**
	 * Create the mysql system tables (global_priv, plugin, servers, etc.)
	 * that MariaDB expects to find on startup. This is the equivalent of
	 * running mysql_install_db.
	 *
	 * We run a minimal subset — just enough for the embedded server to
	 * operate without "Can't open and lock privilege tables" errors.
	 * The full bootstrap scripts use Aria-specific features that may
	 * not work with our stubbed Aria, so we use MyISAM explicitly.
	 */
	private bootstrapSystemTables(): void {
		try {
			this.query('CREATE DATABASE IF NOT EXISTS mysql');
			this.query('USE mysql');

			// global_priv — the core privilege table
			this.query(`
				CREATE TABLE IF NOT EXISTS global_priv (
					Host char(255) binary DEFAULT '',
					User char(128) binary DEFAULT '',
					Priv JSON NOT NULL DEFAULT '{}' CHECK(JSON_VALID(Priv)),
					PRIMARY KEY (Host, User)
				) ENGINE=MyISAM CHARACTER SET utf8mb3 COLLATE utf8mb3_bin
				COMMENT='Users and global privileges'
			`);
			// Insert a root user with all privileges
			this.query(`
				INSERT IGNORE INTO global_priv (Host, User, Priv)
				VALUES
					('localhost', 'root', '{"access":18446744073709551615}'),
					('127.0.0.1', 'root', '{"access":18446744073709551615}'),
					('%', 'root', '{"access":18446744073709551615}')
			`);

			// plugin — plugin registry
			this.query(`
				CREATE TABLE IF NOT EXISTS plugin (
					name varchar(64) DEFAULT '' NOT NULL,
					dl varchar(128) DEFAULT '' NOT NULL,
					PRIMARY KEY (name)
				) ENGINE=MyISAM CHARACTER SET utf8mb3
				COLLATE utf8mb3_general_ci
				COMMENT='MySQL plugins'
			`);

			// servers — federated server links
			this.query(`
				CREATE TABLE IF NOT EXISTS servers (
					Server_name char(64) NOT NULL DEFAULT '',
					Host varchar(2048) NOT NULL DEFAULT '',
					Db char(64) NOT NULL DEFAULT '',
					Username char(128) NOT NULL DEFAULT '',
					Password char(64) NOT NULL DEFAULT '',
					Port INT(4) NOT NULL DEFAULT '0',
					Socket char(108) NOT NULL DEFAULT '',
					Wrapper char(64) NOT NULL DEFAULT '',
					Owner varchar(512) NOT NULL DEFAULT '',
					PRIMARY KEY (Server_name)
				) ENGINE=MyISAM CHARACTER SET utf8mb3
				COMMENT='MySQL Foreign Servers table'
			`);

			// func — user-defined functions
			this.query(`
				CREATE TABLE IF NOT EXISTS func (
					name char(64) binary DEFAULT '' NOT NULL,
					ret tinyint(1) DEFAULT '0' NOT NULL,
					dl char(128) DEFAULT '' NOT NULL,
					type enum('function','aggregate')
						COLLATE utf8mb3_general_ci NOT NULL,
					PRIMARY KEY (name)
				) ENGINE=MyISAM CHARACTER SET utf8mb3
				COLLATE utf8mb3_bin
				COMMENT='User defined functions'
			`);

			// proc — stored procedures
			this.query(`
				CREATE TABLE IF NOT EXISTS proc (
					db char(64) collate utf8mb3_bin DEFAULT '' NOT NULL,
					name char(64) DEFAULT '' NOT NULL,
					type enum('FUNCTION','PROCEDURE','PACKAGE',
						'PACKAGE BODY') NOT NULL,
					specific_name char(64) DEFAULT '' NOT NULL,
					language enum('SQL') DEFAULT 'SQL' NOT NULL,
					sql_data_access enum('CONTAINS_SQL','NO_SQL',
						'READS_SQL_DATA','MODIFIES_SQL_DATA')
						DEFAULT 'CONTAINS_SQL' NOT NULL,
					is_deterministic enum('YES','NO')
						DEFAULT 'NO' NOT NULL,
					security_type enum('INVOKER','DEFINER')
						DEFAULT 'DEFINER' NOT NULL,
					param_list blob NOT NULL,
					returns longblob NOT NULL,
					body longblob NOT NULL,
					definer varchar(384) collate utf8mb3_bin
						DEFAULT '' NOT NULL,
					created timestamp NOT NULL DEFAULT
						CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
					modified timestamp NOT NULL
						DEFAULT '0000-00-00 00:00:00',
					sql_mode set('REAL_AS_FLOAT','PIPES_AS_CONCAT',
						'ANSI_QUOTES','IGNORE_SPACE',
						'IGNORE_BAD_TABLE_OPTIONS',
						'ONLY_FULL_GROUP_BY',
						'NO_UNSIGNED_SUBTRACTION',
						'NO_DIR_IN_CREATE','POSTGRESQL','ORACLE',
						'MSSQL','DB2','MAXDB','NO_KEY_OPTIONS',
						'NO_TABLE_OPTIONS','NO_FIELD_OPTIONS',
						'MYSQL323','MYSQL40','ANSI',
						'NO_AUTO_VALUE_ON_ZERO',
						'NO_BACKSLASH_ESCAPES',
						'STRICT_TRANS_TABLES','STRICT_ALL_TABLES',
						'NO_ZERO_IN_DATE','NO_ZERO_DATE',
						'INVALID_DATES',
						'ERROR_FOR_DIVISION_BY_ZERO',
						'TRADITIONAL','NO_AUTO_CREATE_USER',
						'HIGH_NOT_PRECEDENCE',
						'NO_ENGINE_SUBSTITUTION',
						'PAD_CHAR_TO_FULL_LENGTH',
						'EMPTY_STRING_IS_NULL',
						'SIMULTANEOUS_ASSIGNMENT',
						'TIME_ROUND_FRACTIONAL')
						DEFAULT '' NOT NULL,
					comment text collate utf8mb3_bin NOT NULL,
					character_set_client char(32)
						collate utf8mb3_bin,
					collation_connection char(64)
						collate utf8mb3_bin,
					db_collation char(64) collate utf8mb3_bin,
					body_utf8 longblob,
					aggregate enum('NONE','GROUP')
						DEFAULT 'NONE' NOT NULL,
					PRIMARY KEY (db, name, type)
				) ENGINE=MyISAM CHARACTER SET utf8mb3
				COMMENT='Stored Procedures'
			`);
		} catch {
			// Non-fatal: if bootstrap fails, MariaDB still works
			// with --skip-grant-tables, just with warnings.
		}
	}

	/**
	 * Execute a SQL query and return structured results.
	 */
	query(sql: string): QueryResult {
		if (!this.initialized) {
			throw new Error(
				'MariaDB bridge not initialized. Call init() first.'
			);
		}

		const rc = this.api.mysql_query(this.conn, sql);
		if (rc !== 0) {
			const errno = this.api.mysql_errno(this.conn);
			const error = this.api.mysql_error(this.conn);
			throw new MariaDBQueryError(error, errno, sql);
		}

		const resultPtr = this.api.mysql_store_result(this.conn);

		// Non-SELECT statements (INSERT, UPDATE, DELETE, CREATE, etc.)
		// return a null result set.
		if (resultPtr === 0) {
			return {
				columns: [],
				rows: [],
				affectedRows: Math.max(
					0,
					this.api.mysql_affected_rows(this.conn)
				),
				insertId: Math.max(0, this.api.mysql_insert_id(this.conn)),
				warningCount: 0,
			};
		}

		try {
			const numFields = this.api.mysql_num_fields(resultPtr);
			const columns = this.readColumns(resultPtr, numFields);
			const rows = this.readRows(resultPtr, numFields);

			return {
				columns,
				rows,
				affectedRows: Math.max(
					0,
					this.api.mysql_affected_rows(this.conn)
				),
				insertId: Math.max(0, this.api.mysql_insert_id(this.conn)),
				warningCount: 0,
			};
		} finally {
			this.api.mysql_free_result(resultPtr);
		}
	}

	/**
	 * Read column metadata from a result set.
	 *
	 * The MYSQL_FIELD struct layout (relevant fields):
	 *   offset 0:  char *name        (pointer to column name)
	 *   offset 4:  char *org_name    (pointer to original column name)
	 *   offset 8:  char *table       (pointer to table name)
	 *   offset 12: char *org_table   (pointer to original table name)
	 *   offset 16: char *db          (pointer to database name)
	 *   offset 20: char *catalog     (pointer to catalog)
	 *   offset 24: char *def         (pointer to default value)
	 *   offset 28: unsigned long length
	 *   offset 32: unsigned long max_length
	 *   offset 36: unsigned int name_length
	 *   offset 40: unsigned int org_name_length
	 *   offset 44: unsigned int table_length
	 *   offset 48: unsigned int org_table_length
	 *   offset 52: unsigned int db_length
	 *   offset 56: unsigned int catalog_length
	 *   offset 60: unsigned int def_length
	 *   offset 64: unsigned int flags
	 *   offset 68: unsigned int decimals
	 *   offset 72: unsigned int charsetnr
	 *   offset 76: enum enum_field_types type
	 *
	 * Note: These offsets assume 32-bit WASM (4-byte pointers). Emscripten
	 * compiles to wasm32 by default.
	 */
	private readColumns(resultPtr: number, numFields: number): ColumnInfo[] {
		const columns: ColumnInfo[] = [];
		for (let i = 0; i < numFields; i++) {
			const fieldPtr = this.api.mysql_fetch_field(resultPtr);
			if (fieldPtr === 0) {
				columns.push({
					name: `col${i}`,
					type: 253, // MYSQL_TYPE_VAR_STRING
					length: 255,
					flags: 0,
					decimals: 0,
				});
				continue;
			}

			const namePtr = this.module.getValue(fieldPtr, 'i32');
			const name = namePtr
				? this.module.UTF8ToString(namePtr)
				: `col${i}`;
			// Read as signed i32 then interpret as unsigned via >>> 0.
			// The MYSQL_FIELD struct uses unsigned long for length/flags
			// but getValue only supports signed reads.
			const length = this.module.getValue(fieldPtr + 28, 'i32') >>> 0;
			const flags = this.module.getValue(fieldPtr + 64, 'i32') >>> 0;
			const decimals = this.module.getValue(fieldPtr + 68, 'i32') >>> 0;
			const type = this.module.getValue(fieldPtr + 76, 'i32');

			columns.push({ name, type, length, flags, decimals });
		}
		return columns;
	}

	/**
	 * Read all rows from a result set.
	 *
	 * Each row is a char** (array of string pointers). We read
	 * pointer-sized values (4 bytes in wasm32) for each field.
	 */
	private readRows(
		resultPtr: number,
		numFields: number
	): (string | null)[][] {
		const rows: (string | null)[][] = [];
		let rowPtr: number;
		while ((rowPtr = this.api.mysql_fetch_row(resultPtr)) !== 0) {
			// Read field lengths for this row so we know the byte
			// count of each value. mysql_fetch_lengths() returns a
			// pointer to an unsigned long array (one entry per field).
			const lengthsPtr = this.api.mysql_fetch_lengths(resultPtr);

			const row: (string | null)[] = [];
			for (let i = 0; i < numFields; i++) {
				const strPtr = this.module.getValue(rowPtr + i * 4, 'i32');
				if (strPtr === 0) {
					row.push(null);
				} else {
					// Use the reported length rather than relying on
					// null-termination. This correctly handles binary
					// data that may contain embedded zero bytes.
					const len = lengthsPtr
						? this.module.getValue(lengthsPtr + i * 4, 'i32')
						: 0;
					if (len > 0) {
						row.push(this.module.UTF8ToString(strPtr));
					} else {
						row.push('');
					}
				}
			}
			rows.push(row);
		}
		return rows;
	}

	/**
	 * Get the MariaDB server version string.
	 */
	getServerInfo(): string {
		if (!this.initialized) {
			return 'MariaDB WASM (not initialized)';
		}
		return this.api.mysql_get_server_info(this.conn);
	}

	/**
	 * Shut down the embedded server and release resources.
	 */
	destroy(): void {
		if (!this.initialized) {
			return;
		}
		try {
			this.api.mysql_close(this.conn);
		} catch {
			// Ignore errors during shutdown
		}
		try {
			this.api.mysql_server_end();
		} catch {
			// Ignore errors during shutdown
		}
		this.conn = 0;
		this.initialized = false;
	}
}

/**
 * Error thrown when a MariaDB query fails.
 */
export class MariaDBQueryError extends Error {
	errno: number;
	sql: string;

	constructor(message: string, errno: number, sql: string) {
		super(message);
		this.name = 'MariaDBQueryError';
		this.errno = errno;
		this.sql = sql;
	}
}

/**
 * Load the mariadb-wasm Emscripten module from a file path.
 *
 * The path should point to the mariadb.js file produced by the
 * mariadb-wasm build script. The corresponding mariadb.wasm file
 * must be in the same directory.
 *
 * @param modulePath - Absolute path to mariadb.js
 * @param dataDir    - Optional host directory to mount as NODEFS at
 *                     /var/lib/mysql inside the WASM filesystem. When
 *                     provided, MariaDB's data files persist across
 *                     restarts.
 */
export async function loadMariaDBModule(
	modulePath: string,
	dataDir?: string
): Promise<MariaDBBridge> {
	// Dynamic import of the Emscripten-generated module. The module
	// exports a factory function (createMariaDB) as its default export.
	const factory = await importMariaDBFactory(modulePath);
	const emModule: MariaDBEmscriptenModule = await factory({});

	// If a data directory is provided, mount it via NODEFS so that
	// MyISAM data files persist on the host filesystem across restarts.
	if (dataDir && emModule.NODEFS) {
		try {
			emModule.FS.mkdir('/var/lib/mysql');
		} catch {
			// May already exist
		}
		emModule.FS.mount(emModule.NODEFS, { root: dataDir }, '/var/lib/mysql');
	}

	const bridge = new MariaDBBridge(emModule);
	bridge.init();
	return bridge;
}

async function importMariaDBFactory(
	modulePath: string
): Promise<
	(options?: Record<string, any>) => Promise<MariaDBEmscriptenModule>
> {
	const imported = await import(/* webpackIgnore: true */ modulePath);
	return imported.default || imported;
}
