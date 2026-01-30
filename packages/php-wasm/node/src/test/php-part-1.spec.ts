import {
	getPhpIniEntries,
	PHP,
	PHPProcessManager,
	sandboxedSpawnHandlerFactory,
	setPhpIniEntries,
	type SpawnedPHP,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import { createSpawnHandler, phpVar } from '@php-wasm/util';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import type { PHPLoaderOptions } from '..';
import { loadNodeRuntime } from '..';
import { createNodeFsMountHandler } from '../lib/node-fs-mount';
import { spawn } from 'child_process';

const testDirPath = '/__test987654321';
const testFilePath = '/__test987654321.txt';
/**
 * Preface to Pygmalion is a longer chunk of text that
 * won't fit into a pipe buffer and will require multiple
 * read/write cycles to complete. This is perfect for testing
 * whether these chunks are appended to the output one after
 * another (as opposed to writing over the previous chunk).
 */
const pygmalion = `PREFACE TO PYGMALION.

A Professor of Phonetics.

As will be seen later on, Pygmalion needs, not a preface, but a sequel,
which I have supplied in its due place. The English have no respect for
their language, and will not teach their children to speak it. They
spell it so abominably that no man can teach himself what it sounds
like. It is impossible for an Englishman to open his mouth without
making some other Englishman hate or despise him. German and Spanish
are accessible to foreigners: English is not accessible even to
Englishmen. The reformer England needs today is an energetic phonetic
enthusiast: that is why I have made such a one the hero of a popular
play. There have been heroes of that kind crying in the wilderness for
many years past. When I became interested in the subject towards the
end of the eighteen-seventies, Melville Bell was dead; but Alexander J.
Ellis was still a living patriarch, with an impressive head always
covered by a velvet skull cap, for which he would apologize to public
meetings in a very courtly manner. He and Tito Pagliardini, another
phonetic veteran, were men whom it was impossible to dislike. Henry
Sweet, then a young man, lacked their sweetness of character: he was
about as conciliatory to conventional mortals as Ibsen or Samuel
Butler. His great ability as a phonetician (he was, I think, the best
of them all at his job) would have entitled him to high official
recognition, and perhaps enabled him to popularize his subject, but for
his Satanic contempt for all academic dignitaries and persons in
general who thought more of Greek than of phonetics. Once, in the days
when the Imperial Institute rose in South Kensington, and Joseph
Chamberlain was booming the Empire, I induced the editor of a leading
monthly review to commission an article from Sweet on the imperial
importance of his subject. When it arrived, it contained nothing but a
savagely derisive attack on a professor of language and literature
whose chair Sweet regarded as proper to a phonetic expert only. The
article, being libelous, had to be returned as impossible; and I had to
renounce my dream of dragging its author into the limelight. When I met
him afterwards, for the first time for many years, I found to my
astonishment that he, who had been a quite tolerably presentable young
man, had actually managed by sheer scorn to alter his personal
appearance until he had become a sort of walking repudiation of Oxford
and all its traditions. It must have been largely in his own despite
that he was squeezed into something called a Readership of phonetics
there. The future of phonetics rests probably with his pupils, who all
swore by him; but nothing could bring the man himself into any sort of
compliance with the university, to which he nevertheless clung by
divine right in an intensely Oxonian way. I daresay his papers, if he
has left any, include some satires that may be published without too
destructive results fifty years hence. He was, I believe, not in the
least an ill-natured man: very much the opposite, I should say; but he
would not suffer fools gladly.`;

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;

const phpLoaderOptions: PHPLoaderOptions[] = [{}, { withXdebug: true }];

phpLoaderOptions.forEach((options) => {
	describe.each(phpVersions)('PHP %s', (phpVersion) => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(await loadNodeRuntime(phpVersion as any, options));
			php.mkdir('/php');
			php.setSpawnHandler(spawn as any);

			await setPhpIniEntries(php, {
				disable_functions: '',
				html_errors: false,
			});
		});
		afterEach(async () => {
			php.exit();
		});

		describe('php.runStream()', { skip: options.withXdebug }, () => {
			it('should return a StreamedPHPResponse', async () => {
				const streamed = await php.runStream({
					code: '<?php echo "test";',
				});
				expect(streamed.stdout).toBeInstanceOf(ReadableStream);
				expect(streamed.stderr).toBeInstanceOf(ReadableStream);
				expect(streamed.exitCode).toBeInstanceOf(Promise);
				expect(streamed.headers).toBeInstanceOf(Promise);
			});

			it('should provide stdout bytes through stdoutBytes property', async () => {
				const streamed = await php.runStream({
					code: '<?php echo "Hello World";',
				});
				const bytes = await streamed.stdoutBytes;
				expect(bytes).toStrictEqual(
					new TextEncoder().encode('Hello World')
				);
			});

			it('should provide stdout text through stdoutText property', async () => {
				const streamed = await php.runStream({
					code: '<?php echo "Hello World";',
				});
				const text = await streamed.stdoutText;
				expect(text).toBe('Hello World');
			});

			it('should provide stderr text through stderrText property', async () => {
				const streamed = await php.runStream({
					code: '<?php file_put_contents("php://stderr", "Error message");',
				});
				const stderr = await streamed.stderrText;
				expect(stderr).toBe('Error message');
			});

			it('should handle headers correctly', async () => {
				const streamed = await php.runStream({
					code: '<?php header("Content-Type: application/json"); header("X-Custom: value"); echo "{}";',
				});
				const headers = await streamed.headers;
				expect(headers['content-type']).toEqual(['application/json']);
				expect(headers['x-custom']).toEqual(['value']);
			});

			it('should return exit code 0 for successful execution', async () => {
				const streamed = await php.runStream({
					code: '<?php echo "success";',
				});
				const exitCode = await streamed.exitCode;
				expect(exitCode).toBe(0);
			});

			it('should return non-zero exit code for PHP fatal errors', async () => {
				const streamed = await php.runStream({
					code: '<?php trigger_error("Fatal error", E_USER_ERROR);',
				});
				const exitCode = await streamed.exitCode;
				expect(exitCode).not.toBe(0);
			});

			it('should return non-zero exit code for syntax errors', async () => {
				const streamed = await php.runStream({
					code: '<?php invalid syntax;',
				});
				const exitCode = await streamed.exitCode;
				expect(exitCode).not.toBe(0);
			});

			it('should handle exit() calls with custom exit codes', async () => {
				const streamed = await php.runStream({
					code: '<?php exit(42);',
				});
				const exitCode = await streamed.exitCode;
				expect(exitCode).toBe(42);
			});

			it('should provide ok() method that reflects HTTP response status', async () => {
				const successStreamed = await php.runStream({
					code: '<?php echo "ok";',
				});
				expect(await successStreamed.ok()).toBe(true);

				const exitCode1Http200 = await php.runStream({
					code: '<?php trigger_error("Fatal error", E_USER_ERROR);',
				});

				/**
				 * trigger_error does not affect the HTTP status code set by PHP.
				 *
				 * Some dev servers that buffer the response will notice the
				 * HTTP status code is 200, the exit code is 1, and will replace
				 * the HTTP status code with 500.
				 *
				 * However, from the PHP process perspective, the status code is
				 * still 200.
				 */
				expect(await exitCode1Http200.ok()).toBe(true);

				const http500 = await php.runStream({
					code: '<?php http_response_code(500); ',
				});
				expect(await http500.ok()).toBe(false);
			});

			it('should provide finished promise that resolves when complete', async () => {
				const streamed = await php.runStream({
					code: '<?php echo "done";',
				});
				await expect(streamed.finished).resolves.toBeUndefined();
				// Should be able to read results after finished
				const text = await streamed.stdoutText;
				expect(text).toBe('done');
			});

			it('should handle HTTP status codes from PHP', async () => {
				const streamed = await php.runStream({
					code: '<?php http_response_code(404); echo "Not found";',
				});
				const statusCode = await streamed.httpStatusCode;
				expect(statusCode).toBe(404);
			});

			it('should work with script files', async () => {
				php.writeFile('/test-script.php', '<?php echo "from file";');
				const streamed = await php.runStream({
					scriptPath: '/test-script.php',
				});
				const text = await streamed.stdoutText;
				expect(text).toBe('from file');
			});

			it('should handle large output correctly', async () => {
				const largeString = 'x'.repeat(10000);
				const streamed = await php.runStream({
					code: `<?php echo str_repeat('x', 10000);`,
				});
				const text = await streamed.stdoutText;
				expect(text).toBe(largeString);
			});

			it('should isolate stderr from stdout', async () => {
				const streamed = await php.runStream({
					code: `<?php
						echo "stdout";
						file_put_contents("php://stderr", "stderr");
					`,
				});
				const stdout = await streamed.stdoutText;
				const stderr = await streamed.stderrText;
				expect(stdout).toBe('stdout');
				expect(stderr).toBe('stderr');
			});

			it('should stream output progressively', async () => {
				const streamed = await php.runStream({
					code: `<?php
					echo "first chunk";
					flush();
					sleep(1);
					flush();
					echo "second chunk";
					flush();
				`,
				});

				const reader = streamed.stdout.getReader();
				const decoder = new TextDecoder();

				// Read first chunk
				const firstResult = await reader.read();
				expect(firstResult.done).toBe(false);
				const firstChunk = decoder.decode(firstResult.value);
				expect(firstChunk).toBe('first chunk');

				// Read second chunk (should come after ~1 second delay)
				const startTime = Date.now();
				let secondStdout = await reader.read();
				// Be lenient – some PHP versions may yield an empty stdout chunk.
				if (secondStdout.value?.length === 0) {
					secondStdout = await reader.read();
					expect(decoder.decode(secondStdout.value)).toBe(
						'second chunk'
					);
				}
				const elapsedTime = Date.now() - startTime;
				expect(elapsedTime).toBeGreaterThanOrEqual(900); // Allow some margin for timing

				expect(secondStdout.done).toBe(false);

				// Should be done now
				let finalResult = await reader.read();
				if (!finalResult.done) {
					finalResult = await reader.read();
				}
				expect(finalResult.done).toBe(true);
			});

			it('should stream multiple small outputs progressively', async () => {
				const streamed = await php.runStream({
					code: `<?php
					for ($i = 1; $i <= 3; $i++) {
						echo "chunk $i ";
						flush();
						usleep(100000); // 100ms
					}
				`,
				});

				const reader = streamed.stdout.getReader();
				const decoder = new TextDecoder();
				const chunks = [];

				// Read all chunks as they come
				while (true) {
					const result = await reader.read();
					if (result.done) break;
					chunks.push(decoder.decode(result.value));
				}

				expect(chunks.length).toBeGreaterThan(1);
				expect(chunks.join('')).toBe('chunk 1 chunk 2 chunk 3 ');
			});

			it('should stream stderr separately from stdout', async () => {
				const streamed = await php.cli([
					'php',
					'-r',
					`
					echo "stdout first";
					flush();
					file_put_contents("php://stderr", "stderr first");
					fflush(STDERR);
					sleep(1);
					echo "stdout second";
					flush();
					file_put_contents("php://stderr", "stderr second");
					fflush(STDERR);
				`,
				]);

				const stdoutReader = streamed.stdout.getReader();
				const stderrReader = streamed.stderr.getReader();
				const decoder = new TextDecoder();

				// Read first stdout chunk
				const firstStdout = await stdoutReader.read();
				expect(decoder.decode(firstStdout.value)).toBe('stdout first');

				// Read first stderr chunk
				const firstStderr = await stderrReader.read();
				expect(decoder.decode(firstStderr.value)).toBe('stderr first');

				// Verify we can read remaining chunks
				let secondStdout = await stdoutReader.read();
				// Be lenient – some PHP versions may yield an empty stdout chunk.
				if (secondStdout.value?.length === 0) {
					secondStdout = await stdoutReader.read();
					expect(decoder.decode(secondStdout.value)).toBe(
						'stdout second'
					);
				}

				const secondStderr = await stderrReader.read();
				expect(decoder.decode(secondStderr.value)).toBe(
					'stderr second'
				);
			});

			/**
			 * Guards against releasing the "request in progress" semaphore
			 * too early in the php.runStream() call.
			 *
			 * ## Context
			 *
			 * A single PHP runtime can only handle one request at a time.
			 * The PHP class calls a `wasm_sapi_handle_request` C function that
			 * initializes the PHP runtime and starts the request. That function is
			 * asynchronous and may yield back to the event loop before the request
			 * is fully handled, the exit code known, and the runtime is cleaned up
			 * and prepared for another request.
			 *
			 * The PHP class uses an async semaphore to protect against calling
			 * `wasm_sapi_handle_request` again while a previous call is still
			 * running.
			 *
			 * However, PR 2266 [1] introduced a regression where the semaphore
			 * was released too early. As a result, it opened the runtime to a
			 * race condition where a subsequent runStream() call tried to run
			 * PHP code on a runtime that was in a middle of handling a request.
			 *
			 * This test ensures that two runStream() calls can be made without
			 * crashing the runtime.
			 *
			 * [1] https://github.com/WordPress/wordpress-playground/pull/2266
			 */
			it('should stagger concurrent runStream() calls', async () => {
				/**
				 * Call runStream() twice without waiting for the first one to finish.
				 */
				const response1Promise = php.runStream({
					code: `<?php
					// Declare a new function to ensure a name collision if
					// the second runStream() call actually runs before this
					// one concludes.
					function unique_fn_name(){};

					// Yield back to the event loop.
					sleep(3);

					// Output some stdout information just to be extra sure the
					// execution actually got here.
					echo "response 1";`,
				});
				const response2Promise = php.runStream({
					code: `<?php
					// Ensure a name collision if the first PHP request haven't
					// concluded yet and the symbol is already registered in the
					// runtime.
					function unique_fn_name(){};

					// Yield back to the event loop. Technically we don't need to
					// do that, but switching stacks catalyzes the crash.
					sleep(1);

					// Output some stdout information just to be extra sure the
					// execution actually got here.
					echo "response 2";`,
				});

				// Only now start awaiting things.
				// First, the streaming response objects
				const response1 = await response1Promise;
				const response2 = await response2Promise;

				// Then, wait for the requests to conclude.
				await response1.finished;
				await response2.finished;

				console.log(await response1.stderrText);
				// Ensure both requests succeeded.
				expect(await response1.ok()).toBe(true);
				expect(await response2.ok()).toBe(true);

				// Confirm the STDOUT output.
				expect(await response1.stdoutText).toBe('response 1');
				expect(await response2.stdoutText).toBe('response 2');
			});
		});

		describe('ENV variables', { skip: options.withXdebug }, () => {
			it('Supports setting per-request ENV variables', async () => {
				const result = await php.run({
					env: {
						OPTIONS: 'WordPress',
					},
					code: `<?php
					echo 'env.OPTIONS: ' . getenv("OPTIONS");
				`,
				});
				expect(result.text).toEqual('env.OPTIONS: WordPress');
			});

			it('Does not remember ENV variables between requests', async () => {
				await php.run({
					env: {
						OPTIONS: 'WordPress',
					},
					code: `<?php
					echo 'env.OPTIONS: ' . getenv("OPTIONS");
				`,
				});
				const result = await php.run({
					code: `<?php
					echo 'env.OPTIONS: ' . getenv("OPTIONS");
				`,
				});
				expect(result.text).toEqual('env.OPTIONS: ');
			});
		});

		describe('exec()', { skip: options.withXdebug }, () => {
			it('echo', async () => {
				const result = await php.run({
					code: `<?php
					echo 'stdout: ' . exec("echo WordPress");
				`,
				});
				expect(result.text).toEqual('stdout: WordPress');
			});
		});

		describe('shell_exec()', { skip: options.withXdebug }, () => {
			it('echo', async () => {
				const result = await php.run({
					code: `<?php
					echo 'stdout: ' . shell_exec("echo WordPress");
				`,
				});
				expect(result.text).toEqual('stdout: WordPress\n');
			});
		});

		/**
		 * @issue https://github.com/WordPress/wordpress-playground/issues/1042
		 */
		describe(
			'dns_* function warnings',
			{ skip: options.withXdebug },
			() => {
				it('dns_check_record should throw a warning', async () => {
					const result = await php.run({
						code: `<?php
					dns_check_record('w.org', 2);
				`,
					});
					expect(result.text).toContain(
						'dns_check_record() always returns false in PHP.wasm.'
					);
				});
			}
		);

		describe('dns_* functions()', { skip: options.withXdebug }, () => {
			beforeEach(async () => {
				await setPhpIniEntries(php, {
					...getPhpIniEntries(php),
					// Disable warnings to test the function output
					error_reporting: 'E_ALL & ~E_WARNING',
				});
			});
			it('dns_check_record should exist and be possible to run', async () => {
				const result = await php.run({
					code: `<?php
					var_dump(dns_check_record('w.org', 2));
				`,
				});
				expect(result.text).toEqual('bool(false)\n');
			});
			it('checkdnsrr should exist and be possible to run', async () => {
				const result = await php.run({
					code: `<?php
					var_dump(checkdnsrr('w.org', 2));
				`,
				});
				expect(result.text).toEqual('bool(false)\n');
			});
			it('dns_get_record should exist and be possible to run', async () => {
				const result = await php.run({
					code: `<?php
					var_dump(dns_get_record('w.org'));
				`,
				});
				expect(result.text).toEqual('array(0) {\n}\n');
			});
			it('dns_get_mx should exist and be possible to run', async () => {
				const result = await php.run({
					code: `<?php
					var_dump(dns_get_mx('', $mxhosts));
				`,
				});
				expect(result.text).toEqual('bool(false)\n');
			});
			it('getmxrr should exist and be possible to run', async () => {
				const result = await php.run({
					code: `<?php
					var_dump(getmxrr('', $mxhosts));
				`,
				});
				expect(result.text).toEqual('bool(false)\n');
			});
		});

		describe('dns constants', { skip: options.withXdebug }, () => {
			it('DNS_* constants should exist', async () => {
				const result = await php.run({
					code: `<?php echo json_encode(array(
						'DNS_A' => DNS_A,
						'DNS_NS' => DNS_NS,
						'DNS_CNAME' => DNS_CNAME,
						'DNS_SOA' => DNS_SOA,
						'DNS_PTR' => DNS_PTR,
						'DNS_HINFO' => DNS_HINFO,
						'DNS_CAA' => DNS_CAA,
						'DNS_MX' => DNS_MX,
						'DNS_TXT' => DNS_TXT,
						'DNS_SRV' => DNS_SRV,
						'DNS_NAPTR' => DNS_NAPTR,
						'DNS_AAAA' => DNS_AAAA,
						'DNS_A6' => DNS_A6,
						'DNS_ANY' => DNS_ANY,
						'DNS_ALL' => DNS_ALL,
					));`,
				});
				expect(result.json).toEqual({
					DNS_A: 1,
					DNS_NS: 2,
					DNS_CNAME: 16,
					DNS_SOA: 32,
					DNS_PTR: 2048,
					DNS_HINFO: 4096,
					DNS_CAA: 8192,
					DNS_MX: 16384,
					DNS_TXT: 32768,
					DNS_SRV: 33554432,
					DNS_NAPTR: 67108864,
					DNS_AAAA: 134217728,
					DNS_A6: 16777216,
					DNS_ANY: 268435456,
					DNS_ALL: 251721779,
				});
			});
		});

		describe('popen()', () => {
			it('popen("echo", "r")', async () => {
				const result = await php.run({
					code: `<?php
					$fp = popen("echo WordPress", "r");
					echo 'stdout: ' . fread($fp, 1024);
					pclose($fp);
				`,
				});
				expect(result.text).toEqual('stdout: WordPress\n');
			});

			it('popen("cat", "w")', async () => {
				try {
					const result = await php.run({
						code: `<?php
						$fp = popen("cat > out", "w");
						fwrite($fp, "WordPress\n");
						fclose($fp);

						sleep(1); // @TODO: call js_wait_until_process_exits() in fclose();

						$fp = popen("cat out", "r");
						echo 'stdout: ' . fread($fp, 1024);
						pclose($fp);
					`,
					});

					expect(result.text).toEqual('stdout: WordPress\n');
				} finally {
					rmSync('out', { force: true });
				}
			});
		});

		describe('proc_open()', () => {
			// This test applies only to these PHP versions
			// due to a new patch that replaces the use of
			// EMULATE_FUNCTION_POINTER_CASTS option.
			if (phpVersion === '7.4') {
				it('resolves without crashing with unknown function signature mismatch', async () => {
					const promise = php.runStream({
						code: `<?php
						$descriptorspec = array(
							1 => array("pipe","w")
						);

						$res = proc_open(
							"echo 'Hello World!'",
							$descriptorspec,
							$pipes
						);

						$res = proc_open(
							"echo 'Hello World!'",
							$descriptorspec,
							$pipes
						);
						`,
					});

					await expect(promise).resolves.not.toThrow(
						/null function or function signature mismatch/
					);
				});
			}

			it('echo "WordPress"; stdin=file (empty), stdout=file, stderr=file, file_get_contents', async () => {
				const result = await php.run({
					code: `<?php
					file_put_contents('/tmp/process_in', '');
					$res = proc_open(
						"echo WordPress",
						array(
							array("file","/tmp/process_in", "r"),
							array("file","/tmp/process_out", "w"),
							array("file","/tmp/process_err", "w"),
						),
						$pipes
					);
					proc_close($res);

					$stdout = file_get_contents("/tmp/process_out");
					$stderr = file_get_contents("/tmp/process_err");

					echo 'stdout: ' . $stdout . "";
					echo 'stderr: ' . $stderr . PHP_EOL;
				`,
				});
				expect(result.text).toEqual('stdout: WordPress\nstderr: \n');
			});

			it('echo "WordPress"; stdin=file (empty), stdout=pipe, stderr=pipe, stream_get_contents', async () => {
				const result = await php.run({
					code: `<?php
					file_put_contents('/tmp/process_in', '');
					$res = proc_open(
						"echo WordPress",
						array(
							array("file","/tmp/process_in", "r"),
							array("pipe","w"),
							array("pipe","w"),
						),
						$pipes
					);

					$stdout = stream_get_contents($pipes[1]);
					$stderr = stream_get_contents($pipes[2]);
					proc_close($res);

					echo 'stdout: ' . $stdout . "";
					echo 'stderr: ' . $stderr . PHP_EOL;
				`,
				});
				expect(result.text).toEqual('stdout: WordPress\nstderr: \n');
			});

			it('echo "WordPress"; stdin=file (empty), stdout=pipe, stderr=pipe, fread', async () => {
				const result = await php.run({
					code: `<?php
					file_put_contents('/tmp/process_in', '');
					$res = proc_open(
						"echo WordPress",
						array(
							array("file","/tmp/process_in", "r"),
							array("pipe","w"),
							array("pipe","w"),
						),
						$pipes
					);

					$stdout = fread($pipes[1], 1024);
					$stderr = fread($pipes[2], 1024);
					proc_close($res);

					echo 'stdout: ' . $stdout . "";
					echo 'stderr: ' . $stderr . PHP_EOL;
				`,
				});
				expect(result.text).toEqual('stdout: WordPress\nstderr: \n');
			});

			it(
				'cat: stdin=pipe, stdout=file, stderr=file, file_get_contents',
				async () => {
					console.log({ withXdebug: options.withXdebug });
					const result = await php.run({
						code: `<?php
						$res = proc_open(
							"cat",
							array(
								array("pipe","r"),
								array("file","/tmp/process_out", "w"),
								array("file","/tmp/process_err", "w"),
							),
							$pipes
						);
						fwrite($pipes[0], 'WordPress\n');

						proc_close($res);

						$stdout = file_get_contents("/tmp/process_out");
						$stderr = file_get_contents("/tmp/process_err");

						echo 'stdout: ' . $stdout . "";
						echo 'stderr: ' . $stderr . PHP_EOL;
					`,
					});
					expect(result.text).toEqual(
						'stdout: WordPress\nstderr: \n'
					);
				},
				{ timeout: 10000 }
			);

			it('cat: stdin=file, stdout=file, stderr=file, file_get_contents', async () => {
				const result = await php.run({
					code: `<?php
					file_put_contents('/tmp/process_in', 'WordPress\n');
					$res = proc_open(
						"cat",
						array(
							array("file","/tmp/process_in", "r"),
							array("file","/tmp/process_out", "w"),
							array("file","/tmp/process_err", "w"),
						),
						$pipes
					);
					proc_close($res);

					$stdout = file_get_contents("/tmp/process_out");
					$stderr = file_get_contents("/tmp/process_err");

					echo 'stdout: ' . $stdout . "";
					echo 'stderr: ' . $stderr . PHP_EOL;
				`,
				});

				expect(result.text).toEqual('stdout: WordPress\nstderr: \n');
			});

			it('Passes the cwd and env arguments', async () => {
				const handler = createSpawnHandler(
					async (
						command: string[],
						processApi: any,
						options: any
					) => {
						processApi.stdout(options.cwd + '\n');
						for (const key in options.env) {
							processApi.stdout(
								key + '=' + options.env[key] + '\n'
							);
						}

						// Go async for a moment to let PHP catch up with the stdout
						// data. Otherwise, exit(0) will close the streams before
						// the synchronous code has a chance to read them.
						await new Promise((resolve) => setTimeout(resolve, 1));
						processApi.exit(0);
					}
				);
				php.setSpawnHandler(handler);

				const result = await php.run({
					code: `<?php
					$res = proc_open(
						"cat",
						array(
							array("pipe","r"),
							array("file","/tmp/process_out", "w"),
							array("file","/tmp/process_err", "w"),
						),
						$pipes,
						'/wordpress',
						array("FOO" => "BAR", "BAZ" => "QUX")
					);
					proc_close($res);
					$stdout = file_get_contents("/tmp/process_out");
					$stderr = file_get_contents("/tmp/process_err");
					echo 'stdout: ' . $stdout . "";
					echo 'stderr: ' . $stderr . PHP_EOL;
				`,
				});

				expect(result.text).toEqual(
					'stdout: /wordpress\nFOO=BAR\nBAZ=QUX\nstderr: \n'
				);
			});

			async function pygmalionToProcess(cmd = 'less') {
				return await php.run({
					code: `<?php
				$fd = fopen( "php://temp", "r+" );
				fputs( $fd, ${phpVar(pygmalion)} );
				rewind( $fd );

				$descriptorspec = array(
					0 => $fd,
					1 => fopen('php://stdout', 'wb'),
					2 => fopen('/tmp/stderr', 'wb')
				);
				$fp = proc_open( ${phpVar(cmd)}, $descriptorspec, $pipes );
				proc_close( $fp );
				`,
				});
			}

			it('Pipe pygmalion from a file to STDOUT through a synchronous JavaScript callback', async () => {
				const handler = createSpawnHandler(
					async (command: string[], processApi: any) => {
						processApi.on('stdin', (data: Uint8Array) => {
							processApi.stdout(data);
						});

						// Give the streams a chance to write the data. All the
						// data is written synchronously so a single event loop
						// tick should be enough.
						await new Promise((resolve) => {
							setTimeout(() => {
								processApi.exit(0);
								resolve(undefined);
							});
						});
					}
				);

				php.setSpawnHandler(handler);
				const result = await pygmalionToProcess();

				expect(result.text).toEqual(pygmalion);
			});

			it('Pipe pygmalion from a file to STDOUT through a asynchronous JavaScript callback', async () => {
				const handler = createSpawnHandler(
					async (command: string[], processApi: any) => {
						await new Promise((resolve) => {
							setTimeout(resolve, 1000);
						});
						processApi.on('stdin', (data: Uint8Array) => {
							processApi.stdout(data);
						});
						await new Promise((resolve) => {
							setTimeout(resolve, 1000);
						});
						processApi.exit(0);
					}
				);

				php.setSpawnHandler(handler);
				const result = await pygmalionToProcess();

				expect(result.text).toEqual(pygmalion);
			});

			it('Pipe pygmalion from a file to STDOUT through "cat"', async () => {
				const result = await pygmalionToProcess('cat');
				expect(result.text).toEqual(pygmalion);
			});

			it('Stdout waits for asynchronous data to arrive', async () => {
				const handler = createSpawnHandler(
					async (command: string[], processApi: any) => {
						processApi.stdout(
							new TextEncoder().encode('Hello World!')
						);
						await new Promise((resolve) => {
							setTimeout(() => {
								processApi.stdout(
									new TextEncoder().encode('Hello again!')
								);
								processApi.exit(0);
								resolve(undefined);
							}, 1000);
						});
					}
				);

				php.setSpawnHandler(handler);

				const result = await php.run({
					code: `<?php
				$descriptorspec = array(
					1 => array("pipe","w")
				);
				$proc = proc_open( "fetch", $descriptorspec, $pipes );
				echo fread($pipes[1], 1024);
				echo "\\n";
				// This makes the test pass with JSPI:
				echo fread($pipes[1], 1024);
				proc_close( $proc );
				`,
				});

				expect(result.text).toEqual('Hello World!\nHello again!');
			});

			it('Non-blocking file descriptors do not wait for asynchronous data', async () => {
				const handler = createSpawnHandler(
					async (command: string[], processApi: any) => {
						// Send initial data immediately
						processApi.stdout(
							new TextEncoder().encode('Initial data\n')
						);

						// Send more data after a delay
						await new Promise((resolve) =>
							setTimeout(resolve, 500)
						);
						processApi.stdout(
							new TextEncoder().encode('Delayed data\n')
						);
						processApi.exit(0);
					}
				);

				php.setSpawnHandler(handler);

				const result = await php.run({
					code: `<?php
				$descriptorspec = array(
					1 => array("pipe","w")
				);
				$proc = proc_open( "fetch", $descriptorspec, $pipes );

				// Make the stream non-blocking
				stream_set_blocking($pipes[1], false);

				// First read should get initial data immediately
				$data1 = fread($pipes[1], 1024);
				echo "First read: " . json_encode($data1) . "\\n";

				// Second read should return empty string immediately (non-blocking)
				$data2 = fread($pipes[1], 1024);
				echo "Second read (immediate): " . json_encode($data2) . "\\n";

				// Wait a bit and try again - should get the delayed data
				sleep(1);
				$data3 = fread($pipes[1], 1024);
				echo "Third read (after delay): " . json_encode($data3) . "\\n";

				// Fourth read should be empty again
				$data4 = fread($pipes[1], 1024);
				echo "Fourth read: " . json_encode($data4) . "\\n";

				proc_close( $proc );
				`,
				});

				expect(result.text).toEqual(
					[
						`First read: "Initial data\\n"`,
						`Second read (immediate): ""`,
						`Third read (after delay): "Delayed data\\n"`,
						`Fourth read: ""`,
						'',
					].join('\n')
				);
			});

			it('Can poll non-blocking streams until data arrives', async () => {
				const handler = createSpawnHandler(
					async (command: string[], processApi: any) => {
						// Send data in chunks with delays
						await new Promise((resolve) =>
							setTimeout(resolve, 200)
						);
						processApi.stdout(
							new TextEncoder().encode('Chunk 1\n')
						);

						await new Promise((resolve) =>
							setTimeout(resolve, 400)
						);
						processApi.stdout(
							new TextEncoder().encode('Chunk 2\n')
						);

						await new Promise((resolve) =>
							setTimeout(resolve, 600)
						);
						processApi.exit(0);
					}
				);

				php.setSpawnHandler(handler);

				const result = await php.run({
					code: `<?php
				$descriptorspec = array(
					1 => array("pipe","w")
				);
				$proc = proc_open( "fetch", $descriptorspec, $pipes );

				// Make the stream non-blocking
				stream_set_blocking($pipes[1], false);

				$chunks = array();
				$attempts = 0;
				$maxAttempts = 20;

				// Poll until we get all data or reach max attempts
				while ($attempts < $maxAttempts && !feof($pipes[1])) {
					$data = fread($pipes[1], 1024);
					if ($data !== "") {
						$chunks[] = $data;
						echo "Got chunk: " . json_encode($data) . "\\n";
					} else {
						echo "No data available, attempt " . ($attempts + 1) . "\\n";
					}
					$attempts++;
					usleep(100000); // 100ms between attempts
				}

				echo "Total chunks received: " . count($chunks) . "\\n";
				echo "Combined data: " . json_encode(implode("", $chunks)) . "\\n";

				proc_close( $proc );
				`,
				});

				// The exact output may vary due to timing, but we should see:
				// - Multiple "No data available" messages
				// - Two chunks of data received
				// - Total of 2 chunks
				expect(result.text).toContain('Got chunk: "Chunk 1\\n"');
				expect(result.text).toContain('Got chunk: "Chunk 2\\n"');
				expect(result.text).toContain('Total chunks received: 2');
				expect(result.text).toContain(
					'Combined data: "Chunk 1\\nChunk 2\\n"'
				);
				expect(result.text).toContain('No data available');
			});

			it(
				'feof() returns true when exhausted the synchronous data',
				{ skip: options.withXdebug },
				async () => {
					const handler = createSpawnHandler(
						async (command: string[], processApi: any) => {
							processApi.stdout(
								new TextEncoder().encode('Hello World!\n')
							);
							processApi.exit(0);
						}
					);

					php.setSpawnHandler(handler);

					const result = await php.run({
						code: `<?php
				$descriptorspec = array(
					1 => array("pipe","w")
				);
				$proc = proc_open("echo 'Hello World'", $descriptorspec, $pipes);
				var_dump(fread($pipes[1], 1024)); // "Hello World"
				var_dump(fread($pipes[1], 1024)); // ""
				var_dump(fread($pipes[1], 1024)); // ""
				var_dump($pipes[1]);              // resource(1)
				var_dump(feof($pipes[1]));        // true
				pclose($pipes[1]);
				`,
					});

					expect(result.text).toEqual(
						[
							`string(13) "Hello World!\n"`,
							`string(0) ""`,
							`string(0) ""`,
							`resource(3) of type (stream)`,
							`bool(true)`,
							'',
						].join('\n')
					);
				}
			);

			it(
				'feof() returns true when exhausted the asynchronous data',
				{ skip: options.withXdebug },
				async () => {
					const handler = createSpawnHandler(
						async (command: string[], processApi: any) => {
							processApi.stdout(
								new TextEncoder().encode('Hello World!\n')
							);
							await new Promise((resolve) =>
								setTimeout(resolve, 200)
							);
							processApi.stdout(
								new TextEncoder().encode('Hello Again!\n')
							);
							await new Promise((resolve) =>
								setTimeout(resolve, 400)
							);
							processApi.exit(0);
						}
					);

					php.setSpawnHandler(handler);

					const result = await php.run({
						code: `<?php
				$descriptorspec = array(
					1 => array("pipe","w")
				);
				$proc = proc_open("echo 'Hello World'; sleep 1; echo 'Hello Again'", $descriptorspec, $pipes);
				var_dump(fread($pipes[1], 1024)); // "Hello World"
				var_dump(fread($pipes[1], 1024)); // "Hello Again"
				var_dump(fread($pipes[1], 1024)); // ""
				var_dump($pipes[1]);              // resource(1)
				var_dump(feof($pipes[1]));        // true
				pclose($pipes[1]);
				`,
					});

					expect(result.text).toEqual(
						[
							`string(13) "Hello World!\n"`,
							`string(13) "Hello Again!\n"`,
							`string(0) ""`,
							`resource(3) of type (stream)`,
							`bool(true)`,
							'',
						].join('\n')
					);
				}
			);

			it('Gives access to command and arguments when array type is used in proc_open', async () => {
				let command = '';
				let args: string[] = [];
				php.setSpawnHandler((cmd, argc) => {
					command = cmd;
					args = argc;
					return {
						stdout: {
							on: () => {},
						},
						stderr: {
							on: () => {},
						},
						stdin: {
							write: () => {},
							end: () => {},
						},
						on: (evt: string, callback: () => void) => {
							if (evt === 'spawn') {
								callback();
							}
						},
						kill: () => {},
					} as any;
				});
				await php.run({
					code: `<?php

						$command = [ 'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing' ];

						$descriptorspec = [
							0 => [ "pipe", "r" ],
							1 => [ "pipe", "w" ],
							2 => [ "pipe", "w" ]
						];

						proc_open( $command, $descriptorspec, $pipes );`,
				});
				expect(command).toEqual('lorem');
				expect(args.toString()).toEqual(
					'ipsum,dolor,sit,amet,consectetur,adipiscing'
				);
			});

			it('Uses the three descriptor specs', async () => {
				const result = await php.run({
					code: `<?php

					$command = "echo 'Hello World!'";

					$descriptorspec = [
						0 => [ "pipe", "r" ],
						1 => [ "pipe", "w" ],
						2 => [ "pipe", "w" ]
					];

					$res = proc_open( $command, $descriptorspec, $pipes );

					$stdout = stream_get_contents($pipes[1]);

					proc_close($res);

					echo $stdout;
				`,
				});
				expect(result.text).toEqual('Hello World!\n');
			});

			it('Uses only stdin and stdout descriptor specs', async () => {
				php.setSpawnHandler(spawn as any);

				const result = await php.run({
					code: `<?php

					$command = "echo 'Hello World!'";

					$descriptorspec = [
						0 => [ "pipe", "r" ],
						1 => [ "pipe", "w" ]
					];

					$res = proc_open( $command, $descriptorspec, $pipes );

					$stdout = stream_get_contents($pipes[1]);

					proc_close($res);

					echo $stdout;
				`,
				});
				expect(result.text).toEqual('Hello World!\n');
			});

			it('Uses only stdout and stderr descriptor specs', async () => {
				const result = await php.run({
					code: `<?php

					$command = "echo 'Hello World!'";

					$descriptorspec = [
						1 => [ "pipe", "w" ],
						2 => [ "pipe", "w" ]
					];

					$res = proc_open( $command, $descriptorspec, $pipes );

					$stdout = stream_get_contents($pipes[1]);

					proc_close($res);

					echo $stdout;
				`,
				});
				expect(result.text).toEqual('Hello World!\n');
			});

			it('Calls proc_open two times in a row', async () => {
				const result = await php.run({
					code: `<?php

					$command = "echo 'First hello world!'";

					$descriptorspec = [
						1 => [ "pipe", "w" ],
						2 => [ "pipe", "w" ]
					];

					$res = proc_open( $command, $descriptorspec, $pipes );

					$stdout = stream_get_contents($pipes[1]);

					proc_close($res);

					echo $stdout;

					$command = "echo 'Second hello world!'";

					$descriptorspec = [
						1 => [ "pipe", "w" ],
						2 => [ "pipe", "w" ]
					];

					$res = proc_open( $command, $descriptorspec, $pipes );

					$stdout = stream_get_contents($pipes[1]);

					proc_close($res);

					echo $stdout;`,
				});
				expect(result.text).toEqual(
					'First hello world!\nSecond hello world!\n'
				);
			});

			it('A process that reports being spawned does not timeout', async () => {
				let spawnHandlerCalled = false;
				const handler = createSpawnHandler(
					async (command: string[], processApi: any) => {
						spawnHandlerCalled = true;
						// Avoid the timeout by reporting that the process has been spawned
						processApi.notifySpawn();
						// Take 6 seconds to exit
						await new Promise((resolve) =>
							setTimeout(resolve, 6000)
						);
						processApi.exit(0);
					}
				);

				php.setSpawnHandler(handler);

				const startTime = Date.now();
				await php.run({
					code: `<?php
					$res = proc_open(
						"hanging_command",
						array(
							array("pipe","r"),
							array("pipe","w"),
							array("pipe","w"),
						),
						$pipes
					);
					// Wait for the process to exit
					proc_close($res);
				`,
				});
				const elapsed = Date.now() - startTime;
				// Should not timeout after 5 seconds
				expect(elapsed).toBeGreaterThan(6000);
				expect(elapsed).toBeLessThan(6500);
				expect(spawnHandlerCalled).toBe(true);
			}, 10000);

			it('Handle process spawn timeout gracefully', async () => {
				let spawnHandlerCalled = false;
				const handler = createSpawnHandler(async () => {
					spawnHandlerCalled = true;
					// Don't call processApi.notifySpawn() or processApi.exit()
					// to simulate a hanging process that never starts
					await new Promise(() => {}); // Never resolves
				});

				php.setSpawnHandler(handler);

				const startTime = Date.now();
				try {
					await php.run({
						code: `<?php
							$res = proc_open(
								"hanging_command",
								array(
									array("pipe","r"),
									array("pipe","w"),
									array("pipe","w"),
								),
								$pipes
							);
							// This will block – it's a blocking pipe and will never
							// output any data.
							fread($pipes[1], 1024);
						`,
					});
					// Should not reach here
					expect(false).toBe(true);
				} catch (e) {
					console.log(e);
					const elapsed = Date.now() - startTime;
					// Should timeout around 5 seconds (allowing some margin)
					expect(elapsed).toBeGreaterThan(4500);
					expect(elapsed).toBeLessThan(6000);
					expect(spawnHandlerCalled).toBe(true);
				}
			}, 10000);
		});

		describe('Filesystem', { skip: options.withXdebug }, () => {
			// Unit tests for the filesystem methods of the
			// PHP runtime.
			it('writeFile() should create a file when it does not exist', () => {
				php.writeFile(testFilePath, 'Hello World!');
				expect(php.fileExists(testFilePath)).toEqual(true);
			});

			it('writeFile() should throw a useful error when parent directory does not exist', () => {
				expect(() => {
					php.writeFile('/a/b/c/d/e/f', 'Hello World!');
				}).toThrowError(
					'Could not write to "/a/b/c/d/e/f": There is no such file or directory OR the parent directory does not exist.'
				);
			});

			it('writeFile() should throw a useful error when the specified path is a directory', () => {
				php.mkdir('/dir');
				expect(() => {
					php.writeFile('/dir', 'Hello World!');
				}).toThrowError(
					new Error(
						`Could not write to "/dir": There is a directory under that path.`
					)
				);
			});

			it('writeFile() should overwrite a file when it exists', () => {
				php.writeFile(testFilePath, 'Hello World!');
				php.writeFile(testFilePath, 'New contents');
				expect(php.readFileAsText(testFilePath)).toEqual(
					'New contents'
				);
			});

			it('readFileAsText() should read a file as text', () => {
				php.writeFile(testFilePath, 'Hello World!');
				expect(php.readFileAsText(testFilePath)).toEqual(
					'Hello World!'
				);
			});

			it('readFileAsBuffer() should read a file as buffer', () => {
				php.writeFile(testFilePath, 'Hello World!');
				expect(php.readFileAsBuffer(testFilePath)).toEqual(
					new TextEncoder().encode('Hello World!')
				);
			});

			it('unlink() should delete a file', () => {
				php.writeFile(testFilePath, 'Hello World!');
				expect(php.fileExists(testFilePath)).toEqual(true);
				php.unlink(testFilePath);
				expect(php.fileExists(testFilePath)).toEqual(false);
			});

			it('mv() should move a file', () => {
				php.mkdir(testDirPath);
				const file1 = testDirPath + '/1.txt';
				const file2 = testDirPath + '/2.txt';
				php.writeFile(file1, '1');
				php.mv(file1, file2);
				expect(php.fileExists(file1)).toEqual(false);
				expect(php.fileExists(file2)).toEqual(true);
				expect(php.readFileAsText(file2)).toEqual('1');
			});

			it('mv() should replace target file if it exists', () => {
				php.mkdir(testDirPath);
				const file1 = testDirPath + '/1.txt';
				const file2 = testDirPath + '/2.txt';
				php.writeFile(file1, '1');
				php.writeFile(file2, '2');
				php.mv(file1, file2);
				expect(php.fileExists(file1)).toEqual(false);
				expect(php.fileExists(file2)).toEqual(true);
				expect(php.readFileAsText(file2)).toEqual('1');
			});

			it('mv() should throw a useful error when source file does not exist', () => {
				php.mkdir(testDirPath);
				const file1 = testDirPath + '/1.txt';
				const file2 = testDirPath + '/2.txt';
				expect(() => {
					php.mv(file1, file2);
				}).toThrowError(
					`Could not move ${testDirPath}/1.txt to ${testDirPath}/2.txt: There is no such file or directory OR the parent directory does not exist.`
				);
			});

			it('mv() should throw a useful error when target directory does not exist', () => {
				php.mkdir(testDirPath);
				const file1 = testDirPath + '/1.txt';
				const file2 = testDirPath + '/nowhere/2.txt';
				php.writeFile(file1, '1');
				expect(() => {
					php.mv(file1, file2);
				}).toThrowError(
					`Could not move ${testDirPath}/1.txt to ${testDirPath}/nowhere/2.txt: There is no such file or directory OR the parent directory does not exist.`
				);
			});

			it('mv() from NODEFS to MEMFS should work', () => {
				mkdirSync(__dirname + '/test-data/mount-contents/a/b', {
					recursive: true,
				});
				writeFileSync(
					__dirname + '/test-data/mount-contents/a/b/test.txt',
					'contents'
				);
				php.mount(
					'/nodefs',
					createNodeFsMountHandler(
						__dirname + '/test-data/mount-contents'
					)
				);
				php.mkdir('/nodefs/tmp-dir-for-mv-test');
				expect(
					existsSync(
						__dirname +
							'/test-data/mount-contents/tmp-dir-for-mv-test'
					)
				).toEqual(true);

				php.writeFile(
					'/nodefs/tmp-dir-for-mv-test/test.txt',
					'contents'
				);
				php.mv(
					'/nodefs/tmp-dir-for-mv-test',
					'/tmp/tmp-dir-for-mv-test'
				);
				expect(
					existsSync(
						__dirname +
							'/test-data/mount-contents/tmp-dir-for-mv-test'
					)
				).toEqual(false);
				expect(php.fileExists('/nodefs/tmp-dir-for-mv-test')).toEqual(
					false
				);
				expect(php.fileExists('/tmp/tmp-dir-for-mv-test')).toEqual(
					true
				);
				expect(
					php.readFileAsText('/tmp/tmp-dir-for-mv-test/test.txt')
				).toEqual('contents');

				rmSync(__dirname + '/test-data/mount-contents/a/b/test.txt', {
					recursive: true,
				});
			});

			it('mv() from MEMFS to NODEFS should work', () => {
				php.mount(
					'/nodefs',
					createNodeFsMountHandler(
						__dirname + '/test-data/mount-contents'
					)
				);

				php.writeFile('/nodefs/tmp-file-for-mv-test.txt', 'contents');
				php.mv('/nodefs/tmp-file-for-mv-test.txt', '/tmp/test.txt');
				expect(
					php.fileExists('/nodefs/tmp-file-for-mv-test.txt')
				).toEqual(false);
				expect(php.fileExists('/tmp/test.txt')).toEqual(true);
				expect(php.readFileAsText('/tmp/test.txt')).toEqual('contents');
			});

			it('mkdir() should create a directory', () => {
				php.mkdir(testDirPath);
				expect(php.fileExists(testDirPath)).toEqual(true);
			});

			it('mkdir() should create all nested directories', () => {
				php.mkdir(testDirPath + '/nested/doubly/triply');
				expect(
					php.isDir(testDirPath + '/nested/doubly/triply')
				).toEqual(true);
			});

			it('unlink() should throw a useful error when parent directory does not exist', () => {
				expect(() => {
					php.unlink('/a/b/c/d/e/f');
				}).toThrowError(
					'Could not unlink "/a/b/c/d/e/f": There is no such file or directory OR the parent directory does not exist.'
				);
			});

			it('isDir() should correctly distinguish between a file and a directory', () => {
				php.mkdir(testDirPath);
				expect(php.fileExists(testDirPath)).toEqual(true);
				expect(php.isDir(testDirPath)).toEqual(true);

				php.writeFile(testFilePath, 'Hello World!');
				expect(php.fileExists(testFilePath)).toEqual(true);
				expect(php.isDir(testFilePath)).toEqual(false);
			});

			it('isDir() should correctly distinguish between symlinks to a file and a directory', () => {
				php.writeFile(testFilePath, 'Hello World!');
				php.symlink(testFilePath, '/test-file-link');
				php.mkdir(testDirPath);
				php.symlink(testDirPath, '/test-dir-link');

				expect(php.isDir('/test-file-link')).toEqual(false);
				expect(php.isDir('/test-dir-link')).toEqual(true);
			});

			it('isFile() should correctly distinguish between a file and a directory', () => {
				php.writeFile(testFilePath, 'Hello World!');
				expect(php.fileExists(testFilePath)).toEqual(true);
				expect(php.isFile(testFilePath)).toEqual(true);

				php.mkdir(testDirPath);
				expect(php.fileExists(testDirPath)).toEqual(true);
				expect(php.isFile(testDirPath)).toEqual(false);
			});

			it('isFile() should correctly distinguish between symlinks to a file and a directory', () => {
				php.writeFile(testFilePath, 'Hello World!');
				php.symlink(testFilePath, '/test-file-link');
				php.mkdir(testDirPath);
				php.symlink(testDirPath, '/test-dir-link');

				expect(php.isFile('/test-file-link')).toEqual(true);
				expect(php.isFile('/test-dir-link')).toEqual(false);
			});

			it('symlink() should create a symlink to a file', () => {
				const filePath = `${testDirPath}/test.txt`;
				const fileContent = 'link to me';
				const linkPath = `${testDirPath}/test-link`;

				php.mkdir(testDirPath);
				php.writeFile(filePath, fileContent);
				php.symlink(filePath, linkPath);

				expect(php.readFileAsText(linkPath)).toEqual(fileContent);
			});

			it('symlink() should create a symlink to a directory', () => {
				const testSubdirPath = `${testDirPath}/subdir`;
				const filePath = `${testSubdirPath}/test.txt`;
				const fileContent = 'Hello, World!';
				const linkPath = `${testDirPath}/test-link`;

				php.mkdir(testSubdirPath);
				php.writeFile(filePath, fileContent);
				php.symlink(testSubdirPath, linkPath);

				expect(php.readFileAsText(`${linkPath}/test.txt`)).toEqual(
					fileContent
				);
			});

			it('symlink() should create a symlink to a symlink', () => {
				const filePath = `${testDirPath}/test.txt`;
				const fileContent = 'link to me';
				const sourceLinkPath = `${testDirPath}/test-link`;
				const linkToLinkPath = `${testDirPath}/test-link-to-link`;

				php.mkdir(testDirPath);
				php.writeFile(filePath, fileContent);
				php.symlink(filePath, sourceLinkPath);
				php.symlink(sourceLinkPath, linkToLinkPath);

				expect(php.readFileAsText(linkToLinkPath)).toEqual(fileContent);
			});

			it('isSymlink() should return true for a path to a symlink', () => {
				const filePath = `${testDirPath}/test.txt`;
				const linkPath = `${testDirPath}/test-link`;

				php.mkdir(testDirPath);
				php.writeFile(filePath, '');
				php.symlink(filePath, linkPath);

				expect(php.isSymlink(linkPath)).toEqual(true);
			});

			it('isSymlink() should correctly distinguish between a symlink and a file', () => {
				const filePath = `${testDirPath}/test.txt`;

				php.mkdir(testDirPath);
				php.writeFile(filePath, '');

				expect(php.isSymlink(filePath)).toEqual(false);
			});

			it('isSymlink() should correctly distinguish between a symlink and a directory', () => {
				php.mkdir(testDirPath);
				expect(php.isSymlink(testDirPath)).toEqual(false);
			});

			it('readlink() should read symlink target', () => {
				php.mkdir(testDirPath);
				php.symlink(testDirPath, '/test-link');
				expect(php.readlink('/test-link')).toEqual(testDirPath);
			});

			it('readlink() should throw when reading non-existent paths, files, or directories', () => {
				expect(() => php.readlink('/non-existent')).toThrowError();

				php.writeFile(testFilePath, 'Hello World!');
				// confirm assumption that file exists
				expect(php.isFile(testFilePath)).toEqual(true);
				expect(() => php.readlink(testFilePath)).toThrowError();

				php.mkdir(testDirPath);
				// confirm assumption that dir exists
				expect(php.isDir(testDirPath)).toEqual(true);
				expect(() => php.readlink(testDirPath)).toThrowError();
			});

			it('realpath() should resolve symlink target', () => {
				php.mkdir(testDirPath);
				php.symlink(testDirPath, '/test-link');
				expect(php.realpath('/test-link')).toEqual(testDirPath);
			});

			it('realpath() should resolve a path containing a symlinked directory', () => {
				const testSubdirPath = `${testDirPath}/subdir`;
				const targetFilePath = `${testSubdirPath}/test.txt`;
				php.mkdir(testSubdirPath);
				php.writeFile(targetFilePath, 'Hello World!');

				const symlinkSubdirPath = `${testDirPath}/subdir-link`;
				php.symlink(testSubdirPath, symlinkSubdirPath);

				expect(php.realpath(`${symlinkSubdirPath}/test.txt`)).toEqual(
					targetFilePath
				);
			});

			it('realpath() should resolve a path containing a symlinked directory and a symlinked target', () => {
				php.mkdir(testDirPath);

				const testSubdirPath = `${testDirPath}/subdir`;
				const targetFilePath = `${testSubdirPath}/test.txt`;
				php.mkdir(testSubdirPath);
				php.writeFile(targetFilePath, 'Hello World!');

				const symlinkSubdirPath = `${testDirPath}/subdir-link`;
				php.symlink(testSubdirPath, symlinkSubdirPath);
				const symlinkTargetPath = `${symlinkSubdirPath}/test-link.txt`;
				php.symlink(targetFilePath, symlinkTargetPath);

				expect(php.realpath(symlinkTargetPath)).toEqual(targetFilePath);
			});

			it('realpath() should return the path itself if it does not contain a symlink', () => {
				php.mkdir(testDirPath);

				const filePath = `${testDirPath}/test.txt`;
				php.writeFile(filePath, 'Hello World!');

				expect(php.realpath(filePath)).toEqual(filePath);
			});

			it('realpath() should throw when unable to resolve path', () => {
				expect(() => php.realpath('/non-existent')).toThrowError();
			});

			it('listFiles() should return a list of files in a directory', () => {
				php.mkdir(testDirPath);
				php.writeFile(testDirPath + '/test.txt', 'Hello World!');
				php.writeFile(testDirPath + '/test2.txt', 'Hello World!');
				expect(php.listFiles(testDirPath)).toEqual([
					'test.txt',
					'test2.txt',
				]);
			});

			it('listFiles() option prependPath should prepend given path to all files returned', () => {
				php.mkdir(testDirPath);
				php.writeFile(testDirPath + '/test.txt', 'Hello World!');
				php.writeFile(testDirPath + '/test2.txt', 'Hello World!');
				expect(
					php.listFiles(testDirPath, { prependPath: true })
				).toEqual([
					testDirPath + '/test.txt',
					testDirPath + '/test2.txt',
				]);
			});
		});
	});
});

