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

/**
 * Validate the message format
 *
 * @param string $message - The message to validate
 * @return bool - If the message is valid
 */
function validate_message($message)
{
    // Validate description. Description is required
    preg_match('/(?<=What happened\?\n\n)(.*?)(?=\n\nLogs)/s', $message, $description);
    if (empty($description)) {
        return false;
    }

    // Validate logs if exists. Logs need to match the PHP error log format
    preg_match('/(?<=Logs\n\n)(.*?)(?=\n\nUrl)/s', $message, $logs);
    if (!empty($logs)) {
        $logs = $logs[0];
        if (preg_match('/\[\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2} UTC\](.*)/s', $logs) !== 1) {
            return false;
        }
    }

    // Validate URL if exists
    preg_match('/(?<=Url\n\n)(.*)/s', $message, $url);
    if (!empty($url)) {
        $url = $url[0];
        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            return false;
        }
    }

    return true;
}

if (empty($token)) {
    response(false, 'No token provided');
}

if (!isset($_POST['message'])) {
    response(false, 'No message provided');
}
$text = $_POST['message'];

if (!validate_message($text)) {
    response(false, 'Invalid message');
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
