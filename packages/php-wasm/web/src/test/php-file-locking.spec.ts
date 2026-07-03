import test from '@playwright/test';

const phpVersion = '8.2';

test.describe('SQLite file locking', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', (log) => console.log(log.text()));

		await page.goto('/');

		await page.addScriptTag({
			type: 'module',
			url: '/src/test/playwright/browser-globals.ts',
		});
	});

	test('coordinates rollback-journal writes across PROXYFS runtimes', async ({
		page,
	}) => {
		const result = await page.evaluate(async (phpVersion) => {
			async function createPHP() {
				const php = new window.PHP(
					await window.loadWebRuntime(phpVersion as any)
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
					$pdo->query( 'PRAGMA journal_mode=delete' )->fetchColumn();
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
		}, phpVersion);

		test.expect(result).toEqual({
			rows: [
				{ worker: 1, c: 50 },
				{ worker: 2, c: 50 },
			],
			count: 100,
			integrity: 'ok',
			wal: false,
			shm: false,
		});
	});
});
