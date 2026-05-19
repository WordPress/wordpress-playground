<?php

$client_id = getenv('CLIENT_ID');
$popup_state_prefix = 'playground-popup-';
$oauth_message_type = 'playground-github-oauth-token';

if (array_key_exists('redirect', $_GET) && $_GET["redirect"] === "1") {
    $redirect_uri = playground_oauth_callback_url();
    if (!$redirect_uri) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid OAuth callback URL']);
        die();
    }
    http_response_code(302);
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
$auth_data = [];
if ($result === false) {
    $auth_data['error'] = 'GitHub OAuth token request failed: ' . (curl_error($ch) ?: 'Unknown cURL error');
} else {
    parse_str($result, $auth_data);
    $status_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($status_code >= 400 && empty($auth_data['error']) && empty($auth_data['error_description'])) {
        $auth_data['error'] = 'GitHub OAuth token request failed with status ' . $status_code;
    }
}

$is_popup_callback = isset($_GET['state']) && strpos($_GET['state'], $popup_state_prefix) === 0;

if ($is_popup_callback) {
    header('Content-Type: text/html; charset=utf-8');
    echo playground_oauth_popup_response([
        'type'  => $oauth_message_type,
        'state' => $_GET['state'],
    ] + playground_oauth_popup_result($auth_data));
} else {
    header('Content-Type: application/json');
    echo json_encode($auth_data);
}

/**
 * Returns the callback URL GitHub should redirect to after authorization.
 */
function playground_oauth_callback_url() {
    $path = strtok($_SERVER['REQUEST_URI'], '?');
    $base_url = getenv('OAUTH_CALLBACK_BASE_URL');
    if ($base_url) {
        return rtrim($base_url, '/') . $path;
    }

    // Infer the public callback scheme for proxied and local development
    // requests while only accepting explicit http/https forwarded values.
    $scheme = 'https';
    $forwarded_proto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
    if (in_array($forwarded_proto, ['http', 'https'], true)) {
        $scheme = $forwarded_proto;
    } elseif (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        $scheme = 'https';
    } elseif (isset($_SERVER['HTTP_HOST']) && strpos($_SERVER['HTTP_HOST'], 'localhost') === 0) {
        $scheme = 'http';
    }

    // Some servers/proxies route by listener or default vhost and still run
    // this script for arbitrary Host values. Since the fallback reflects Host
    // into redirect_uri, keep it to hostname[:port] URL authority syntax.
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (!preg_match('/^[A-Za-z0-9.-]+(?::[0-9]+)?$/', $host)) {
        return null;
    }

    return $scheme . '://' . $host . $path;
}

/**
 * Returns either a token or an error string for popup callbacks.
 */
function playground_oauth_popup_result($auth_data) {
    if (isset($auth_data['access_token']) && is_string($auth_data['access_token']) && $auth_data['access_token'] !== '') {
        return ['token' => $auth_data['access_token']];
    }

    return [
        'error' => playground_oauth_error_message($auth_data) ?: 'GitHub OAuth did not return an access token.',
    ];
}

/**
 * Reads the most specific OAuth error message from GitHub's token response.
 */
function playground_oauth_error_message($auth_data) {
    if (isset($auth_data['error_description']) && is_string($auth_data['error_description'])) {
        return $auth_data['error_description'];
    }
    if (isset($auth_data['error']) && is_string($auth_data['error'])) {
        return $auth_data['error'];
    }
    return null;
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
