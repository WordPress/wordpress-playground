import { NodePHP } from '@php-wasm/node';
import { readFileSync } from 'fs';
import {
	SQLJournalEntry,
	installSqlSyncMuPlugin,
	journalSQLQueries,
} from '../sql';

// Shim XMLHttpRequest to return a fixed response
describe('Sync tests', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await loadPHP();
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

async function loadPHP() {
	const wp = await getWordPressDataModule();
	const php = await NodePHP.load('8.0', {
		dataModules: [wp],
	});
	return php;
}

async function getWordPressDataModule() {
	const wpData = readFileSync(__dirname + '/wp-6.3.data');
	const wpDataArrayBuffer = wpData.buffer.slice(
		wpData.byteOffset,
		wpData.byteOffset + wpData.byteLength
	);
	shimXHR(wpDataArrayBuffer);
	// @ts-ignore
	return await import('./wp-6.3.js');
}

function shimXHR(response: ArrayBuffer) {
	// Shim XMLHttpRequest to return a fixed response
	// @ts-ignore
	globalThis.XMLHttpRequest = class XMLHttpRequest {
		response?: ArrayBuffer;
		onload() {}
		open() {
			setTimeout(() => {
				this.response = response;
				this.onload();
			}, 100);
		}
		send() {}
		setRequestHeader() {}
		getResponseHeader() {}
		getAllResponseHeaders() {}
		abort() {}
		addEventListener() {}
		removeEventListener() {}
		dispatchEvent() {}
		get readyState() {
			return 4;
		}
		get status() {
			return 200;
		}
	};
}
