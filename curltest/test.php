<?php

// echo file_get_contents('https://wordpress.org');

// die();

$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, 'https://google.com/');
curl_setopt($ch, CURLOPT_VERBOSE, 1);
curl_setopt($ch, CURLOPT_TCP_NODELAY, 0);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
curl_setopt($ch, CURLOPT_SSL_VERIFYSTATUS, 0);

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
