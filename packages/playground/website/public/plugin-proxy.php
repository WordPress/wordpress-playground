<?php

ini_set('display_errors', 0);

class ApiException extends Exception {}
class RateLimitedException extends ApiException {}
class PullRequestApiException extends ApiException
{
	private $pullRequestTitle;
	private $pullRequestOpenedAt;

	/**
	 * Creates an API error for a pull request that GitHub resolved.
	 *
	 * Artifact and workflow checks happen after the pull request has been
	 * fetched. Keeping its title on those errors lets verification clients
	 * identify the resolved pull request even when its preview is unavailable.
	 *
	 * @param string         $message          Machine-readable proxy error name.
	 * @param string         $pullRequestTitle Title returned by the GitHub API.
	 * @param string         $pullRequestOpenedAt GitHub creation timestamp.
	 * @param Throwable|null $previous            Original artifact or workflow error.
	 */
	public function __construct(
		$message,
		$pullRequestTitle,
		$pullRequestOpenedAt,
		$previous = null
	)
	{
		parent::__construct($message, 0, $previous);
		$this->pullRequestTitle = $pullRequestTitle;
		$this->pullRequestOpenedAt = $pullRequestOpenedAt;
	}

	/**
	 * Returns the title of the pull request resolved before the error occurred.
	 *
	 * @return string Pull-request title returned by the GitHub API.
	 */
	public function getPullRequestTitle()
	{
		return $this->pullRequestTitle;
	}

	/**
	 * Returns when GitHub records the pull request as having been opened.
	 *
	 * @return string ISO 8601 creation timestamp returned by the GitHub API.
	 */
	public function getPullRequestOpenedAt()
	{
		return $this->pullRequestOpenedAt;
	}
}
class UrlNotAllowedException extends ApiException {}
class PluginDownloader
{

	private $githubToken;

	public const PLUGINS = 'plugins';
	public const THEMES = 'theme';
	// List of allow-listed GitHub organizations. Intentionally lowercased
	// for a case-insensitive check later on.
	public const ALLOWED_ORGS = ['wordpress', 'automattic', 'woocommerce'];

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
				'cache-control'
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

