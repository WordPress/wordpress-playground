<?php

// This test needs a PHP request router because it verifies the HTTP headers
// emitted by PHP's header() function, not just the helper's array bookkeeping.
// One test-only route invokes sendBufferedResponseHeaders() with controlled
// upstream, allowlist, and default-header inputs. The other runs the GitHub
// workflow run lookup against a fake GitHub API. Returning false for every
// other URL lets the built-in server handle ordinary proxy requests.
$test_route = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (
	$test_route !== '/__test-default-response-headers'
	&& $test_route !== '/__test-run-lookup'
) {
	return false;
}

// plugin-proxy.php has no import-only entry point. Requiring it also dispatches
// this test-only request, which dies with a 400 invalid-query response. Buffer
// that response and replace it from a shutdown callback after the helper has
// been defined.
ob_start();

if ($test_route === '/__test-run-lookup') {
	// The lookup talks to api.github.com over HTTPS through PHP streams, which
	// the http_proxy variable used by the other tests does not reach. Replacing
	// gitHubRequest() keeps the production lookup and removes the network.
	//
	// `runs` lists the head repository ID of each run, newest first; `null`
	// stands for a deleted head repository. Every run belongs to repository 1.
	$parse_id = function ($value) {
		return $value === 'null' ? null : (int) $value;
	};
	$mode = $_GET['mode'];
	$run_head_repository_ids = array_map($parse_id, explode(',', $_GET['runs']));
	$pr_head_repository_id = $parse_id($_GET['pr-head'] ?? '1');
	register_shutdown_function(function () use ($mode, $run_head_repository_ids, $pr_head_repository_id) {
		ob_clean();
		header_remove();
		http_response_code(200);
		header('Content-Type: application/json');

		$downloader = new class('test-token', $run_head_repository_ids, $pr_head_repository_id) extends PluginDownloader {
			public $artifactListRequests = [];
			private $runHeadRepositoryIds;
			private $prHeadRepositoryId;

			public function __construct($githubToken, $runHeadRepositoryIds, $prHeadRepositoryId)
			{
				parent::__construct($githubToken);
				$this->runHeadRepositoryIds = $runHeadRepositoryIds;
				$this->prHeadRepositoryId = $prHeadRepositoryId;
			}

			public function gitHubRequest($url, $decode = true, $follow_location = true)
			{
				$path = parse_url($url, PHP_URL_PATH);

				if (preg_match('#/pulls/\d+$#', $path)) {
					$body = [
						'title' => 'Test pull request',
						'created_at' => '2026-01-01T00:00:00Z',
						'head' => [
							'ref' => 'test-branch',
							'repo' => $this->prHeadRepositoryId === null
								? null
								: ['id' => $this->prHeadRepositoryId],
						],
					];
				} else if (preg_match('#/actions/workflows$#', $path)) {
					$body = [
						'workflows' => [['id' => 1, 'name' => 'Target workflow']],
					];
				} else if (preg_match('#/actions/workflows/\d+/runs$#', $path)) {
					$runs = [];
					foreach ($this->runHeadRepositoryIds as $index => $head_repository_id) {
						$runs[] = [
							'repository' => ['id' => 1],
							'head_repository' => $head_repository_id === null
								? null
								: ['id' => $head_repository_id],
							'artifacts_url' => "https://api.github.com/test-artifacts/$index",
						];
					}
					$body = ['workflow_runs' => $runs];
				} else {
					// Every run has an artifact with the requested name, as a
					// fork that copies the name would.
					$this->artifactListRequests[] = (int) basename($path);
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
			if ($mode === 'pr') {
				$downloader->streamFromGithubPR('wordpress', 'test-repo', '1', 'Target workflow', 'target-artifact');
			} else {
				$downloader->streamFromGithubBranch('wordpress', 'test-repo', 'test-branch', 'Target workflow', 'target-artifact');
			}
		} catch (ApiException $e) {
			http_response_code(400);
			$error = $e->getMessage();
		}
		// streamFromGithubPR prints the pull request details on success. Only
		// this summary is under test.
		ob_clean();
		echo json_encode([
			'error' => $error,
			'artifactListRequests' => $downloader->artifactListRequests,
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
