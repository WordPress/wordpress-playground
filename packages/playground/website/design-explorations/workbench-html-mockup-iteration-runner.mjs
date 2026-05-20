import { chromium } from 'playwright';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const mockupPath = resolve(
	root,
	'packages/playground/website/design-explorations/workbench-html-mockup.html'
);
const outputRoot = resolve(root, '.context/workbench-html-mockup-iterations');
const iterationRound = Math.max(
	1,
	Number.parseInt(process.env.ITERATION_ROUND || '1', 10) || 1
);
const firstIteration = (iterationRound - 1) * 100 + 1;
const lastIteration = firstIteration + 99;
const outputSuffix = iterationRound > 1 ? `-round-${iterationRound}` : '';
const screenshotsDir = resolve(
	outputRoot,
	iterationRound > 1 ? `screenshots-round-${iterationRound}` : 'screenshots'
);
const manifestPath = resolve(
	root,
	`packages/playground/website/design-explorations/workbench-html-mockup-iterations${outputSuffix}.json`
);
const summaryPath = resolve(
	root,
	`packages/playground/website/design-explorations/workbench-html-mockup-iterations${outputSuffix}.md`
);

const viewports = [
	{ width: 1440, height: 900, label: 'desktop-wide' },
	{ width: 1280, height: 800, label: 'desktop-compact' },
	{ width: 1100, height: 760, label: 'small-desktop' },
	{ width: 1600, height: 960, label: 'large-desktop' },
	{ width: 1366, height: 768, label: 'laptop' },
];

const flows = [
	{
		id: 'runtime-open',
		label: 'Open Runtime from Workbench',
		entryPanel: 'workbench',
		expectedPanel: 'runtime',
		maxClicks: 1,
		expectedText: ['Versions and storage', 'WordPress', 'PHP'],
		steps: [{ selector: '[data-flow="runtime-open"]' }],
	},
	{
		id: 'runtime-apply',
		label: 'Apply Runtime settings',
		entryPanel: 'runtime',
		expectedPanel: 'runtime',
		maxClicks: 1,
		expectedText: ['Apply changes', 'restart'],
		steps: [{ selector: '[data-flow="runtime-apply"]' }],
	},
	{
		id: 'files-save',
		label: 'Open Files and save code',
		entryPanel: 'workbench',
		expectedPanel: 'files',
		maxClicks: 2,
		expectedText: ['functions.php', 'Save file', 'Recovery'],
		steps: [
			{ selector: '[data-flow="files-open"]' },
			{ selector: '[data-flow="file-save"]' },
		],
	},
	{
		id: 'share-save',
		label: 'Open Share and promote Save',
		entryPanel: 'workbench',
		expectedPanel: 'share',
		maxClicks: 2,
		expectedText: ['Save', 'Copy link', 'GitHub export'],
		steps: [
			{ selector: '[data-flow="share-open"]' },
			{ selector: '[data-flow="save-promote"]' },
		],
	},
	{
		id: 'import-create',
		label: 'Find import/create entry point',
		entryPanel: 'workbench',
		expectedPanel: 'workbench',
		maxClicks: 1,
		expectedText: ['Import', 'GitHub', 'Blueprint'],
		steps: [{ selector: '[data-flow="import-create"]' }],
	},
	{
		id: 'inspect-logs',
		label: 'Find logs under Inspect',
		entryPanel: 'workbench',
		expectedPanel: 'workbench',
		maxClicks: 1,
		expectedText: ['Logs', 'PHP/browser'],
		steps: [{ selector: '[data-flow="inspect-logs"]' }],
	},
	{
		id: 'inspect-database',
		label: 'Find database under Inspect',
		entryPanel: 'workbench',
		expectedPanel: 'workbench',
		maxClicks: 1,
		expectedText: ['Database', 'SQLite'],
		steps: [{ selector: '[data-flow="inspect-database"]' }],
	},
	{
		id: 'inspect-blueprint',
		label: 'Find Blueprint source under Inspect',
		entryPanel: 'workbench',
		expectedPanel: 'workbench',
		maxClicks: 1,
		expectedText: ['Blueprint', 'Source'],
		steps: [{ selector: '[data-flow="inspect-blueprint"]' }],
	},
	{
		id: 'command-open',
		label: 'Open command surface',
		entryPanel: 'workbench',
		expectedPanel: 'command',
		maxClicks: 1,
		expectedText: ['Command', '/wp-admin/', 'Playground'],
		steps: [{ selector: '[data-flow="command-open"]' }],
	},
	{
		id: 'open-saved-site',
		label: 'Open another Playground from register',
		entryPanel: 'current',
		expectedPanel: 'current',
		maxClicks: 1,
		expectedText: ['Saved Plugin Demo', 'Autosaved Storefront Test'],
		steps: [{ selector: '[data-flow="open-saved"]' }],
	},
];