	private function streamArtifactFromBranch($organization, $repo, $branchName, $workflow_name, $artifact_name)
	{
		$branchName = urlencode($branchName);

		$workflows = $this->gitHubRequest("https://api.github.com/repos/$organization/$repo/actions/workflows")['body'];
		if (!$workflows || !$workflows->workflows) {
			throw new ApiException('no_workflows_found');
		}

		$workflow_id = null;
		foreach ($workflows->workflows as $workflow) {
			if ($workflow->name === $workflow_name) {
				$workflow_id = $workflow->id;
				break;
			}
		}
		if (!$workflow_id) {
			throw new ApiException('workflow_not_found');
		}

		$ciRuns = $this->gitHubRequest("https://api.github.com/repos/$organization/$repo/actions/workflows/$workflow_id/runs?branch=$branchName")['body'];
		if (!$ciRuns || !$ciRuns->workflow_runs) {
			throw new ApiException('no_ci_runs');
		}

		$artifactsUrls = [];
		foreach ($ciRuns->workflow_runs as $run) {
			$artifactsUrls[] = $run->artifacts_url;
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
				// Support prefix matching if artifact name ends with '-'
				// This is used for branches where artifact names include commit hashes
				$is_match = (substr($artifact_name, -1) === '-')
					? (strpos($artifact->name, $artifact_name) === 0)
					: ($artifact_name === $artifact->name);

				if ($is_match) {
					if ($artifact->size_in_bytes < 3000) {
						throw new ApiException('artifact_invalid');
					}
					if ($artifact->expired) {
						throw new ApiException('artifact_expired');
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
				'cache-control'
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

	public function streamFromGithubBranch($organization, $repo, $branch, $workflow_name, $artifact_name)
	{
		$this->streamArtifactFromBranch($organization, $repo, $branch, $workflow_name, $artifact_name);
	}

	public function streamFromGithubPR($organization, $repo, $pr, $workflow_name, $artifact_name)
	{
		$prDetails = $this->gitHubRequest("https://api.github.com/repos/$organization/$repo/pulls/$pr")['body'];
		if (!$prDetails) {
			throw new ApiException('invalid_pr_number');
		}
		try {
			$this->streamArtifactFromBranch(
				$organization,
				$repo,
				$prDetails->head->ref,
				$workflow_name,
				$artifact_name
			);
		} catch (RateLimitedException $e) {
			throw $e;
		} catch (ApiException $e) {
			throw new PullRequestApiException(
				$e->getMessage(),
				$prDetails->title,
				$prDetails->created_at,
				$e
			);
		}
		if (array_key_exists('verify_only', $_GET)) {
			header('Content-Type: application/json');
			echo json_encode([
				'title' => $prDetails->title,
				'created_at' => $prDetails->created_at,
			]);
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
				'cache-control'
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
			if (isset($http_response_header) && isRateLimitedResponse($http_response_header)) {
				throw new RateLimitedException('Rate limited');
			}
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

function streamHttpResponse($url, $request_method = 'GET', $request_headers = [], $request_body = null, $allowed_response_headers = [], $default_response_headers = [], $allowed_hosts = null)
{
	// Make the initial request, then manually follow up to libcurl's default 30 redirects.
	// See https://curl.se/libcurl/c/CURLOPT_MAXREDIRS.html
	$max_redirects = 30;
	for ($redirect_count = 0; $redirect_count <= $max_redirects; $redirect_count++) {
		// When supplied, the allowlist applies to every outbound URL.
		if (
			$allowed_hosts !== null
			&& !isPluginProxyUrlAllowed($url, $allowed_hosts)
		) {
			throw new UrlNotAllowedException('URL is not allowed');
		}

		$info = streamHttpResponseOnce(
			$url,
			$request_method,
			$request_headers,
			$request_body,
			$allowed_response_headers,
			$default_response_headers
		);

		if (empty($info['redirect_url'])) {
			return $info;
		}

		// Match libcurl's default method behavior across redirects.
		// See https://curl.se/libcurl/c/CURLOPT_FOLLOWLOCATION.html
		$redirect_uses_get = (
			$info['http_code'] === 303
			&& $request_method !== 'HEAD'
		) || (
			$request_method === 'POST'
			&& in_array($info['http_code'], [301, 302], true)
		);
		if ($redirect_uses_get) {
			$request_method = 'GET';
			$request_body = null;
		}

		$url = $info['redirect_url'];
	}

	throw new ApiException('Too many redirects');
}

function isPluginProxyUrlAllowed($candidate_url, $allowed_hosts)
{
	$host = is_string($candidate_url) ? parse_url($candidate_url, PHP_URL_HOST) : null;
	return is_string($host) && in_array($host, $allowed_hosts, true);
}

function streamHttpResponseOnce($url, $request_method, $request_headers, $request_body, $allowed_response_headers, $default_response_headers)
{
	$ch = curl_init($url);
	curl_setopt_array(
		$ch,
		[
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_CONNECTTIMEOUT => 30,
			CURLOPT_FAILONERROR => true,
		]
	);

	if ($request_method === 'POST') {
		curl_setopt($ch, CURLOPT_POST, true);
		curl_setopt($ch, CURLOPT_POSTFIELDS, $request_body);
	} else if ($request_method === 'HEAD') {
		curl_setopt($ch, CURLOPT_NOBODY, true);
	} else if ($request_method !== 'GET') {
		if ($request_body !== null && $request_body !== '') {
			curl_setopt($ch, CURLOPT_POSTFIELDS, $request_body);
		}
		curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $request_method);
	}

	if (count($request_headers)) {
		curl_setopt($ch, CURLOPT_HTTPHEADER, $request_headers);
	}

	// Hold each header block until we know whether it describes an intermediate redirect.
	$response_status = 0;
	$response_headers = [];
	$has_location_header = false;
	$is_redirect_response = false;
	curl_setopt(
		$ch,
		CURLOPT_HEADERFUNCTION,
		function ($curl, $header_line) use (
			&$response_status,
			&$response_headers,
			&$has_location_header,
			&$is_redirect_response,
			$allowed_response_headers,
			$default_response_headers
		) {
			$header_length = strlen($header_line);
			if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $header_line, $matches)) {
				$response_status = (int)$matches[1];
				$response_headers = [];
				$has_location_header = false;
				$is_redirect_response = false;
				return $header_length;
			}

			if (trim($header_line) === '') {
				if ($response_status < 100 || $response_status >= 200) {
					$is_redirect_response = (
						$response_status >= 300
						&& $response_status < 400
						&& $has_location_header
					);
					if (!$is_redirect_response) {
						sendBufferedResponseHeaders(
							$response_headers,
							$allowed_response_headers,
							$default_response_headers
						);
					}
				}
				return $header_length;
			}

			$separator_position = strpos($header_line, ':');
			if ($separator_position === false) {
				return $header_length;
			}

			$header_name = strtolower(substr($header_line, 0, $separator_position));
			$response_headers[] = [$header_name, $header_line];
			if ($header_name === 'location') {
				$has_location_header = true;
			}
			return $header_length;
		}
	);
	curl_setopt(
		$ch,
		CURLOPT_WRITEFUNCTION,
		function ($curl, $body) use (&$is_redirect_response) {
			if ($is_redirect_response) {
				return strlen($body);
			}
			echo $body;
			flush();
			return strlen($body);
		}
	);
	$response = curl_exec($ch);
	$info = curl_getinfo($ch);
	closeCurlHandle($ch);
	if ($is_redirect_response && empty($info['redirect_url'])) {
		throw new ApiException('Invalid redirect');
	}
	if ($response === false && isset($info['http_code']) && $info['http_code'] === 429) {
		throw new RateLimitedException('Rate limited');
	}
	return $info;
}

function sendBufferedResponseHeaders($response_headers, $allowed_response_headers, $default_response_headers)
{
	$seen_headers = [];
	foreach ($response_headers as [$header_name, $header_line]) {
		$header_allowed = (
			NULL === $allowed_response_headers
			|| in_array($header_name, $allowed_response_headers, true)
		) && $header_name !== 'transfer-encoding';
		if ($header_allowed) {
			$seen_headers[$header_name] = true;
			header($header_line);
		}
	}

	foreach ($default_response_headers as $header_line) {
		$header_name = strtolower(substr($header_line, 0, strpos($header_line, ':')));
		if (!isset($seen_headers[$header_name])) {
			header($header_line);
		}
	}
}

function closeCurlHandle($ch)
{
	if (version_compare(PHP_VERSION, '8.5', '<')) {
		// curl_close is deprecated in PHP 8.5 and later.
		// See https://www.php.net/manual/en/migration85.deprecated.php#migration85.deprecated.curl
		curl_close($ch);
	}
}

function isRateLimitedResponse($headers)
{
	$http_code = 0;
	$rate_limit_exhausted = false;
	foreach ($headers as $header) {
		if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $matches)) {
			$http_code = (int)$matches[1];
		}
		if (preg_match('/^X-RateLimit-Remaining\s*:\s*0\b/i', $header)) {
			$rate_limit_exhausted = true;
		}
	}
	// GitHub reports primary rate limits as HTTP 403 with this header.
	return $http_code === 429 || ($http_code === 403 && $rate_limit_exhausted);
}

$downloader = new PluginDownloader(
	getenv('GITHUB_TOKEN')
);

// Serve the request:
if (!array_key_exists('url', $_GET)) {
	header('Access-Control-Allow-Origin: *');
}
try {
	/** @deprecated Plugins and themes downloads are no longer needed now that WordPress.org serves
	 *              the proper CORS headers. This code will be removed in one of the next releases.
	 */
	if (isset($_GET['plugin'])) {
		$downloader->streamFromDirectory($_GET['plugin'], PluginDownloader::PLUGINS);
	} else if (isset($_GET['theme'])) {
		$downloader->streamFromDirectory($_GET['theme'], PluginDownloader::THEMES);
	} else if (isset($_GET['org']) && isset($_GET['repo']) && isset($_GET['workflow']) && isset($_GET['pr']) && isset($_GET['artifact'])) {
		// Don't reveal the allowed orgs to the client, just give an error.
		// Lowercase the org name to make the check case-insensitive.
		if (! in_array(strtolower($_GET['org']), PluginDownloader::ALLOWED_ORGS, true)) {
			throw new ApiException('Invalid org. This organization is not allowed.');
		}
		$downloader->streamFromGithubPR(
			$_GET['org'],
			$_GET['repo'],
			$_GET['pr'],
			$_GET['workflow'],
			$_GET['artifact']
		);
	} else if (isset($_GET['org']) && isset($_GET['repo']) && isset($_GET['workflow']) && isset($_GET['branch']) && isset($_GET['artifact'])) {
		// Don't reveal the allowed orgs to the client, just give an error.
		// Lowercase the org name to make the check case-insensitive.
		if (! in_array(strtolower($_GET['org']), PluginDownloader::ALLOWED_ORGS, true)) {
			throw new ApiException('Invalid org. This organization is not allowed.');
		}
		$downloader->streamFromGithubBranch(
			$_GET['org'],
			$_GET['repo'],
			$_GET['branch'],
			$_GET['workflow'],
			$_GET['artifact']
		);
	} else if (isset($_GET['repo']) && isset($_GET['name'])) {
		// Verify repo string contains org/repo format
		$parts = explode('/', $_GET['repo']);
		if (count($parts) !== 2) {
			throw new ApiException('Invalid repo format. Expected "organization/repository".');
		}

		// Verify org is allowed, and lowercase it to make the check case-insensitive.
		if (!in_array(strtolower($parts[0]), PluginDownloader::ALLOWED_ORGS, true)) {
			throw new ApiException('Invalid repo. Organization not allowed.');
		}

		$downloader->streamFromGithubReleases($_GET['repo'], $_GET['name']);
	} else if (isset($_GET['build-ref'])) {
		$build_ref = strtolower($_GET['build-ref']);
		if ($build_ref === 'trunk' || $build_ref === 'master') {
			$build_ref = 'master';
			$prefix = 'refs/heads/';
			// If the build ref is of the form x.x append '-branch' to it.
		} elseif (preg_match('/^\d+\.\d+$/', $build_ref)) {
			$build_ref .= '-branch';
			$prefix = 'refs/heads/';
			// If the build ref is in the form x.x.x, it's a tag.
		} elseif (preg_match('/^\d+\.\d+\.\d+$/', $build_ref)) {
			// Remove trailing .0 if present.
			if (substr($build_ref, -2) === '.0') {
				$build_ref = substr($build_ref, 0, -2);
			}
			$prefix = 'refs/tags/';
			// If the build ref is in the form [a-f0-9]{7,40} it's a commit hash.
		} elseif (preg_match('/^[a-f0-9]{7,40}$/', $build_ref)) {
			$prefix = '';
		} elseif (preg_match('/^\d+\.\d+-branch$/', $build_ref)) {
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
		$url = "https://github.com/WordPress/WordPress/archive/{$prefix}{$build_ref}.zip";

		$github_response = $downloader->gitHubRequest($url, false, false);

		// Get the real zip file's location header from the response.
		$zipUrl = null;
		foreach ($github_response['headers'] as $header_line) {
			$header_name = strtolower(substr($header_line, 0, strpos($header_line, ':')));
			$header_value = trim(substr($header_line, 1 + strpos($header_line, ':')));
			if ($header_name === 'location') {
				$zipUrl = $header_value;
				break;
			}
		}

		if (! $zipUrl) {
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
			null,
			[],
			$allowed_domains
		);
	} else {
		throw new ApiException('Invalid query parameters');
	}
} catch (ApiException $e) {
	if ($e instanceof UrlNotAllowedException) {
		http_response_code(403);
		die("Error: The specified URL is not allowed.");
	}
	http_response_code($e instanceof RateLimitedException ? 429 : 400);
	if (!headers_sent()) {
		header('Content-Type: application/json');
	}
	$errorResponse = ['error' => $e->getMessage()];
	if ($e instanceof PullRequestApiException) {
		$errorResponse['title'] = $e->getPullRequestTitle();
		$errorResponse['created_at'] = $e->getPullRequestOpenedAt();
	}
	die(json_encode($errorResponse));
}
