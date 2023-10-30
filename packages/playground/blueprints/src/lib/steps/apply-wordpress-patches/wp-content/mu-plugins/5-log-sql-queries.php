<?php

function findAutoIncrementColumns() {
    $pdo = new PDO('sqlite://wordpress/wp-content/database/.ht.sqlite');
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

$auto_increment_columns = findAutoIncrementColumns();


function playground_report_queries($query, $query_type, $table_name, $insert_columns, $last_insert_id)
{
    global $auto_increment_columns;
    $auto_increment_column = $auto_increment_columns[$table_name] ?? null;
    post_message_to_js(json_encode([
        'type' => 'sql',
        'query' => $query,
        'query_type' => $query_type,
        'table_name' => $table_name,
        'auto_increment_column' => $auto_increment_column,
        'last_insert_id' => $last_insert_id,
    ]));
}
add_filter('post_query_sqlite_db', 'playground_report_queries', -1000, 5);

