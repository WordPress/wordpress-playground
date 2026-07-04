import test, { type Page } from '@playwright/test';

const phpVersion = '8.2';
const successResult = {
	rows: [
		{ worker: 1, c: 50 },
		{ worker: 2, c: 50 },
	],
	count: 100,
	journal: 'wal',
	integrity: 'ok',
	wal: true,
	shm: true,
};

type WebRuntimeLoaderName =
	| 'loadWebRuntime'
	| 'loadWebRuntimeWithoutSQLiteSharedMemory';

const browserConsoleLogs = new WeakMap<Page, string[]>();

test.describe('SQLite file locking', () => {
	test.beforeEach(async ({ page }) => {
		const logs: string[] = [];
		browserConsoleLogs.set(page, logs);
		page.on('console', (log) => logs.push(log.text()));

		await page.goto('/');

		await page.addScriptTag({
			type: 'module',
			url: '/src/test/playwright/browser-globals.ts',
		});
	});

	test.afterEach(async ({ page }, testInfo) => {
		if (testInfo.status === testInfo.expectedStatus) {
			return;
		}
		const logs = browserConsoleLogs.get(page);
		if (!logs?.length) {
			return;
		}
		await testInfo.attach('browser-console.log', {
			body: logs.join('\n'),
			contentType: 'text/plain',
		});
	});

	test('coordinates WAL writes across PROXYFS runtimes', async ({ page }) => {
		const result = await runWalConcurrencyScenario(page, 'loadWebRuntime');

		test.expect(result).toEqual(successResult);
	});

	test('needs shared memory coordination for WAL writes across PROXYFS runtimes', async ({
		page,
	}) => {
		const result = await runWalConcurrencyScenario(
			page,
			'loadWebRuntimeWithoutSQLiteSharedMemory'
		);

		/*
		 * This is the same workload as the positive test with only the
		 * cross-runtime `-shm` coordinator disabled. Without it, one runtime's
		 * WAL-index view wins and the other writer's committed frames vanish.
		 */
		test.expect(result).toMatchObject({
			count: 50,
			journal: 'wal',
			integrity: 'ok',
			wal: true,
			shm: true,
		});
		test.expect(result.rows).toHaveLength(1);
		test.expect(result.rows[0].c).toBe(50);
		test.expect([1, 2]).toContain(result.rows[0].worker);
		test.expect(result).not.toEqual(successResult);
	});
});

async function runWalConcurrencyScenario(
	page: Page,
	runtimeLoaderName: WebRuntimeLoaderName
) {
	return await page.evaluate(
		async ({ phpVersion, runtimeLoaderName }) => {
			async function createPHP() {
				const php = new window.PHP(
					await window[runtimeLoaderName](phpVersion as any)
				);
				return php;
			}

			async function runText(
				php: InstanceType<typeof window.PHP>,
				code: string
			) {
				const response = await php.run({ code });
				if (response.exitCode !== 0) {
					throw new Error(response.text);
				}
				return response.text;
			}

			const primary = await createPHP();
			const replica = await createPHP();
			await window.proxyFileSystem(primary, replica, ['/tmp']);

			const databasePath = `/tmp/sqlite-locks-${Date.now()}.sqlite`;
			await runText(
				primary,
				`<?php
					$db = '${databasePath}';
					@unlink( $db );
					@unlink( $db . '-wal' );
					@unlink( $db . '-shm' );
					$pdo = new PDO( 'sqlite:' . $db );
					$pdo->setAttribute( PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION );
					$pdo->query( 'PRAGMA journal_mode=wal' )->fetchColumn();
					$pdo->exec( 'CREATE TABLE t(worker int, i int)' );
				`
			);

			const worker = (id: number) => `<?php
				$pdo = new PDO( 'sqlite:${databasePath}' );
				$pdo->setAttribute( PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION );
				$pdo->exec( 'PRAGMA busy_timeout=5000' );
				for ( $i = 0; $i < 50; $i++ ) {
					$pdo->beginTransaction();
					$pdo->exec( 'INSERT INTO t(worker, i) VALUES (${id}, ' . $i . ')' );
					$pdo->commit();
				}
			`;

			try {
				await Promise.all([
					runText(primary, worker(1)),
					runText(replica, worker(2)),
				]);

				return JSON.parse(
					await runText(
						primary,
						`<?php
							$pdo = new PDO( 'sqlite:${databasePath}' );
							$rows = $pdo->query( 'SELECT worker, COUNT(*) c FROM t GROUP BY worker ORDER BY worker' )->fetchAll( PDO::FETCH_ASSOC );
							echo json_encode( array(
								'rows' => $rows,
								'count' => (int) $pdo->query( 'SELECT COUNT(*) FROM t' )->fetchColumn(),
								'journal' => $pdo->query( 'PRAGMA journal_mode' )->fetchColumn(),
								'integrity' => $pdo->query( 'PRAGMA integrity_check' )->fetchColumn(),
								'wal' => file_exists( '${databasePath}-wal' ),
								'shm' => file_exists( '${databasePath}-shm' ),
							) );
						`
					)
				);
			} finally {
				primary.exit();
				replica.exit();
			}
		},
		{ phpVersion, runtimeLoaderName }
	);
}