describe('sandboxedSpawnHandlerFactory', () => {
	const phpVersion = RecommendedPHPVersion;
	let php: PHP;
	let spawnedPhp: SpawnedPHP;
	let processManager: PHPProcessManager;
	beforeEach(async () => {
		processManager = new PHPProcessManager({
			phpFactory: async () => {
				const php = new PHP(
					await loadNodeRuntime(phpVersion as any, {})
				);
				php.mkdir('/tmp/shared-test-directory');
				php.chdir('/tmp/shared-test-directory');

				php.writeFile(
					'/tmp/shared-test-directory/README.md',
					'Hello, world!'
				);
				php.mkdir('/tmp/shared-test-directory/code');
				php.writeFile(
					'/tmp/shared-test-directory/code/index.php',
					'Hello, world!'
				);
				await php.setSpawnHandler(
					sandboxedSpawnHandlerFactory(() =>
						processManager.acquirePHPInstance()
					)
				);
				return php;
			},
			maxPhpInstances: 5,
		});
		spawnedPhp = await processManager.acquirePHPInstance();
		php = spawnedPhp.php;
	});
	afterEach(async () => {
		await processManager[Symbol.asyncDispose]();
		spawnedPhp?.reap();
	});
	it.each([
		// Default cwd
		{
			command: 'ls',
			expected: ['README.md', 'code', ''].join('\n'),
		},
		// Explicit path
		{
			command: 'ls /tmp/shared-test-directory',
			expected: ['README.md', 'code', ''].join('\n'),
		},
		// Subdirectory – we expect a different output
		{
			command: 'ls /tmp/shared-test-directory/code',
			expected: ['index.php', ''].join('\n'),
		},
		// pwd
		{
			command: 'pwd',
			expected: '/tmp/shared-test-directory\n',
		},
	])('should be able to run "$command"', async ({ command, expected }) => {
		const response = await php.run({
			code: `<?php
				$output = shell_exec(getenv('COMMAND'));
				echo $output;
			`,
			env: {
				COMMAND: command,
			},
		});
		expect(response.text).toEqual(expected);
	});

	it('Should be able to run CLI commands via php.cli()', async () => {
		const response = await php.cli(['ls', '/tmp/shared-test-directory']);
		expect(await response.stdoutText).toEqual(
			['README.md', 'code', ''].join('\n')
		);
	});
});
