/**
 * Mirrors the WordPress/blueprints repository into the website build.
 *
 * playground.wordpress.net used to load the welcome Blueprint and the
 * Blueprints gallery index straight from raw.githubusercontent.com on every
 * boot. That made Playground unavailable whenever GitHub was down. This script
 * copies the Blueprints directory into `website/public/blueprints/` so the
 * production build serves it from its own origin, and rewrites every
 * self-referencing raw.githubusercontent.com URL inside the mirrored files
 * (Blueprint attachments, screenshots, WXR imports) to the mirror as well.
 * Without that rewrite, a Blueprint would load from the mirror but still fetch
 * its `.wxr` or `.zip` files from GitHub.
 *
 * Usage:
 *   node packages/playground/website/scripts/sync-blueprints-mirror.mjs [--optional] [--if-missing]
 *
 * Environment:
 *   BLUEPRINTS_MIRROR_SOURCE_REPO  git URL to clone (default: WordPress/blueprints on GitHub)
 *   BLUEPRINTS_MIRROR_SOURCE_REF   branch to mirror (default: trunk)
 *   BLUEPRINTS_MIRROR_BASE_URL     public URL the mirror is served from
 *                                  (default: https://playground.wordpress.net/blueprints)
 *   BLUEPRINTS_MIRROR_DIR          output directory
 *                                  (default: packages/playground/website/public/blueprints)
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const projectRoot = path.resolve(import.meta.dirname, '../../../..');
const args = new Set(process.argv.slice(2));
const optional = args.has('--optional');
const ifMissing = args.has('--if-missing');

const sourceRepo =
	process.env.BLUEPRINTS_MIRROR_SOURCE_REPO ||
	'https://github.com/WordPress/blueprints.git';
const sourceRef = process.env.BLUEPRINTS_MIRROR_SOURCE_REF || 'trunk';
const baseUrl = (
	process.env.BLUEPRINTS_MIRROR_BASE_URL ||
	'https://playground.wordpress.net/blueprints'
).replace(/\/+$/, '');
const targetDir = path.resolve(
	projectRoot,
	process.env.BLUEPRINTS_MIRROR_DIR ||
		'packages/playground/website/public/blueprints'
);

/**
 * Top-level entries of the Blueprints repository that the website needs.
 * `index.json` drives the gallery, `apps.json` the "My WordPress" app list,
 * and `blueprints/` holds the Blueprint files and their attachments.
 */
const MIRRORED_ENTRIES = ['blueprints', 'index.json', 'apps.json'];

/**
 * Text files whose contents may reference other files in the repository by
 * raw.githubusercontent.com URL.
 */
const REWRITABLE_EXTENSIONS = new Set([
	'.json',
	'.xml',
	'.wxr',
	'.md',
	'.html',
	'.txt',
	'.php',
	'.js',
	'.css',
]);

/**
 * Matches URLs pointing into the WordPress/blueprints repository on GitHub,
 * regardless of the owner's letter case, the ref (`trunk`, `refs/heads/trunk`,
 * or a commit SHA) and whether the URL is JSON-escaped (`\/`).
 *
 * The match covers the URL prefix up to and including the slash after the
 * ref, so replacing it with the mirror base URL leaves the repository path
 * intact.
 */
const SELF_REFERENCE_PATTERN =
	/https?:(?:\\?\/){2}raw\.githubusercontent\.com(?:\\?\/)wordpress(?:\\?\/)blueprints(?:\\?\/)(?:refs(?:\\?\/)heads(?:\\?\/))?[^/\\"'\s]+(?:\\?\/)/gi;

if (ifMissing && fs.existsSync(path.join(targetDir, 'index.json'))) {
	console.log(`Blueprints mirror already exists in ${targetDir}`);
	process.exit(0);
}

try {
	const checkoutDir = fs.mkdtempSync(
		path.join(os.tmpdir(), 'blueprints-mirror-')
	);
	try {
		run('git', [
			'clone',
			'--depth=1',
			'--branch',
			sourceRef,
			'--quiet',
			sourceRepo,
			checkoutDir,
		]);
		const sourceCommit = run('git', ['rev-parse', 'HEAD'], {
			cwd: checkoutDir,
		}).trim();

		fs.rmSync(targetDir, { recursive: true, force: true });
		fs.mkdirSync(targetDir, { recursive: true });
		for (const entry of MIRRORED_ENTRIES) {
			fs.cpSync(
				path.join(checkoutDir, entry),
				path.join(targetDir, entry),
				{ recursive: true }
			);
		}

		const rewritten = rewriteSelfReferences(targetDir);

		fs.writeFileSync(
			path.join(targetDir, 'mirror.json'),
			JSON.stringify(
				{
					source: sourceRepo,
					ref: sourceRef,
					commit: sourceCommit,
					baseUrl,
					syncedAt: new Date().toISOString(),
				},
				null,
				'\t'
			) + '\n'
		);
		console.log(
			`Mirrored ${sourceRepo}@${sourceCommit.slice(0, 7)} into ${targetDir} ` +
				`(${rewritten} file(s) rewritten to ${baseUrl})`
		);
	} finally {
		fs.rmSync(checkoutDir, { recursive: true, force: true });
	}
} catch (error) {
	if (optional) {
		console.warn(`Skipping Blueprints mirror sync: ${error.message}`);
		process.exit(0);
	}
	throw error;
}

function rewriteSelfReferences(dir) {
	let rewrittenFiles = 0;
	for (const file of walk(dir)) {
		if (!REWRITABLE_EXTENSIONS.has(path.extname(file).toLowerCase())) {
			continue;
		}
		const original = fs.readFileSync(file, 'utf8');
		const updated = original.replace(SELF_REFERENCE_PATTERN, (match) => {
			// Preserve JSON escaping of slashes if the original URL used it.
			const escaped = match.includes('\\/');
			const separator = escaped ? '\\/' : '/';
			return baseUrl.replaceAll('/', separator) + separator;
		});
		if (updated !== original) {
			fs.writeFileSync(file, updated);
			rewrittenFiles++;
		}
	}
	return rewrittenFiles;
}

function* walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(fullPath);
		} else if (entry.isFile()) {
			yield fullPath;
		}
	}
}

function run(command, commandArgs, { cwd = projectRoot } = {}) {
	const result = spawnSync(command, commandArgs, {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	if (result.error) {
		throw new Error(`${command} failed to start: ${result.error.message}`, {
			cause: result.error,
		});
	}
	if (result.status !== 0) {
		const output = [result.stdout, result.stderr]
			.filter(Boolean)
			.join('\n')
			.trim();
		throw new Error(
			`${command} ${commandArgs.join(' ')} exited with code ${result.status}` +
				(output ? `: ${output}` : '')
		);
	}
	return result.stdout;
}
