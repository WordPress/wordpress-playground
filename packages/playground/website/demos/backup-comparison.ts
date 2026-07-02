import {
	startPlaygroundWeb,
	type PlaygroundClient,
} from '@wp-playground/client';
import {
	wpCLI,
	zipWpContent,
	compileBlueprintV1,
	runBlueprintV1Steps,
	type BlueprintV1Declaration,
} from '@wp-playground/blueprints';
import { getRemoteUrl } from '../src/lib/config';
import { BlobReader, BlobWriter, ZipReader, type Entry } from '@zip.js/zip.js';
// @ts-ignore Provided by the website Vite config.
import { corsProxyUrl } from 'virtual:cors-proxy-url';

type ZipEntryInfo = {
	path: string;
	compressedSize: number;
	uncompressedSize: number;
	isDirectory: boolean;
};

type BackupResult = {
	id: string;
	label: string;
	filename: string;
	bytes: Uint8Array;
	entries: ZipEntryInfo[];
};

const iframe = getElement<HTMLIFrameElement>('wp');
const statusElement = getElement<HTMLElement>('status');
const resultsElement = getElement<HTMLElement>('results');
const exportLiteButton = getElement<HTMLButtonElement>('export-lite');
const exportSelfContainedButton = getElement<HTMLButtonElement>(
	'export-self-contained'
);
const blueprintBundleButton = getElement<HTMLButtonElement>('blueprint-bundle');
const clearResultsButton = getElement<HTMLButtonElement>('clear-results');

const results: BackupResult[] = [];
let playground: PlaygroundClient | undefined;
let isBusy = false;
let isBlueprintBundleMakerReady = false;

const blueprintBundleMakerPlugin = {
	step: 'installPlugin',
	pluginData: {
		resource: 'url',
		url: 'https://github.com/ashfame/blueprint-bundle-maker/archive/refs/heads/main.zip',
	},
	options: {
		activate: true,
		targetFolderName: 'blueprint-bundle-maker',
	},
} as const;

const blueprint: BlueprintV1Declaration = {
	preferredVersions: {
		php: '8.3',
		wp: 'latest',
	},
	landingPage: '/',
};

boot();

exportLiteButton.addEventListener('click', () => {
	void runBackup('Playground export (selfContained: false)', async () => {
		const bytes = await zipWpContent(await getPlayground(), {
			selfContained: false,
		});
		return {
			filename: 'playground-export-self-contained-false.zip',
			bytes,
		};
	});
});

exportSelfContainedButton.addEventListener('click', () => {
	void runBackup('Playground export (selfContained: true)', async () => {
		const bytes = await zipWpContent(await getPlayground(), {
			selfContained: true,
		});
		return {
			filename: 'playground-export-self-contained-true.zip',
			bytes,
		};
	});
});

blueprintBundleButton.addEventListener('click', () => {
	void runBackup('Blueprint Bundle Maker plugin', generateBlueprintBundle);
});

clearResultsButton.addEventListener('click', () => {
	results.splice(0);
	renderResults();
	setStatus('Results cleared.');
});

async function boot() {
	setButtonsEnabled(false);
	setStatus('Booting Playground...');

	try {
		playground = await startPlaygroundWeb({
			iframe,
			remoteUrl: getRemoteUrl().toString(),
			blueprint,
			corsProxy: corsProxyUrl,
		});
		await playground.isReady();
		setStatus('Ready.');
		setButtonsEnabled(true);
	} catch (error) {
		setStatus(`Boot failed:\n${formatError(error)}`);
	}
}

async function generateBlueprintBundle() {
	const client = await getPlayground();
	await prepareBlueprintBundleMaker(client);

	const outputPath = '/tmp/site-blueprint-bundle.zip';
	if (await client.fileExists(outputPath)) {
		await client.unlink(outputPath);
	}

	setStatus('Running WP-CLI: wp blueprint-bundle make...');
	const response = await wpCLI(client, {
		command: [
			'wp',
			'blueprint-bundle',
			'make',
			`--output=${outputPath}`,
			'--force',
		],
	});

	const cliOutput = [response.text, response.errors]
		.filter((item) => item?.trim())
		.join('\n');
	if (cliOutput) {
		setStatus(`WP-CLI finished:\n${cliOutput}`);
	}

	const bytes = await client.readFileAsBuffer(outputPath);
	return {
		filename: 'blueprint-bundle-maker.zip',
		bytes,
	};
}

async function prepareBlueprintBundleMaker(client: PlaygroundClient) {
	if (isBlueprintBundleMakerReady) {
		return;
	}

	setStatus('Installing Blueprint Bundle Maker and WP-CLI...');
	const compiled = await compileBlueprintV1(
		{
			extraLibraries: ['wp-cli'],
			steps: [blueprintBundleMakerPlugin],
		},
		{
			corsProxy: corsProxyUrl,
		}
	);
	await runBlueprintV1Steps(compiled, client);
	isBlueprintBundleMakerReady = true;
}

async function runBackup(
	label: string,
	generate: () => Promise<{ filename: string; bytes: Uint8Array }>
) {
	if (isBusy) {
		return;
	}

	isBusy = true;
	setButtonsEnabled(false);
	setStatus(`Generating ${label}...`);

	try {
		const startedAt = performance.now();
		const { filename, bytes } = await generate();
		setStatus(`Inspecting ${label}...`);
		const entries = await inspectZip(bytes);
		const elapsed = Math.round(performance.now() - startedAt);
		results.unshift({
			id: crypto.randomUUID(),
			label,
			filename,
			bytes,
			entries,
		});
		renderResults();
		setStatus(
			`${label} generated in ${formatDuration(elapsed)}.\n` +
				`${formatBytes(bytes.byteLength)} across ${entries.length} inspected entries.`
		);
	} catch (error) {
		setStatus(`${label} failed:\n${formatError(error)}`);
	} finally {
		isBusy = false;
		setButtonsEnabled(true);
	}
}

