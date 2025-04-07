import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { ExecutorContext, joinPathFragments, logger } from '@nx/devkit';
import { PackageForSelfHostingExecutorSchema } from './schema';
import * as tar from 'tar-fs';

export default async function packageForSelfHostingExecutor(
	options: PackageForSelfHostingExecutorSchema,
	context: ExecutorContext
) {
	let hostingBaseUrl: URL;
	try {
		hostingBaseUrl = new URL(options.hostingBaseUrl);
	} catch (e) {
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

	await new Promise((resolve, reject) => {
		const pack = tar.pack(builtPackagePath, {
			ignore: function isPackageJson(name) {
				return (
					path.dirname(name) === builtPackagePath &&
					path.basename(name) === 'package.json'
				);
			},
			map: function prefixWithPackageDir(header) {
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
