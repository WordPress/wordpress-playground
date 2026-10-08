#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

// Publishes every public package in dependency order and stops at the
// first package that cannot be published. A package only reaches npm
// after every workspace dependency it pins is confirmed on the registry,
// so a partial release never leaves npm with unsatisfiable dependencies.
const distTag = process.argv
	.find((argument) => argument.startsWith('--dist-tag='))
	?.slice('--dist-tag='.length);
const maxPublishAttempts = 3;
const publishRetryDelayMs = 15_000;
const maxRegistryChecks = 10;
const registryCheckDelayMs = 5_000;

const packages = sortByWorkspaceDependencies(listPublishablePackages());

for (const pkg of packages) {
	await publishPackage(pkg);
}

console.log(`All ${packages.length} packages are on the registry.`);

function listPublishablePackages() {
	const result = spawnSync('npx', ['lerna', 'list', '--json'], {
		encoding: 'utf8',
	});
	if (result.status !== 0) {
		console.error(result.stderr);
		process.exit(1);
	}

	return JSON.parse(result.stdout).map((pkg) => {
		const directory = getPublishDirectory(pkg);
		const manifestPath = path.join(directory, 'package.json');
		if (!fs.existsSync(manifestPath)) {
			console.error(
				`${pkg.name} has no dist manifest at ${manifestPath}. ` +
					`Run npm run build before this script.`
			);
			process.exit(1);
		}

		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
		if (manifest.version !== pkg.version) {
			console.error(
				`${pkg.name} is at ${pkg.version} but its dist manifest ` +
					`is at ${manifest.version}. Run npm run build after ` +
					`lerna version to regenerate the dist manifests.`
			);
			process.exit(1);
		}

		return {
			name: pkg.name,
			version: pkg.version,
			directory,
			manifest,
		};
	});
}

function getPublishDirectory(pkg) {
	const packageJson = JSON.parse(
		fs.readFileSync(path.join(pkg.location, 'package.json'), 'utf8')
	);
	const directory = packageJson.publishConfig?.directory;
	if (!directory) {
		console.error(`${pkg.name} has no publishConfig.directory.`);
		process.exit(1);
	}
	return path.resolve(pkg.location, directory);
}

function sortByWorkspaceDependencies(packages) {
	const workspaceNames = new Set(packages.map((pkg) => pkg.name));
	const remaining = new Map(packages.map((pkg) => [pkg.name, pkg]));
	const ordered = [];

	while (remaining.size > 0) {
		const ready = [...remaining.values()].filter((pkg) =>
			getWorkspaceDependencies(pkg, workspaceNames).every(
				(dependency) => !remaining.has(dependency)
			)
		);
		if (ready.length === 0) {
			console.error(
				'Dependency cycle between: ' + [...remaining.keys()].join(', ')
			);
			process.exit(1);
		}
		for (const pkg of ready) {
			ordered.push(pkg);
			remaining.delete(pkg.name);
		}
	}

	return ordered;
}

function getWorkspaceDependencies(pkg, workspaceNames) {
	const dependencies = new Set();
	for (const section of [
		'dependencies',
		'optionalDependencies',
		'peerDependencies',
	]) {
		for (const name of Object.keys(pkg.manifest[section] ?? {})) {
			if (workspaceNames.has(name)) {
				dependencies.add(name);
			}
		}
	}
	return [...dependencies];
}

async function publishPackage(pkg) {
	for (let attempt = 1; attempt <= maxPublishAttempts; attempt++) {
		// A publish can succeed on the registry while npm reports a
		// failure, so recheck before every attempt: a retry against an
		// already published version fails with EPUBLISHCONFLICT forever.
		if (isOnRegistry(pkg)) {
			console.log(
				`Skipping ${pkg.name}@${pkg.version}: already published.`
			);
			return;
		}

		console.log(
			`Publishing ${pkg.name}@${pkg.version} ` +
				`(attempt ${attempt}/${maxPublishAttempts})...`
		);
		const result = spawnSync('npm', ['publish', `--tag=${distTag}`], {
			cwd: pkg.directory,
			stdio: 'inherit',
		});
		if (result.status === 0) {
			await waitUntilOnRegistry(pkg);
			return;
		}
		if (attempt < maxPublishAttempts) {
			await sleep(publishRetryDelayMs * attempt);
		}
	}

	console.error(
		`Failed to publish ${pkg.name}@${pkg.version} after ` +
			`${maxPublishAttempts} attempts. Stopping so no dependent ` +
			`package is published with a dependency that is not on npm.`
	);
	process.exit(1);
}

async function waitUntilOnRegistry(pkg) {
	for (let check = 1; check <= maxRegistryChecks; check++) {
		if (isOnRegistry(pkg)) {
			return;
		}
		await sleep(registryCheckDelayMs);
	}

	console.error(
		`${pkg.name}@${pkg.version} was published but the registry did ` +
			`not confirm it after ${maxRegistryChecks} checks.`
	);
	process.exit(1);
}

function isOnRegistry(pkg) {
	// npm caches registry metadata for five minutes. Without
	// --prefer-online, the polls after a publish can read the stale
	// cached packument and never see the new version.
	const result = spawnSync(
		'npm',
		['view', '--prefer-online', `${pkg.name}@${pkg.version}`, 'version'],
		{ encoding: 'utf8' }
	);
	return result.status === 0 && result.stdout.trim() !== '';
}
