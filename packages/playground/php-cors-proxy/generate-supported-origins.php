<?php

require_once __DIR__ . '/cors-proxy-functions.php';

$origins_string = getenv('CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED');
$origins = preg_split(
    '/\s+/',
    trim($origins_string === false ? '' : $origins_string),
    -1,
    PREG_SPLIT_NO_EMPTY
);

if (empty($origins)) {
    fwrite(
        STDERR,
        "CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED must contain at least one origin.\n"
    );
    exit(1);
}

foreach ($origins as $origin) {
    if (!is_valid_cors_proxy_origin_pattern($origin)) {
        fwrite(
            STDERR,
            "Invalid origin pattern in CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED: " .
                $origin .
                "\n"
        );
        exit(1);
    }
}

echo "<?php\n\ndefine(\n";
echo "    'PLAYGROUND_CORS_PROXY_SUPPORTED_ORIGINS',\n";
echo "    [\n";
foreach ($origins as $origin) {
    echo '        ' . var_export($origin, true) . ",\n";
}
echo "    ]\n";
echo ");\n";
