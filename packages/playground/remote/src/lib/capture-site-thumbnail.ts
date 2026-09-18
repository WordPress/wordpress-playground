import { domToCanvas } from 'modern-screenshot';
import type { SiteThumbnail } from './playground-client';
// @ts-ignore -- Vite resolves this URL import; ambient declarations break package consumers.
import resourceWorkerUrl from 'modern-screenshot/worker?url';

const CAPTURE_WIDTH = 1024;
const CAPTURE_HEIGHT = 768;
const THUMBNAIL_WIDTH = 320;
const CAPTURE_TIMEOUT_MS = 3000;
const CLONED_NODES_PER_YIELD = 100;

/**
 * Renders the current WordPress document as a compact site thumbnail.
 *
 * This module is loaded inside the WordPress iframe. The remote frame cannot
 * read that document when Document-Isolation-Policy is active, so capture must
 * happen on this side of the frame boundary. DOM and computed-style work must
 * remain in this event loop. The resource worker handles supported fetches,
 * and the phase callbacks yield so other tasks can run during the remaining
 * renderer work.
 */
export async function captureSiteThumbnail(): Promise<SiteThumbnail> {
	document
		.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')
		.forEach((image) => (image.loading = 'eager'));

	await yieldToNextTask();
	await waitForFonts();
	await yieldToNextTask();

	let clonedNodeCount = 0;
	const canvas = await domToCanvas(document.documentElement, {
		width: CAPTURE_WIDTH,
		height: CAPTURE_HEIGHT,
		scale: THUMBNAIL_WIDTH / CAPTURE_WIDTH,
		backgroundColor: '#ffffff',
		timeout: CAPTURE_TIMEOUT_MS,
		workerUrl: getResourceWorkerUrl(),
		filter: (node) =>
			!(node instanceof HTMLElement && node.id === 'wpadminbar'),
		onCloneEachNode: async () => {
			clonedNodeCount++;
			if (clonedNodeCount % CLONED_NODES_PER_YIELD === 0) {
				await yieldDuringClone();
			}
		},
		onCloneNode: async (cloned) => {
			prepareClonedDocument(cloned);
			await yieldToNextTask();
		},
		onEmbedNode: yieldToNextTask,
		onCreateForeignObjectSvg: yieldToNextTask,
	});

	await yieldToNextTask();
	let blob = await canvasToBlob(canvas, 'image/webp', 0.68);
	if (blob.type !== 'image/webp') {
		await yieldToNextTask();
		blob = await canvasToBlob(canvas, 'image/jpeg', 0.72);
	}
	const dataUrl = await blobToDataUrl(blob);
	const dataUrlPrefix = `data:${blob.type};base64,`;
	if (!dataUrl.startsWith(dataUrlPrefix)) {
		throw new Error(
			'The site thumbnail renderer returned an invalid image.'
		);
	}
	return {
		mime: blob.type,
		data: dataUrl.slice(dataUrlPrefix.length),
	};
}

(
	globalThis as typeof globalThis & {
		__playgroundCaptureSiteThumbnail?: typeof captureSiteThumbnail;
	}
).__playgroundCaptureSiteThumbnail = captureSiteThumbnail;

async function waitForFonts() {
	if (!document.fonts) {
		return;
	}
	await Promise.race([
		document.fonts.ready,
		new Promise((resolve) => setTimeout(resolve, CAPTURE_TIMEOUT_MS)),
	]);
}

function getResourceWorkerUrl() {
	const url = new URL(resourceWorkerUrl, window.location.href);
	// The service worker uses this marker to serve the bundled worker instead
	// of treating its URL as a file inside the scoped WordPress site.
	url.searchParams.set('playground-site-thumbnail-worker', '1');
	return url.href;
}

/**
 * A timer lets Chromium navigate modern-screenshot's internal style iframe
 * midway through cloning, when its document briefly has no body. The scheduler
 * continuation stays ahead of navigation while still allowing input to run.
 */
async function yieldDuringClone() {
	const scheduler = (
		globalThis as typeof globalThis & {
			scheduler?: { yield?: () => Promise<void> };
		}
	).scheduler;
	if (scheduler?.yield) {
		await scheduler.yield();
		return;
	}
	await yieldToNextTask();
}

async function yieldToNextTask() {
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function prepareClonedDocument(cloned: Node) {
	if (!(cloned instanceof HTMLElement)) {
		return;
	}
	cloned.style.setProperty('margin-top', '0', 'important');
	const style = cloned.ownerDocument.createElement('style');
	style.textContent = `
		*, *::before, *::after {
			animation: none !important;
			caret-color: transparent !important;
			transition: none !important;
		}
	`;
	cloned.querySelector('head')?.append(style);
}

function canvasToBlob(
	canvas: HTMLCanvasElement,
	type: string,
	quality: number
) {
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error('The site thumbnail encoder failed.'));
				}
			},
			type,
			quality
		);
	});
}

function blobToDataUrl(blob: Blob) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}
