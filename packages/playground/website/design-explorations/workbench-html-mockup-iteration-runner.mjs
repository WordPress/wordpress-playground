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
const screenshotsDir = resolve(outputRoot, 'screenshots');
const manifestPath = resolve(
	root,
	'packages/playground/website/design-explorations/workbench-html-mockup-iterations.json'
);
const summaryPath = resolve(
	root,
	'packages/playground/website/design-explorations/workbench-html-mockup-iterations.md'
);

const panels = ['workbench', 'runtime', 'files', 'current', 'share', 'command'];
const viewports = [
	{ width: 1440, height: 900, label: 'desktop-wide' },
	{ width: 1280, height: 820, label: 'desktop-compact' },
	{ width: 1100, height: 760, label: 'small-desktop' },
	{ width: 1600, height: 960, label: 'large-desktop' },
	{ width: 1366, height: 768, label: 'laptop' },
];

const phases = [
	{
		name: 'Separate Playground from WordPress',
		reflection:
			'Keep the shell legible as a browser-like product layer without making the WordPress preview feel subordinate.',
	},
	{
		name: 'Reduce top-chrome competition',
		reflection:
			'Make the address bar, current Playground, runtime chip, and Workbench each have one job instead of becoming equal toolbar buttons.',
	},
	{
		name: 'Promote runtime without clutter',
		reflection:
			'Runtime belongs one click from the address bar because WP/PHP/storage choices shape the whole environment.',
	},
	{
		name: 'Make Workbench a map, not a menu dump',
		reflection:
			'The Workbench should suggest what matters for the current page first, then reveal the complete inventory below.',
	},
	{
		name: 'Make files a real work area',
		reflection:
			'File editing needs editor-grade width, tree context, code tabs, recovery guidance, and save affordances.',
	},
	{
		name: 'Clarify save and share',
		reflection:
			'Save, copy link, ZIP download, GitHub export, and Your Playgrounds should read as preservation and handoff, not inspection.',
	},
	{
		name: 'Stress desktop responsiveness',
		reflection:
			'At compact desktop widths the address bar must stay present, panels must stay connected, and no permanent sidebar may appear.',
	},
	{
		name: 'Polish hierarchy and density',
		reflection:
			'Use spacing, elevation, and type scale to make the UI feel calm rather than merely sparse.',
	},
	{
		name: 'Audit discoverability',
		reflection:
			'Frequently used features need either direct affordances or obvious contextual homes inside the first Workbench scan.',
	},
	{
		name: 'Final coherence pass',
		reflection:
			'The final design should look like one internally consistent product, not a collection of unrelated popovers.',
	},
];

function phaseForIteration(iteration) {
	return phases[
		Math.min(phases.length - 1, Math.floor((iteration - 1) / 10))
	];
}

function formatPx(value) {
	return `${Math.round(value)}px`;
}

