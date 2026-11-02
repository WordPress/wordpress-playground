<?php

require_once __DIR__ . '/../php-cors-proxy/cors-proxy-functions.php';

$configured_origins_string = getenv(
    'CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED'
);
if ($configured_origins_string === false) {
    $configured_origins_string = '';
}

$configured_origins = preg_split(
    '/\s+/',
    trim($configured_origins_string),
    -1,
    PREG_SPLIT_NO_EMPTY
);

if (empty($configured_origins)) {
    fwrite(
        STDERR,
        "CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED must contain at least one origin.\n"
    );
    exit(1);
}

$supported_origin_rules = [];
foreach ($configured_origins as $configured_origin) {
    $supported_origin_rule = create_supported_origin_rule(
        $configured_origin
    );

    if ($supported_origin_rule === false) {
        $error_message =
            "Invalid supported origin in " .
            "CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED: $configured_origin\n";
        fwrite(STDERR, $error_message);
        exit(1);
    }

    $supported_origin_rules[] = $supported_origin_rule;
}

echo "<?php\n\ndefine(\n";
echo "    'PLAYGROUND_CORS_PROXY_SUPPORTED_ORIGIN_RULES',\n";
echo "    [\n";
foreach ($supported_origin_rules as $supported_origin_rule) {
    echo "        [\n";
    foreach ($supported_origin_rule as $field_name => $field_value) {
        $exported_field_name = var_export($field_name, true);
        if ($field_value === null) {
            $exported_field_value = 'null';
        } else {
            $exported_field_value = var_export($field_value, true);
        }
        echo "            $exported_field_name => $exported_field_value,\n";
    }
    echo "        ],\n";
}
echo "    ]\n";
echo ");\n";

function create_supported_origin_rule($configured_origin) {
    $origin_parts = parse_cors_proxy_origin($configured_origin);
    if ($origin_parts !== false) {
        return [
            'type' => 'match-exact',
            'origin' => $configured_origin,
        ];
    }

    if (str_starts_with($configured_origin, 'http://*.')) {
        $origin_without_wildcard =
            'http://' .
            substr($configured_origin, strlen('http://*.'));
    } else if (str_starts_with($configured_origin, 'https://*.')) {
        $origin_without_wildcard =
            'https://' .
            substr($configured_origin, strlen('https://*.'));
    } else {
        return false;
    }

    $origin_parts = parse_cors_proxy_origin($origin_without_wildcard);
    if ($origin_parts === false) {
        return false;
    }

    return [
        'type' => 'match-subdomain',
        'scheme' => $origin_parts['scheme'],
        'host' => strtolower($origin_parts['host']),
        'port' => $origin_parts['port'],
    ];
}
