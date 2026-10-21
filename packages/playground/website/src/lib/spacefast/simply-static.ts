import type {
	BlueprintV1Declaration,
	PlaygroundClient,
	StepDefinition,
	UniversalPHP,
} from '@wp-playground/client';
import {
	compileBlueprintV1,
	runBlueprintV1Steps,
} from '@wp-playground/blueprints';
import { joinPaths, phpVar } from '@php-wasm/util';
import adapter from './simply-static-adapter.php?raw';
import { collectStaticFiles } from './site';

const PLUGIN_URL =
	'https://downloads.wordpress.org/plugin/simply-static.3.8.18.zip';
const ADAPTER_PATH =
	'/wordpress/wp-content/mu-plugins/playground-spacefast-export.php';
const CONFIG_MARKER =
	'<?php /* Playground Spacefast Simply Static configuration */';
const EXPORT_DIRECTORY = '/wordpress/playground-spacefast-static';

/** Runs the same setup steps on the open site that the saved Blueprint will replay. */
export async function generateStaticSite(
	playground: PlaygroundClient,
	blueprint: BlueprintV1Declaration,
	url: string,
	proxy: string,
	onProgress: (message: string) => void
) {
	const steps = simplyStaticSteps(url);
	onProgress('Installing and configuring Simply Static…');
	const compiled = await compileBlueprintV1(
		{ steps },
		{
			corsProxy: proxy,
			onStepCompleted: (result, step) => {
				if (step.step === 'runPHP' && result.exitCode !== 0) {
					throw new Error(
						result.errors || 'Could not configure Simply Static.'
					);
				}
			},
		}
	);
	await runBlueprintV1Steps(compiled, playground as UniversalPHP);
	const savedBlueprint = {
		...blueprint,
		steps: [
			...(blueprint.steps || []).filter(
				(step) => !isSpacefastSetupStep(step)
			),
			...steps,
		],
	};
	// Never reuse an earlier export when generation fails or a page has been deleted.
	if (await playground.fileExists(EXPORT_DIRECTORY)) {
		await playground.rmdir(EXPORT_DIRECTORY, { recursive: true });
	}
	await playground.mkdir(EXPORT_DIRECTORY);
	onProgress('Generating the static website…');
	let state = await advanceExport(playground, true);
	const deadline = Date.now() + 10 * 60 * 1000;
	while (Date.now() < deadline) {
		const responses: Record<string, unknown> = {};
		for (const [index, url] of state.pendingUrls.entries()) {
			const response = await playground.request({
				url,
				headers: { 'x-playground-spacefast-crawl': '1' },
			});
			const bodyPath = joinPaths(
				'/tmp',
				`playground-spacefast-crawl-${index}.body`
			);
			await playground.writeFile(bodyPath, response.bytes);
			responses[url] = {
				bodyPath,
				status: response.httpStatusCode,
				headers: Object.fromEntries(
					Object.entries(response.headers).map(([key, values]) => [
						key,
						values.join(', '),
					])
				),
			};
		}
		await playground.writeFile(
			'/tmp/playground-spacefast-crawl.json',
			JSON.stringify(responses)
		);
		state = await advanceExport(playground, false);
		if (state.result) {
			if (state.result.status !== 'success') {
				throw new Error(
					`Simply Static export failed: ${state.result.message || state.result.status}`
				);
			}
			return {
				blueprint: savedBlueprint,
				files: await collectStaticFiles(playground, EXPORT_DIRECTORY),
			};
		}
		if (state.done)
			throw new Error(
				'Simply Static stopped before completing the export.'
			);
		onProgress(
			`Generating the static website: ${state.exportedFiles[state.exportedFiles.length - 1] || state.task || 'preparing'}…`
		);
	}
	throw new Error(
		'Simply Static export timed out. The Spacefast site has not been changed.'
	);
}

function simplyStaticSteps(url: string): StepDefinition[] {
	const destination = new URL(url);
	return [
		{
			step: 'installPlugin',
			pluginData: { resource: 'url', url: PLUGIN_URL },
			ifAlreadyInstalled: 'skip',
			options: { activate: true },
		},
		{ step: 'writeFile', path: ADAPTER_PATH, data: adapter },
		{
			step: 'runPHP',
			code: `${CONFIG_MARKER}
			require '/wordpress/wp-load.php';
			$options = \\Simply_Static\\Options::instance();
			foreach (${phpVar({
				delivery_method: 'local',
				local_dir: EXPORT_DIRECTORY,
				temp_files_dir: '/tmp/playground-spacefast-simply-static',
				destination_url_type: 'absolute',
				destination_scheme: `${destination.protocol}//`,
				destination_host: destination.host,
				clear_directory_before_export: true,
				server_cron: false,
				smart_crawl: true,
				crawlers: ['home', 'post_type', 'taxonomy'],
			})} as $key => $value) { $options->set($key, $value); }
			$options->save();
			`,
		},
	];
}

function isSpacefastSetupStep(
	step: NonNullable<BlueprintV1Declaration['steps']>[number]
) {
	if (!step || typeof step !== 'object') return false;
	return (
		(step.step === 'writeFile' && step.path === ADAPTER_PATH) ||
		(step.step === 'runPHP' &&
			typeof step.code === 'string' &&
			step.code.startsWith(CONFIG_MARKER)) ||
		(step.step === 'installPlugin' &&
			step.pluginData?.resource === 'url' &&
			step.pluginData.url === PLUGIN_URL)
	);
}

async function advanceExport(playground: PlaygroundClient, start: boolean) {
	const result = await playground.run({
		code: `<?php
		define('PLAYGROUND_SPACEFAST_EXPORT', true);
		require '/wordpress/wp-load.php';
		$plugin = \\Simply_Static\\Plugin::instance();
		$job = $plugin->get_archive_creation_job();
		if (${phpVar(start)}) {
			delete_option('playground_spacefast_export_result');
			if (!$plugin->run_static_export()) {
				throw new RuntimeException('Simply Static could not start. Check whether another export is running.');
			}
		} else {
			$job->tick();
		}
		$pending = array();
		$tasks = $job->get_batches(1);
		$next_task = $tasks ? reset($tasks)->data[0] ?? null : null;
		$pages = $next_task === 'fetch_urls' ? $job->get_task_object('fetch_urls')->get_pages_to_process() : array();
		foreach ($pages as $page) {
			if (\\Simply_Static\\Util::is_local_asset_url($page->url) &&
				is_string(\\Simply_Static\\Util::resolve_local_asset_path($page->url))) { continue; }
			$pending[] = $page->get_handler()->prepare_url($page->url);
		}
		echo json_encode(array('pendingUrls' => $pending,
			'exportedFiles' => $GLOBALS['playground_spacefast_exported_files'] ?? array(),
			'done' => $job->is_job_done(),
			'task' => $job->get_current_task(),
			'result' => get_option('playground_spacefast_export_result', null),
		), JSON_THROW_ON_ERROR);
		`,
	});
	if (result.exitCode !== 0)
		throw new Error(result.errors || 'Simply Static export failed.');
	return JSON.parse(result.text) as {
		done: boolean;
		task: string | null;
		pendingUrls: string[];
		exportedFiles: string[];
		result: { status: string; message?: string } | null;
	};
}
