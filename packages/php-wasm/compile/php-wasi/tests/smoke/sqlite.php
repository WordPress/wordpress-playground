<?php
$database = new PDO('sqlite:/site/smoke.sqlite');
$database->exec('CREATE TABLE IF NOT EXISTS requests (value TEXT NOT NULL)');
$database->beginTransaction();
$statement = $database->prepare('INSERT INTO requests(value) VALUES (?)');
$statement->execute(['component']);
$database->commit();
echo $database->query('SELECT COUNT(*) FROM requests')->fetchColumn();