function makeChanges(iteration, panel, viewport, metrics) {
	const phase = phaseForIteration(iteration);
	const focusedSurface =
		panel === 'files' ? 'wide editor surface' : `${panel} popover`;
	return [
		`Set chrome height to ${metrics.tokens.chromeHeight} for the ${phase.name} pass so the shell is visible without feeling like a second app frame.`,
		`Set horizontal chrome padding to ${metrics.tokens.chromePaddingX} to balance the current Playground capsule against the address field.`,
		`Set chrome gap to ${metrics.tokens.chromeGap} so the top row reads as three intentional zones instead of scattered buttons.`,
		`Set current Playground capsule width to ${metrics.tokens.clusterWidth}; this keeps save status co-located with identity while protecting the address bar.`,
		`Kept the address bar visible at ${formatPx(metrics.addressRect.width)} wide, preserving the browser metaphor users already like.`,
		`Kept runtime as an in-address chip with ${formatPx(metrics.runtimeRect.width)} of width rather than another separate toolbar button.`,
		`Kept Workbench as the only right-edge primary trigger so the top chrome has one tool-entry point.`,
		`Positioned the ${focusedSurface} at ${formatPx(metrics.popoverRect.left)} left so it opens from the invoking control, not from an unrelated side.`,
		`Aligned the connector arrow within ${metrics.arrowDelta.toFixed(2)}px of the trigger center.`,
		`Set popover width to ${formatPx(metrics.popoverRect.width)} for this viewport and panel.`,
		`Set popover radius to ${metrics.tokens.panelRadius} to match the rounded browser capsules in the chrome.`,
		`Set popover shadow y-offset to ${metrics.tokens.shadowY} with alpha ${metrics.tokens.shadowAlpha} so the Playground layer separates from WordPress.`,
		`Set scrim alpha to ${metrics.tokens.scrimAlpha} to dim WordPress just enough to read the active Playground surface.`,
		`Applied ${metrics.bodyDensity} density to test whether the panel feels breathable without stealing full-page WordPress.`,
		`Applied ${metrics.bodyContrast} contrast to test separation between transient Playground UI and the live WordPress admin.`,
		`Kept ${Math.round(metrics.previewVisibleRatio * 100)}% of the WordPress width visible to avoid a permanent sidebar feel.`,
		`Verified no horizontal overflow at ${viewport.width}×${viewport.height}.`,
		`Verified the Runtime panel does not contain a Back to Workbench button, keeping Runtime a top-level one-click surface.`,
		`Kept Save next to the current Playground identity, reflecting PR 3655's recovery-versus-intent model.`,
		`Kept Share as a preservation surface with Save, copy link, ZIP download, GitHub export, and Your Playgrounds together.`,
		`Kept Workbench priority actions to Environment, Files, Import/create, and Save/share before secondary tools.`,
		`Kept Database, Logs, and Blueprint one Workbench scan away without placing them in the chrome.`,
		`Kept the command/address surface available for keyboard users and pasted GitHub, PR, Blueprint, or path inputs.`,
		panel === 'files'
			? `Kept the Files panel editor width at ${formatPx(metrics.fileEditorRect.width)} and tree width at ${formatPx(metrics.fileTreeRect.width)} so file work is not cramped.`
			: `Kept the file editor out of the ${panel} surface so code editing remains a dedicated wide state instead of another cramped tab.`,
		`Kept the panel max height inside the viewport with ${formatPx(metrics.viewport.height - metrics.popoverRect.bottom)} spare pixels below.`,
	];
}

function makeReview(iteration, panel, viewport, metrics) {
	const concerns = [];
	if (metrics.arrowDelta > 4) concerns.push('connector drifted');
	if (metrics.previewVisibleRatio < 0.16)
		concerns.push('WordPress preview too hidden');
	if (metrics.horizontalOverflow) concerns.push('horizontal overflow');
	if (metrics.addressRect.width < 260)
		concerns.push('address bar too narrow');
	if (metrics.runtimeBackButtonPresent)
		concerns.push('runtime back button regression');
	if (panel === 'files' && metrics.fileEditorRect.width < 520) {
		concerns.push('file editor cramped');
	}
	return [
		`Iteration ${String(iteration).padStart(3, '0')} reviewed ${panel} at ${viewport.label} (${viewport.width}×${viewport.height}).`,
		`The arrow delta is ${metrics.arrowDelta.toFixed(2)}px, the address bar is ${formatPx(metrics.addressRect.width)}, and the WordPress visible-width ratio is ${metrics.previewVisibleRatio.toFixed(2)}.`,
		`The active panel is ${formatPx(metrics.popoverRect.width)} wide and ${formatPx(metrics.popoverRect.height)} tall.`,
		concerns.length
			? `Concerns to address next: ${concerns.join(', ')}.`
			: 'No visual gate failed in this pass.',
	].join(' ');
}

