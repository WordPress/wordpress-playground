import type {
	BlueprintV1Declaration,
	PlaygroundClient,
} from '@wp-playground/client';
import { wpCLI, validateBlueprintDeclaration } from '@wp-playground/blueprints';
import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';
import {
	basename,
	dirname,
	joinPaths,
	phpVar,
	resolvePathUnder,
} from '@php-wasm/util';
import { getSqliteDatabasePath } from '@wp-playground/tools';
import type { PublishedFile } from './api';
import { publicFileUrl } from './paths';

export const SOURCE_DIRECTORY = '_playground';
export const MANIFEST_PATH = joinPaths(SOURCE_DIRECTORY, 'site.json');

export type SiteManifest = {
	formatVersion: 1;
	spaceId: string;
	siteUrl: string;
	uploads: string[];
};

export async function parseSetupBlueprint(
	text: string
): Promise<BlueprintV1Declaration> {
	const blueprint = JSON.parse(text);
	if (blueprint.version === 2)
		throw new Error('This prototype currently supports Blueprint v1.');
	const result = await validateBlueprintDeclaration(blueprint);
	if (!result.valid)
		throw new Error(
			'The setup Blueprint is invalid. Check its fields in the Blueprint editor.'
		);
	return {
		...blueprint,
		extraLibraries: [
			...new Set([...(blueprint.extraLibraries || []), 'wp-cli']),
		],
	};
}

/** Fetches only public data. No Spacefast connection is needed to open a site. */
export async function loadPublicSite(source: string, proxy: string) {
	const base = new URL(source.endsWith('/') ? source : `${source}/`);
	if (
		!['https:', 'http:'].includes(base.protocol) ||
		base.username ||
		base.password
	) {
		throw new Error('Enter a public HTTP or HTTPS site URL.');
	}
	const fetchFile = async (path: string) => {
		const url = publicFileUrl(path, base);
		const response = await fetchWithCorsProxy(
			url.href,
			{ credentials: 'omit', cache: 'no-store' },
			proxy
		);
		if (!response.ok)
			throw new Error(`Could not load ${path} (${response.status}).`);
		return response;
	};
	const manifest = parseManifest(
		await (await fetchFile(MANIFEST_PATH)).json()
	);
	const blueprint = await parseSetupBlueprint(
		await (
			await fetchFile(joinPaths(SOURCE_DIRECTORY, 'blueprint.json'))
		).text()
	);
	return { base: base.href, manifest, blueprint, fetchFile };
}

/** Makes a consistent SQLite snapshot, rather than copying a possibly WAL-backed file. */
export async function collectSiteFiles(
	playground: PlaygroundClient,
	blueprint: BlueprintV1Declaration,
	spaceId: string,
	onProgress: (message: string) => void
) {
	onProgress('Taking a SQLite snapshot…');
	const database = await getSqliteDatabasePath(playground);
	const snapshot = '/tmp/spacefast-database.sqlite';
	const result = await playground.run({
		code: `<?php
		$path = ${phpVar(snapshot)};
		if (file_exists($path)) { unlink($path); }
		$db = new PDO('sqlite:' . ${phpVar(database)});
		$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
		$db->exec('VACUUM INTO ' . $db->quote($path));
	`,
	});
	assertPhpSuccess(result);
	let databaseBytes: Uint8Array;
	try {
		databaseBytes = new Uint8Array(
			await playground.readFileAsBuffer(snapshot)
		);
	} finally {
		await playground.unlink(snapshot);
	}
	onProgress('Reading uploads…');
	const root = await playground.documentRoot;
	const uploads = await readDirectory(
		playground,
		joinPaths(root, 'wp-content/uploads')
	);
	const manifest: SiteManifest = {
		formatVersion: 1,
		spaceId,
		siteUrl: await playground.absoluteUrl,
		uploads: uploads.map(({ path }) => path),
	};
	const files: PublishedFile[] = [
		{ path: MANIFEST_PATH, data: jsonBlob(manifest) },
		{
			path: joinPaths(SOURCE_DIRECTORY, 'blueprint.json'),
			data: jsonBlob(blueprint),
		},
		{
			path: joinPaths(SOURCE_DIRECTORY, 'database.sqlite'),
			data: new Blob([databaseBytes], {
				type: 'application/vnd.sqlite3',
			}),
		},
		...uploads.map(({ path, data }) => ({
			path: joinPaths(SOURCE_DIRECTORY, 'uploads', path),
			data,
		})),
	];
	return { manifest, files };
}

