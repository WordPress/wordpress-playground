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
	// stands for a deleted head repository. An entry may add the run's event
	// after a colon, as in `1:pull_request_target`; the default is
	// `pull_request`. A third field of `no-artifacts` gives the run an
	// empty artifact list, as for a build still in progress, as in
	// `1:pull_request:no-artifacts`. Every run belongs to repository 1.
	$parse_id = function ($value) {
		return $value === 'null' ? null : (int) $value;
	};
	$mode = $_GET['mode'];
	$runs = [];
	if (($_GET['runs'] ?? '') !== '') {
		foreach (explode(',', $_GET['runs']) as $entry) {
			$parts = explode(':', $entry, 3);
			$runs[] = [
				'head_repository_id' => $parse_id($parts[0]),
				'event' => $parts[1] ?? 'pull_request',
				'has_artifacts' => ($parts[2] ?? '') !== 'no-artifacts',
			];
		}
	}
	$pr_head_repository_id = $parse_id($_GET['pr-head'] ?? '1');
	register_shutdown_function(function () use ($mode, $runs, $pr_head_repository_id) {
		ob_clean();
		header_remove();
		http_response_code(200);
		header('Content-Type: application/json');

		$downloader = new class('test-token', $runs, $pr_head_repository_id) extends PluginDownloader {
			public $artifactListRequests = [];
			private $runs;
			private $prHeadRepositoryId;

			public function __construct($githubToken, $runs, $prHeadRepositoryId)
			{
				parent::__construct($githubToken);
				$this->runs = $runs;
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
					// Serve one page of runs, as GitHub does.
					parse_str(parse_url($url, PHP_URL_QUERY) ?? '', $query);
					$per_page = (int) ($query['per_page'] ?? 30);
					$page = (int) ($query['page'] ?? 1);
					$runs = [];
					foreach (array_slice($this->runs, ($page - 1) * $per_page, $per_page, true) as $index => $run) {
						$runs[] = [
							'event' => $run['event'],
							'repository' => ['id' => 1],
							'head_repository' => $run['head_repository_id'] === null
								? null
								: ['id' => $run['head_repository_id']],
							'artifacts_url' => $run['has_artifacts']
								? "https://api.github.com/test-artifacts/$index"
								: "https://api.github.com/test-artifacts/$index/none",
						];
					}
					$body = ['workflow_runs' => $runs];
				} else if (preg_match('#^/test-artifacts/(\d+)/none$#', $path, $matches)) {
					$this->artifactListRequests[] = (int) $matches[1];
					$body = ['artifacts' => []];
				} else if (preg_match('#^/test-artifacts/(\d+)$#', $path, $matches)) {
					// Every run has an artifact with the requested name, as a
					// fork that copies the name would.
					$this->artifactListRequests[] = (int) $matches[1];
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
				} else {
					throw new LogicException("Unexpected GitHub API request: $url");
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