async function inspectZip(bytes: Uint8Array): Promise<ZipEntryInfo[]> {
	const blob = new Blob([bytes], { type: 'application/zip' });
	return listZipEntries(blob);
}

async function listZipEntries(
	blob: Blob,
	prefix = '',
	depth = 0
): Promise<ZipEntryInfo[]> {
	const reader = new ZipReader(new BlobReader(blob));
	try {
		const entries = await reader.getEntries();
		const infos: ZipEntryInfo[] = [];
		for (const entry of entries) {
			const path = `${prefix}${entry.filename}`;
			infos.push(toZipEntryInfo(entry, path));

			if (
				depth === 0 &&
				!entry.directory &&
				entry.filename.endsWith('.zip') &&
				entry.getData
			) {
				const nestedBlob = await entry.getData(
					new BlobWriter('application/zip')
				);
				infos.push(
					...(await listZipEntries(
						nestedBlob,
						`${path}!/`,
						depth + 1
					))
				);
			}
		}
		return infos.sort((a, b) => a.path.localeCompare(b.path));
	} finally {
		await reader.close();
	}
}

function toZipEntryInfo(entry: Entry, path: string): ZipEntryInfo {
	return {
		path,
		compressedSize: entry.compressedSize ?? 0,
		uncompressedSize: entry.uncompressedSize ?? 0,
		isDirectory: !!entry.directory,
	};
}

function renderResults() {
	clearResultsButton.disabled = results.length === 0 || isBusy;
	resultsElement.replaceChildren(
		...results.map((result) => renderResult(result))
	);
}

function renderResult(result: BackupResult) {
	const container = document.createElement('article');
	container.className = 'result';

	const header = document.createElement('div');
	header.className = 'result-header';

	const title = document.createElement('div');
	title.className = 'result-title';
	title.textContent = result.label;

	const meta = document.createElement('div');
	meta.className = 'result-meta';
	meta.textContent = [
		formatBytes(result.bytes.byteLength),
		`${result.entries.length} inspected entries`,
		result.filename,
	].join(' · ');

	const actions = document.createElement('div');
	actions.className = 'result-actions';

	const downloadButton = document.createElement('button');
	downloadButton.type = 'button';
	downloadButton.textContent = 'Download ZIP';
	downloadButton.addEventListener('click', () => downloadResult(result));
	actions.append(downloadButton);

	header.append(title, meta, actions);

	const details = document.createElement('details');
	const summary = document.createElement('summary');
	summary.textContent = 'File list';
	details.append(summary, renderEntriesTable(result.entries));

	container.append(header, details);
	return container;
}

function renderEntriesTable(entries: ZipEntryInfo[]) {
	const wrapper = document.createElement('div');
	wrapper.className = 'entries';

	const table = document.createElement('table');
	const thead = document.createElement('thead');
	const tbody = document.createElement('tbody');

	const headerRow = document.createElement('tr');
	for (const label of ['Path', 'Compressed', 'Uncompressed']) {
		const th = document.createElement('th');
		th.textContent = label;
		headerRow.append(th);
	}
	thead.append(headerRow);

	for (const entry of entries) {
		const row = document.createElement('tr');
		const path = document.createElement('td');
		path.className = 'path';
		path.textContent = entry.isDirectory ? `${entry.path}/` : entry.path;

		const compressed = document.createElement('td');
		compressed.textContent = entry.isDirectory
			? '-'
			: formatBytes(entry.compressedSize);

		const uncompressed = document.createElement('td');
		uncompressed.textContent = entry.isDirectory
			? '-'
			: formatBytes(entry.uncompressedSize);

		row.append(path, compressed, uncompressed);
		tbody.append(row);
	}

	table.append(thead, tbody);
	wrapper.append(table);
	return wrapper;
}

function downloadResult(result: BackupResult) {
	const url = URL.createObjectURL(
		new Blob([result.bytes], { type: 'application/zip' })
	);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = result.filename;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function getPlayground() {
	if (!playground) {
		throw new Error('Playground is not ready yet.');
	}
	await playground.isReady();
	return playground;
}

function setButtonsEnabled(enabled: boolean) {
	exportLiteButton.disabled = !enabled;
	exportSelfContainedButton.disabled = !enabled;
	blueprintBundleButton.disabled = !enabled;
	clearResultsButton.disabled = !enabled || results.length === 0;
}

function setStatus(message: string) {
	statusElement.textContent = message;
}

function getElement<T extends HTMLElement>(id: string) {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`Missing element: #${id}`);
	}
	return element as T;
}

function formatError(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function formatBytes(bytes: number) {
	if (bytes === 0) {
		return '0 B';
	}
	const units = ['B', 'KB', 'MB', 'GB'];
	const exponent = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1
	);
	const value = bytes / 1024 ** exponent;
	return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function formatDuration(milliseconds: number) {
	if (milliseconds < 1000) {
		return `${milliseconds} ms`;
	}
	return `${(milliseconds / 1000).toFixed(1)} s`;
}
