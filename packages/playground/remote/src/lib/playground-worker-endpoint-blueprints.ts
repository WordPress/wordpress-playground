import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { exposeAPI } from '@php-wasm/web';
import { PlaygroundWorkerEndpointBlueprints } from './blueprints-worker';

self.postMessage('worker-script-started');
const downloadMonitor = new EmscriptenDownloadMonitor();

const workerGlobal = self as unknown as {
	__playgroundWorkerEndpointBlueprints?: boolean;
};
const alreadyExposedComlinkEndpoint =
	workerGlobal.__playgroundWorkerEndpointBlueprints;
if (alreadyExposedComlinkEndpoint) {
	/*
	 * This worker entrypoint owns exactly one Comlink endpoint. Seeing this
	 * guard means the same module was evaluated twice in the same worker
	 * global, most likely because a generated chunk imported the worker
	 * entrypoint to reuse one of its exports. Keep shared imports in
	 * side-effect-free modules so loading PHP chunks cannot re-run worker
	 * startup code.
	 */
	throw new Error(
		'The Blueprints Playground worker tried to expose its Comlink endpoint more than once in the same worker global. This usually means the worker entrypoint was imported as a dependency. Worker entrypoints must not be imported; move shared code into a side-effect-free module instead.'
	);
}
workerGlobal.__playgroundWorkerEndpointBlueprints = true;
const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundWorkerEndpointBlueprints(
		downloadMonitor,
		() => setApiReady(),
		(error) => setAPIError(error)
	)
);
