import { chromium } from 'playwright';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const mockupPath = resolve(
	root,
	'packages/playground/website/design-explorations/workbench-html-mockup.html'
);
const outputRoot = resolve(
	root,
	'.context/workbench-browser-environment-checks'
);
const screenshotsDir = resolve(outputRoot, 'screenshots');
const manifestPath = resolve(outputRoot, 'manifest.json');
const summaryPath = resolve(outputRoot, 'summary.md');
const fileUrl = pathToFileURL(mockupPath).toString();

const viewports = [
	{ width: 1440, height: 900, label: 'desktop-wide' },
	{ width: 1200, height: 820, label: 'desktop-compact' },
	{ width: 1024, height: 768, label: 'small-desktop' },
	{ width: 960, height: 720, label: 'minimum-desktop' },
];

const states = [
	{
		id: 'main',
		panel: '',
		expectedText: ['Classic Mountain', '/wp-admin/', 'Environment'],
	},
	{
		id: 'runtime',
		panel: 'runtime',
		expectedText: ['Save this Playground', 'Change runtime', 'PHP 8.4'],
	},
	{
		id: 'command',
		panel: 'command',
		expectedText: [
			'Your Playgrounds',
			'SQLite database',
			'GitHub / ZIP / PR',
		],
	},
	{
		id: 'files',
		panel: 'files',
		expectedText: ['Files and recovery', 'functions.php', 'Save file'],
	},
	{
		id: 'current',
		panel: 'current',
		expectedText: [
			'Filter Playgrounds',
			'Saved Plugin Demo',
			'Local theme mount',
		],
	},
	{
		id: 'share',
		panel: 'share',
		expectedText: ['Preserve and hand off', 'Copy link', 'Download ZIP'],
	},
];

function stateUrl(state) {
	return state.panel ? `${fileUrl}?panel=${state.panel}` : fileUrl;
}

function stateBudget(state) {
	return {
		main: { maxSurfaceRatio: 0.05, maxVisibleBorderCount: 0 },
		runtime: { maxSurfaceRatio: 0.56, maxVisibleBorderCount: 12 },
		command: { maxSurfaceRatio: 0.57, maxVisibleBorderCount: 8 },
		files: { maxSurfaceRatio: 0.62, maxVisibleBorderCount: 12 },
		current: { maxSurfaceRatio: 0.53, maxVisibleBorderCount: 10 },
		share: { maxSurfaceRatio: 0.42, maxVisibleBorderCount: 8 },
	}[state.id];
}

