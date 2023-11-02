<?php

function findAutoIncrementColumns()
{
    $pdo = $GLOBALS['@pdo'];
    $columns = [];

    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $table) {
        $tableInfo = getTableInfo($pdo, $table);
        $primaryKeyAutoIncrement = $tableInfo['primaryKeyAutoIncrement'];

        if (!$primaryKeyAutoIncrement) {
            continue;
        }
        $columns[$table] = $primaryKeyAutoIncrement;
    }
    unset($pdo);

    return $columns;
}

function getTableInfo(PDO $pdo, $tableName)
{
    try {
        $stmt = $pdo->prepare("PRAGMA table_info($tableName)");
        $stmt->execute();
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $primaryKeyAutoIncrement = null;
        foreach ($columns as $column) {
            if ($column['pk'] == 1 && stripos($column['type'], 'INTEGER') !== false) {
                $stmt = $pdo->prepare("SELECT count(*) as nb FROM sqlite_sequence WHERE name=:table_name");
                $stmt->execute([':table_name' => $tableName]);
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($result['nb'] > 0) {
                    $primaryKeyAutoIncrement = $column['name'];
                }
            }
        }
        return [
            'columns' => array_column($columns, 'name'),
            'primaryKeyAutoIncrement' => $primaryKeyAutoIncrement,
        ];
    } catch (PDOException $e) {
        echo "Error: " . $e->getMessage() . "\n";
        return [];
    }
}

function playground_bump_autoincrements_filter($query, $query_type)
{
    if ($query_type !== 'CREATE TABLE' && $query_type !== 'ALTER TABLE') {
        return;
    }

    playground_bump_autoincrements();
}
add_filter('post_query_sqlite_db', 'playground_bump_autoincrements_filter', -1000, 2);

function playground_bump_autoincrements()
{
    $pdo = $GLOBALS['@pdo'];
    $stmt = $pdo->prepare("UPDATE sqlite_sequence SET seq = :new_seq where seq < :new_seq");
    $new_seq = get_option('playground_id_offset');
    $stmt->bindParam(':new_seq', $new_seq);
    $stmt->execute();

    /**
     * We must force SQLite to use monotonically increasing values for
     * autoincrement column. If sqlite_sequence says that wp_posts has
     * seq=10, the next row should get id=11.
     * 
     * Huh? SQLite doesn't do that by default?
     * 
     * Well, no.
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
     */
    $autoincrement_columns = findAutoIncrementColumns();
    foreach ($autoincrement_columns as $table => $column) {
        $trigger_query = <<<SQL
        CREATE TRIGGER IF NOT EXISTS 
        force_seq_autoincrement_on_{$table}_{$column}
        BEFORE INSERT ON $table
        FOR EACH ROW
        WHEN NEW.{$column} IS NULL
        BEGIN
            SET NEW.{$column} = (
                SELECT seq FROM sqlite_sequence WHERE name = '$table'
            ) + 1;
            UPDATE sqlite_sequence set seq = seq + 1 WHERE name = '$table';
        END;
        SQL;
        var_dump($trigger_query);
        $pdo->query($trigger_query);
    }
}

function playground_report_queries($query, $query_type, $table_name, $insert_columns, $last_insert_id)
{
    global $auto_increment_columns;
    $auto_increment_column = $auto_increment_columns[$table_name] ?? null;
    post_message_to_js(json_encode([
        'type' => 'sql',
        'subtype' => 'query',
        'query' => $query,
        'query_type' => $query_type,
        'table_name' => $table_name,
        'auto_increment_column' => $auto_increment_column,
        'last_insert_id' => $last_insert_id,
    ]));
}

// Don't report SQL queries we're replaying from another peer.
if (!isset($GLOBALS['@REPLAYING_SQL']) || !$GLOBALS['@REPLAYING_SQL']) {
    $auto_increment_columns = findAutoIncrementColumns();
    add_filter('sqlite_post_query', 'playground_report_queries', -1000, 5);

    add_filter('sqlite_begin_transaction', function ($success, $level) {
        if (0 === $level) {
            post_message_to_js(json_encode([
                'type' => 'sql',
                'subtype' => 'transaction',
                'success' => $success,
                'command' => 'START TRANSACTION',
            ]));
        }
    }, 0, 2);
    add_filter('sqlite_commit', function ($success, $level) {
        if (0 === $level) {
            post_message_to_js(json_encode([
                'type' => 'sql',
                'subtype' => 'transaction',
                'success' => $success,
                'command' => 'COMMIT',
            ]));
        }
    }, 0, 2);
    add_filter('sqlite_rollback', function ($success, $level) {
        if (0 === $level) {
            post_message_to_js(json_encode([
                'type' => 'sql',
                'subtype' => 'transaction',
                'success' => $success,
                'command' => 'ROLLBACK',
            ]));
        }
    }, 0, 2);
}
