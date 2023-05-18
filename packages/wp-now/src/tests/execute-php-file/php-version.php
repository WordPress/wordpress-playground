<?php
$resultFile = fopen(__DIR__ . '/php-version-result.txt', 'w');
fwrite($resultFile, "PHP Version: " . phpversion());
fclose($resultFile);