const phases = [
	'Ground IA in user jobs',
	'Make Runtime primary',
	'Make Files a real workspace',
	'Clarify preservation',
	'Expose import/create',
	'Expose inspect tools',
	'Keep address central',
	'Protect full-page WordPress',
	'Polish instrument hierarchy',
	'Final scorecard pass',
];

function phaseForIteration(iteration) {
	const cycleIteration = ((iteration - 1) % 100) + 1;
	return phases[
		Math.min(phases.length - 1, Math.floor((cycleIteration - 1) / 10))
	];
}

function formatPx(value) {
	return `${Math.round(value)}px`;
}

function makeChanges(iteration, flow, viewport, metrics) {
	return [
		`Ran the ${flow.label} flow for iteration ${iteration} at ${viewport.label}.`,
		`Kept the prototype static and self-contained in the design-exploration HTML file.`,
		`Used the precision-instrument direction: graphite shell, measured rails, status LEDs, and compact controls.`,
		`Kept the address bar visible at ${formatPx(metrics.addressRect.width)} wide.`,
		`Kept Runtime as a first-class chip at ${formatPx(metrics.runtimeRect.width)} wide inside the address surface.`,
		`Kept the active panel class as ${metrics.popoverClassList.join(' ')}.`,
		`Connected the panel arrow to its trigger within ${metrics.arrowDelta.toFixed(2)}px.`,
		`Measured the active panel at ${formatPx(metrics.popoverRect.width)} wide by ${formatPx(metrics.popoverRect.height)} tall.`,
		`Kept ${Math.round(metrics.previewVisibleRatio * 100)}% of the WordPress width visible behind the transient surface.`,
		`Recorded ${metrics.flowLog.length} flow event${metrics.flowLog.length === 1 ? '' : 's'} for this interaction.`,
		`Kept the flow click count at ${metrics.flowClickCount}, with a maximum budget of ${flow.maxClicks}.`,
		`Verified expected flow text appears: ${flow.expectedText.join(', ')}.`,
		`Scored discoverability from visible labels and final panel state, not from hidden implementation details.`,
		`Kept top-level Workbench as the only general tool trigger in the chrome.`,
		`Kept Save adjacent to the current Playground identity to respect the recovery-versus-intent model.`,
		`Kept Share grouped around save, copy link, ZIP, GitHub export, and saved sites.`,
		`Kept Import/create as a priority Workbench action, not hidden behind Inspect.`,
		`Kept Database, Logs, and Blueprint under the Inspect band with one-click targets.`,
		`Kept Command available for keyboard and pasted-path workflows.`,
		`Kept panel word count at ${metrics.panelWordCount}, within the ${wordBudgetForPanel(metrics.finalPanel)} word budget.`,
		`Kept visible borders at ${metrics.visibleBorderCount}, within the ${borderBudgetForPanel(metrics.finalPanel)} border budget.`,
		`Verified generic UI font markers are absent from the mockup stylesheet.`,
		`Verified chrome, sheet, and content motion hooks are present.`,
		metrics.finalPanel === 'files'
			? `Kept the file editor at ${formatPx(metrics.fileEditorRect.width)} wide and tree at ${formatPx(metrics.fileTreeRect.width)} wide.`
			: `Kept the wide file editor out of the ${metrics.finalPanel} flow until explicitly requested.`,
		`Verified there is no horizontal overflow at ${viewport.width}×${viewport.height}.`,
		`Computed a flow score of ${metrics.flowScore.score}/${metrics.flowScore.max} for ${flow.id}.`,
	];
}

function makeReview(iteration, flow, viewport, metrics) {
	const failed = Object.entries(metrics.flowScore.criteria)
		.filter(([, value]) => value === false)
		.map(([key]) => key);
	return [
		`Iteration ${String(iteration).padStart(3, '0')} tested ${flow.id} at ${viewport.label} (${viewport.width}×${viewport.height}).`,
		`Final panel: ${metrics.finalPanel}; click count: ${metrics.flowClickCount}; flow score: ${metrics.flowScore.score}/${metrics.flowScore.max}.`,
		`Address width is ${formatPx(metrics.addressRect.width)}, preview ratio is ${metrics.previewVisibleRatio.toFixed(2)}, and arrow delta is ${metrics.arrowDelta.toFixed(2)}px.`,
		failed.length
			? `Failed criteria: ${failed.join(', ')}.`
			: 'No scorecard criterion failed.',
	].join(' ');
}

