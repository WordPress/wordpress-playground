import { createHash } from 'node:crypto';
import {
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

type ReprintRelease = { version: string; sha256: string };

/**
 * Builds the locked client by default. `update [tag]` selects a release
 * and changes the lock only after downloading and verifying its PHAR.
 */
async function main() {
	const [command, version = 'latest'] = process.argv.slice(2);
	if (command && command !== 'update') {
		throw new Error('Usage: reprint-assets.mts [update [tag|latest]]');
	}
	const releasePath = new URL(
		'../src/lib/reprint/release.json',
		import.meta.url
	);
	const release: ReprintRelease = command
		? await resolveReprintRelease(version)
		: JSON.parse(await readFile(releasePath, 'utf8'));
	await bundleReprint(
		release,
		new URL('../public/assets/optional/reprint/', import.meta.url)
	);
	if (command) {
		await writeFile(
			releasePath,
			JSON.stringify(release, null, '\t') + '\n'
		);
	}
	console.log(`Reprint ${release.version} is ready.`);
}

/**
 * Writes a verified PHAR into the website's generated public assets directory.
 * A matching cached file avoids GitHub requests. Downloads are checked
 * before replacing files. The digest in the filename prevents stale
 * browser caches.
 */
export async function bundleReprint(
	release: ReprintRelease,
	directory: URL
): Promise<void> {
	if (!/^[a-f0-9]{64}$/.test(release.sha256)) {
		throw new Error('The Reprint release must include a SHA-256 checksum.');
	}
	const filename = `reprint-${release.sha256}.phar`;
	const destination = new URL(filename, directory);
	let cached: Buffer | undefined;
	try {
		cached = await readFile(destination);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	if (!cached || !matchesChecksum(cached, release.sha256)) {
		const response = await fetch(
			`https://github.com/WordPress/reprint/releases/download/${encodeURIComponent(release.version)}/reprint.phar`,
			{ signal: AbortSignal.timeout(120_000) }
		);
		if (!response.ok) {
			throw new Error(
				`Could not download Reprint: HTTP ${response.status}.`
			);
		}
		const bytes = Buffer.from(await response.arrayBuffer());
		if (!matchesChecksum(bytes, release.sha256)) {
			throw new Error(
				'The Reprint PHAR does not match the release checksum.'
			);
		}
		await mkdir(directory, { recursive: true });
		const temporary = new URL(`${filename}.${process.pid}.tmp`, directory);
		try {
			await writeFile(temporary, bytes);
			await rename(temporary, destination);
		} finally {
			await rm(temporary, { force: true });
		}
	}
	// Public files are copied wholesale by Vite. Keep only the selected client
	// so an update does not bundle every version used in this checkout's past.
	for (const entry of await readdir(directory)) {
		if (entry !== filename && entry.endsWith('.phar')) {
			await rm(new URL(entry, directory));
		}
	}
}

/**
 * Reads GitHub's release asset checksum, rather than asking maintainers to copy
 * it by hand. `latest` selects the latest stable release; a tag selects that
 * exact release. Optional GitHub authentication applies only to this
 * API request.
 */
export async function resolveReprintRelease(
	version: string
): Promise<ReprintRelease> {
	const endpoint =
		version === 'latest' ? 'latest' : `tags/${encodeURIComponent(version)}`;
	const response = await fetch(
		`https://api.github.com/repos/WordPress/reprint/releases/${endpoint}`,
		{
			headers: {
				Accept: 'application/vnd.github+json',
				...(process.env.GITHUB_TOKEN
					? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
					: {}),
			},
			signal: AbortSignal.timeout(30_000),
		}
	);
	if (!response.ok) {
		throw new Error(
			`Could not read the Reprint release: HTTP ${response.status}.`
		);
	}
	const release = await response.json();
	const asset = release.assets.find(
		(candidate: { name: string }) => candidate.name === 'reprint.phar'
	);
	if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest)) {
		throw new Error(
			'The Reprint release has no PHAR with a SHA-256 checksum.'
		);
	}
	return {
		version: release.tag_name,
		sha256: asset.digest.slice('sha256:'.length),
	};
}

/** Checks cached and downloaded bytes against the same release digest. */
function matchesChecksum(bytes: Uint8Array, checksum: string): boolean {
	return createHash('sha256').update(bytes).digest('hex') === checksum;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	await main();
}
