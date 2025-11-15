const fs = require('fs');
const path = require('path');
const moduleRequire = require('module').createRequire(__dirname);

const PACKAGES_TO_DEDUPE = [
	'@docusaurus/plugin-content-docs',
	'@docusaurus/theme-common',
	'@docusaurus/theme-search-algolia',
];

function getExportKeys(exportsField) {
	if (!exportsField) {
		return ['.'];
	}

	if (typeof exportsField === 'string') {
		return ['.'];
	}

	if (Array.isArray(exportsField)) {
		return ['.'];
	}

	if (typeof exportsField === 'object') {
		const keys = new Set(['.']);
		for (const key of Object.keys(exportsField)) {
			if (key === 'default' || key.includes('*')) {
				continue;
			}
			keys.add(key);
		}
		return Array.from(keys);
	}

	return ['.'];
}

function normalizeSubpath(pkgName, subpath) {
	if (subpath === '.' || !subpath) {
		return pkgName;
	}
	return `${pkgName}/${subpath.replace(/^\.\//, '')}`;
}

function resolvePackageMetadata(pkgName) {
	let entryPoint;
	try {
		entryPoint = moduleRequire.resolve(pkgName);
	} catch (error) {
		console.warn(
			`docusaurus-dedupe-aliases: unable to resolve entry for ${pkgName}`,
			error
		);
		return null;
	}

	let currentDir = path.dirname(entryPoint);
	const fsRoot = path.parse(currentDir).root;

	while (currentDir && currentDir !== fsRoot) {
		const candidate = path.join(currentDir, 'package.json');
		if (fs.existsSync(candidate)) {
			const pkgJson = JSON.parse(fs.readFileSync(candidate, 'utf8'));
			if (pkgJson?.name === pkgName) {
				return { pkgJson, pkgRoot: currentDir };
			}
		}
		currentDir = path.dirname(currentDir);
	}

	console.warn(
		`docusaurus-dedupe-aliases: could not locate package.json for ${pkgName}`
	);
	return null;
}

function buildAliasesForPackage(pkgName) {
	const metadata = resolvePackageMetadata(pkgName);
	if (!metadata) {
		return [];
	}

	const { pkgJson, pkgRoot } = metadata;
	const exportKeys = getExportKeys(pkgJson.exports);

	return exportKeys.flatMap((subpath) => {
		const specifier = normalizeSubpath(pkgName, subpath);
		try {
			const target = moduleRequire.resolve(specifier);
			const aliasKey =
				subpath === '.' ? `${pkgName}$` : specifier.replace(/\\/g, '/');
			return [[aliasKey, target]];
		} catch (error) {
			const aliasKey =
				subpath === '.' ? `${pkgName}$` : specifier.replace(/\\/g, '/');
			const fallbackTarget =
				subpath === '.'
					? path.join(pkgRoot, pkgJson.main ?? 'index.js')
					: path.join(pkgRoot, subpath.replace(/^\.\//, ''));

			if (fs.existsSync(fallbackTarget)) {
				console.warn(
					`docusaurus-dedupe-aliases: resolved ${specifier} via fallback path ${fallbackTarget} due to`,
					error.message
				);
				return [[aliasKey, fallbackTarget]];
			}

			console.warn(
				`docusaurus-dedupe-aliases: unable to resolve specifier ${specifier}`,
				error
			);
			return [];
		}
	});
}

module.exports = function docusaurusDedupeAliases() {
	const aliasEntries = PACKAGES_TO_DEDUPE.flatMap(buildAliasesForPackage);
	const aliases = Object.fromEntries(aliasEntries);

	return {
		name: 'docusaurus-dedupe-aliases',
		configureWebpack() {
			return {
				resolve: {
					alias: aliases,
				},
			};
		},
	};
};
