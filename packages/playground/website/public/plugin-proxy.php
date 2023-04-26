<?php

ini_set('display_errors', 0);

class ApiException extends Exception
{
}
class PluginDownloader
{

    private $githubToken;

    public const PLUGINS = 'plugins';
    public const THEMES = 'themes';

    public function __construct($githubToken)
    {
        $this->githubToken = $githubToken;
    }

    public function streamFromDirectory($name, $directory)
    {
        $name = preg_replace('#[^a-zA-Z0-9\.\-_]#', '', $name);
        $zipUrl = "https://downloads.wordpress.org/$directory/$name";
        try {
            $this->streamHttpResponse($zipUrl, [
                'content-length',
                'x-frame-options',
                'last-modified',
                'etag',
                'date',
                'age',
                'vary',
                'cache-Control'
            ]);
        } catch (ApiException $e) {
            throw new ApiException("Plugin or theme '$name' not found");
        }
    }

    public function streamFromGithubPR($organization, $repo, $pr, $workflow_name, $artifact_name)
    {
        $prDetails = $this->gitHubRequest("https://api.github.com/repos/$organization/$repo/pulls/$pr")['body'];
        if (!$prDetails) {
            throw new ApiException('Invalid PR number');
        }
        $branchName = $prDetails->head->ref;
        $ciRuns = $this->gitHubRequest("https://api.github.com/repos/$organization/$repo/actions/runs?branch=$branchName")['body'];
        if (!$ciRuns) {
            throw new ApiException('No CI runs found');
        }

        $artifactsUrls = [];
        foreach ($ciRuns->workflow_runs as $run) {
            if ($run->name === $workflow_name) {
                $artifactsUrls[] = $run->artifacts_url;
            }
        }
        if (!$artifactsUrls) {
            throw new ApiException('No artifact URL found');
        }

        foreach ($artifactsUrls as $artifactsUrl) {
            $zip_download_api_endpoint = $zip_url = null;

            $artifacts = $this->gitHubRequest($artifactsUrl)['body'];
            if (!$artifacts) {
                continue;
            }

            foreach ($artifacts->artifacts as $artifact) {
                if ($artifact->name === $artifact_name) {
                    $zip_download_api_endpoint = $artifact->archive_download_url;
                    break;
                }
            }
            if (!$zip_download_api_endpoint) {
                continue;
            }

            $zip_download_headers = $this->gitHubRequest($zip_download_api_endpoint, true)['headers'];
            // Find the location header and store it in $zip_url
            foreach ($zip_download_headers as $header) {
                if (substr(strtolower($header), 0, 10) === 'location: ') {
                    $zip_url = substr($header, 10);
                    break;
                }
            }
            if (!$zip_url) {
                continue;
            }
            $this->streamHttpResponse($zip_url, [], [
                'Content-Length: ' . $artifact->size_in_bytes
            ]);
        }
        if (!$artifacts) {
            throw new ApiException('No artifacts found under the URL');
        }
        if (!$zip_download_api_endpoint) {
            throw new ApiException('No artifact download URL found with the name');
        }
        if (!$zip_url) {
            throw new ApiException('No zip location returned by the artifact download API');
        }
    }

    protected function gitHubRequest($url)
    {
        $headers[] = 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36';
        $headers[] = 'Authorization: Bearer ' . $this->githubToken;
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => implode("\r\n", $headers),
            ]
        ]);
        $response = file_get_contents($url, false, $context);
        if ($response === false) {
            throw new ApiException('Request failed');
        }
        return [
            'body' => json_decode($response),
            'headers' => array_map('trim', array_slice($http_response_header, 1))
        ];
    }

    private function streamHttpResponse($url, $allowed_headers = [], $default_headers = [])
    {
        $default_headers = array_merge([
            'Content-Type: application/zip',
            'Content-Disposition: attachment; filename="plugin.zip"',
        ], $default_headers);
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

        $seen_headers = [];
        curl_setopt(
            $ch,
            CURLOPT_HEADERFUNCTION,
            function ($curl, $header_line) use ($seen_headers, $allowed_headers) {
                $header_name = strtolower(substr($header_line, 0, strpos($header_line, ':')));
                $seen_headers[$header_name] = true;
                if (in_array($header_name, $allowed_headers)) {
                    header($header_line);
                }
                return strlen($header_line);
            }
        );
        $extra_headers_sent = false;
        curl_setopt(
            $ch,
            CURLOPT_WRITEFUNCTION,
            function ($curl, $body) use (&$extra_headers_sent, $default_headers) {
                if (!$extra_headers_sent) {
                    foreach ($default_headers as $header_line) {
                        $header_name = strtolower(substr($header_line, 0, strpos($header_line, ':')));
                        if (!isset($seen_headers[strtolower($header_name)])) {
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
        if ($info['http_code'] > 299 || $info['http_code'] < 200) {
            throw new ApiException('Request failed');
        }
    }

}

$downloader = new PluginDownloader(
    getenv('GITHUB_TOKEN')
);

// Serve the request:
header('Access-Control-Allow-Origin: *');
$pluginResponse;
try {
    if (isset($_GET['plugin'])) {
        $downloader->streamFromDirectory($_GET['plugin'], PluginDownloader::PLUGINS);
    } else if (isset($_GET['theme'])) {
        $downloader->streamFromDirectory($_GET['plugin'], PluginDownloader::THEMES);
    } else if (isset($_GET['org']) && isset($_GET['repo']) && isset($_GET['workflow']) && isset($_GET['pr']) && isset($_GET['artifact'])) {
        $allowedInputs = [
            [
                'org' => 'WordPress',
                'repo' => 'gutenberg',
                'workflow' => 'Build Gutenberg Plugin Zip',
                'artifact' => 'gutenberg-plugin'
            ],
            [
                'org' => 'woocommerce',
                'repo' => 'woocommerce',
                'workflow' => 'Build Live Branch',
                'artifact' => 'plugins'
            ]
        ];
        $allowed = false;
        foreach ($allowedInputs as $allowedInput) {
            if (
                $_GET['org'] === $allowedInput['org'] &&
                $_GET['repo'] === $allowedInput['repo'] &&
                $_GET['workflow'] === $allowedInput['workflow'] &&
                $_GET['artifact'] === $allowedInput['artifact']
            ) {
                $allowed = true;
                break;
            }
        }
        if (!$allowed) {
            die('Invalid request');
        }
        $downloader->streamFromGithubPR(
            $_GET['org'],
            $_GET['repo'],
            $_GET['pr'],
            $_GET['workflow'],
            $_GET['artifact']
        );
    } else {
        throw new ApiException('Invalid query parameters');
    }
} catch (ApiException $e) {
    header('HTTP/1.1 400 Invalid request');
    if (!headers_sent()) {
        header('Content-Type: application/json');
    }
    die(json_encode(['error' => $e->getMessage()]));
}
