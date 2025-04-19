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
const internalSharedBuffers = createSharedFSBuffers();

log('[MAIN] Booting WordPress');

let firstTime = true;

/**
 * We don't store the result in a variable because we don't need it.
 * All we want are SharedArrayBuffers populated with WordPress files.
 */
const requestHandler = await bootWordPress({
	createPhpRuntime: async () => await loadNodeRuntime(RecommendedPHPVersion),
	siteUrl: 'http://playground-domain/',

	wordPressZip: await getWordPressModule(),
	sqliteIntegrationPluginZip: await getSqliteDatabaseModule(),
	hooks: {
		/**
		 * A hook I added temporarily for the sake of explorations.
		 * I'm not sure if I want to keep it yet. Let's discuss.
		 */
		afterPhpInstanceCreated: async (php, { isPrimary }) => {
			if (!isPrimary) {
				return;
			}
			if (!firstTime) {
				return;
			}
			// This hook will be called every time a new PHP instance is created.
			// We only want to the mount once.
			firstTime = false;
			log('[MAIN] Mounting shared array buffers');
			php.mv('/internal/shared', '/internal/shared-old');
			php.mkdir('/internal/shared');

			await php.mount(
				'/internal/shared',
				sharedArrayBufferMount(internalSharedBuffers)
			);
			php.copyRecursive('/internal/shared-old', '/internal/shared');
			php.rmdir('/internal/shared-old', { recursive: true });

			php.mkdir('/wordpress');
			await php.mount('/wordpress', sharedArrayBufferMount(wpBuffers));
			log('[MAIN] Mounted shared array buffers');
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
const titleMatch = response.text.match(/<title>(.*?)<\/title>/i);
if (titleMatch && titleMatch[1]) {
	console.log('Extracted Title:', titleMatch[1]);
} else {
	console.log('Could not extract title from response.');
	// Optionally log the full text if title extraction fails
	// console.log(response.text);
}

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
			'/internal/shared': internalSharedBuffers,
		},
	});
	await phpWorkerApi.isReady();
	log(`[MAIN] Worker ${workerNb} booted`);
	workerNb++;
	return phpWorkerApi;
}

async function main() {
	const worker1 = await spawnSharedFSPhpWorker();
	const worker2 = await spawnSharedFSPhpWorker();

	// Print all the posts in the database
	const result = await worker1.run({
		code: `<?php
require_once '/wordpress/wp-load.php';

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "[PHP] Getting post titles...\\n";

$all_posts = $wpdb->get_results( "SELECT ID, post_title FROM {$wpdb->posts} ORDER BY ID ASC" );

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

	console.log('\n[MAIN] Worker 1: Inserting a new post...');
	const insertResult = await worker1.run({
		code: `<?php
require_once '/wordpress/wp-load.php';

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "[PHP] Inserting a new post...\\n";

$post_id = wp_insert_post(array(
    'post_title'    => 'My New Post from Worker 1',
    'post_content'  => 'This is the content of the new post created via PHP.',
    'post_status'   => 'publish',
	'post_author'   => 1,        
	'post_type'     => 'post'
));

if ( is_wp_error( $post_id ) ) {
    echo "[PHP] Error inserting post: " . $post_id->get_error_message() . "\\n";
} else {
    echo "[PHP] Successfully inserted post with ID: " . $post_id . "\\n";
}
`,
	});
	console.log(insertResult.text);

	// Verify the post was inserted by listing posts again in worker 2
	console.log(
		'\n[MAIN] Worker 2: Listing posts again to verify insertion...'
	);
	const verifyResult = await worker2.run({
		code: `<?php
require_once '/wordpress/wp-load.php';

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "[PHP] Getting post titles again...\\n";
global $wpdb;

$all_posts = $wpdb->get_results( "SELECT ID, post_title FROM {$wpdb->posts} ORDER BY ID ASC" );

if ( ! empty( $all_posts ) ) {
	echo "[PHP] Found " . count($all_posts) . " posts:\\n";
	foreach ( $all_posts as $single_post ) {
		// Use htmlspecialchars to prevent potential XSS if titles contain HTML/JS
		echo "[PHP] - ID: " . $single_post->ID . ", Title: " . htmlspecialchars($single_post->post_title) . "\\n";
	}
} else {
	echo "[PHP] No posts found.\\n";
}

echo "[PHP] Finished getting post titles again.\\n";
?>`,
	});
	console.log(verifyResult.text);

	// console.log('[Node] Worker 2 spawned and ready.');

	// console.log(
	// 	'[Node] Running Worker 1 Task (Create DB, Create Table, Insert Row)...'
	// );

	// console.log('\n[Node] Test finished.');
	process.exit(0); // Explicitly exit the process
}

main().catch(console.trace);
