<?php

$client_id = getenv('CLIENT_ID');
if (array_key_exists('redirect', $_GET) && $_GET["redirect"] === "1") {
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (!preg_match('/^[A-Za-z0-9.-]+(?::[0-9]+)?$/', $host)) {
        http_response_code(400);
        die('Invalid OAuth callback host');
    }
    $params = [
        'client_id' => $client_id,
        'redirect_uri' => 'https://' . $host . '/',
    ];
    if (isset($_GET['state']) && is_string($_GET['state']) && preg_match('/^[a-f0-9]{32}$/', $_GET['state'])) {
        $params['state'] = $_GET['state'];
    }
    header('Location: https://github.com/login/oauth/authorize?' . http_build_query($params));
    http_response_code(302);
    die();
}

$api_endpoint = 'https://github.com/login/oauth/access_token';
$data = [
    'client_id' => $client_id,
    'client_secret' => getenv('CLIENT_SECRET'),
    'code' => $_GET['code'] ?? '',
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $api_endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
$result = curl_exec($ch);
parse_str($result, $auth_data);

header('Content-Type: application/json');
echo json_encode($auth_data);
