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
