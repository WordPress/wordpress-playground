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
			mysql_affected_rows: m.cwrap('mysql_affected_rows', 'number', [
				'number',
			]),
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
			mysql_insert_id: m.cwrap('mysql_insert_id', 'number', ['number']),
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
				affectedRows: this.api.mysql_affected_rows(this.conn),
				insertId: this.api.mysql_insert_id(this.conn),
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
				affectedRows: this.api.mysql_affected_rows(this.conn),
				insertId: this.api.mysql_insert_id(this.conn),
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
			const length = this.module.getValue(fieldPtr + 28, 'i32');
			const flags = this.module.getValue(fieldPtr + 64, 'i32');
			const decimals = this.module.getValue(fieldPtr + 68, 'i32');
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