async function collectMetrics(page, state) {
	return page.evaluate(
		({ expectedText, stateId, maxSurfaceRatio, maxVisibleBorderCount }) => {
			function rectFor(selector) {
				const element = document.querySelector(selector);
				if (!element) {
					return {
						left: 0,
						top: 0,
						width: 0,
						height: 0,
						right: 0,
						bottom: 0,
					};
				}
				const rect = element.getBoundingClientRect();
				return {
					left: rect.left,
					top: rect.top,
					width: rect.width,
					height: rect.height,
					right: rect.right,
					bottom: rect.bottom,
				};
			}

			function isVisible(selector) {
				const element = document.querySelector(selector);
				if (!element) return false;
				const rect = element.getBoundingClientRect();
				const style = getComputedStyle(element);
				return (
					rect.width > 0 &&
					rect.height > 0 &&
					style.display !== 'none' &&
					style.visibility !== 'hidden'
				);
			}

			const inputText = Array.from(document.querySelectorAll('input'))
				.map(
					(input) =>
						input.value || input.getAttribute('aria-label') || ''
				)
				.join(' ');
			const ariaText = Array.from(
				document.querySelectorAll('[aria-label]')
			)
				.map((element) => element.getAttribute('aria-label') || '')
				.join(' ');
			const bodyText =
				`${document.body.innerText} ${inputText} ${ariaText}`.toLowerCase();
			const chromeRect = rectFor('.chrome');
			const addressRect = rectFor('.address-card');
			const environmentRect = rectFor('.environment-pill');
			const siteRect = rectFor('.site-frame');
			const popoverRect = rectFor('[data-popover]');
			const commandRect = rectFor('[data-command-layer]');
			const trayRect = rectFor('[data-files-tray]');
			const editorRect = rectFor('.editor');
			const fileTreeRect = rectFor('.file-tree');
			const recoveryRect = rectFor('.recovery-rail');
			const activeSurface = isVisible('[data-files-tray]')
				? 'files'
				: isVisible('[data-command-layer]')
					? 'command'
					: isVisible('[data-popover]')
						? document.querySelector('[data-popover]').dataset
								.surface || 'popover'
						: 'main';
			const activeRect =
				activeSurface === 'files'
					? trayRect
					: activeSurface === 'command'
						? commandRect
						: activeSurface === 'main'
							? { width: 0, height: 0 }
							: popoverRect;
			const activeElement =
				activeSurface === 'files'
					? document.querySelector('[data-files-tray]')
					: activeSurface === 'command'
						? document.querySelector('[data-command-layer]')
						: activeSurface === 'main'
							? null
							: document.querySelector('[data-popover]');
			const visibleBorderCount = activeElement
				? [
						activeElement,
						...activeElement.querySelectorAll('*'),
					].filter((element) => {
						const rect = element.getBoundingClientRect();
						const style = getComputedStyle(element);
						return (
							rect.width > 0 &&
							rect.height > 0 &&
							['top', 'right', 'bottom', 'left'].some(
								(side) =>
									Number.parseFloat(
										style.getPropertyValue(
											`border-${side}-width`
										)
									) > 0 &&
									style.getPropertyValue(
										`border-${side}-style`
									) !== 'none' &&
									style.getPropertyValue(
										`border-${side}-color`
									) !== 'rgba(0, 0, 0, 0)'
							)
						);
					}).length
				: 0;
			const surfaceRatio =
				(activeRect.width * activeRect.height) /
				Math.max(1, window.innerWidth * window.innerHeight);
			const expectedTextOk = expectedText.every((text) =>
				bodyText.includes(text.toLowerCase())
			);
			const criteria = {
				noHorizontalOverflow:
					document.documentElement.scrollWidth <=
					window.innerWidth + 1,
				addressVisibleAndCentral:
					addressRect.width >= 360 &&
					Math.abs(
						addressRect.left +
							addressRect.width / 2 -
							window.innerWidth / 2
					) <=
						window.innerWidth * 0.18,
				environmentVisible: environmentRect.width >= 180,
				wordpressCanvasVisible:
					siteRect.width >= window.innerWidth * 0.84 &&
					siteRect.height >= 420,
				expectedTextOk,
				surfaceBounded: surfaceRatio <= maxSurfaceRatio,
				borderUseIntentional:
					visibleBorderCount <= maxVisibleBorderCount,
				playgroundSeparated: chromeRect.bottom <= siteRect.top + 2,
				filesEditorReadable:
					stateId !== 'files' ||
					(window.innerWidth < 1280
						? editorRect.width >= 430 && fileTreeRect.width >= 150
						: editorRect.width >= 430 &&
							fileTreeRect.width >= 150 &&
							recoveryRect.width >= 180),
			};
			return {
				viewport: {
					width: window.innerWidth,
					height: window.innerHeight,
				},
				activeSurface,
				addressRect,
				environmentRect,
				siteRect,
				activeRect,
				surfaceRatio: Number(surfaceRatio.toFixed(3)),
				visibleBorderCount,
				editorRect,
				fileTreeRect,
				recoveryRect,
				criteria,
			};
		},
		{ ...state, stateId: state.id, ...stateBudget(state) }
	);
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(screenshotsDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];

for (const viewport of viewports) {
	await page.setViewportSize({
		width: viewport.width,
		height: viewport.height,
	});
	for (const state of states) {
		await page.goto(stateUrl(state));
		await page.waitForSelector('.chrome');
		await page.waitForTimeout(80);
		const metrics = await collectMetrics(page, state);
		const screenshot = resolve(
			screenshotsDir,
			`${viewport.label}-${state.id}.png`
		);
		await page.screenshot({ path: screenshot, fullPage: false });
		results.push({ viewport, state: state.id, screenshot, ...metrics });
	}
}

await browser.close();

const failures = results.filter((result) =>
	Object.values(result.criteria).some((value) => value === false)
);
const manifest = {
	createdAt: new Date().toISOString(),
	mockup: mockupPath,
	results,
	failures: failures.map((result) => ({
		viewport: result.viewport.label,
		state: result.state,
		criteria: result.criteria,
	})),
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const summary = `# Browser/environment mockup checks

Generated ${results.length} screenshots for ${states.length} states across ${viewports.length} desktop breakpoints.

- Screenshots: \`${screenshotsDir}\`
- Manifest: \`${manifestPath}\`
- Failures: ${failures.length}

## Gates

- No horizontal overflow.
- Address remains visible and central.
- Environment pill remains visible.
- WordPress canvas remains the page owner.
- Expected labels/actions are visible in each state.
- Transient surfaces stay bounded.
- Visible border count stays bounded, allowing structural borders without card noise.
- Playground chrome is visually separated from WordPress.
- Files has readable tree, editor, and recovery rail widths.
`;
await writeFile(summaryPath, summary);

if (failures.length) {
	console.error(`Browser/environment checks failed: ${failures.length}`);
	console.error(JSON.stringify(failures, null, 2));
	process.exitCode = 1;
} else {
	console.log(
		`Browser/environment checks passed: ${results.length} screenshots, 0 failures.`
	);
}