/** Restores into a fresh runtime after its setup Blueprint has installed plugins and themes. */
export async function restoreSite(
	playground: PlaygroundClient,
	site: Awaited<ReturnType<typeof loadPublicSite>>,
	onProgress: (message: string) => void
) {
	onProgress('Loading the SQLite database…');
	const database = await getSqliteDatabasePath(playground);
	const bytes = await (
		await site.fetchFile(joinPaths(SOURCE_DIRECTORY, 'database.sqlite'))
	).arrayBuffer();
	const temporary = '/tmp/spacefast-restore.sqlite';
	await playground.writeFile(temporary, new Uint8Array(bytes));
	// No WordPress request is running in this fresh iframe while its data is installed.
	assertPhpSuccess(
		await playground.run({
			code: `<?php
		$path = ${phpVar(database)};
		foreach (array($path . '-wal', $path . '-shm', $path) as $file) {
			if (file_exists($file) && !unlink($file)) { throw new RuntimeException('Could not replace database.'); }
		}
		if (!rename(${phpVar(temporary)}, $path)) { throw new RuntimeException('Could not install database.'); }
	`,
		})
	);
	const uploadsRoot = joinPaths(
		await playground.documentRoot,
		'wp-content/uploads'
	);
	if (await playground.fileExists(uploadsRoot))
		await playground.rmdir(uploadsRoot, { recursive: true });
	await playground.mkdir(uploadsRoot);
	for (const [index, path] of site.manifest.uploads.entries()) {
		onProgress(
			`Loading upload ${index + 1}/${site.manifest.uploads.length}…`
		);
		const target = resolvePathUnder(path, uploadsRoot);
		if (!target)
			throw new Error('An upload path escapes the uploads directory.');
		await playground.mkdir(dirname(target));
		await playground.writeFile(
			target,
			new Uint8Array(
				await (
					await site.fetchFile(
						joinPaths(SOURCE_DIRECTORY, 'uploads', path)
					)
				).arrayBuffer()
			)
		);
	}
	onProgress('Updating URLs for this Playground…');
	const newUrl = await playground.absoluteUrl;
	assertPhpSuccess(
		await wpCLI(playground, {
			command: [
				'wp',
				'search-replace',
				site.manifest.siteUrl,
				newUrl,
				'--all-tables-with-prefix',
				'--precise',
			],
		})
	);
	for (const option of ['home', 'siteurl']) {
		assertPhpSuccess(
			await wpCLI(playground, {
				command: ['wp', 'option', 'update', option, newUrl],
			})
		);
	}
	const admin = await playground.run({
		code: `<?php
		require '/wordpress/wp-load.php';
		$users = get_users(array('role' => 'administrator', 'number' => 1));
		if (!$users) { throw new RuntimeException('The site has no administrator.'); }
		echo $users[0]->user_login;
	`,
	});
	assertPhpSuccess(admin);
	// The setup Blueprint may already have consumed the one-time auto-login cookie.
	await playground.defineConstant(
		'PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED',
		true
	);
	await playground.goTo(
		`/wp-login.php?${new URLSearchParams({
			playground_force_auto_login_as_user: admin.text.trim(),
			redirect_to: '/wp-admin/',
		})}`
	);
}

export async function collectStaticFiles(
	playground: PlaygroundClient,
	directory: string
) {
	const root = await playground.documentRoot;
	const output = resolvePathUnder(directory, root);
	if (
		!output ||
		output === joinPaths(root, 'wp-content') ||
		resolvePathUnder(output, joinPaths(root, 'wp-content'))
	) {
		throw new Error(
			'Choose a dedicated export directory under /wordpress, outside wp-content.'
		);
	}
	const files = (await readDirectory(playground, output)).filter(
		({ path }) => !['.htaccess', '.user.ini'].includes(basename(path))
	);
	if (!files.some(({ path }) => path === 'index.html')) {
		throw new Error(
			'The export directory must contain index.html. Generate a static export first.'
		);
	}
	if (
		files.some(
			({ path }) =>
				path === SOURCE_DIRECTORY ||
				resolvePathUnder(joinPaths('/', path), `/${SOURCE_DIRECTORY}`)
		)
	) {
		throw new Error(
			'The export directory uses the reserved _playground directory.'
		);
	}
	return files;
}

export function parseManifest(value: unknown): SiteManifest {
	const manifest = value as SiteManifest;
	if (
		!manifest ||
		manifest.formatVersion !== 1 ||
		typeof manifest.spaceId !== 'string' ||
		typeof manifest.siteUrl !== 'string' ||
		!Array.isArray(manifest.uploads) ||
		manifest.uploads.some(
			(path) =>
				typeof path !== 'string' ||
				path.startsWith('/') ||
				resolvePathUnder(path, '/uploads') !==
					joinPaths('/uploads', path)
		)
	) {
		throw new Error(
			'This URL does not contain a supported Playground site.'
		);
	}
	return manifest;
}

async function readDirectory(
	playground: PlaygroundClient,
	root: string
): Promise<PublishedFile[]> {
	const files: PublishedFile[] = [];
	if (!(await playground.fileExists(root))) return files;
	const listing = await playground.run({
		code: `<?php
		$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(
			${phpVar(root)}, FilesystemIterator::SKIP_DOTS
		));
		$files = array();
		foreach ($iterator as $file) {
			if ($file->isLink()) { throw new RuntimeException('Symlinks cannot be published.'); }
			if ($file->isFile()) { $files[] = $iterator->getSubIterator()->getSubPathname(); }
		}
		echo json_encode($files, JSON_THROW_ON_ERROR);
	`,
	});
	assertPhpSuccess(listing);
	for (const path of JSON.parse(listing.text) as string[]) {
		const absolute = resolvePathUnder(path, root);
		if (!absolute)
			throw new Error('An exported file escapes its directory.');
		files.push({
			path,
			data: new Blob([
				new Uint8Array(await playground.readFileAsBuffer(absolute)),
			]),
		});
	}
	return files;
}

function jsonBlob(value: unknown) {
	return new Blob([JSON.stringify(value, null, 2)], {
		type: 'application/json',
	});
}

function assertPhpSuccess(result: { exitCode: number; errors: string }) {
	if (result.exitCode !== 0)
		throw new Error(result.errors || 'A PHP operation failed.');
}
