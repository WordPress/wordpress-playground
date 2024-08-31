<?php

ini_set('display_errors', 0);

class ApiException extends Exception
{
}
class PluginDownloader
{

    private $githubToken;

    public const PLUGINS = 'plugins';
    public const THEMES = 'theme';

    public function __construct($githubToken)
    {
        $this->githubToken = $githubToken;
    }

    public function streamFromDirectory($name, $directory)
    {
        $name = preg_replace('#[^a-zA-Z0-9\.\-_]#', '', $name);
        $zipUrl = "https://downloads.wordpress.org/$directory/$name";
        try {
            $info = streamHttpResponse($zipUrl, 'GET', [], NULL, [
                'content-length',
                'x-frame-options',
                'last-modified',
                'etag',
                'date',
                'age',
                'vary',
                'cache-Control'
            ], [
                'Content-Type: application/zip',
                'Content-Disposition: attachment; filename="plugin.zip"',
            ]);
            if ($info['http_code'] > 299 || $info['http_code'] < 200) {
                throw new ApiException('Request failed');
            }
        } catch (ApiException $e) {
            throw new ApiException("Plugin or theme '$name' not found");
        }
    }

    public function streamFromGithubPR($organization, $repo, $pr, $workflow_name, $artifact_name)
    {
        $prDetails = $this->gitHubRequest("https://api.github.com/repos/$organization/$repo/pulls/$pr")['body'];
        if (!$prDetails) {
            throw new ApiException('invalid_pr_number');
        }
        $branchName = urlencode($prDetails->head->ref);
        $ciRuns = $this->gitHubRequest("https://api.github.com/repos/$organization/$repo/actions/runs?branch=$branchName")['body'];
        if (!$ciRuns) {
            throw new ApiException('no_ci_runs');
        }

        $artifactsUrls = [];
        foreach ($ciRuns->workflow_runs as $run) {
            if ($run->name === $workflow_name) {
                $artifactsUrls[] = $run->artifacts_url;
            }
        }
        if (!$artifactsUrls) {
            throw new ApiException('artifact_not_found');
        }

        foreach ($artifactsUrls as $artifactsUrl) {
            $zip_download_api_endpoint = $zip_url = null;

            $artifacts = $this->gitHubRequest($artifactsUrl)['body'];
            if (!$artifacts) {
                continue;
            }

            foreach ($artifacts->artifacts as $artifact) {
                if ($artifact_name === $artifact->name) {
                    if ($artifact->size_in_bytes < 3000) {
                        throw new ApiException('artifact_invalid');
                    }
                    $zip_download_api_endpoint = $artifact->archive_download_url;
                    break;
                }
            }
            if (!$zip_download_api_endpoint) {
                continue;
            }

            /*
             * Short-circuit with HTTP 200 OK when we only want to
             * verify whether the CI artifact seems to exist but we
             * don't want to download it yet.
             */
            if (array_key_exists('verify_only', $_GET)) {
                header('HTTP/1.1 200 OK');
                return;
            }

            $allowed_headers = array(
                'content-length',
                'content-disposition',
                'x-frame-options',
                'last-modified',
                'etag',
                'date',
                'age',
                'vary',
                'cache-Control'
            );
            $artifact_res = $this->gitHubRequest($zip_download_api_endpoint, false, false);
            ob_end_flush();
            flush();

            // The API endpoint returns the actual artifact URL as a 302 Location header.
            foreach ($artifact_res['headers'] as $header_line) {
                $header_name = strtolower(substr($header_line, 0, strpos($header_line, ':')));
                $header_value = trim(substr($header_line, 1 + strpos($header_line, ':')));
                if ($header_name === 'location') {
                    streamHttpResponse($header_value, 'GET', [], NULL, $allowed_headers, [
                        'Content-Type: application/zip',
                    ]);
                    die();
                }
            }

            throw new ApiException('artifact_redirect_not_present');
        }
        if (!$artifacts) {
            throw new ApiException('artifact_not_available');
        }
        if (!$zip_download_api_endpoint) {
            throw new ApiException('artifact_not_available');
        }
        if (!$zip_url) {
            throw new ApiException('artifact_not_available');
        }
    }

    public function streamFromGithubReleases($repo, $name)
    {
        $zipUrl = "https://github.com/$repo/releases/latest/download/$name";
        try {
            $info = streamHttpResponse($zipUrl, 'GET', [], NULL, [
                'content-length',
                'x-frame-options',
                'last-modified',
                'etag',
                'date',
                'age',
                'vary',
                'cache-Control'
            ], [
                'Content-Type: application/zip',
                'Content-Disposition: attachment; filename="plugin.zip"',
            ]);
            if ($info['http_code'] > 299 || $info['http_code'] < 200) {
                throw new ApiException('Request failed');
            }
        } catch (ApiException $e) {
            throw new ApiException("Plugin or theme '$name' not found");
        }
    }

