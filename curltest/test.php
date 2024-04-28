<?php

// echo file_get_contents('https://wordpress.org');


// die();


function handle_for_url($url)
{
    $ch = curl_init();

    curl_setopt($ch, CURLOPT_URL, $url);
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
    return $ch;
}

// Single handle
$ch = handle_for_url('https://api.wordpress.org/stats/locale/1.0/');
$output = curl_exec($ch);
var_dump($output);

// Multi handle
$ch1 = handle_for_url('https://api.wordpress.org/stats/locale/1.0/');
$ch2 = handle_for_url('https://api.wordpress.org/stats/wordpress/1.0/');
$ch3 = handle_for_url('https://api.wordpress.org/stats/php/1.0/');

$mh = curl_multi_init();

curl_multi_add_handle($mh, $ch1);
curl_multi_add_handle($mh, $ch2);
curl_multi_add_handle($mh, $ch3);

$running = null;
do {
    curl_multi_exec($mh, $running);
} while ($running);

$output1 = curl_multi_getcontent($ch1);
$output2 = curl_multi_getcontent($ch2);
$output3 = curl_multi_getcontent($ch3);

curl_multi_remove_handle($mh, $ch1);
curl_multi_remove_handle($mh, $ch2);
curl_multi_remove_handle($mh, $ch3);
curl_multi_close($mh);

var_dump($output1);
var_dump($output2);
var_dump($output3);
