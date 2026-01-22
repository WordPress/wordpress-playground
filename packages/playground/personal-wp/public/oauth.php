<?php

$client_id = getenv('CLIENT_ID');
if (array_key_exists('redirect', $_GET) && $_GET["redirect"] === "1") {
    http_response_code(302);
    // Always redirect to the current host, even if the redirect_uri is set to a different host.
    // Also, do not allow any custom path segments in the redirect_uri.
    $redirect_host = $_SERVER['HTTP_HOST'];
    $redirect_query = parse_url($_GET['redirect_uri'], PHP_URL_QUERY);
    $redirect_uri = 'https://' . $redirect_host . '?' . $redirect_query;
    $redirect_param = isset($_GET['redirect_uri']) ? "&redirect_uri=" . urlencode($redirect_uri) : '';
    header("Location: https://github.com/login/oauth/authorize?client_id={$client_id}&scope=repo" . $redirect_param);
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
