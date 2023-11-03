<?php

function playground_override_autoincrements_filter($query, $query_type)
{
    if ($query_type === 'CREATE TABLE' || $query_type === 'ALTER TABLE') {
        playground_override_autoincrement_algorithm();
    }
}
add_filter('post_query_sqlite_db', 'playground_override_autoincrements_filter', -1000, 2);

/**
 * Forces SQLite to use monotonically increasing values for every 
 * autoincrement column. For example, if sqlite_sequence says that
 * `wp_posts` has seq=10, the next row will get id=11.
 * 
 * ## How to use
 * 
 * * Call this function when starting the synchronized session.
 * * Call this function again every time a new autoincrement field is created.
 * 
 * ## Doesn't SQLite already do that?
 * 
 * Sadly, no.
 * 
 * SQLite always uses max(id) + 1 for the next autoincrement value
 * regardless of the seq value stored in sqlite_sequence.
 * 
 * This means trouble. Receiving a remote row with a high ID like 450000 
 * changes the next locally assigned ID from 11 to 450001. This is a 
 * certain way to get ID conflicts between peers.
 * 
 * Fortunately, we can create a trigger to force SQLite to use ID=seq+1
 * instead of its default algorithm.
 * 
 * ## Implementation
 *
 * We override the default AUTOINCREMENT algorithm with our own.
 * 
 * Instead of sqlite_sequence, we use a custom playground_sequence table
 * to store the next available ID for every table/column pair.
 * 
 * We use an AFTER INSERT trigger to reassign the AUTOINCREMENT value to the
 * next available value in the playground_sequence table.
 * 
 * The last_insert_id() function still returns the original ID assigned by SQLite,
 * so we introduce a new 'sqlite_last_insert_id' filter in class-wp-sqlite-translator.php
 * and use it to give WordPress the correct last_insert_id.
 * 
 * ## Alternatives considered
 * 
 * * Using a custom DEFAULT value for the PRIMARY KEY column – SQLite doesn't support it
 * * Update ID with a trigger BEFORE INSERT – SQLite doesn't support it
 * * Use INSTEAD OF triggers on a table – they only work with views
 * * Read the entire row after INSERTing it, and reconstruct the query – too complex and be error-prone
 * * Replace the ID column with a custom, non-autoincrement one – that's complex in SQLite plus it could mess up WP core db migrations
 */
function playground_override_autoincrement_algorithm($local_id_offset = null)
{
    if (null !== $local_id_offset) {
        // Store the default autoincrement offset for the current peer:
        update_option('playground_id_offset', $local_id_offset);
    }

    playground_ensure_autoincrement_columns_view();

    // Ensure the playground_sequence table exists:
    $pdo = $GLOBALS['@pdo'];
    $pdo->query("CREATE TABLE IF NOT EXISTS playground_sequence (
        table_name varchar(255),
        column_name varchar(255),
        seq int default 0 not null,
        PRIMARY KEY (table_name, column_name)
    )");

    // Insert all the AUTOINCREMENT table/column pairs that are not
    // already tracked in playground_sequence:
    $stmt = $pdo->prepare(<<<SQL
        INSERT INTO playground_sequence 
        SELECT table_name, column_name, :seq FROM autoincrement_columns
        WHERE 1=1 -- Needed because of the ambiguous ON clause, see https://sqlite.org/lang_upsert.html
        ON CONFLICT(table_name, column_name) DO NOTHING;
    SQL);
    $stmt->execute([':seq' => get_option('playground_id_offset')]);

    // Create any missing AFTER INSERT triggers:
    foreach (playground_get_autoincrement_columns() as $table => $column) {
        $pdo->query(<<<SQL
            CREATE TRIGGER IF NOT EXISTS 
            force_seq_autoincrement_on_{$table}_{$column}
            AFTER INSERT ON $table
            FOR EACH ROW
            WHEN
                -- Don't run this trigger when we're replaying queries from another peer
                (SELECT value FROM playground_variables WHERE name = 'is_replaying') = 'no'
            BEGIN
                -- Update the inserted row with the next available ID
                UPDATE {$table} SET {$column} = (
                    SELECT seq FROM playground_sequence WHERE table_name = '{$table}'
                ) + 1 WHERE rowid = NEW.rowid;
                -- Record the ID that was just assigned
                UPDATE playground_sequence SET seq = seq + 1 WHERE table_name = '{$table}';
            END;
        SQL);
    }
}

function playground_get_autoincrement_columns()
{
    playground_ensure_autoincrement_columns_view();
    $stmt = $GLOBALS['@pdo']->query('SELECT table_name, column_name FROM autoincrement_columns');
    return $stmt ? $stmt->fetchAll(PDO::FETCH_KEY_PAIR) : [];
}

function playground_ensure_autoincrement_columns_view()
{
    $GLOBALS['@pdo']->query(<<<SQL
    CREATE VIEW IF NOT EXISTS autoincrement_columns AS 
        SELECT DISTINCT m.name as 'table_name', ti.name AS 'column_name', seq.seq AS 'seq'
            FROM
                sqlite_schema AS m,
                pragma_table_info(m.name) AS ti
            INNER JOIN sqlite_sequence seq ON seq.name = m.name
            WHERE
                m.type = 'table' AND
                m.name NOT LIKE 'sqlite_%' AND
                ti.pk = 1 AND 
                ti.type LIKE '%INTEGER%'
            ORDER BY 1
    ;
    SQL
    );
}

