<?php

/**
 * Optional Apache + FastCGI transport coverage. Unlike cli-server, Apache must
 * receive plain body bytes and generate its own transfer framing.
 */
function test_apache_header_transport($httpd, $upstream_port, $raw_port) {
    $directory = sys_get_temp_dir() . '/cors-proxy-apache-' . bin2hex(random_bytes(6));
    mkdir($directory);
    $proxy_port = find_free_port();
    $fcgi_port = find_free_port();
    $module_dir = getenv('CORS_PROXY_TEST_APACHE_MODULES') ?: '/usr/libexec/apache2';
    $php_cgi = getenv('CORS_PROXY_TEST_PHP_CGI') ?: dirname(PHP_BINARY) . '/php-cgi';
    $proxy_dir = dirname(__DIR__, 2);
    $prepend = __DIR__ . '/proxy-test-prepend.php';
    $config = "ServerRoot \"$directory\"\n" .
        "PidFile \"$directory/httpd.pid\"\n" .
        "DefaultRuntimeDir \"$directory\"\n" .
        "Listen 127.0.0.1:$proxy_port\nServerName localhost\n" .
        "ErrorLog \"$directory/error.log\"\nLogLevel warn\n";
    foreach ([
        'mpm_prefork', 'unixd', 'authz_core', 'proxy', 'proxy_fcgi', 'env',
    ] as $module) {
        $config .= "LoadModule {$module}_module \"$module_dir/mod_$module.so\"\n";
    }
    $config .= "ProxyFCGIBackendType GENERIC\nSetEnv ap_trust_cgilike_cl 1\nSetEnv proxy-sendcl 1\n" .
        "DocumentRoot \"$proxy_dir\"\n" .
        "<Directory \"$proxy_dir\">\nRequire all granted\n</Directory>\n<Location />\nCGIPassAuth On\n</Location>\n" .
        "ProxyPassMatch ^/(.*\\.php)$ fcgi://127.0.0.1:$fcgi_port$proxy_dir/$1 flushpackets=on\n";
    file_put_contents("$directory/httpd.conf", $config);
    $fcgi_proc = start_server_process(
        escapeshellarg($php_cgi) . ' -d ' . escapeshellarg("auto_prepend_file=$prepend") .
            ' -d output_buffering=0 -b ' . escapeshellarg("127.0.0.1:$fcgi_port"),
        $fcgi_port
    );
    $apache_proc = start_server_process(
        escapeshellarg($httpd) . ' -f ' . escapeshellarg("$directory/httpd.conf") . ' -X',
        $proxy_port
    );
    try {
        echo "\nApache + FastCGI transport\n";
        test_header_transport($proxy_port, $upstream_port, $raw_port, false);
    } finally {
        proc_terminate($apache_proc);
        proc_close($apache_proc);
        proc_terminate($fcgi_proc);
        proc_close($fcgi_proc);
        foreach (glob("$directory/*") as $file) {
            unlink($file);
        }
        rmdir($directory);
    }
}
