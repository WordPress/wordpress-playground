import { loadNodeRuntime } from '@php-wasm/node';
import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
/* @ts-ignore */
import legacyMysqlPolyfill from '../legacy-mysql-polyfill.php?raw';

/**
 * Tests the mysql_* function polyfill that uses PDO SQLite.
 *
 * Since the polyfill is plain PHP that checks function_exists()
 * before defining functions, and PHP 8.x does NOT have the old
 * mysql extension, the polyfill activates on PHP 8.x just as it
 * would on PHP 5.6 web builds.
 */
describe('Legacy mysql_* polyfill (PDO SQLite)', () => {
	let php: PHP;

	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
		php.mkdir('/internal/shared/preload');
		php.writeFile(
			'/internal/shared/preload/legacy-mysql-polyfill.php',
			legacyMysqlPolyfill
		);
		// Create the database directory
		php.mkdir('/wordpress/wp-content/database');
	});

	afterEach(() => {
		php.exit();
	});

	it('should define mysql_connect when the native extension is absent', async () => {
		const result = await php.run({
			code: `<?php
				require_once '/internal/shared/preload/legacy-mysql-polyfill.php';
				echo function_exists('mysql_connect') ? 'yes' : 'no';
			`,
		});
		expect(result.text).toBe('yes');
	});

	it('should connect and create tables via PDO SQLite', async () => {
		const result = await php.run({
			code: `<?php
				require_once '/internal/shared/preload/legacy-mysql-polyfill.php';

				$link = mysql_connect('localhost', 'root', '');
				if (!$link) { echo 'CONNECT_FAILED'; exit; }

				mysql_select_db('wordpress', $link);

				$ok = mysql_query("CREATE TABLE test_table (
					id INTEGER PRIMARY KEY,
					name TEXT NOT NULL DEFAULT '',
					value TEXT
				)", $link);
				if (!$ok) { echo 'CREATE_FAILED: ' . mysql_error($link); exit; }

				$ok = mysql_query("INSERT INTO test_table (name, value) VALUES ('hello', 'world')", $link);
				if (!$ok) { echo 'INSERT_FAILED: ' . mysql_error($link); exit; }

				$result = mysql_query("SELECT * FROM test_table", $link);
				if (!$result) { echo 'SELECT_FAILED: ' . mysql_error($link); exit; }

				$row = mysql_fetch_assoc($result);
				echo $row['name'] . ':' . $row['value'];
			`,
			env: { DOCUMENT_ROOT: '/wordpress' },
		});
		expect(result.text).toBe('hello:world');
	});

	it('should translate MySQL CREATE TABLE syntax to SQLite', async () => {
		const result = await php.run({
			code: `<?php
				require_once '/internal/shared/preload/legacy-mysql-polyfill.php';

				$link = mysql_connect('localhost', 'root', '');
				mysql_select_db('wordpress', $link);

				// This is similar to WordPress 1.x CREATE TABLE syntax
				$ok = mysql_query("CREATE TABLE wp_posts (
					ID bigint(20) NOT NULL auto_increment,
					post_author int(4) NOT NULL default '0',
					post_date datetime NOT NULL default '0000-00-00 00:00:00',
					post_content text NOT NULL,
					post_title tinytext NOT NULL,
					post_status enum('publish','draft','private','static') NOT NULL default 'publish',
					PRIMARY KEY (ID)
				) TYPE=MyISAM", $link);

				if (!$ok) {
					echo 'CREATE_FAILED: ' . mysql_error($link);
					exit;
				}

				$ok = mysql_query("INSERT INTO wp_posts (post_author, post_date, post_content, post_title, post_status) VALUES (1, '2004-01-01 00:00:00', 'Hello!', 'First Post', 'publish')", $link);
				if (!$ok) {
					echo 'INSERT_FAILED: ' . mysql_error($link);
					exit;
				}

				$id = mysql_insert_id($link);

				$result = mysql_query("SELECT ID, post_title, post_status FROM wp_posts WHERE ID = " . $id, $link);
				$row = mysql_fetch_object($result);
				echo $row->post_title . '|' . $row->post_status . '|rows=' . mysql_num_rows($result);
			`,
			env: { DOCUMENT_ROOT: '/wordpress' },
		});
		expect(result.text).toBe('First Post|publish|rows=1');
	});

	it('should handle KEY/INDEX definitions in CREATE TABLE (WordPress 1.0 schema)', async () => {
		const result = await php.run({
			code: `<?php
				require_once '/internal/shared/preload/legacy-mysql-polyfill.php';

				$link = mysql_connect('localhost', 'root', '');
				mysql_select_db('wordpress', $link);

				// This is the actual WordPress 1.0 wp_posts CREATE TABLE
				// schema, which includes KEY clauses that SQLite doesn't
				// support inline.
				$ok = mysql_query("CREATE TABLE wp_posts (
					ID bigint(20) NOT NULL auto_increment,
					post_author int(4) NOT NULL default '0',
					post_date datetime NOT NULL default '0000-00-00 00:00:00',
					post_content text NOT NULL,
					post_title tinytext NOT NULL,
					post_excerpt tinytext NOT NULL,
					post_status enum('publish','draft','private','static') NOT NULL default 'publish',
					comment_status enum('open','closed','registered_only') NOT NULL default 'open',
					ping_status enum('open','closed') NOT NULL default 'open',
					post_password varchar(20) NOT NULL default '',
					post_name varchar(200) NOT NULL default '',
					post_modified datetime NOT NULL default '0000-00-00 00:00:00',
					PRIMARY KEY  (ID),
					KEY post_name (post_name)
				) TYPE=MyISAM", $link);

				if (!$ok) {
					echo 'CREATE_FAILED: ' . mysql_error($link);
					exit;
				}

				// Test with UNIQUE KEY and multiple KEY clauses
				$ok2 = mysql_query("CREATE TABLE wp_users (
					ID bigint(20) NOT NULL auto_increment,
					user_login varchar(60) NOT NULL default '',
					user_pass varchar(64) NOT NULL default '',
					user_email varchar(100) NOT NULL default '',
					PRIMARY KEY  (ID),
					UNIQUE KEY user_login (user_login),
					KEY user_email (user_email)
				) TYPE=MyISAM", $link);

				if (!$ok2) {
					echo 'CREATE_USERS_FAILED: ' . mysql_error($link);
					exit;
				}

				// Verify both tables were created and are functional
				mysql_query("INSERT INTO wp_posts (post_author, post_date, post_content, post_title, post_excerpt, post_status, comment_status, ping_status, post_password, post_name, post_modified) VALUES (1, '2004-01-01 00:00:00', 'Hello!', 'First Post', '', 'publish', 'open', 'open', '', 'first-post', '2004-01-01 00:00:00')", $link);
				mysql_query("INSERT INTO wp_users (user_login, user_pass, user_email) VALUES ('admin', 'password', 'admin@example.com')", $link);

				$posts = mysql_query("SELECT COUNT(*) as cnt FROM wp_posts", $link);
				$post_row = mysql_fetch_assoc($posts);
				$users = mysql_query("SELECT COUNT(*) as cnt FROM wp_users", $link);
				$user_row = mysql_fetch_assoc($users);

				echo 'posts=' . $post_row['cnt'] . '|users=' . $user_row['cnt'];
			`,
			env: { DOCUMENT_ROOT: '/wordpress' },
		});
		expect(result.text).toBe('posts=1|users=1');
	});

	it('should handle SHOW TABLES', async () => {
		const result = await php.run({
			code: `<?php
				require_once '/internal/shared/preload/legacy-mysql-polyfill.php';

				$link = mysql_connect('localhost', 'root', '');
				mysql_select_db('wordpress', $link);

				mysql_query("CREATE TABLE wp_options (option_id INTEGER PRIMARY KEY, option_name TEXT)", $link);
				mysql_query("CREATE TABLE wp_posts (ID INTEGER PRIMARY KEY, title TEXT)", $link);

				$result = mysql_query("SHOW TABLES", $link);
				$tables = array();
				while ($row = mysql_fetch_row($result)) {
					$tables[] = $row[0];
				}
				sort($tables);
				echo implode(',', $tables);
			`,
			env: { DOCUMENT_ROOT: '/wordpress' },
		});
		expect(result.text).toBe('wp_options,wp_posts');
	});

	it('should handle mysql_real_escape_string', async () => {
		const result = await php.run({
			code: `<?php
				require_once '/internal/shared/preload/legacy-mysql-polyfill.php';

				$link = mysql_connect('localhost', 'root', '');
				$escaped = mysql_real_escape_string("it's a test", $link);
				echo $escaped;
			`,
			env: { DOCUMENT_ROOT: '/wordpress' },
		});
		expect(result.text).toBe("it''s a test");
	});

	it('should handle mysql_affected_rows and mysql_insert_id', async () => {
		const result = await php.run({
			code: `<?php
				require_once '/internal/shared/preload/legacy-mysql-polyfill.php';

				$link = mysql_connect('localhost', 'root', '');
				mysql_select_db('wordpress', $link);

				mysql_query("CREATE TABLE test_affected (id INTEGER PRIMARY KEY, val TEXT)", $link);
				mysql_query("INSERT INTO test_affected (val) VALUES ('a')", $link);
				$id1 = mysql_insert_id($link);
				mysql_query("INSERT INTO test_affected (val) VALUES ('b')", $link);
				$id2 = mysql_insert_id($link);
				mysql_query("INSERT INTO test_affected (val) VALUES ('c')", $link);
				$id3 = mysql_insert_id($link);

				mysql_query("UPDATE test_affected SET val = 'x' WHERE id > 1", $link);
				$affected = mysql_affected_rows($link);

				echo "ids=$id1,$id2,$id3|affected=$affected";
			`,
			env: { DOCUMENT_ROOT: '/wordpress' },
		});
		expect(result.text).toBe('ids=1,2,3|affected=2');
	});

	it('should handle mysql_error on failed queries', async () => {
		const result = await php.run({
			code: `<?php
				require_once '/internal/shared/preload/legacy-mysql-polyfill.php';

				$link = mysql_connect('localhost', 'root', '');
				mysql_select_db('wordpress', $link);

				// Query a non-existent table
				$result = mysql_query("SELECT * FROM nonexistent_table", $link);
				$has_error = ($result === false) ? 'yes' : 'no';
				$error = mysql_error($link);
				$has_text = strlen($error) > 0 ? 'yes' : 'no';

				echo "failed=$has_error|has_error=$has_text";
			`,
			env: { DOCUMENT_ROOT: '/wordpress' },
		});
		expect(result.text).toBe('failed=yes|has_error=yes');
	});
});
