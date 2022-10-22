<?php

function download_file($url){
     $ch = curl_init($url);
     curl_setopt($ch, CURLOPT_HEADER, 1);
     curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
     curl_setopt($ch, CURLOPT_BINARYTRANSFER, 1);
     curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 0);

     $response = curl_exec($ch);

     $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
     $headers = array_map('trim', explode("\n", substr($response, 0, $header_size)));
     $body = substr($response, $header_size);

     return [$headers, $body];
}

$plugin_name = preg_replace('#[^a-zA-Z0-9\.\-_]#', '', $_GET['plugin']);
$zip_url = 'https://downloads.wordpress.org/plugin/' . $plugin_name;

[$received_headers, $bytes] = download_file($zip_url);

$forward_headers = [
    'content-length',
    'content-type',
    'content-disposition',
    'x-frame-options',
    'last-modified',
    'etag',
    'date',
    'age',
    'vary',
    'cache-Control'
];

foreach($received_headers as $received_header) {
    $comparable_header = strtolower($received_header);
    foreach($forward_headers as $sought_header) {
        if(substr($comparable_header, 0, strlen($sought_header)) === $sought_header){
            header($received_header);
            break;
        }
    }
}

echo $bytes;