    public function gitHubRequest($url, $decode = true, $follow_location = true)
    {
        $headers[] = 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36';
        $headers[] = 'Authorization: Bearer ' . $this->githubToken;
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => implode("\r\n", $headers),
                'follow_location' => $follow_location
            ]
        ]);
        $response = file_get_contents($url, false, $context);
        if ($response === false) {
            throw new ApiException('Request failed');
        }
        // Find the last index of "HTTP/1.1 200 OK" in $http_response_header array
        for ($i = count($http_response_header) - 1; $i >= 0; $i--) {
            if (substr($http_response_header[$i], 0, 12) === 'HTTP/1.1 200') {
                break;
            }
        }
        $headers = array_map('trim', array_slice($http_response_header, $i + 1));
        return [
            'body' => $decode ? json_decode($response) : $response,
            'headers' => $headers
        ];
    }

}
function streamHttpResponse($url, $request_method = 'GET', $request_headers = [], $request_body = null, $allowed_response_headers = [], $default_response_headers = [])
{
    $ch = curl_init($url);
    curl_setopt_array(
        $ch,
        [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 30,
            CURLOPT_FAILONERROR => true,
            CURLOPT_FOLLOWLOCATION => true,
        ]
    );

    if ($request_method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $request_body);
    } else if ($request_method === 'HEAD') {
        curl_setopt($ch, CURLOPT_NOBODY, true);
    }

    if (count($request_headers)) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $request_headers);
    }

    $seen_headers = [];
    curl_setopt(
        $ch,
        CURLOPT_HEADERFUNCTION,
        function ($curl, $header_line) use ($seen_headers, $allowed_response_headers) {
            if (strpos($header_line, ':') === false) {
                return strlen($header_line);
            }
            $header_name = strtolower(substr($header_line, 0, strpos($header_line, ':')));
            $seen_headers[$header_name] = true;
            $illegal_headers = ['transfer-encoding'];
            $header_allowed = (
                NULL === $allowed_response_headers || in_array($header_name, $allowed_response_headers)
            ) && !in_array($header_name, $illegal_headers);
            if ($header_allowed) {
                header($header_line);
            }
            return strlen($header_line);
        }
    );
    $extra_headers_sent = false;
    curl_setopt(
        $ch,
        CURLOPT_WRITEFUNCTION,
        function ($curl, $body) use (&$extra_headers_sent, $default_response_headers) {
            if (!$extra_headers_sent) {
                foreach ($default_response_headers as $header_line) {
                    $header_name = strtolower(substr($header_line, 0, strpos($header_line, ':')));
                    if (!isset($seen_headers[$header_name])) {
                        header($header_line);
                    }
                }
                $extra_headers_sent = true;
            }
            echo $body;
            flush();
            return strlen($body);
        }
    );
    curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    return $info;
}

$downloader = new PluginDownloader(
    getenv('GITHUB_TOKEN')
);

