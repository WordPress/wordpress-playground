<?php
function collector_dump_db($zip)
{
	$tables   = collector_get_db_tables();
	$mysqli   = collector_get_db();
	$sqlFile  = collector_get_tmpfile('schema', 'sql');
	$tmpFiles = [$sqlFile];

	file_put_contents($sqlFile, sprintf("-- %s\n", json_encode(['SECTION START' => 'SCHEMA'])), FILE_APPEND);

	foreach($tables as $table)
	{
		file_put_contents($sqlFile, sprintf("-- %s\n", json_encode(['ACTION' => 'DROP', 'TABLE' => $table])), FILE_APPEND);
		file_put_contents($sqlFile, sprintf("DROP TABLE IF EXISTS `%s`;\n", $table), FILE_APPEND);
		file_put_contents($sqlFile, sprintf("-- %s\n", json_encode(['ACTION' => 'CREATE', 'TABLE' => $table])), FILE_APPEND);
		file_put_contents($sqlFile, preg_replace("/\s+/", " ", collector_dump_db_schema($table)) . "\n", FILE_APPEND);
	}

	file_put_contents($sqlFile, sprintf("-- %s\n", json_encode(['SECTION END' => 'SCHEMA'])), FILE_APPEND);
	file_put_contents($sqlFile, sprintf("-- %s\n", json_encode(['SECTION START' => 'RECORDS'])), FILE_APPEND);

	// Process in reverse order so wp_users comes before wp_options
	// meaning the fakepass will be cleared before transients are
	// dumped to the schema backup in the zip
	foreach(array_reverse($tables) as $table)
	{
		file_put_contents($sqlFile, sprintf("-- %s\n", json_encode(['ACTION' => 'INSERT', 'TABLE' => $table])), FILE_APPEND);
		$recordList = collector_dump_db_records($table);

		while($record = $recordList->fetch_assoc())
		{
			if($table === 'wp_users' && (int) $record['ID'] === (int) wp_get_current_user()->ID)
			{
				$record['user_pass'] = wp_hash_password(collector_use_fakepass());
			}

			$insert = sprintf(
				'INSERT INTO `%s` (%s) VALUES (%s);',
				mysqli_real_escape_string($mysqli, $table),
				implode(', ', array_map(fn($f) => "`" . mysqli_real_escape_string($mysqli, $f) . "`", array_keys($record))),
				implode(', ', array_map(fn($f) => "'" . mysqli_real_escape_string($mysqli, $f) . "'", array_values($record))),
			);

			file_put_contents($sqlFile, $insert . "\n", FILE_APPEND);
		}
	}

	file_put_contents($sqlFile, sprintf("-- %s\n", json_encode(['SECTION END' => 'RECORDS'])), FILE_APPEND);

	$zip->addFile($sqlFile, 'schema/_Schema.sql');

	return $tmpFiles;
}

function collector_get_db()
{
	static $mysqli;
	if(!$mysqli)
	{
		$mysqli = mysqli_connect(DB_HOST, DB_USER, DB_PASSWORD);
		mysqli_select_db($mysqli, DB_NAME);
	}

	return $mysqli;
}

function collector_get_db_tables()
{
	$mysqli = collector_get_db();
	$query  = $mysqli->query('SHOW TABLES');
	$tables = $query->fetch_all();

	return array_map(fn($t) => $t[0], $tables);
}

function collector_dump_db_schema($table)
{
	$mysqli = collector_get_db();
	return $mysqli
	->query(sprintf('SHOW CREATE TABLE `%s`', $mysqli->real_escape_string($table)))
	->fetch_object()
	->{'Create Table'};
}

function collector_dump_db_records($table)
{
	$mysqli = collector_get_db();
	return $mysqli
	->query(sprintf('SELECT * FROM `%s`', $mysqli->real_escape_string($table)));
}