/**
 * Listens for SQL queries executed by WordPress and emits them to the JS side.
 */
function playground_sync_listen_for_sql_queries()
{
    add_filter('sqlite_last_insert_id', function ($last_insert_id, $table_name) {
        // Get last relevant value from playground_sequence
        $pdo = $GLOBALS['@pdo'];
        try {
            $stmt = $pdo->prepare("SELECT * FROM playground_sequence WHERE table_name = :table_name");
            $stmt->execute([':table_name' => $table_name]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($result) {
                return $result['seq'];
            }
        } catch (PDOException $e) {
            // The `playground_sequence` table does not exists when this function runs for the first time.
            // We can't create it yet because JS didn't assign us the AUTOINCREMENT ID offset yet.
            // The only thing we can do is wait for the offset and ignore any PDO errors for now.
        }
        return $last_insert_id;
    }, 0, 2);

    // Report all SQL queries:
    // Consider using SQLite's "update hook" instead of "sqlite_post_query" WordPress hook here:
    add_filter('sqlite_post_query', 'playground_sync_emit_query', -1000, 6);

    // Report all transaction-related queries:
    $transaction_actions = [
        'sqlite_begin_transaction' => 'START TRANSACTION',
        'sqlite_commit' => 'COMMIT',
        'sqlite_rollback' => 'ROLLBACK',
    ];
    foreach ($transaction_actions as $action => $command) {
        add_action($action, function ($success, $level) use ($command) {
            if (0 !== $level) {
                return;
            }

            post_message_to_js(json_encode([
                'type' => 'sql',
                'subtype' => 'transaction',
                'success' => $success,
                'command' => $command,
            ]));
        }, 0, 2);
    }
}

function playground_sync_emit_query($query, $query_type, $table_name, $insert_columns, $last_insert_id, $affected_rows)
{
    static $auto_increment_columns = null;
    if ($auto_increment_columns === null) {
        $auto_increment_columns = playground_get_autoincrement_columns();
    }
    $auto_increment_column = $auto_increment_columns[$table_name] ?? null;

    $was_pk_generated = $query_type === 'INSERT' && $auto_increment_column && !in_array($auto_increment_column, $insert_columns, true);
    if ($was_pk_generated) {
        $rows = $GLOBALS['@pdo']->query("SELECT * FROM $table_name WHERE $auto_increment_column <= $last_insert_id ORDER BY $auto_increment_column DESC LIMIT $affected_rows")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $row[$auto_increment_column] = (int) $row[$auto_increment_column];
            post_message_to_js(json_encode([
                'type' => 'sql',
                'subtype' => 'reconstruct-query',
                'row' => $row,
                'query_type' => $query_type,
                'table_name' => $table_name,
                'auto_increment_column' => $auto_increment_column,
                'last_insert_id' => $last_insert_id,
            ]));
        }
        return;
    }

    post_message_to_js(json_encode([
        'type' => 'sql',
        'subtype' => 'replay-query',
        'query' => $query,
        'query_type' => $query_type,
        'table_name' => $table_name,
        'auto_increment_column' => $auto_increment_column,
        'last_insert_id' => $last_insert_id,
    ]));
}

function playground_sync_replay_queries($queries)
{
    global $wpdb;
    $pdo = $GLOBALS['@pdo'];
    foreach ($queries as $query) {
        try {
            // If another peer assigned an autoincrement value, we don't get
            // the query but a key/value representation of the inserted row.
            // Let's reconstruct the INSERT query from that.
            if ($query['subtype'] === 'reconstruct-query') {
                $table_name = $query['table_name'];
                $columns = implode(', ', array_keys($query['row']));
                $placeholders = ':' . implode(', :', array_keys($query['row']));

                $stmt = $pdo->prepare("INSERT INTO $table_name ($columns) VALUES ($placeholders)");
                $stmt->execute($query['row']);
            } else {
                $wpdb->query($query['query']);
            }
        } catch (PDOException $e) {
            // Let's ignore errors related to UNIQUE constraints violation.
            // Sometimes we'll ignore something we shouldn't, but for the most
            // part, they are related to surface-level core mechanics like transients.
            // 
            // In the future, let's implement pattern matching on queries and
            // prevent synchronizing things like transients.
            var_dump("PDO Exception! " . $e->getMessage());
            var_dump($e->getCode());
            var_dump($query);
            // SQLSTATE[23000]: Integrity constraint violation: 19 UNIQUE constraint failed
            if ($e->getCode() === "23000") {
                continue;
            }
            throw $e;
        }
    }
}

// Don't override the AUTOINCREMENT IDs when replaying queries from 
// another peer. The AFTER INSERT trigger will abstain from running
// when `is_replaying` is set to "yes".
$pdo = $GLOBALS['@pdo'];
$pdo->query("CREATE TABLE IF NOT EXISTS playground_variables (name TEXT PRIMARY KEY, value TEXT);");
$stmt = $pdo->prepare("INSERT OR REPLACE INTO playground_variables VALUES ('is_replaying', :is_replaying);");
$is_replaying = isset($GLOBALS['@REPLAYING_SQL']) && $GLOBALS['@REPLAYING_SQL'];
$stmt->execute([':is_replaying' => $is_replaying ? 'yes' : 'no']);

// Don't emit SQL queries we're just replaying from another peer.
if (!$is_replaying) {
    playground_sync_listen_for_sql_queries();
}
