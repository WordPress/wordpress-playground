import { NodePHP } from '@php-wasm/node';
import {
	SQLJournalEntry,
	installSqlSyncMuPlugin,
	journalSQLQueries,
} from '../sql';
import { getWordPressModuleInNode } from '@wp-playground/wordpress';

// Shim XMLHttpRequest to return a fixed response
describe('Sync tests', () => {
	let php: NodePHP;
	beforeEach(async () => {
		const wpData = await getWordPressModuleInNode();
		console.log({ wpData });
		php = await NodePHP.load('8.0', {
			dataModules: [wpData],
		});
		console.log("Loaded PHP");
	});
	it.only('Loads WordPress', async () => {
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
