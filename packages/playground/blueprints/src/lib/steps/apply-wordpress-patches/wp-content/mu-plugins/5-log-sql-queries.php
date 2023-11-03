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
    $new_seq = get_option('playground_id_offset');
    /*
     * In SQLite we can't:
     * * Set a custom default value for a PRIMARY KEY column
     * * Update ID with a trigger BEFORE INSERT
     * * Update ID with a trigger AFTER INSERT in a way that preserves last_insert_rowid()
     * * Use INSTEAD OF triggers on a table
     * 
     * Here's what we can do:
     * * Read the entire row after INSERTing it, and reconstruct the query
     * * Rename the ID column to ID2 and create an ID column with a custom default value
     * * Use that AFTER INSERT trigger and filter last_insert_id from class-wp-sqlite-translator.php
     */
    $pdo->query("CREATE TABLE IF NOT EXISTS playground_sequence (
        table_name varchar(255),
        column_name varchar(255),
        seq int default 0 not null,
        PRIMARY KEY (table_name, column_name)
    )");
    foreach (findAutoIncrementColumns() as $table => $column) {
        $stmt = $pdo->prepare(<<<SQL
        INSERT INTO playground_sequence 
        VALUES (:table_name, :column_name, :seq) 
        SQL
        );
        $stmt->execute([
            ':table_name' => $table,
            ':column_name' => $column,
            ':seq' => $new_seq,
        ]);
        var_dump([
            ':table_name' => $table,
            ':column_name' => $column,
            ':seq' => $new_seq,
        ]);
    }

    // $stmt = $pdo->prepare("UPDATE sqlite_sequence SET seq = :new_seq where seq < :new_seq");
    // $stmt->bindParam(':new_seq', $new_seq);
    // $stmt->execute();

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
        AFTER INSERT ON $table
        FOR EACH ROW
        --WHEN NEW.{$column} IS NULL
        BEGIN
            UPDATE {$table} SET {$column} = (
                SELECT seq FROM playground_sequence WHERE table_name = '{$table}' AND column_name = '{$column}'
            ) + 1 WHERE rowid = NEW.rowid;
            UPDATE playground_sequence SET seq = seq + 1 WHERE table_name = '{$table}' AND column_name = '{$column}';
        END;
        SQL;
        var_dump($trigger_query);
        $pdo->query($trigger_query);
    }
}

function playground_report_queries($query, $query_type, $table_name, $insert_columns, $last_insert_id, $affected_rows)
{
    global $auto_increment_columns;
    $auto_increment_column = $auto_increment_columns[$table_name] ?? null;

    // @TODO: Replace this with SQLite's update hook:
    $was_pk_generated = $query_type === 'INSERT' && $auto_increment_column && !in_array($auto_increment_column, $insert_columns, true);
    if ($was_pk_generated) {
        $rows = $GLOBALS['@pdo']->query("SELECT * FROM $table_name WHERE $auto_increment_column <= $last_insert_id ORDER BY $auto_increment_column DESC LIMIT $affected_rows")->fetchAll(PDO::FETCH_ASSOC);
        foreach($rows as $row) {
            $row[$auto_increment_column] = (int) $row[$auto_increment_column];
            post_message_to_js(json_encode([
                'type' => 'sql',
                'subtype' => 'insert-row',
                'row' => $row,
                'query_type' => $query_type,
                'insert_columns' => $insert_columns,
                'table_name' => $table_name,
                'auto_increment_column' => $auto_increment_column,
                'last_insert_id' => $last_insert_id,
            ]));
        }
        return;
    }

    if ($query) {
        post_message_to_js(json_encode([
            'type' => 'sql',
            'subtype' => 'replay-query',
            'query' => $query,
            'query_type' => $query_type,
            'insert_columns' => $insert_columns,
            'table_name' => $table_name,
            'auto_increment_column' => $auto_increment_column,
            'last_insert_id' => $last_insert_id,
        ]));
        // @TODO: Why is $query null sometimes?
    }
}

// Don't report SQL queries we're replaying from another peer.
if (!isset($GLOBALS['@REPLAYING_SQL']) || !$GLOBALS['@REPLAYING_SQL']) {
    $auto_increment_columns = findAutoIncrementColumns();
    add_filter('sqlite_post_query', 'playground_report_queries', -1000, 6);
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
            // The table might not exist yet
        }
        return $last_insert_id;
    }, 0, 2);


    // add_filter('sqlite_begin_transaction', function ($success, $level) {
    //     if (0 === $level) {
    //         post_message_to_js(json_encode([
    //             'type' => 'sql',
    //             'subtype' => 'transaction',
    //             'success' => $success,
    //             'command' => 'START TRANSACTION',
    //         ]));
    //     }
    // }, 0, 2);
    // add_filter('sqlite_commit', function ($success, $level) {
    //     if (0 === $level) {
    //         post_message_to_js(json_encode([
    //             'type' => 'sql',
    //             'subtype' => 'transaction',
    //             'success' => $success,
    //             'command' => 'COMMIT',
    //         ]));
    //     }
    // }, 0, 2);
    // add_filter('sqlite_rollback', function ($success, $level) {
    //     if (0 === $level) {
    //         post_message_to_js(json_encode([
    //             'type' => 'sql',
    //             'subtype' => 'transaction',
    //             'success' => $success,
    //             'command' => 'ROLLBACK',
    //         ]));
    //     }
    // }, 0, 2);
}
