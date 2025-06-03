import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
} from '@php-wasm/universal';
import { phpVars } from '@php-wasm/util';
// eslint-disable-next-line @nx/enforce-module-boundaries
import InitialDockerfile from '../../../compile/php/Dockerfile?raw';
import { loadNodeRuntime } from '../lib';

const requestHandler = (
	req: http.IncomingMessage,
	res: http.ServerResponse
) => {
	if (req.url === '/image.jpg') {
		const image = fs.readFileSync(
			path.join(__dirname, 'test-data', 'image.jpg')
		);
		res.writeHead(200, { 'Content-Type': 'image/jpeg' });
		res.write(image);
		res.end();
	} else {
		res.writeHead(200, { 'Content-Type': 'text/plain' });
		res.end('Hello World\n');
	}
};

const httpServer = http.createServer(requestHandler);
const selfSignedCert = {
	key: fs.readFileSync(path.join(__dirname, 'test-data', 'key.pem')),
	cert: fs.readFileSync(path.join(__dirname, 'test-data', 'cert.pem')),
};
const httpsServer = https.createServer(
	{
		key: selfSignedCert.key,
		cert: selfSignedCert.cert,
	},
	requestHandler
);

type Mode = 'http' | 'https';

const protocols = {
	http: {
		protocol: 'http',
		port: new Promise((resolve) => {
			httpServer.listen(0, function () {
				resolve((httpServer.address() as any).port);
			});
		}),
	},
	https: {
		protocol: 'https',
		port: new Promise((resolve) => {
			httpsServer.listen(0, function () {
				resolve((httpsServer.address() as any).port);
			});
		}),
	},
};

const { protocol, port } = protocols[import.meta.env['PROTOCOL'] as Mode];

const host = '127.0.0.1';

const httpUrl = `${protocol}://${host}:${port}`;

