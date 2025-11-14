const fs = require('fs');
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

function buildAliasesForPackage(pkgName) {
	let pkgJsonPath;
	try {
		pkgJsonPath = moduleRequire.resolve(`${pkgName}/package.json`);
	} catch (error) {
		console.warn(
			`docusaurus-dedupe-aliases: unable to resolve ${pkgName}`,
			error
		);
		return [];
	}

	const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
	const exportKeys = getExportKeys(pkgJson.exports);

	return exportKeys.flatMap((subpath) => {
		const specifier = normalizeSubpath(pkgName, subpath);
		try {
			const target = moduleRequire.resolve(specifier);
			const aliasKey =
				subpath === '.' ? `${pkgName}$` : specifier.replace(/\\/g, '/');
			return [[aliasKey, target]];
		} catch (error) {
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
