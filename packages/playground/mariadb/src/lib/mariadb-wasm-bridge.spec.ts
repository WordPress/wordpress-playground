import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MariaDBBridge, MariaDBQueryError } from './mariadb-wasm-bridge';
import type { MariaDBEmscriptenModule } from './mariadb-wasm-bridge';

/**
 * Creates a mock Emscripten module that simulates the MariaDB C API.
 * The mock tracks calls and returns sensible defaults so the bridge
 * can be exercised without the real WASM binary.
 */
function createMockModule(): MariaDBEmscriptenModule {
	const MOCK_CONN = 42;
	const MOCK_RESULT = 100;
	const MOCK_FIELD = 200;

	// Simple in-memory state to simulate query behavior
	let hasResultSet = false;
	let rowIndex = 0;

	// Simulated result data for SELECT queries
	const mockRows = [
		['1', 'hello'],
		['2', 'world'],
	];
	const mockColumns = ['id', 'name'];

	const cwrapFunctions: Record<string, (...args: any[]) => any> = {
		mysql_server_init: vi.fn(() => 0),
		mysql_server_end: vi.fn(),
		mysql_init: vi.fn(() => MOCK_CONN),
		mysql_real_connect: vi.fn(() => MOCK_CONN),
		mysql_close: vi.fn(),
		mysql_query: vi.fn((_conn: number, sql: string) => {
			hasResultSet = sql.trim().toUpperCase().startsWith('SELECT');
			rowIndex = 0;
			if (sql.includes('FORCE_ERROR')) {
				return 1; // non-zero = error
			}
			return 0;
		}),
		mysql_store_result: vi.fn(() => {
			return hasResultSet ? MOCK_RESULT : 0;
		}),
		mysql_fetch_row: vi.fn(() => {
			if (rowIndex < mockRows.length) {
				rowIndex++;
				return 300 + rowIndex; // non-zero pointer
			}
			return 0; // end of rows
		}),
		mysql_num_fields: vi.fn(() => (hasResultSet ? 2 : 0)),
		mysql_num_rows: vi.fn(() => (hasResultSet ? mockRows.length : 0)),
		mysql_free_result: vi.fn(),
		mysql_error: vi.fn(() => 'Forced test error'),
		mysql_errno: vi.fn(() => 1064),
		mysql_affected_rows: vi.fn(() => (hasResultSet ? 0 : 1)),
		mysql_field_count: vi.fn(() => (hasResultSet ? 2 : 0)),
		mysql_fetch_field: vi.fn(() => MOCK_FIELD),
		mysql_fetch_lengths: vi.fn(() => 400),
		mysql_real_escape_string: vi.fn(() => 0),
		mysql_select_db: vi.fn(() => 0),
		mysql_get_server_info: vi.fn(() => '10.11.6-MariaDB'),
		mysql_insert_id: vi.fn(() => 0),
	};

	// Track which field we're on for column metadata
	let fieldIndex = 0;

	return {
		cwrap: vi.fn((name: string) => {
			return cwrapFunctions[name] || vi.fn(() => 0);
		}),
		getValue: vi.fn((ptr: number) => {
			// Column name pointer — return a non-zero value so the bridge
			// calls UTF8ToString on it
			if (ptr === MOCK_FIELD) {
				fieldIndex++;
				return 500 + fieldIndex;
			}
			// Column length (offset 28)
			if (ptr === MOCK_FIELD + 28) return 255;
			// Column flags (offset 64)
			if (ptr === MOCK_FIELD + 64) return 0;
			// Column decimals (offset 68)
			if (ptr === MOCK_FIELD + 68) return 0;
			// Column type (offset 76) — MYSQL_TYPE_VAR_STRING = 253
			if (ptr === MOCK_FIELD + 76) return 253;

			// Row field pointers — return non-zero for valid values
			if (ptr >= 301 && ptr < 400) return 600;

			// Field lengths
			if (ptr >= 400 && ptr < 500) return 5;

			return 0;
		}),
		UTF8ToString: vi.fn((ptr: number) => {
			// Column names
			if (ptr >= 501 && ptr <= 502) {
				return mockColumns[(ptr - 501) % mockColumns.length];
			}
			// Row values — return mock data based on field/row
			if (ptr === 600) return 'mock_value';
			return '';
		}),
		stringToUTF8: vi.fn(),
		_malloc: vi.fn(() => 1000),
		_free: vi.fn(),
		FS: {
			mkdir: vi.fn(),
			mount: vi.fn(),
		},
		// HEAP8 is needed by init() to build the argv array for
		// mysql_server_init via Int32Array view.
		HEAP8: { buffer: new ArrayBuffer(8192) },
	} as any;
}

