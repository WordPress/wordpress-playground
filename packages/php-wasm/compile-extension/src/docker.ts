import { spawn } from 'node:child_process';
import path from 'node:path';

import type { AsyncMode } from './manifest';

export interface DockerBuildContext {
	workspaceRoot: string;
	phpWasmRoot: string;
	compileRoot: string;
}

export interface DockerImageOptions extends DockerBuildContext {
	phpVersion: string;
	phpRelease: string;
	asyncMode: AsyncMode;
}

export interface DockerRunOptions extends DockerImageOptions {
	sourceDir: string;
	outDir: string;
	name: string;
	artifactFile: string;
	optimize: string;
	extraCflags?: string;
	extraLdflags?: string;
	configArgs: string[];
}

export function createDockerContext(workspaceRoot: string): DockerBuildContext {
	const phpWasmRoot = path.join(workspaceRoot, 'packages/php-wasm');
	return {
		workspaceRoot,
		phpWasmRoot,
		compileRoot: path.join(phpWasmRoot, 'compile'),
	};
}

export async function assertDockerIsAvailable(): Promise<void> {
	try {
		await runCommand('docker', ['--version'], {
			stdio: 'ignore',
		});
	} catch (error) {
		throw new Error(
			'Docker is required to compile PHP.wasm extensions, but the docker command was not found.',
			{ cause: error }
		);
	}
}

export async function buildBaseImage(context: DockerBuildContext) {
	await runCommand('make', ['base-image'], {
		cwd: context.compileRoot,
	});
}

export async function buildExtensionImage(
	options: DockerImageOptions
): Promise<string> {
	const imageTag = getExtensionImageTag(options);
	await runCommand(
		'docker',
		[
			'build',
			'-f',
			'compile-extension/docker/Dockerfile.ext',
			'.',
			`--tag=${imageTag}`,
			'--progress=plain',
			'--build-arg',
			`PHP_VERSION=${options.phpRelease}`,
			'--build-arg',
			'JSPI=yes',
		],
		{
			cwd: options.phpWasmRoot,
		}
	);
	return imageTag;
}

export async function runExtensionBuild(options: DockerRunOptions) {
	const imageTag = getExtensionImageTag(options);
	const runArgs = [
		'run',
		'--rm',
		'-v',
		`${options.sourceDir}:/src:ro`,
		'-v',
		`${options.outDir}:/out`,
		'-v',
		`${options.compileRoot}:/php-wasm-compile:ro`,
		'--env',
		`EXTENSION_NAME=${options.name}`,
		'--env',
		`PHP_VERSION_SHORT=${options.phpVersion}`,
		'--env',
		`ASYNC_MODE=${options.asyncMode}`,
		'--env',
		`ARTIFACT_FILENAME=${options.artifactFile}`,
		'--env',
		`OPTIMIZE=${options.optimize}`,
		'--env',
		`CONFIG_ARGS_COUNT=${options.configArgs.length}`,
	];

	if (options.extraCflags) {
		runArgs.push('--env', `EXTRA_CFLAGS=${options.extraCflags}`);
	}
	if (options.extraLdflags) {
		runArgs.push('--env', `EXTRA_LDFLAGS=${options.extraLdflags}`);
	}

	options.configArgs.forEach((arg, index) => {
		runArgs.push('--env', `CONFIG_ARG_${index}=${arg}`);
	});

	runArgs.push(imageTag);

	await runCommand('docker', runArgs, {
		cwd: options.workspaceRoot,
	});
}

function getExtensionImageTag(
	options: Pick<DockerImageOptions, 'phpVersion' | 'asyncMode'>
) {
	const phpVersion = options.phpVersion.replaceAll('.', '-');
	return `playground-php-wasm:compile-extension-php${phpVersion}-${options.asyncMode}`;
}

interface RunCommandOptions {
	cwd?: string;
	stdio?: 'inherit' | 'ignore';
}

async function runCommand(
	command: string,
	args: string[],
	options: RunCommandOptions = {}
): Promise<void> {
	console.log(`Running ${command} ${args.join(' ')}`);
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			stdio: options.stdio ?? 'inherit',
			env: process.env,
		});
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`${command} exited with code ${code}`));
		});
	});
}
