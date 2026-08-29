<?php
$database = new PDO('sqlite:/site/smoke-lock.sqlite');
$database->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$database->exec('PRAGMA busy_timeout=5000');
$database->exec('CREATE TABLE IF NOT EXISTS requests (value TEXT NOT NULL)');
$database->exec('BEGIN IMMEDIATE');
usleep(600000);
$database->exec("INSERT INTO requests(value) VALUES ('component')");
$database->exec('COMMIT');
echo $database->query('SELECT COUNT(*) FROM requests')->fetchColumn();
