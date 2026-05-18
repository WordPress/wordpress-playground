<?php

$client_id = getenv('CLIENT_ID');
$popup_state_prefix = 'playground-popup-';
$oauth_message_type = 'playground-github-oauth-token';

if (array_key_exists('redirect', $_GET) && $_GET["redirect"] === "1") {
    http_response_code(302);
    $redirect_uri = playground_oauth_callback_url();
    $state_param = isset($_GET['state']) ? "&state=" . urlencode($_GET['state']) : '';
    header("Location: https://github.com/login/oauth/authorize?client_id={$client_id}&scope=repo&redirect_uri=" . urlencode($redirect_uri) . $state_param);
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

$is_popup_callback = isset($_GET['state']) && strpos($_GET['state'], $popup_state_prefix) === 0;

if ($is_popup_callback) {
    header('Content-Type: text/html; charset=utf-8');
    echo playground_oauth_popup_response([
        'type'  => $oauth_message_type,
        'state' => $_GET['state'],
        'token' => $auth_data['access_token'] ?? null,
        'error' => $auth_data['error_description'] ?? $auth_data['error'] ?? null,
    ]);
} else {
    header('Content-Type: application/json');
    echo json_encode($auth_data);
}

/**
 * Returns the callback URL GitHub should redirect to after authorization.
 */
function playground_oauth_callback_url() {
    $scheme = 'https';
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        $scheme = $_SERVER['HTTP_X_FORWARDED_PROTO'];
    } elseif (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        $scheme = 'https';
    } elseif (isset($_SERVER['HTTP_HOST']) && strpos($_SERVER['HTTP_HOST'], 'localhost') === 0) {
        $scheme = 'http';
    }

    $path = strtok($_SERVER['REQUEST_URI'], '?');
    return $scheme . '://' . $_SERVER['HTTP_HOST'] . $path;
}

/**
 * Renders the popup callback page that sends the OAuth result to a trusted
 * opener.
 */
function playground_oauth_popup_response($message) {
    $encoded_message = json_encode($message, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    return <<<HTML
<!doctype html>
<html>
    <head>
        <meta charset="utf-8" />
        <title>GitHub authorization complete</title>
    </head>
    <body>
        <script>
            const message = {$encoded_message};
            const currentScript = document.currentScript;
            if (currentScript) {
                currentScript.remove();
            }

            const targetOrigin = getTrustedOAuthOpenerOrigin();
            if (targetOrigin) {
                window.opener.postMessage(message, targetOrigin);
            }
            window.close();

            function getTrustedOAuthOpenerOrigin() {
                if (!window.opener) {
                    return null;
                }

                try {
                    const opener = window.opener;
                    const openerUrl = new URL(opener.location.href);
                    // Same-origin WordPress pages live under /scope:* paths.
                    // Only top-level Playground pages may receive credentials.
                    const isScopedPath = openerUrl.pathname
                        .split('/')
                        .some((segment) => segment.startsWith('scope:'));

                    if (
                        opener !== opener.top ||
                        openerUrl.origin !== window.location.origin ||
                        isScopedPath
                    ) {
                        return null;
                    }

                    return openerUrl.origin;
                } catch {
                    return null;
                }
            }
        </script>
        GitHub authorization complete. You can close this window.
    </body>
</html>
HTML;
}