describe('MariaDBBridge', () => {
	let mockModule: MariaDBEmscriptenModule;
	let bridge: MariaDBBridge;

	beforeEach(() => {
		mockModule = createMockModule();
		bridge = new MariaDBBridge(mockModule);
	});

	it('wraps all required MySQL C API functions via cwrap', () => {
		const expectedFunctions = [
			'mysql_server_init',
			'mysql_server_end',
			'mysql_init',
			'mysql_real_connect',
			'mysql_close',
			'mysql_query',
			'mysql_store_result',
			'mysql_fetch_row',
			'mysql_num_fields',
			'mysql_num_rows',
			'mysql_free_result',
			'mysql_error',
			'mysql_errno',
			'mysql_affected_rows',
			'mysql_field_count',
			'mysql_fetch_field',
			'mysql_fetch_lengths',
			'mysql_real_escape_string',
			'mysql_select_db',
			'mysql_get_server_info',
			'mysql_insert_id',
		];

		const cwrapCalls = (mockModule.cwrap as any).mock.calls.map(
			(c: any[]) => c[0]
		);
		for (const fn of expectedFunctions) {
			expect(cwrapCalls).toContain(fn);
		}
	});

	it('throws when querying before init()', () => {
		expect(() => bridge.query('SELECT 1')).toThrow(
			'MariaDB bridge not initialized'
		);
	});

	it('initializes the embedded server and opens a connection', () => {
		bridge.init();

		// mysql_server_init should have been called
		const serverInit = (mockModule.cwrap as any).mock.results.find(
			(r: any, i: number) =>
				(mockModule.cwrap as any).mock.calls[i][0] ===
				'mysql_server_init'
		);
		expect(serverInit).toBeDefined();
	});

	it('does not double-initialize', () => {
		bridge.init();
		bridge.init(); // should be a no-op
		// No error thrown means success
	});

	it('executes a non-SELECT query and returns affected rows', () => {
		bridge.init();
		const result = bridge.query('INSERT INTO t VALUES (1)');

		expect(result.columns).toHaveLength(0);
		expect(result.rows).toHaveLength(0);
		expect(result.affectedRows).toBe(1);
	});

	it('executes a SELECT query and returns columns and rows', () => {
		bridge.init();
		const result = bridge.query('SELECT id, name FROM t');

		expect(result.columns).toHaveLength(2);
		expect(result.columns[0].name).toBe('id');
		expect(result.columns[1].name).toBe('name');
		expect(result.rows).toHaveLength(2);
	});

	it('throws MariaDBQueryError on query failure', () => {
		bridge.init();
		try {
			bridge.query('SELECT FORCE_ERROR');
			expect.fail('Should have thrown');
		} catch (e) {
			expect(e).toBeInstanceOf(MariaDBQueryError);
			const err = e as MariaDBQueryError;
			expect(err.errno).toBe(1064);
			expect(err.sql).toBe('SELECT FORCE_ERROR');
		}
	});

	it('returns server info', () => {
		bridge.init();
		expect(bridge.getServerInfo()).toBe('10.11.6-MariaDB');
	});

	it('returns a fallback string before init', () => {
		expect(bridge.getServerInfo()).toContain('not initialized');
	});

	it('cleans up on destroy()', () => {
		bridge.init();
		bridge.destroy();

		// After destroy, querying should fail
		expect(() => bridge.query('SELECT 1')).toThrow(
			'MariaDB bridge not initialized'
		);
	});

	it('destroy() is safe to call multiple times', () => {
		bridge.init();
		bridge.destroy();
		bridge.destroy(); // should not throw
	});

	it('destroy() is safe to call without init()', () => {
		bridge.destroy(); // should not throw
	});
});

describe('MariaDBQueryError', () => {
	it('includes errno and sql in the error', () => {
		const err = new MariaDBQueryError('bad syntax', 1064, 'SELECT ???');
		expect(err.name).toBe('MariaDBQueryError');
		expect(err.message).toBe('bad syntax');
		expect(err.errno).toBe(1064);
		expect(err.sql).toBe('SELECT ???');
		expect(err).toBeInstanceOf(Error);
	});
});
