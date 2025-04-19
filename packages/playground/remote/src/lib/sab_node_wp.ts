import {
	createSharedFSBuffers,
	sharedArrayBufferMount,
} from './shared-array-buffer-fs';
import { consumeAPI, spawnPHPWorkerThread } from '@php-wasm/web';
import type { ExperimentalWorkerEndpoint } from './worker-thread-shared-node';
import { getWordPressModule } from '@wp-playground/wordpress-builds';
import { bootWordPress } from '@wp-playground/wordpress';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { loadNodeRuntime } from '@php-wasm/node';
import { getSqliteDatabaseModule } from '@wp-playground/wordpress-builds';

const DEBUG = true;
const log = (...a: any[]) => DEBUG && console.log('[SABFS]', ...a);

/**
 * Boot WordPress once in this worker thread so child
 * workers can reuse it. It's simple and should speed up
 * the boot process of each child worker.
 */
const wpBuffers = createSharedFSBuffers();

log('[MAIN] Booting WordPress');

/**
 * We don't store the result in a variable because we don't need it.
 * All we want are SharedArrayBuffers populated with WordPress files.
 */
const requestHandler = await bootWordPress({
	createPhpRuntime: async () => {
		const runtime = await loadNodeRuntime(RecommendedPHPVersion);
		return runtime;
	},
	siteUrl: 'http://playground-domain/',

	wordPressZip: await getWordPressModule(),
	sqliteIntegrationPluginZip: await getSqliteDatabaseModule(),
	hooks: {
		beforeWordPressFiles: async (php) => {
			log('[MAIN] Mounting shared array buffer');
			php.mkdir('/wordpress');
			await php.mount('/wordpress', sharedArrayBufferMount(wpBuffers));
			log('[MAIN] Mounted shared array buffer');
		},
	},
});

log('[MAIN] Booted WordPress');
const response = await requestHandler.request({
	url: '/',
	method: 'GET',
	body: '',
	headers: {},
});
console.log(response.text);
// process.exit(0);

// @ts-ignore
export const experimentalSABFSWorkerUrl: string =
	new URL('./worker-thread-shared-node.ts', import.meta.url) + '';

let workerNb = 1;
async function spawnSharedFSPhpWorker() {
	log(`[MAIN] Spawning worker ${workerNb}...`);
	const experimentalPhpWorkerApi = await spawnPHPWorkerThread(
		experimentalSABFSWorkerUrl
	);
	const phpWorkerApi = consumeAPI<ExperimentalWorkerEndpoint>(
		experimentalPhpWorkerApi
	);
	await phpWorkerApi.isConnected();
	await phpWorkerApi.bootWordPress({
		sharedMounts: {
			'/wordpress': wpBuffers,
		},
	});
	await phpWorkerApi.isReady();
	log(`[MAIN] Worker ${workerNb} booted`);
	workerNb++;
	return phpWorkerApi;
}

async function main() {
	const worker1 = await spawnSharedFSPhpWorker();
	const result = await worker1.run({
		code: `<?php
require_once '/wordpress/wp-load.php';

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "[PHP] Getting post titles...\\n";

$all_posts = get_posts( array(
	'numberposts' => -1, // Get all posts
	'post_status' => 'publish', // Only published posts
	'post_type'   => 'post', // Only standard posts
) );

if ( ! empty( $all_posts ) ) {
	echo "[PHP] Found " . count($all_posts) . " posts:\\n";
	foreach ( $all_posts as $single_post ) {
		// Use htmlspecialchars to prevent potential XSS if titles contain HTML/JS
		echo "[PHP] - ID: " . $single_post->ID . ", Title: " . htmlspecialchars($single_post->post_title) . "\\n";
	}
} else {
	echo "[PHP] No posts found.\\n";
}

echo "[PHP] Finished getting post titles.\\n";
?>`,
	});
	console.log(result.text);

	// const worker2 = await spawnSharedFSPhpWorker();
	// console.log('[Node] Worker 2 spawned and ready.');

	// console.log(
	// 	'[Node] Running Worker 1 Task (Create DB, Create Table, Insert Row)...'
	// );

	// console.log('\n[Node] Test finished.');
	process.exit(0); // Explicitly exit the process
}

main().catch(console.trace);