describe(`${protocol} protocol – asyncify`, () => {
	const js = phpVars({
		host,
		port,
		httpUrl,
	});

	const phpVersions =
		'PHP' in process.env ? [process.env['PHP']] : SupportedPHPVersions;

	const topOfTheStack: Record<string, string> = {
		// Network functions from https://www.php.net/manual/en/book.network.php
		fsockopen: `
			$fp = fsockopen(${js['host']}, ${js['port']});
			fwrite($fp, "GET / HTTP/1.1\\r\\n\\r\\n");
			fread($fp, 10);
			fclose($fp);`,
	};

	describe.each(phpVersions)('PHP %s – asyncify', (phpVersion) => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(await loadNodeRuntime(phpVersion as any));
			await setPhpIniEntries(php, { allow_url_fopen: 1 });
		});

		describe.each(Object.keys(topOfTheStack))('%s', (networkCallKey) => {
			const networkCall = topOfTheStack[networkCallKey];
			test('Direct call', () => assertNoCrash(networkCall));
			describe('Function calls', () => {
				test('Simple call', () => assertNoCrash(`${networkCall};`));
				test('Simple call', () =>
					assertNoCrash(`function top() { ${networkCall} } top();`));
				test('Via call_user_func', () =>
					assertNoCrash(
						`function top() { ${networkCall} } call_user_func('top'); `
					));
				test('Via call_user_func_array', () =>
					assertNoCrash(
						`function top() { ${networkCall} } call_user_func_array('top', array());`
					));
			});

			describe('Array functions', () => {
				test('array_filter', () =>
					assertNoCrash(`
						function top() { ${networkCall} }
						array_filter(array('top'), 'top');
					`));

				test('array_map', () =>
					assertNoCrash(`
							function top() { ${networkCall} }
							array_map(array('top'), 'top');
						`));

				// Network calls in sort() would be silly so let's skip those for now.
			});

			describe('Class method calls', () => {
				test('Regular method', () =>
					assertNoCrash(`
					class Top {
						function my_method() { ${networkCall} }
					}
					$x = new Top();
					$x->my_method();
				`));
				test('Via ReflectionMethod->invoke()', () =>
					assertNoCrash(`
					class Top {
						function my_method() { ${networkCall} }
					}
					$reflectionMethod = new ReflectionMethod('Top', 'my_method');
					$reflectionMethod->invoke(new Top());
				`));
				test('Via ReflectionMethod->invokeArgs()', () =>
					assertNoCrash(`
					class Top {
						function my_method() { ${networkCall} }
					}
					$reflectionMethod = new ReflectionMethod('Top', 'my_method');
					$reflectionMethod->invokeArgs(new Top(), array());
				`));
				test('Via call_user_func', () =>
					assertNoCrash(`
					class Top {
						function my_method() { ${networkCall} }
					}
					call_user_func([new Top(), 'my_method']);
					`));
				test('Via call_user_func_array', () =>
					assertNoCrash(`
					class Top {
						function my_method() { ${networkCall} }
					}
					call_user_func_array([new Top(), 'my_method'], []);
					`));
				test('Constructor', () =>
					assertNoCrash(`
					class Top {
						function __construct() { ${networkCall} }
					}
					new Top();
				`));
				test('Destructor', () =>
					assertNoCrash(`
					class Top {
						function __destruct() { ${networkCall} }
					}
					$x = new Top();
					unset($x);
				`));
				test('__call', () =>
					assertNoCrash(`
					class Top {
						function __call($method, $args) { ${networkCall} }
					}
					$x = new Top();
					$x->test();
				`));
				test('__get', () =>
					assertNoCrash(`
					class Top {
						function __get($prop) { ${networkCall} }
					}
					$x = new Top();
					$x->test;
				`));
				test('__set', () =>
					assertNoCrash(`
					class Top {
						function __set($prop, $value) { ${networkCall} }
					}
					$x = new Top();
					$x->test = 1;
				`));
				test('__isset', () =>
					assertNoCrash(`
					class Top {
						function __isset($prop) { ${networkCall} }
					}
					$x = new Top();
					isset($x->test);
				`));
				test('ArrayAccess', () => {
					assertNoCrash(`
						class Top implements ArrayAccess {
							function offsetExists($offset) { ${networkCall} }
							function offsetGet($offset) { ${networkCall} }
							function offsetSet($offset, $value) { ${networkCall} }
							function offsetUnset($offset) { ${networkCall} }
						}
						$x = new Top();
						isset($x['test']);
						$a = $x['test'];
						$x['test'] = 123;
						unset($x['test']);
					`);
				});
				test('Iterator', () =>
					assertNoCrash(`
					$data = new class() implements IteratorAggregate {
						public function getIterator(): Traversable {
							${networkCall};
							return new ArrayIterator( [] );
						}
					};
					echo json_encode( [
						...$data
					] );
				`));

				test('Countable', () =>
					assertNoCrash(`
					$data = new class() implements Countable {
						public function count() {
							${networkCall}
							return 0;
						}
					};
					count($data);
				`));

				test('yield', () =>
					assertNoCrash(`
					function countTo2() {
						${networkCall};
						yield '1';
						${networkCall};
						yield '2';
					}
					foreach(countTo2() as $number) {
						echo $number;
					}
				`));
			});

			describe('exif extension support', () => {
				it('exif_read_data', async () => {
					assertNoCrash(
						`var_dump(exif_read_data('${httpUrl}/image.jpg'));`
					);
				});
				it('exif_imagetype', async () => {
					assertNoCrash(
						`var_dump(exif_imagetype('${httpUrl}/image.jpg'));`
					);
				});
				it('exif_thumbnail', async () => {
					assertNoCrash(
						`var_dump(exif_thumbnail('${httpUrl}/image.jpg'));`
					);
				});
			});
		});

		async function assertNoCrash(code: string) {
			try {
				const result = await php.run({
					code: `<?php ${code}`,
				});
				expect(result).toBeTruthy();
				expect(result.text).toBe('');
				expect(result.errors).toBeFalsy();
			} catch (e) {
				if (
					'FIX_DOCKERFILE' in process.env &&
					process.env['FIX_DOCKERFILE'] === 'true' &&
					'functionsMaybeMissingFromAsyncify' in php
				) {
					const missingCandidates = (
						php.functionsMaybeMissingFromAsyncify as string[]
					)
						.map((candidate) =>
							candidate.replace('byn$fpcast-emu$', '')
						)
						.filter(
							(candidate) =>
								!Dockerfile.includes(`"${candidate}"`)
						);
					if (missingCandidates.length) {
						addAsyncifyFunctionsToDockerfile(missingCandidates);
						throw new Error(
							`Asyncify crash! The following missing functions were just auto-added to the ASYNCIFY_ONLY list in the Dockerfile: \n ` +
								missingCandidates.join(', ') +
								`\nYou now need to rebuild PHP and re-run this test: \n` +
								`  npm run recompile:php:node:asyncify:8.0\n` +
								`  node --stack-trace-limit=100 ./node_modules/.bin/nx test php-wasm-node --test-name-pattern='asyncify'\n`
						);
					}

					const err = new Error(
						`Asyncify crash! No C functions present in the stack trace were missing ` +
							`from the Dockerfile. This could mean the stack trace is too short – try increasing the stack trace limit ` +
							`with --stack-trace-limit=100. If you already did that, fixing this problem will likely take more digging.`
					);
					err.cause = e;
					throw err;
				}
			}
		}
	});
});

let Dockerfile = InitialDockerfile;
const DockerfilePath = path.resolve(
	__dirname,
	'../../../compile/php/Dockerfile'
);
function addAsyncifyFunctionsToDockerfile(functions: string[]) {
	const currentDockerfile = fs.readFileSync(DockerfilePath, 'utf8') + '';
	const lookup = `export ASYNCIFY_ONLY=$'`;
	const idx = currentDockerfile.indexOf(lookup) + lookup.length;
	const updatedDockerfile =
		currentDockerfile.substring(0, idx) +
		functions.map((f) => `"${f}",\\\n`).join('') +
		currentDockerfile.substring(idx);
	fs.writeFileSync(DockerfilePath, updatedDockerfile);
	Dockerfile = updatedDockerfile;
}
