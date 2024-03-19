<?php
header('Content-Type: application/json');
$channel = getenv('CHANNEL');
$token = getenv('TOKEN');

function response($ok, $error = null)
{
    $response_data = array(
        'ok' => $ok,
    );
    if ($error) {
        $response_data['error'] = $error;
    }
    die(json_encode($response_data));
}

if (empty($token)) {
    response(false, 'No token provided');
}

if (!isset($_POST['message'])) {
    response(false, 'No message provided');
}
$text = $_POST['message'];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://slack.com/api/chat.postMessage?channel=$channel&text=$text");
curl_setopt($ch, CURLOPT_HTTPHEADER, array("Authorization: Bearer $token"));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

// Temp remove SSL
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);

$response = curl_exec($ch);
$errors = curl_error($ch);
$response_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);


if ($response_code !== 200) {
    response(false, 'HTTP Error: ' . $errors);
}

$response_data = json_decode($response, true);
if ($response_data['ok'] !== true) {
    response(false, 'Slack Error: ' . $response_data['error']);
}

response(true);
