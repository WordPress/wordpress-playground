const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '../../../../..');
const nodeModulesDir = path.resolve(__dirname, '..', 'node_modules');

/**
 * Maps a package name like "@php-wasm/web" to its project directory
 * in the repo like "packages/php-wasm/web".
 */
function getProjectDirectory(packageName: string): string | null {
	const match = packageName.match(/^@(php-wasm|wp-playground)\/(.+)$/);
	if (!match) return null;
	const layer = match[1] === 'wp-playground' ? 'playground' : match[1];
	return path.join(repoRoot, 'packages', layer, match[2]);
}

/**
 * Returns the list of source files for a project by reading the
 * tsconfig.lib.json include/exclude patterns — but as a simpler
 * approximation, returns all .ts files NOT inside a /test/ directory.
 */
function getSourceImports(projectDir: string): Set<string> {
	const imports = new Set<string>();
	function walk(dir: string) {
		if (!fs.existsSync(dir)) return;
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== 'test' && entry.name !== 'node_modules') {
					walk(full);
				}
			} else if (
				entry.name.endsWith('.ts') ||
				entry.name.endsWith('.tsx')
			) {
				const content = fs.readFileSync(full, 'utf-8');
				// Match: import '...', import('...'), from '...'
				const patterns = [
					/from\s+['"]([^./][^'"]*)['"]/g,
					/import\s+['"]([^./][^'"]*)['"]/g,
					/import\(\s*['"]([^./][^'"]*)['"]\s*\)/g,
				];
				for (const re of patterns) {
					let m;
					while ((m = re.exec(content)) !== null) {
						const imp = m[1];
						const pkg = imp.startsWith('@')
							? imp.split('/').slice(0, 2).join('/')
							: imp.split('/')[0];
						imports.add(pkg);
					}
				}
			}
		}
	}
	walk(path.join(projectDir, 'src'));

	return imports;
}

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

describe('Built package dependencies', () => {
	getInstalledPackages().forEach((pkg) => {
		it(`${pkg.name} should only declare dependencies imported from source files`, () => {
			const directory = getProjectDirectory(pkg.name);

			if (!directory || !fs.existsSync(directory)) return;

			const sourceImports = getSourceImports(directory);

			const packageJsonFile = JSON.parse(
				fs.readFileSync(path.join(pkg.dir, 'package.json'), 'utf-8')
			);

			const dependencies = Object.keys(
				packageJsonFile.dependencies || {}
			);

			for (const dependency of dependencies) {
				expect(sourceImports).toContain(dependency);
			}
		});
	});
});
