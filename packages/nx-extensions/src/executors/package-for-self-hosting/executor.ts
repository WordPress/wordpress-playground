import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import type { ExecutorContext } from '@nx/devkit';
import { joinPathFragments, logger } from '@nx/devkit';
import type { PackageForSelfHostingExecutorSchema } from './schema';
import * as tar from 'tar-fs';
import { globSync } from 'glob';

export default async function packageForSelfHostingExecutor(
	options: PackageForSelfHostingExecutorSchema,
	context: ExecutorContext
) {
	let hostingBaseUrl: URL;
	try {
		hostingBaseUrl = new URL(options.hostingBaseUrl);
	} catch {
		logger.error(
			`hostingBaseUrl option "${options.hostingBaseUrl}" is not a URL.`
		);
		return { success: false };
	}

	const name = context.projectName;
	const project = context.projectGraph.nodes[name];
	if (!project) {
		logger.error(`Could not find project "${name}".`);
		return { success: false };
	}

	const builtPackagePath =
		project.data?.targets?.build?.options?.outputPath ||
		project.data?.targets?.['build:vite']?.options?.outputPath ||
		project.data?.targets?.['build:bundle']?.options?.outputPath ||
		project.data?.targets?.['build:package-json']?.options?.outputPath;
	if (!builtPackagePath) {
		logger.error(
			`Could not find build outputPath of project "${name}". Is project.json configured correctly?`
		);
		return { success: false };
	}

	// TODO : Is there a way to explicitly run a build here using the task orchestrator?
	// Running a single target's executor doesn't run dependencies
	// https://github.com/nrwl/nx/issues/19531#issuecomment-1760343458
	// For now, this executor must be declared to depend upon the target
	// that builds with a package.json

	const packageJsonPath = path.join(builtPackagePath, 'package.json');
	if (!fs.existsSync(packageJsonPath)) {
		logger.error(
			`Could not find "${packageJsonPath}". Are you missing a build target in the "dependsOn" list?`
		);
		return { success: false };
	}

	const packageJsonText = fs.readFileSync(packageJsonPath, 'utf8');
	const packageJson: any = JSON.parse(packageJsonText);

	const packageName: string = packageJson.name;
	if (!packageName) {
		logger.error(
			`There must be a package name declared in "${packageJsonPath}".`
		);
		return { success: false };
	}

	const packageVersion = packageJson.version;
	if (!packageVersion) {
		logger.error(
			`There must be a package version declared in "${packageJsonPath}".`
		);
		return { success: false };
	}

	if (packageJson.private) {
		logger.error(`"${packageName}" is a private package.`);
		return { success: false };
	}

	if (packageJson.dependencies) {
		packageJson.dependencies = mapToSelfHostedDependencies(
			hostingBaseUrl,
			packageJson.dependencies
		);
	}
	if (packageJson.devDependencies) {
		packageJson.devDependencies = mapToSelfHostedDependencies(
			hostingBaseUrl,
			packageJson.devDependencies
		);
	}

	// TODO: Should 'dist' not be hardcoded?
	const tarballOutputDir = path.join(
		path.resolve('dist'),
		'packages-for-self-hosting',
		encodeURIComponent(hostingBaseUrl.href),
		`v${packageVersion}`
	);
	fs.mkdirSync(tarballOutputDir, { recursive: true });

	const tarballFileName = getTarballFileName(packageName, packageVersion);
	const tarballPath = path.join(tarballOutputDir, tarballFileName);
	const tarballWriteStream = fs.createWriteStream(tarballPath);

	// NOTE: A package can declare which files should be included when it is installed
	// as a dependency by declaring a "files" property in its package.json.
	// https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files
	//
	// We use it to limit the published files for some packages and need to support it here.
	let globs = packageJson.files ? packageJson.files : ['**/*'];
	// NOTE: There were issues with figuring out how to resolve absolute globs
	// that were actually relative to the project root, so we just make all globs relative.
	globs = globs.map(function makeGlobRelative(glob: string) {
		return glob.startsWith('/') ? glob.slice(1) : glob;
	});
	const matchingPaths = globSync(globs, { cwd: builtPackagePath });

	const matchingFiles = new Set<string>();
	const matchingDirs: string[] = [];
	for (const matchingPath of matchingPaths) {
		const absolutePath = path.join(builtPackagePath, matchingPath);
		if (fs.statSync(absolutePath).isDirectory()) {
			matchingDirs.push(matchingPath);
		} else {
			matchingFiles.add(matchingPath);
		}
	}

	await new Promise((resolve, reject) => {
		const pack = tar.pack(builtPackagePath, {
			// NOTE: AFAICT, tar-fs does not support specifying multiple directories
			// to add to the tarball, so we tell it to add everything and then exclude
			// undesired files using this ignore() function.
			ignore(name) {
				// Ignore package.json because we will add a patched version later
				if (
					path.dirname(name) === builtPackagePath &&
					path.basename(name) === 'package.json'
				) {
					return true;
				}

				const relativeName = path.relative(builtPackagePath, name);
				if (matchingFiles.has(relativeName)) {
					// This file is specifically included with the package.
					return false;
				}

				const isMatchingDirChild = matchingDirs.some(
					(dir) =>
						dir === relativeName ||
						relativeName.startsWith(`${dir}/`)
				);
				if (isMatchingDirChild) {
					// This file is under a directory that is included with the package.
					return false;
				}

				return true;
			},
			map(header) {
				// Place all files under a top-level 'package' directory as expected by npm.
				header.name = path.join('package', header.name);
				return header;
			},
		});
		pack.entry(
			{ name: 'package/package.json' },
			JSON.stringify(packageJson, null, 2)
		);
		pack.pipe(zlib.createGzip())
			.pipe(tarballWriteStream)
			.on('error', reject)
			.on('finish', () => resolve(null));
	});

	return { success: true };
}

function getTarballFileName(packageName: string, packageVersion: string) {
	// NOTE: This assumes we always use a simple version string for
	// Playground dependencies like "1.2.3" rather than an expression
	// like "^1.2.3"
	const baseName = packageName.replaceAll('/', '-');
	return `${baseName}-${packageVersion}.tar.gz`;
}

function mapToSelfHostedDependencies(
	hostingBaseUrl: URL,
	dependencies: Record<string, string>
) {
	const mappedDependencies = {};
	for (const [depName, depVersion] of Object.entries(dependencies)) {
		const isPlaygroundPackage =
			depName.startsWith('@php-wasm/') ||
			depName.startsWith('@wp-playground/');
		if (isPlaygroundPackage) {
			const tarballUrl = new URL(hostingBaseUrl);
			const tarballName = getTarballFileName(depName, depVersion);
			tarballUrl.pathname = joinPathFragments(
				tarballUrl.pathname,
				`v${depVersion}`,
				tarballName
			);
			mappedDependencies[depName] = tarballUrl.href;
		} else {
			mappedDependencies[depName] = depVersion;
		}
	}
	return mappedDependencies;
}
