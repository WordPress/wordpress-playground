import fs from 'fs';
import path from 'path';
import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
} from '@php-wasm/universal';
// eslint-disable-next-line @nx/enforce-module-boundaries
import InitialDockerfile from '../../../compile/php/Dockerfile?raw';
import { loadNodeRuntime } from '../lib';
import { jspi } from 'wasm-feature-detect';

const runtimeMode = (await jspi()) ? 'jspi' : 'asyncify';

describe(`SQLite3 – ${runtimeMode}`, () => {
	const phpVersions =
		'PHP' in process.env ? [process.env['PHP']] : SupportedPHPVersions;

	const drivers = {
		SQLite3:
			"$db = new SQLite3('sqlite:' . tempnam(sys_get_temp_dir(), 'php-wasm-sqlite3-'));",
		PDO: "$db = new PDO('sqlite:' . tempnam(sys_get_temp_dir(), 'php-wasm-sqlite3-'));",
	};
	const topOfTheStack: Record<string, string> = {};
	for (const [driverName, driverCode] of Object.entries(drivers)) {
		topOfTheStack[`createTable${driverName}`] = `
			${driverCode}
			// Create a new table
			$db->exec('CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				email TEXT NOT NULL
			)');

			// Insert a few records
			$db->exec("INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')");
			$db->exec("INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com')");
			$db->exec("INSERT INTO users (name, email) VALUES ('Charlie', 'charlie@example.com')");
		`;

		topOfTheStack[`preparedStatements${driverName}`] = `
			${driverCode}
			$stmt = $db->prepare('INSERT INTO users (name, email) VALUES (:name, :email)');
			$stmt->bindValue(':name', 'Alice', SQLITE3_TEXT);
			$stmt->bindValue(':email', 'alice@example.com', SQLITE3_TEXT);
			$stmt->execute();
		`;

		topOfTheStack[`transactions${driverName}`] = `
			${driverCode}
			$db->exec('BEGIN TRANSACTION');
			$db->exec("INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')");
			$db->exec("INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com')");
			$db->exec('COMMIT');
		`;

		topOfTheStack[`customFunctions${driverName}`] = `
			${driverCode}
			$db->createFunction('my_concat', function($a, $b) {
				return $a . ' ' . $b;
			}, 2);
			$db->exec('SELECT my_concat("Hello", "World")');
		`;

		topOfTheStack[`customFunctionDoingAsyncOperation${driverName}`] = `
			${driverCode}
			$db->createFunction('my_concat', function($a, $b) {
				fetch('https://wordpress.org');
				return $a . ' ' . $b;
			}, 2);
			$db->exec('SELECT my_concat("Hello", "World")');
		`;
	}

	// SQLite3 extension-specific asyncify tests
	topOfTheStack['sqlite3Open'] = `
		${drivers.SQLite3}
		$db->exec('CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY, val TEXT)');
		$db->close();
	`;

	topOfTheStack['sqlite3OpenBlob'] = `
		${drivers.SQLite3}
		$db->exec('CREATE TABLE blobs (id INTEGER PRIMARY KEY, data BLOB)');
		$stmt = $db->prepare('INSERT INTO blobs (data) VALUES (:data)');
		$stmt->bindValue(':data', 'hello world', SQLITE3_BLOB);
		$stmt->execute();
		$rowid = $db->lastInsertRowID();
		$stream = $db->openBlob('blobs', 'data', $rowid, 'main', SQLITE3_OPEN_READONLY);
		if (is_resource($stream)) {
			$data = stream_get_contents($stream);
			fclose($stream);
		}
	`;

	topOfTheStack['sqlite3Query'] = `
		${drivers.SQLite3}
		$db->exec('CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)');
		$db->exec("INSERT INTO t (val) VALUES ('foo')");
		$result = $db->query('SELECT val FROM t WHERE id = 1');
		$row = $result->fetchArray(SQLITE3_ASSOC);
	`;

	topOfTheStack['sqlite3QuerySingle'] = `
		${drivers.SQLite3}
		$db->exec('CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)');
		$db->exec("INSERT INTO t (val) VALUES ('bar')");
		$val = $db->querySingle('SELECT val FROM t WHERE id = 1');
	`;

	topOfTheStack['sqlite3Backup'] = `
		$src = new SQLite3(':memory:');
		$src->exec('CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)');
		$src->exec("INSERT INTO t (val) VALUES ('baz')");
		$dest = new SQLite3('backup.sqlite');
		$src->backup($dest, 'main', 'main');
		$dest->close();
		$src->close();
	`;

	topOfTheStack['sqlite3BusyTimeout'] = `
		${drivers.SQLite3}
		$db->busyTimeout(1000);
	`;

	topOfTheStack['sqlite3CreateAggregate'] = `
		${drivers.SQLite3}
		$db->exec('CREATE TABLE t (val INTEGER)');
		$db->exec('INSERT INTO t (val) VALUES (1), (2), (3)');
		$db->createAggregate('mysum', function (&$context, $row, $val) {
			$context += $val;
		}, function (&$context) {
			return $context;
		}, 1);
		$result = $db->querySingle('SELECT mysum(val) FROM t');
	`;

	topOfTheStack['sqlite3CreateCollation'] = `
		${drivers.SQLite3}
		$db->createCollation('NOCASE_REVERSE', function($a, $b) {
			return strcmp(strrev($a), strrev($b));
		});
		$db->exec('CREATE TABLE t (val TEXT)');
		$db->exec("INSERT INTO t (val) VALUES ('abc'), ('cba')");
		$result = $db->query('SELECT val FROM t ORDER BY val COLLATE NOCASE_REVERSE');
	`;

	topOfTheStack['sqlite3SetAuthorizer'] = `
		${drivers.SQLite3}
		$db->setAuthorizer(function($action, $arg1, $arg2, $dbName, $triggerName) {
			if ($action === SQLITE3_CREATE_TABLE) {
				return SQLITE3_DENY;
			}
			return SQLITE3_OK;
		});
		// This should fail due to authorizer
		@$db->exec('CREATE TABLE t (id INTEGER)');
	`;

	topOfTheStack['sqlite3ResultFetchArray'] = `
		${drivers.SQLite3}
		$db->exec('CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)');
		$db->exec("INSERT INTO t (val) VALUES ('foo')");
		$result = $db->query('SELECT * FROM t');
		while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
			// do nothing
		}
	`;

	topOfTheStack['sqlite3StmtExecute'] = `
		${drivers.SQLite3}
		$db->exec('CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)');
		$stmt = $db->prepare('INSERT INTO t (val) VALUES (:val)');
		$stmt->bindValue(':val', 'async', SQLITE3_TEXT);
		$stmt->execute();
	`;

	topOfTheStack['sqlite3StmtReset'] = `
		${drivers.SQLite3}
		$db->exec('CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)');
		$stmt = $db->prepare('INSERT INTO t (val) VALUES (:val)');
		$stmt->bindValue(':val', 'reset', SQLITE3_TEXT);
		$stmt->execute();
		$stmt->reset();
		$stmt->bindValue(':val', 'reset2', SQLITE3_TEXT);
		$stmt->execute();
	`;

	topOfTheStack['sqlite3ResultNumColumns'] = `
		${drivers.SQLite3}
		$db->exec('CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)');
		$db->exec("INSERT INTO t (val) VALUES ('foo')");
		$result = $db->query('SELECT * FROM t');
		$numCols = $result->numColumns();
	`;

	// PDO extension-specific asyncify tests
	topOfTheStack['pdoBeginCommitRollback'] = `
		${drivers.PDO}
		$db->beginTransaction();
		$db->exec("INSERT INTO users (name, email) VALUES ('Dave', 'dave@example.com')");
		$db->commit();
		$db->beginTransaction();
		$db->exec("INSERT INTO users (name, email) VALUES ('Eve', 'eve@example.com')");
		$db->rollBack();
	`;

	topOfTheStack['pdoPrepareExecuteFetch'] = `
		${drivers.PDO}
		$db->exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, val TEXT)');
		$stmt = $db->prepare('INSERT INTO test (val) VALUES (:val)');
		$stmt->bindValue(':val', 'async', PDO::PARAM_STR);
		$stmt->execute();
		$stmt = $db->prepare('SELECT * FROM test');
		$stmt->execute();
		while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
			// do nothing
		}
	`;

	topOfTheStack['pdoLastInsertId'] = `
		${drivers.PDO}
		$db->exec('CREATE TABLE IF NOT EXISTS test2 (id INTEGER PRIMARY KEY, val TEXT)');
		$db->exec("INSERT INTO test2 (val) VALUES ('foo')");
		$lastId = $db->lastInsertId();
	`;

	topOfTheStack['pdoErrorInfo'] = `
		${drivers.PDO}
		// Intentionally cause an error
		@$db->exec('INVALID SQL');
		$errorInfo = $db->errorInfo();
	`;

	topOfTheStack['pdoStatementBindParamFetchAll'] = `
		${drivers.PDO}
		$db->exec('CREATE TABLE IF NOT EXISTS test3 (id INTEGER PRIMARY KEY, val TEXT)');
		$db->exec("INSERT INTO test3 (val) VALUES ('bar')");
		$stmt = $db->prepare('SELECT * FROM test3 WHERE val = :val');
		$val = 'bar';
		$stmt->bindParam(':val', $val, PDO::PARAM_STR);
		$stmt->execute();
		$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
	`;

	topOfTheStack['pdoStatementColumnCount'] = `
		${drivers.PDO}
		$db->exec('CREATE TABLE IF NOT EXISTS test4 (id INTEGER PRIMARY KEY, val TEXT)');
		$db->exec("INSERT INTO test4 (val) VALUES ('baz')");
		$stmt = $db->query('SELECT * FROM test4');
		$numCols = $stmt->columnCount();
	`;

	topOfTheStack['pdoGetAttributeSetAttribute'] = `
		${drivers.PDO}
		$oldErrMode = $db->getAttribute(PDO::ATTR_ERRMODE);
		$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
		$newErrMode = $db->getAttribute(PDO::ATTR_ERRMODE);
	`;

	topOfTheStack['pdoQuote'] = `
		${drivers.PDO}
		$unsafe = "O'Reilly";
		$safe = $db->quote($unsafe);
	`;

	topOfTheStack['pdoGetAvailableDrivers'] = `
		${drivers.PDO}
		$drivers = PDO::getAvailableDrivers();
	`;

	describe.each(phpVersions)(`PHP %s – ${runtimeMode}`, (phpVersion) => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(await loadNodeRuntime(phpVersion as any));
			await setPhpIniEntries(php, { allow_url_fopen: 1 });
		});

		afterEach(async () => {
			php.exit();
		});

		describe.each(Object.keys(topOfTheStack))('%s', (networkCallKey) => {
			const networkCall = topOfTheStack[networkCallKey];
			test('Direct call', () => assertNoCrash(networkCall));
		});

		async function assertNoCrash(code: string) {
			try {
				const result = await php.run({
					code: `<?php ${code}`,
				});
				expect(result).toBeTruthy();
				expect(result.text).toBe('');
				expect(result.errors).toBeFalsy();
				expect(result.exitCode).toBe(0);
			} catch (e) {
				if (
					'FIX_DOCKERFILE' in process.env &&
					process.env['FIX_DOCKERFILE'] === 'true' &&
					runtimeMode == 'asyncify' &&
					'functionsMaybeMissingFromAsyncify' in php
				) {
					const missingCandidates = (
						php.functionsMaybeMissingFromAsyncify as string[]
					)
						.map((candidate) =>
							candidate.replace('byn$fpcast-emu$', '')
						)
						.filter(
							(candidate) =>
								!Dockerfile.includes(`"${candidate}"`)
						);
					if (missingCandidates.length) {
						addAsyncifyFunctionsToDockerfile(missingCandidates);
						throw new Error(
							`Asyncify crash! The following missing functions were just auto-added to the ASYNCIFY_ONLY list in the Dockerfile: \n ` +
								missingCandidates.join(', ') +
								`\nYou now need to rebuild PHP and re-run this test: \n` +
								`  npm run recompile:php:node:asyncify:8.0\n` +
								`  node --stack-trace-limit=100 ./node_modules/.bin/nx test php-wasm-node --test-name-pattern='asyncify'\n`
						);
					}

					const err = new Error(
						`Asyncify crash! No C functions present in the stack trace were missing ` +
							`from the Dockerfile. This could mean the stack trace is too short – try increasing the stack trace limit ` +
							`with --stack-trace-limit=100. If you already did that, fixing this problem will likely take more digging.`
					);
					err.cause = e;
					throw err;
				}
			}
		}
	});
});

let Dockerfile = InitialDockerfile;
const DockerfilePath = path.resolve(
	__dirname,
	'../../../compile/php/Dockerfile'
);
function addAsyncifyFunctionsToDockerfile(functions: string[]) {
	const currentDockerfile = fs.readFileSync(DockerfilePath, 'utf8') + '';
	const lookup = `export ASYNCIFY_ONLY_UNPREFIXED=$'`;
	const idx = currentDockerfile.indexOf(lookup) + lookup.length;
	const updatedDockerfile =
		currentDockerfile.substring(0, idx) +
		functions.map((f) => `"${f}",\\\n`).join('') +
		currentDockerfile.substring(idx);
	fs.writeFileSync(DockerfilePath, updatedDockerfile);
	Dockerfile = updatedDockerfile;
}
