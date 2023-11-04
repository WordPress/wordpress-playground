<?php

$client_id = getenv('CLIENT_ID');
if (array_key_exists('redirect', $_GET) && $_GET["redirect"] === "1") {
    http_response_code(302);
    header("Location: https://github.com/login/oauth/authorize?client_id=${client_id}&scope=repo");
    die();
}

$api_endpoint = 'https://github.com/login/oauth/access_token';
$data = [
    'client_id' => $client_id,
    'client_secret' => getenv('CLIENT_SECRET'),
    'code' => $_GET['code'],
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $api_endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
$result = curl_exec($ch);
parse_str($result, $auth_data);

header('Content-Type: application/json');
echo json_encode($auth_data);