// Serve the request:
if (!array_key_exists('url', $_GET)) {
    header('Access-Control-Allow-Origin: *');
}
$pluginResponse;
try {
    /** @deprecated Plugins and themes downloads are no longer needed now that WordPress.org serves
     *              the proper CORS headers. This code will be removed in one of the next releases.
     */
    if (isset($_GET['plugin'])) {
        $downloader->streamFromDirectory($_GET['plugin'], PluginDownloader::PLUGINS);
    } else if (isset($_GET['theme'])) {
        $downloader->streamFromDirectory($_GET['theme'], PluginDownloader::THEMES);
    } else if (isset($_GET['org']) && isset($_GET['repo']) && isset($_GET['workflow']) && isset($_GET['pr']) && isset($_GET['artifact'])) {
        $allowedInputs = [
            [
                'org' => 'WordPress',
                'repo' => 'gutenberg',
                'workflow' => 'Build Gutenberg Plugin Zip',
                'artifact' => '#gutenberg-plugin#'
            ],
            [
                'org' => 'woocommerce',
                'repo' => 'woocommerce',
                'workflow' => 'Build Live Branch',
                'artifact' => '#plugins#'
            ],
            [
                'org' => 'WordPress',
                'repo' => 'wordpress-develop',
                'workflow' => 'Test Build Processes',
                'artifact' => '#wordpress-build-\d+#'
            ],
            [
                'org' => 'Automattic',
                'repo' => 'sensei',
                'workflow' => 'Plugin Build',
                'artifact' => '#sensei-lms-\w+#'
            ],
        ];
        $allowed = false;
        foreach ($allowedInputs as $allowedInput) {
            if (
                $_GET['org'] === $allowedInput['org'] &&
                $_GET['repo'] === $allowedInput['repo'] &&
                $_GET['workflow'] === $allowedInput['workflow'] &&
                preg_match($allowedInput['artifact'], $_GET['artifact'])
            ) {
                $allowed = true;
                break;
            }
        }
        if (!$allowed) {
            header('HTTP/1.1 400 Invalid request');
            die('Invalid request');
        }
        $downloader->streamFromGithubPR(
            $_GET['org'],
            $_GET['repo'],
            $_GET['pr'],
            $_GET['workflow'],
            $_GET['artifact']
        );
    } else if (isset($_GET['repo']) && isset($_GET['name'])) {
        // Only allow downloads from the block-interactivity-experiments repo for now.
        if ($_GET['repo'] !== 'WordPress/block-interactivity-experiments') {
            throw new ApiException('Invalid repo. Only "WordPress/block-interactivity-experiments" is allowed.');
        }

        $downloader->streamFromGithubReleases($_GET['repo'], $_GET['name']);
    } else if ( isset( $_GET['wordpress-branch'] ) ) {
        $branch = strtolower( $_GET['wordpress-branch'] );
        if ( $branch === 'trunk' || $branch === 'master' ) {
            $branch = 'master';
            $prefix = 'refs/heads/';
            // If the brach is of the form x.x append '-branch' to it.
        } elseif ( preg_match( '/^\d+\.\d+$/', $branch ) ) {
            $branch .= '-branch';
            $prefix = 'refs/heads/';
            // If the branch is in the form x.x.x, it's a tag.
        } elseif ( preg_match( '/^\d+\.\d+\.\d+$/', $branch ) ) {
            // Remove trailing .0 if present.
            if ( substr( $branch, -2 ) === '.0' ) {
                $branch = substr( $branch, 0, -2 );
            }
            $prefix = 'refs/tags/';
            // If the branch is in the form [a-f0-9]{7,40} it's a commit hash.
        } elseif ( preg_match( '/^[a-f0-9]{7,40}$/', $branch ) ) {
            $prefix = '';
        } elseif ( preg_match( '/^\d+\.\d+-branch$/', $branch ) ) {
            $prefix = 'refs/heads/';
        } else {
            throw new ApiException('artifact_not_found');
        }

        /*
         * URL provided by GitHub by the "Download ZIP" button.
         *
         * The URL of the actual zip file is provided by the location header, the
         * zip file's final URL is known to change occasionally so it's required
         * to fetch the official URL before streaming the file.
         */
        $url = "https://github.com/WordPress/WordPress/archive/{$prefix}{$branch}.zip";

        $github_response = $downloader->gitHubRequest( $url, false, false );

        // Get the real zip file's location header from the response.
        $zipUrl = null;
        foreach ( $github_response['headers'] as $header_line ) {
            $header_name = strtolower( substr( $header_line, 0, strpos( $header_line, ':' ) ) );
            $header_value = trim( substr( $header_line, 1 + strpos( $header_line, ':' ) ) );
            if ( $header_name === 'location' ) {
                $zipUrl = $header_value;
                break;
            }
        }

        if ( ! $zipUrl ) {
            throw new ApiException('artifact_not_found');
        }

        // Stream the zip file from the real location.
        streamHttpResponse(
            $zipUrl,
            'GET',
            [],
            file_get_contents('php://input'),
            null,
            [
                'Content-Disposition: attachment; filename="wordpress.zip"',
            ]
        );
    } else if (isset($_GET['url'])) {
        // Proxy the current request to $_GET['url'] and return the response,
        // but only if the URL is allowlisted.
        $url = $_GET['url'];
        $allowed_domains = ['api.wordpress.org', 'w.org', 'wordpress.org', 's.w.org'];
        $parsed_url = parse_url($url);
        if (!in_array($parsed_url['host'], $allowed_domains)) {
            http_response_code(403);
            echo "Error: The specified URL is not allowed.";
            exit;
        }

        /**
         * Pass through the request headers we got from WordPress via fetch(),
         * then filter out:
         *
         * * The browser-specific headers
         * * Headers related to security to avoid leaking any auth information
         *
         * ...and pass the rest to the proxied request.
         *
         * @return array
         */
        function get_request_headers()
        {
            $headers = [];
            foreach ($_SERVER as $name => $value) {
                if (substr($name, 0, 5) !== 'HTTP_') {
                    continue;
                }
                $name = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($name, 5)))));
                $lcname = strtolower($name);
                if (
                    $lcname === 'authorization'
                    || $lcname === 'cookie'
                    || $lcname === 'host'
                    || $lcname === 'origin'
                    || $lcname === 'referer'
                    || 0 === strpos($lcname, 'sec-')
                ) {
                    continue;
                }
                $headers[$name] = $value;
            }
            return $headers;
        }

        streamHttpResponse(
            $url,
            $_SERVER['REQUEST_METHOD'],
            get_request_headers(),
            file_get_contents('php://input'),
            null
        );
    } else {
        throw new ApiException('Invalid query parameters');
    }
} catch (ApiException $e) {
    http_response_code(400);
    if (!headers_sent()) {
        header('Content-Type: application/json');
    }
    die(json_encode(['error' => $e->getMessage()]));
}