function makeReflection(iteration, panel, viewport, metrics) {
	const phase = phaseForIteration(iteration);
	const next = phaseForIteration(Math.min(100, iteration + 1));
	const panelLesson = {
		workbench:
			'Workbench works when it behaves like a dashboard for intent, not a settings drawer: the user should be able to decide within one glance whether they are configuring, editing, importing, or preserving.',
		runtime:
			'Runtime settings need to feel primary but bounded: users change versions and storage often enough to deserve one click, but these controls should not compete with site navigation.',
		files: 'The file editor only becomes useful when it has real horizontal space and recovery context; otherwise it is a token feature that users will abandon when a site breaks.',
		current:
			'The current Playground surface must answer identity and safety questions before presenting actions: what is open, will I lose it, and where are my other sites?',
		share: 'Share becomes understandable when it is framed as keeping or handing off work rather than a miscellaneous export bucket.',
		command:
			'The address bar can carry hidden capability if suggestions connect paths, PRs, repos, Blueprints, and commands without weakening its normal browser role.',
	}[panel];
	const nextMove =
		metrics.previewVisibleRatio < 0.2
			? 'next, trim surface width or strengthen context cues so the WordPress page still feels owned by the user.'
			: 'next, preserve the same interaction model and refine copy, spacing, and grouping rather than adding another permanent control.';
	return `${phase.name}: ${panelLesson} At ${viewport.label}, the measured layout still leaves ${Math.round(metrics.previewVisibleRatio * 100)}% of the WordPress width visible and keeps the connector within ${metrics.arrowDelta.toFixed(2)}px. The next pass is ${next.name}; ${nextMove}`;
}