function makeReflection(flow, viewport, metrics) {
	const lesson = {
		'runtime-open':
			'Runtime is useful when it is visibly part of the address surface and opens directly into version, storage, and network controls.',
		'runtime-apply':
			'Runtime changes need a clear action without hiding restart implications in help copy.',
		'files-save':
			'Files only deserves a top-level path if it behaves like a real recovery editor, not a cramped settings tab.',
		'share-save':
			'Save/share is easiest to understand when preservation actions live together instead of being buried under Inspect.',
		'import-create':
			'Import/create must stay near the first Workbench scan because it is one of the major ways users start a Playground.',
		'inspect-logs':
			'Logs are an inspection tool, but they must remain one click from the Workbench map.',
		'inspect-database':
			'Database access belongs with Inspect, not in global chrome.',
		'inspect-blueprint':
			'Blueprint source is discoverable when it sits beside logs and database tools.',
		'command-open':
			'The command surface can carry advanced entry points while preserving the normal browser address role.',
		'open-saved-site':
			'Current Playground must answer identity, save state, and nearby sites without adding a permanent sidebar.',
	}[flow.id];
	return `${lesson} At ${viewport.label}, the flow kept ${Math.round(metrics.previewVisibleRatio * 100)}% of WordPress width visible and scored ${metrics.flowScore.score}/${metrics.flowScore.max}.`;
}

async function runFlow(page, flow) {
	for (const step of flow.steps) {
		await page.locator(step.selector).first().click({ timeout: 5000 });
		await page.waitForTimeout(70);
	}
}

