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
	it('Loads WordPress', async () => {
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

// * * Add unit tests for cases like:
// *   * Failed SQL queries
// *   * Transactions without the final commit (request died prematurely)
// *   * Conflicting SQL queries
// *   * Conflicting FS operations
// *   * Nested transactions
// *   * Unique constraint violations
// *   * Queries without transactions
// *   * Commits and rollbacks in transactions

// Use this as a unit test later on:
// const result = await playground.run({
// 	code: `<?php
// 	require '/wordpress/wp-load.php';
// 	$wpdb->query("BEGIN");
// 	$result = $wpdb->query("INSERT INTO wp_posts(to_ping,pinged,post_content_filtered,post_excerpt, post_author, post_title, post_content, post_status) VALUES('','','','', 1, 'this is rolled back and we dont want to see this', '', 'publish')");
// 	var_dump($result);
// 	$wpdb->query("ROLLBACK");
// 	$wpdb->query("BEGIN");
// 	$result = $wpdb->query("INSERT INTO wp_posts(to_ping,pinged,post_content_filtered,post_excerpt, post_author, post_title, post_content, post_status) VALUES('','','','', 1, 'this is committed and we do want to see this', '', 'publish')");
// 	var_dump($result);
// 	$wpdb->query("COMMIT");
// 	`,
// });
// console.log('I just executed the thing, here is the result: ', result.text);

// Refresh after applying incoming changes. Is this actually useful, though?
// let refreshTimeout: any = null;
// if (refreshTimeout) {
//     clearTimeout(refreshTimeout);
// }
// refreshTimeout = setTimeout(() => {
//     client2.getCurrentURL().then((url) => {
//         client2.goTo(url);
//     });
// }, 150);

// const result = await playground.run({
// 	code: `<?php
// 	require '/wordpress/wp-load.php';
// 	$result = $wpdb->query("INSERT INTO wp_posts(ID,to_ping,pinged,post_content_filtered,post_excerpt, post_author, post_title, post_content, post_status) VALUES(10000000,'','','','', 1, 'this is rolled back and we dont want to see this', '', 'publish')");
// 	echo "\\ninserting new post into wp_posts: ";
// 	var_dump($result);
// 	echo "Insert id: \\n";
// 	var_dump($wpdb->insert_id);
// 	echo "Last error: \\n";
// 	var_dump($wpdb->last_error);
// 	echo "\\nupdating playground_sequence ";
// 	$result = $wpdb->query("update playground_sequence set seq=200;");
// 	var_dump($result);
// 	echo "\\ninserting new post into wp_posts ";
// 	$result = $wpdb->query("INSERT INTO wp_posts(to_ping,pinged,post_content_filtered,post_excerpt, post_author, post_title, post_content, post_status) VALUES('','','','', 1, 'this is committed and we do want to see this', '', 'publish')");
// 	var_dump($result);
// 	var_dump($wpdb->insert_id);
// 	echo "\\ninserting another new post into wp_posts ";
// 	$result = $wpdb->query("INSERT INTO wp_posts(to_ping,pinged,post_content_filtered,post_excerpt, post_author, post_title, post_content, post_status) VALUES('','','','', 1, 'this is committed and we do want to see 33this', '', 'publish')");
// 	var_dump($result);
// 	var_dump($wpdb->insert_id);

// 	`,
// });
