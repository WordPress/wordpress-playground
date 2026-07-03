import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';

export interface GitFixtureServer {
	url: string;
	close(): Promise<void>;
}

export async function startGitFixtureServer(): Promise<GitFixtureServer> {
	const repositoryRoot = await mkdtemp(join(tmpdir(), 'playground-git-'));
	await createSamplePluginRepository(repositoryRoot);

	const server = createServer((req, res) => {
		handleGitFixtureRequest(req, res, repositoryRoot).catch((error) => {
			if (!res.headersSent) {
				setCorsHeaders(res);
				res.statusCode = 500;
			}
			res.end(String(error));
		});
	});

	try {
		await listen(server);
	} catch (error) {
		await rm(repositoryRoot, { recursive: true, force: true });
		throw error;
	}

	const address = server.address();
	if (!address || typeof address === 'string') {
		await rm(repositoryRoot, { recursive: true, force: true });
		throw new Error('Git fixture server did not bind to a TCP port');
	}

	return {
		url: `http://127.0.0.1:${address.port}`,
		close: async () => {
			await close(server);
			await rm(repositoryRoot, { recursive: true, force: true });
		},
	};
}

async function createSamplePluginRepository(repositoryRoot: string) {
	const workTree = join(repositoryRoot, 'sample-plugin-worktree');
	const pluginDirectory = join(workTree, 'sample-plugin');
	await mkdir(workTree, { recursive: true });
	await cp(join(__dirname, 'fixtures/sample-plugin'), pluginDirectory, {
		recursive: true,
	});

	await runGit(['init'], workTree);
	await runGit(['checkout', '-B', 'main'], workTree);
	await runGit(['add', 'sample-plugin/sample-plugin.php'], workTree);
	await runGit(
		[
			'-c',
			'user.name=WordPress Playground Tests',
			'-c',
			'user.email=playground@example.com',
			'commit',
			'-m',
			'Add sample plugin',
		],
		workTree
	);
	await runGit(
		['clone', '--bare', workTree, 'sample-plugin.git'],
		repositoryRoot
	);
}

async function handleGitFixtureRequest(
	req: IncomingMessage,
	res: ServerResponse,
	repositoryRoot: string
) {
	setCorsHeaders(res);
	if (req.method === 'OPTIONS') {
		res.statusCode = 204;
		res.end();
		return;
	}

	const requestUrl = new URL(req.url || '/', 'http://git-fixture.test');
	const pathInfo = requestUrl.pathname;
	if (!pathInfo.startsWith('/') || pathInfo.includes('..')) {
		res.statusCode = 404;
		res.end('Not found');
		return;
	}

	const requestBody = await collectStream(req);
	const child = spawn('git', ['http-backend'], {
		env: {
			...process.env,
			GIT_HTTP_EXPORT_ALL: '1',
			GIT_PROJECT_ROOT: repositoryRoot,
			PATH_INFO: pathInfo,
			QUERY_STRING: requestUrl.searchParams.toString(),
			REQUEST_METHOD: req.method || 'GET',
			CONTENT_TYPE: String(req.headers['content-type'] || ''),
			CONTENT_LENGTH: String(requestBody.length),
		},
	});

	child.stdin.end(requestBody);
	const [stdout, stderr, exitCode] = await Promise.all([
		collectStream(child.stdout),
		collectStream(child.stderr),
		new Promise<number | null>((resolve) =>
			child.on('close', (code) => resolve(code))
		),
	]);

	if (exitCode) {
		throw new Error(
			`git http-backend exited with ${exitCode}: ${stderr.toString()}`
		);
	}

	writeCgiResponse(stdout, res);
}

async function runGit(args: string[], cwd: string) {
	const child = spawn('git', args, { cwd });
	const [stdout, stderr, exitCode] = await Promise.all([
		collectStream(child.stdout),
		collectStream(child.stderr),
		new Promise<number | null>((resolve) =>
			child.on('close', (code) => resolve(code))
		),
	]);

	if (exitCode) {
		throw new Error(
			`git ${args.join(' ')} exited with ${exitCode}: ${stderr.toString()}`
		);
	}

	return stdout;
}

function listen(server: Server): Promise<void> {
	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			resolve();
		});
	});
}

function close(server: Server): Promise<void> {
	return new Promise((resolve, reject) => {
		server.close((error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

function collectStream(stream: Readable): Promise<Buffer> {
	const chunks: Buffer[] = [];
	return new Promise((resolve, reject) => {
		stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		stream.on('error', reject);
		stream.on('end', () => resolve(Buffer.concat(chunks)));
	});
}

function writeCgiResponse(response: Buffer, res: ServerResponse) {
	const separator = response.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
	const separatorIndex = response.indexOf(separator);
	if (separatorIndex === -1) {
		res.statusCode = 500;
		res.end(response);
		return;
	}

	const headerText = response.subarray(0, separatorIndex).toString('utf8');
	for (const line of headerText.split(/\r?\n/)) {
		const separatorAt = line.indexOf(':');
		if (separatorAt === -1) {
			continue;
		}
		const name = line.slice(0, separatorAt);
		const value = line.slice(separatorAt + 1).trim();
		if (name.toLowerCase() === 'status') {
			res.statusCode = parseInt(value, 10);
		} else {
			res.setHeader(name, value);
		}
	}

	res.end(response.subarray(separatorIndex + separator.length));
}

function setCorsHeaders(res: ServerResponse) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.setHeader(
		'Access-Control-Allow-Headers',
		'authorization, content-type, git-protocol'
	);
}
