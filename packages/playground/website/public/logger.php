<?php
// Disable error reporting
error_reporting(0);

header('Content-Type: application/json');

/**
 * Rate limit logger requests
 */
$max_requests_per_hour = 5;

session_start();
$rate_limit_key = md5('logger_requests_' . date('Y-m-d H'));
if (!isset($_SESSION[$rate_limit_key])) {
    $_SESSION[$rate_limit_key] = 0;
}
$_SESSION[$rate_limit_key]++;

if ($_SESSION[$rate_limit_key] > $max_requests_per_hour) {
    response(false, 'Too many requests');
}

$channel = getenv('SLACK_CHANNEL');
$token = getenv('SLACK_TOKEN');

/**
 * Send response to the client
 *
 * @param bool $ok - If the request was successful
 * @param string|null $error - Error message if the request was not successful
 */
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

if (!isset($_POST['description']) || empty($_POST['description'])) {
    response(false, 'No description provided');
}
$text = "How can we recreate this error?\n\n" . $_POST['description'];

if (isset($_POST['logs']) && !empty($_POST['logs'])) {
    $text .= "\n\nLogs\n\n" . $_POST['logs'];
}

if (isset($_POST['url'])) {
    if (filter_var($_POST['url'], FILTER_VALIDATE_URL) === false) {
        response(false, 'Invalid URL');
    }
    $text .= "\n\nUrl\n\n" . $_POST['url'];
}

if (isset($_POST['context']) && !empty($_POST['context'])) {
    $text .= "\n\nContext\n\n" . $_POST['context'];
}

// Add blueprint
if (isset($_POST['blueprint']) && !empty($_POST['blueprint'])) {
    $text .= "\n\nBlueprint\n\n" . $_POST['blueprint'];
}

$text = urlencode($text);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://slack.com/api/chat.postMessage?channel=$channel&text=$text");
curl_setopt($ch, CURLOPT_HTTPHEADER, array("Authorization: Bearer $token"));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

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