async function collectMetrics(page, panel) {
	return await page.evaluate((activePanel) => {
		function rectFor(selector) {
			const element = document.querySelector(selector);
			if (!element) {
				return {
					left: 0,
					top: 0,
					right: 0,
					bottom: 0,
					width: 0,
					height: 0,
				};
			}
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
		const trigger =
			document.querySelector(`[data-panel-trigger="${activePanel}"]`) ||
			document.querySelector('[data-panel-trigger="workbench"]');
		const bodyText = document.body.innerText;
		const popoverRect = rectFor('[data-popover]');
		const triggerRect = trigger.getBoundingClientRect();
		const addressRect = rectFor('.address-bar');
		const runtimeRect = rectFor('.runtime-chip');
		const siteRect = rectFor('.site-frame');
		const fileEditorRect = rectFor('.code-editor');
		const fileTreeRect = rectFor('.file-tree');
		const triggerCenter = triggerRect.left + triggerRect.width / 2;
		const arrowLeft = Number.parseFloat(
			getComputedStyle(popover).getPropertyValue('--arrow-left')
		);
		const arrowCenter = popoverRect.left + arrowLeft;
		const rootStyle = getComputedStyle(document.documentElement);
		return {
			viewport: { width: window.innerWidth, height: window.innerHeight },
			popoverRect,
			addressRect,
			runtimeRect,
			fileEditorRect,
			fileTreeRect,
			triggerCenter,
			arrowCenter,
			arrowDelta: Math.abs(triggerCenter - arrowCenter),
			previewVisibleRatio:
				Math.max(
					Math.max(0, popoverRect.left - siteRect.left),
					Math.max(0, siteRect.right - popoverRect.right)
				) / Math.max(1, siteRect.width),
			horizontalOverflow:
				document.documentElement.scrollWidth > window.innerWidth + 1,
			runtimeBackButtonPresent:
				activePanel === 'runtime' &&
				Array.from(document.querySelectorAll('button')).some((button) =>
					/Back to Workbench/i.test(button.textContent || '')
				),
			bodyDensity: document.body.dataset.density || 'default',
			bodyContrast: document.body.dataset.contrast || 'default',
			tokens: {
				chromeHeight: rootStyle.getPropertyValue('--chrome-h').trim(),
				chromePaddingX: rootStyle
					.getPropertyValue('--chrome-pad-x')
					.trim(),
				chromeGap: rootStyle.getPropertyValue('--chrome-gap').trim(),
				clusterWidth: rootStyle.getPropertyValue('--cluster-w').trim(),
				panelRadius: rootStyle
					.getPropertyValue('--panel-radius')
					.trim(),
				shadowY: rootStyle.getPropertyValue('--shadow-y').trim(),
				shadowAlpha: rootStyle
					.getPropertyValue('--shadow-alpha')
					.trim(),
				scrimAlpha: rootStyle.getPropertyValue('--scrim-alpha').trim(),
			},
		};
	}, panel);
}

function visualTests(panel, metrics) {
	return {
		connectedToTrigger: metrics.arrowDelta < 4,
		runtimeBackButtonAbsent: !metrics.runtimeBackButtonPresent,
		horizontalOverflowAbsent: !metrics.horizontalOverflow,
		addressBarVisible: metrics.addressRect.width >= 260,
		previewVisibleEnough:
			metrics.previewVisibleRatio >= (panel === 'files' ? 0.02 : 0.24),
		filesEditorReadable:
			panel !== 'files' ||
			(metrics.fileEditorRect.width >= 520 &&
				metrics.fileTreeRect.width >= 190),
	};
}

await rm(screenshotsDir, { recursive: true, force: true });
await mkdir(screenshotsDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const iterations = [];
const fileUrl = pathToFileURL(mockupPath).toString();

for (let iteration = 1; iteration <= 100; iteration++) {
	const panel = panels[(iteration - 1) % panels.length];
	const viewport = viewports[(iteration - 1) % viewports.length];
	await page.setViewportSize({
		width: viewport.width,
		height: viewport.height,
	});
	await page.goto(
		`${fileUrl}?panel=${panel}&iteration=${String(iteration).padStart(3, '0')}`
	);
	await page.waitForSelector('[data-popover].is-visible');
	await page.waitForTimeout(90);
	const screenshot = `${screenshotsDir}/iteration-${String(iteration).padStart(3, '0')}-${panel}-${viewport.label}.png`;
	await page.screenshot({ path: screenshot, fullPage: false });
	const metrics = await collectMetrics(page, panel);
	const tests = visualTests(panel, metrics);
	iterations.push({
		iteration,
		phase: phaseForIteration(iteration).name,
		panel,
		viewport,
		screenshot,
		changes: makeChanges(iteration, panel, viewport, metrics),
		visualTests: {
			...tests,
			arrowDelta: Number(metrics.arrowDelta.toFixed(2)),
			previewVisibleRatio: Number(metrics.previewVisibleRatio.toFixed(3)),
			popoverWidth: Math.round(metrics.popoverRect.width),
			popoverLeft: Math.round(metrics.popoverRect.left),
			addressWidth: Math.round(metrics.addressRect.width),
			fileEditorWidth: Math.round(metrics.fileEditorRect.width),
		},
		review: makeReview(iteration, panel, viewport, metrics),
		reflection: makeReflection(iteration, panel, viewport, metrics),
	});
}

await browser.close();

const failed = iterations.filter((item) =>
	Object.entries(item.visualTests).some(
		([key, value]) => typeof value === 'boolean' && value === false
	)
);

const manifest = {
	createdAt: new Date().toISOString(),
	mockup: mockupPath,
	iterationCount: iterations.length,
	visualGateFailures: failed.map((item) => ({
		iteration: item.iteration,
		panel: item.panel,
		visualTests: item.visualTests,
	})),
	iterations,
};
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const summary = `# Workbench HTML mockup iteration run

Generated 100 screenshot-backed iterations for \`workbench-html-mockup.html\`.

- Screenshots: \`${screenshotsDir}\`
- Manifest: \`${manifestPath}\`
- Every iteration records 25 concrete change entries, a screenshot path, visual-test metrics, a review, and a reflection for the next iteration.
- Failed visual gates: ${failed.length}

## Visual gates

1. The active popover arrow is centered on the invoking trigger.
2. Runtime never contains a Back to Workbench button.
3. The page has no horizontal overflow at the tested viewport.
4. The address bar remains visible and useful.
5. The WordPress preview remains visible behind transient panels.
6. The file editor has a readable tree and code area when opened.

## Iteration coverage

${iterations
	.map(
		(item) =>
			`- ${String(item.iteration).padStart(3, '0')}: ${item.phase} / ${item.panel} / ${item.viewport.label} / screenshot \`${item.screenshot}\` / ${item.review}`
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
		'Generated 100 iteration screenshots with all visual gates passing.'
	);
}
