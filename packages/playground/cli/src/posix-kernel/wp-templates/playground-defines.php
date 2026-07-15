<?php
// Reads constants from the sibling JSON store and define()s them.

$store = __DIR__ . '/0-playground-defines.json';
if (!file_exists($store)) {
    return;
}
$entries = json_decode((string) file_get_contents($store), true);
if (!is_array($entries)) {
    return;
}
foreach ($entries as $name => $value) {
    if (defined($name)) {
        continue;
    }
    define($name, $value);
}
