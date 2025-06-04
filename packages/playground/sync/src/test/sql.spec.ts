import type { PHP } from '@php-wasm/universal';
import type { SQLJournalEntry } from '../sql';
import { installSqlSyncMuPlugin, journalSQLQueries } from '../sql';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { bootWordPress } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';

describe('Sync tests', () => {
	let php: PHP;
	beforeEach(async () => {
		const handler = await bootWordPress({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',

			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(
				// The new AST-based SQLite driver doesn't expose query information
				// via the "sqlite_last_insert_id", "sqlite_translated_query_executed",
				// and "sqlite_transaction_query_executed" hooks.
				// We need to use the old driver here.
				'v2.1.17-alpha.1'
			),
		});
		php = await handler.getPrimaryPhp();
	});
	it('Loads WordPress', async () => {
		expect(php.listFiles('/')).toContain('wordpress');
	});
	it('Journals SQL queries', async () => {
		const inserts: SQLJournalEntry[] = [];
		const sqlCapture = vitest.fn((entry: SQLJournalEntry) => {
			if (entry.query_type === 'INSERT') {
				inserts.push(entry);
			}
		});

		await installSqlSyncMuPlugin(php);
		await journalSQLQueries(php, sqlCapture);

		await php.run({
			code: `<?php
                require '/wordpress/wp-load.php';
                // Create post object
                $my_post = array(
                    'post_title'    => 'My post',
                    'post_content'  => 'Content',
                    'post_status'   => 'publish',
                    'post_author'   => 1,
                );

                // Insert the post into the database
                wp_insert_post( $my_post );
            `,
		});
		expect(sqlCapture).toHaveBeenCalled();
		expect(inserts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					query_type: 'INSERT',
					table_name: 'wp_posts',
				}),
			])
		);
	});

	it('Records committed SQL queries but not rolled back SQL queries', async () => {
		const inserts: SQLJournalEntry[] = [];
		const sqlCapture = vitest.fn((entry: SQLJournalEntry) => {
			if (entry.query_type === 'INSERT') {
				inserts.push(entry);
			}
		});

		await installSqlSyncMuPlugin(php);
		await journalSQLQueries(php, sqlCapture);

		await php.run({
			code: `<?php
                require '/wordpress/wp-load.php';
				$wpdb->query("BEGIN");
                $my_post = array(
                    'post_title'    => 'This got rolled back',
                    'post_content'  => 'Content',
                    'post_status'   => 'publish',
                    'post_author'   => 1,
                );

                // Insert the post into the database
                wp_insert_post( $my_post );
				$wpdb->query("ROLLBACK");
				$wpdb->query("BEGIN");
                $my_post = array(
                    'post_title'    => 'This got committed',
                    'post_content'  => 'Content',
                    'post_status'   => 'publish',
                    'post_author'   => 1,
                );

                // Insert the post into the database
                wp_insert_post( $my_post );
				$wpdb->query("COMMIT");
            `,
		});
		const wpPostsInserts = inserts.filter(
			(entry) => entry.table_name === 'wp_posts'
		) as any;
		expect(wpPostsInserts).toHaveLength(1);
		expect(wpPostsInserts[0]?.row?.post_title).toEqual(
			'This got committed'
		);
	});
});
