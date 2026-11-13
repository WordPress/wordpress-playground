<?php

// This test needs a PHP request router because it verifies the HTTP headers
// emitted by PHP's header() function, not just the helper's array bookkeeping.
// One test-only route invokes sendBufferedResponseHeaders() with controlled
// upstream, allowlist, and default-header inputs. The other runs the GitHub
// artifact lookup against a fake GitHub API. Returning false for every other
// URL lets the built-in server handle ordinary proxy requests.
$test_route = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (
	$test_route !== '/__test-default-response-headers'
	&& $test_route !== '/__test-workflow-lookup'
) {
	return false;
}

// plugin-proxy.php has no import-only entry point. Requiring it also dispatches
// this test-only request, which dies with a 400 invalid-query response. Buffer
// that response and replace it from a shutdown callback after the helper has
// been defined.
ob_start();

if ($test_route === '/__test-workflow-lookup') {
	// The lookup talks to api.github.com over HTTPS through PHP streams, which
	// the http_proxy variable used by the other tests does not reach. Replacing
	// gitHubRequest() keeps the production lookup and removes the network.
	$workflow_count = (int) $_GET['workflow-count'];
	$workflow_position = (int) $_GET['workflow-position'];
	register_shutdown_function(function () use ($workflow_count, $workflow_position) {
		ob_clean();
		header_remove();
		http_response_code(200);
		header('Content-Type: application/json');

		$downloader = new class('test-token', $workflow_count, $workflow_position) extends PluginDownloader {
			public $workflowListRequests = [];
			private $workflowCount;
			private $workflowPosition;

			public function __construct($githubToken, $workflowCount, $workflowPosition)
			{
				parent::__construct($githubToken);
				$this->workflowCount = $workflowCount;
				$this->workflowPosition = $workflowPosition;
			}

			public function gitHubRequest($url, $decode = true, $follow_location = true)
			{
				$path = parse_url($url, PHP_URL_PATH);
				parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

				if (preg_match('#/actions/workflows$#', $path)) {
					$this->workflowListRequests[] = $query;
					// Page the way GitHub does: 30 per page unless asked, 100 at most.
					$per_page = min((int) ($query['per_page'] ?? 30), 100);
					$page = (int) ($query['page'] ?? 1);
					$workflows = [];
					for ($position = 1; $position <= $this->workflowCount; $position++) {
						$workflows[] = [
							'id' => $position,
							'name' => $position === $this->workflowPosition
								? 'Target workflow'
								: "Workflow $position",
						];
					}
					$body = [
						'total_count' => $this->workflowCount,
						'workflows' => array_slice($workflows, ($page - 1) * $per_page, $per_page),
					];
				} else if (preg_match('#/actions/workflows/\d+/runs$#', $path)) {
					$body = [
						'workflow_runs' => [
							['artifacts_url' => 'https://api.github.com/test-artifacts'],
						],
					];
				} else {
					$body = [
						'artifacts' => [
							[
								'name' => 'target-artifact',
								'size_in_bytes' => 4000,
								'expired' => false,
								'archive_download_url' => 'https://api.github.com/test-artifact.zip',
							],
						],
					];
				}

				return [
					'body' => json_decode(json_encode($body)),
					'headers' => [],
				];
			}
		};

		// verify_only stops the lookup once the artifact is found, before any download.
		$_GET['verify_only'] = '1';
		$error = null;
		try {
			$downloader->streamFromGithubBranch(
				'wordpress',
				'test-repo',
				'test-branch',
				'Target workflow',
				'target-artifact'
			);
		} catch (ApiException $e) {
			http_response_code(400);
			$error = $e->getMessage();
		}
		echo json_encode([
			'error' => $error,
			'workflowListRequests' => $downloader->workflowListRequests,
		]);
	});
} else {
	$allow_content_type = isset($_GET['allow-content-type']);
	register_shutdown_function(function () use ($allow_content_type) {
		ob_clean();
		header_remove();
		http_response_code(200);
		sendBufferedResponseHeaders(
			[['content-type', "Content-Type: application/octet-stream\r\n"]],
			$allow_content_type ? ['content-type'] : ['content-length'],
			['Content-Type: application/zip']
		);
		echo 'body';
	});
}

require __DIR__ . '/../../public/plugin-proxy.php';