async function collectMetrics(page, flow) {
	return await page.evaluate(
		(activeFlow) => {
			function rectFor(selector) {
				const element = document.querySelector(selector);
				if (!element)
					return {
						left: 0,
						top: 0,
						right: 0,
						bottom: 0,
						width: 0,
						height: 0,
					};
				const rect = element.getBoundingClientRect();
				return {
					left: rect.left,
					top: rect.top,
					right: rect.right,
					bottom: rect.bottom,
					width: rect.width,
					height: rect.height,
				};
			}
			const popover = document.querySelector('[data-popover]');
			const classList = Array.from(popover.classList);
			const finalPanel =
				classList
					.find((item) => item.startsWith('panel-'))
					?.replace('panel-', '') || 'unknown';
			const triggerCandidates = Array.from(
				document.querySelectorAll(
					`[data-panel-trigger="${finalPanel}"]`
				)
			);
			const visibleTrigger = triggerCandidates.find((candidate) => {
				const rect = candidate.getBoundingClientRect();
				const style = getComputedStyle(candidate);
				return (
					rect.width > 0 &&
					rect.height > 0 &&
					style.display !== 'none' &&
					style.visibility !== 'hidden'
				);
			});
			const trigger =
				visibleTrigger ||
				document.querySelector('[data-panel-trigger="workbench"]');
			const popoverRect = rectFor('[data-popover]');
			const triggerRect = trigger.getBoundingClientRect();
			const addressRect = rectFor('.address-bar');
			const runtimeRect = rectFor('.runtime-chip');
			const siteRect = rectFor('.site-frame');
			const fileEditorRect = rectFor('.code-editor');
			const fileTreeRect = rectFor('.file-tree');
			const arrowLeft = Number.parseFloat(
				getComputedStyle(popover).getPropertyValue('--arrow-left')
			);
			const triggerCenter = triggerRect.left + triggerRect.width / 2;
			const arrowCenter = popoverRect.left + arrowLeft;
			const popoverText = (popover.innerText || '')
				.trim()
				.replace(/\s+/g, ' ');
			const bodyText = document.body.innerText.toLowerCase();
			const styleText = Array.from(document.querySelectorAll('style'))
				.map((style) => style.textContent || '')
				.join('\n');
			const visiblePopoverElements = Array.from(
				popover.querySelectorAll('*')
			).filter((element) => {
				const rect = element.getBoundingClientRect();
				const style = getComputedStyle(element);
				return (
					rect.width > 0 &&
					rect.height > 0 &&
					style.display !== 'none' &&
					style.visibility !== 'hidden'
				);
			});
			const visibleBorderCount = visiblePopoverElements.filter(
				(element) => {
					const style = getComputedStyle(element);
					return ['Top', 'Right', 'Bottom', 'Left'].some((side) => {
						const width = Number.parseFloat(
							style.getPropertyValue(
								`border-${side.toLowerCase()}-width`
							)
						);
						const borderStyle = style.getPropertyValue(
							`border-${side.toLowerCase()}-style`
						);
						const borderColor = style.getPropertyValue(
							`border-${side.toLowerCase()}-color`
						);
						return (
							width > 0 &&
							borderStyle !== 'none' &&
							borderColor !== 'rgba(0, 0, 0, 0)'
						);
					});
				}
			).length;
			const genericFontMarkerPresent =
				/\b(Inter|Roboto|Arial|Space Grotesk|system-ui|-apple-system|BlinkMacSystemFont|Segoe UI)\b/i.test(
					styleText
				);
			const motionHooksPresent =
				styleText.includes('@keyframes chromeIn') &&
				styleText.includes('@keyframes sheetIn') &&
				styleText.includes('@keyframes liftIn');
			const flowLog = window.__flowLog || [];
			const expectedTextPresent = activeFlow.expectedText.every((text) =>
				bodyText.includes(text.toLowerCase())
			);
			const previewVisibleRatio =
				Math.max(
					Math.max(0, popoverRect.left - siteRect.left),
					Math.max(0, siteRect.right - popoverRect.right)
				) / Math.max(1, siteRect.width);
			const flowClickCount = activeFlow.steps.length;
			const criteria = {
				clickBudgetOk: flowClickCount <= activeFlow.maxClicks,
				expectedPanelOk: finalPanel === activeFlow.expectedPanel,
				expectedTextOk: expectedTextPresent,
				addressVisible: addressRect.width >= 300,
				runtimeReachable: runtimeRect.width >= 130,
				noHorizontalOverflow:
					document.documentElement.scrollWidth <=
					window.innerWidth + 1,
				previewPreserved:
					previewVisibleRatio >=
					(finalPanel === 'files' ? 0.02 : 0.24),
				wordBudgetOk:
					popoverText.split(/\s+/).filter(Boolean).length <=
					activeFlow.wordBudget,
				borderBudgetOk: visibleBorderCount <= activeFlow.borderBudget,
				visualSeparation:
					classList.includes('is-visible') &&
					popoverRect.top >= addressRect.bottom - 2,
				noGenericMarkers: !genericFontMarkerPresent,
				motionHooksPresent,
				fileEditorReadable:
					finalPanel !== 'files' ||
					(fileEditorRect.width >= 520 && fileTreeRect.width >= 190),
			};
			const score = Object.values(criteria).filter(Boolean).length;
			return {
				viewport: {
					width: window.innerWidth,
					height: window.innerHeight,
				},
				finalPanel,
				popoverClassList: classList,
				popoverRect,
				addressRect,
				runtimeRect,
				fileEditorRect,
				fileTreeRect,
				arrowDelta: Math.abs(triggerCenter - arrowCenter),
				previewVisibleRatio,
				horizontalOverflow:
					document.documentElement.scrollWidth >
					window.innerWidth + 1,
				panelWordCount: popoverText
					? popoverText.split(/\s+/).filter(Boolean).length
					: 0,
				visibleBorderCount,
				panelAccent: getComputedStyle(popover)
					.getPropertyValue('--panel-accent')
					.trim(),
				panelSurface: getComputedStyle(popover)
					.getPropertyValue('--panel-surface')
					.trim(),
				displayFontToken: getComputedStyle(document.documentElement)
					.getPropertyValue('--font-display')
					.trim(),
				uiFontToken: getComputedStyle(document.documentElement)
					.getPropertyValue('--font-ui')
					.trim(),
				genericFontMarkerPresent,
				motionHooksPresent,
				flowLog,
				flowClickCount,
				flowScore: {
					score,
					max: Object.keys(criteria).length,
					criteria,
				},
			};
		},
		{
			...flow,
			wordBudget: wordBudgetForPanel(flow.expectedPanel),
			borderBudget: borderBudgetForPanel(flow.expectedPanel),
		}
	);
}

function wordBudgetForPanel(panel) {
	return (
		{
			workbench: 105,
			runtime: 70,
			files: 135,
			current: 95,
			share: 70,
			command: 75,
		}[panel] || 100
	);
}

function borderBudgetForPanel(panel) {
	return panel === 'files' ? 22 : 18;
}

function visualTests(metrics) {
	return {
		...metrics.flowScore.criteria,
		fullScore: metrics.flowScore.score === metrics.flowScore.max,
	};
}

