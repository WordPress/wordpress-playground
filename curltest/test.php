<?php

$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, 'https://wordpress.org');
curl_setopt($ch, CURLOPT_VERBOSE, 1);
curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
// curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 0);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
$streamVerboseHandle = fopen('php://stdout', 'w+');
curl_setopt($ch, CURLOPT_STDERR, $streamVerboseHandle);

// var_dump( curl_version() );
// var_dump( curl_getinfo( $ch ) );

echo "BEFORE";
$output = curl_exec($ch);
echo "AFTER";

// var_dump($output);
// var_dump(curl_error($ch));

curl_close($ch);
