<?php
header('X-PHP-WASI: persistent');
$body = file_get_contents('php://input');
$temporary = tempnam('/site', 'php-wasi-');
echo $_SERVER['REQUEST_METHOD'], ':', $body, ':temp=', $temporary === false ? 'failed' : 'ok';
if ($temporary !== false) {
    unlink($temporary);
}