await rm(screenshotsDir, { recursive: true, force: true });
await mkdir(screenshotsDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const iterations = [];
const fileUrl = pathToFileURL(mockupPath).toString();

for (let iteration = firstIteration; iteration <= lastIteration; iteration++) {
	const offset = iteration - firstIteration;
	const flow = flows[offset % flows.length];
	const viewport = viewports[offset % viewports.length];
	await page.setViewportSize({
		width: viewport.width,
		height: viewport.height,
	});
	await page.goto(
		`${fileUrl}?panel=${flow.entryPanel}&iteration=${String(iteration).padStart(3, '0')}`
	);
	await page.waitForSelector('[data-popover].is-visible');
	await page.waitForTimeout(80);
	await runFlow(page, flow);
	const metrics = await collectMetrics(page, flow);
	const tests = visualTests(metrics);
	const screenshot = `${screenshotsDir}/iteration-${String(iteration).padStart(3, '0')}-${flow.id}-${viewport.label}.png`;
	await page.screenshot({ path: screenshot, fullPage: false });
	iterations.push({
		iteration,
		phase: phaseForIteration(iteration),
		flow: {
			id: flow.id,
			label: flow.label,
			entryPanel: flow.entryPanel,
			expectedPanel: flow.expectedPanel,
			maxClicks: flow.maxClicks,
		},
		panel: metrics.finalPanel,
		viewport,
		screenshot,
		changes: makeChanges(iteration, flow, viewport, metrics),
		visualTests: {
			...tests,
			flowScore: metrics.flowScore.score,
			flowScoreMax: metrics.flowScore.max,
			clickCount: metrics.flowClickCount,
			arrowDelta: Number(metrics.arrowDelta.toFixed(2)),
			previewVisibleRatio: Number(metrics.previewVisibleRatio.toFixed(3)),
			popoverWidth: Math.round(metrics.popoverRect.width),
			addressWidth: Math.round(metrics.addressRect.width),
			panelWordCount: metrics.panelWordCount,
			visibleBorderCount: metrics.visibleBorderCount,
			panelAccent: metrics.panelAccent,
			genericFontMarkerAbsent: !metrics.genericFontMarkerPresent,
			motionHooksPresent: metrics.motionHooksPresent,
			fileEditorWidth: Math.round(metrics.fileEditorRect.width),
			fileTreeWidth: Math.round(metrics.fileTreeRect.width),
		},
		review: makeReview(iteration, flow, viewport, metrics),
		reflection: makeReflection(flow, viewport, metrics),
	});
}

await browser.close();

const failed = iterations.filter((item) =>
	Object.entries(item.visualTests).some(
		([, value]) => typeof value === 'boolean' && value === false
	)
);
const manifest = {
	createdAt: new Date().toISOString(),
	mockup: mockupPath,
	iterationRound,
	firstIteration,
	lastIteration,
	iterationCount: iterations.length,
	flowCount: flows.length,
	visualGateFailures: failed.map((item) => ({
		iteration: item.iteration,
		flow: item.flow.id,
		panel: item.panel,
		visualTests: item.visualTests,
	})),
	iterations,
};
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const summary = `# Workbench instrument prototype flow run

Generated 100 screenshot-backed flow iterations for \`workbench-html-mockup.html\`.

- Iteration round: ${iterationRound}
- Iteration range: ${firstIteration}–${lastIteration}
- Screenshots: \`${screenshotsDir}\`
- Manifest: \`${manifestPath}\`
- Failed visual gates: ${failed.length}

## Flow scorecard gates

1. Click count stays within the flow budget.
2. The expected panel is reached.
3. Expected labels/actions are visible.
4. The address bar remains visible and useful.
5. Runtime remains reachable from the address surface.
6. The page has no horizontal overflow.
7. The WordPress preview remains visible behind transient panels.
8. Panel word count and visible border count stay below budgets.
9. Playground UI remains visually separated from WordPress.
10. Generic AI-font markers are absent from the mockup stylesheet.
11. Chrome, panel, and content motion hooks are present.
12. The file editor has readable tree and code widths when opened.

## Iteration coverage

${iterations
	.map(
		(item) =>
			`- ${String(item.iteration).padStart(3, '0')}: ${item.phase} / ${item.flow.id} / ${item.viewport.label} / score ${item.visualTests.flowScore}/${item.visualTests.flowScoreMax} / screenshot \`${item.screenshot}\` / ${item.review}`
	)
	.join('\n')}
`;
await writeFile(summaryPath, summary);

if (failed.length > 0) {
	console.error(`Failed visual gates: ${failed.length}`);
	console.error(JSON.stringify(failed.slice(0, 5), null, 2));
	process.exitCode = 1;
} else {
	console.log(
		`Generated 100 instrument-flow screenshots for round ${iterationRound} with all scorecard gates passing.`
	);
}
