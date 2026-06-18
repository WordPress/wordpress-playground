const path = require('path');
const fs = require('fs');

const nodeModulesDir = path.resolve(__dirname, '..', 'node_modules');

const bundleFiles = ['index.js', 'index.cjs'];
const assetExtensions = ['dat', 'so', 'wasm'];
const importRegex = new RegExp(
	`import\\(\\s*["']((?:\\./|\\.\\./)[^"']+\\.(?:${assetExtensions.join(
		'|'
	)}))["']\\s*\\)`,
	'g'
);

function getInstalledPackages(): Array<{ name: string; dir: string }> {
	const results: Array<{ name: string; dir: string }> = [];
	for (const scope of ['@php-wasm', '@wp-playground']) {
		const scopeDir = path.join(nodeModulesDir, scope);
		if (!fs.existsSync(scopeDir)) continue;
		for (const pkg of fs.readdirSync(scopeDir)) {
			const pkgDir = path.join(scopeDir, pkg);
			const pkgJsonPath = path.join(pkgDir, 'package.json');
			if (!fs.existsSync(pkgJsonPath)) continue;
			const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
			results.push({ name: pkgJson.name, dir: pkgDir });
		}
	}
	return results;
}

describe('Built package dynamic asset imports', () => {
	getInstalledPackages().forEach((pkg) => {
		it(`${pkg.name} dynamic asset imports resolve to files in dist`, () => {
			for (const bundle of bundleFiles) {
				const bundlePath = path.join(pkg.dir, bundle);
				if (!fs.existsSync(bundlePath)) continue;

				const source = fs.readFileSync(bundlePath, 'utf-8');
				const specs = [...source.matchAll(importRegex)].map(
					([, spec]) => spec
				);
				if (specs.length === 0) continue;

				for (const spec of specs) {
					const resolved = path.resolve(pkg.dir, spec);
					expect({
						bundle: `${pkg.name}/${bundle}`,
						spec,
						resolved,
						exists: fs.existsSync(resolved),
					}).toEqual({
						bundle: `${pkg.name}/${bundle}`,
						spec,
						resolved,
						exists: true,
					});
				}
			}
		});
	});
});
