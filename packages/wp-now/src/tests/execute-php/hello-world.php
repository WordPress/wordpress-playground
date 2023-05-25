<?php
$resultFile = fopen(__DIR__ . '/hello-world-result.txt', 'w');
fwrite($resultFile, 'Hello World!');
fclose($resultFile);
