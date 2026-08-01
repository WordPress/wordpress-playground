#!/usr/bin/env node
import fs from 'node:fs';

const rootPackageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const overrides = rootPackageJson.overrides ?? {};
const failures = [];

// The release build writes resolved dependency versions into dist package.json files.
// npm 11 rejects a direct dependency when the root override does not match that
// resolved version exactly, even if the semver range would resolve correctly.
// Example: #3745 set both `@wp-playground/mcp` and root `overrides.ws`
// to `^8.21.0`. During release, Lerna packed a generated MCP manifest
// with the resolved direct dependency `ws@8.21.0`; npm 11 rejected that
// because the root override still used the non-identical `^8.21.0` range.
// @see https://github.com/WordPress/wordpress-playground/pull/3745
for (const packageDir of getWorkspacePackageDirs(
	rootPackageJson.workspaces ?? []
)) {
	const packageJsonPath = `${packageDir}/package.json`;
	if (!fs.existsSync(packageJsonPath)) {
		continue;
	}

	const packageJson = readJson(packageJsonPath);
	if (packageJson.private || !packageJson.publishConfig?.directory) {
		continue;
	}

	for (const section of ['dependencies', 'optionalDependencies']) {
		for (const [dependencyName, dependencySpec] of Object.entries(
			packageJson[section] ?? {}
		)) {
			const overrideSpec = overrides[dependencyName];
			if (typeof overrideSpec !== 'string') {
				continue;
			}

			const resolvedVersion = getResolvedVersion(
				packageDir,
				dependencyName
			);
			if (!resolvedVersion) {
				failures.push(
					`${packageJson.name} declares ${dependencyName}, but ` +
						'package-lock.json does not include a resolved version.'
				);
				continue;
			}

			if (
				dependencySpec !== resolvedVersion ||
				overrideSpec !== resolvedVersion
			) {
				failures.push(
					`${packageJson.name} declares ${dependencyName}@${dependencySpec} ` +
						`and the root override is ${dependencyName}@${overrideSpec}, ` +
						`but the lockfile resolves ${dependencyName}@${resolvedVersion}. ` +
						'Published package manifests use resolved versions during release, ' +
						'and npm rejects root overrides that do not exactly match ' +
						'direct dependencies. Pin both specs to the resolved version, ' +
						'or remove the root override.'
				);
			}
		}
	}
}

if (failures.length > 0) {
	console.error('Publish package override validation failed:');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log('Publish package override validation passed.');

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getWorkspacePackageDirs(workspaces) {
	const packageDirs = [];
	for (const workspace of workspaces) {
		if (!workspace.endsWith('/*')) {
			if (fs.existsSync(workspace)) {
				packageDirs.push(workspace);
			}
			continue;
		}

		const baseDir = workspace.slice(0, -2);
		if (!fs.existsSync(baseDir)) {
			continue;
		}

		for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				packageDirs.push(`${baseDir}/${entry.name}`);
			}
		}
	}
	return packageDirs;
}

function getResolvedVersion(packageDir, dependencyName) {
	const packageLocalPath = `${packageDir}/node_modules/${dependencyName}`;
	const rootPackagePath = `node_modules/${dependencyName}`;
	return (
		packageLock.packages?.[packageLocalPath]?.version ??
		packageLock.packages?.[rootPackagePath]?.version
	);
}
