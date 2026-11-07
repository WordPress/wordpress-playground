import type {
	PlaygroundWorkerEndpoint,
	WorkerBootOptions,
} from './playground-worker-endpoint';
import type { RemoteAPI } from '@php-wasm/universal';
import type { WebClientMixin } from './playground-client';

// This is the complete worker surface reachable by public window RPC. Never pipe
// a worker or class instance into a window API: TS visibility is not RPC access control.
const workerMethods = [
	'pathToInternalUrl',
	'internalUrlToPath',
	'mv',
	'cp',
	'rmdir',
	'request',
	'requestStreamed',
	'run',
	'runStream',
	'cli',
	'chdir',
	'cwd',
	'setSapiName',
	'mkdir',
	'mkdirTree',
	'readFileAsText',
	'readFileAsBuffer',
	'writeFile',
	'unlink',
	'listFiles',
	'isDir',
	'isFile',
	'fileExists',
	'defineConstant',
	'getWordPressModuleDetails',
	'getMinifiedWordPressVersions',
	'email',
	'prefetchUpdateChecks',
] as const satisfies readonly (keyof PlaygroundWorkerEndpoint)[];
const webMethods = [
	'onDownloadProgress',
	'cli',
	'journalFSEvents',
	'replayFSJournal',
	'addEventListener',
	'removeEventListener',
	'setProgress',
	'setLoaded',
	'onNavigation',
	'goTo',
	'getCurrentURL',
	'captureSiteThumbnail',
	'setIframeSandboxFlags',
	'onWebMCPToolsChanged',
	'callWebMCPTool',
	'cancelWebMCPTool',
	'onMessage',
	'backfillStaticFilesRemovedFromMinifiedBuild',
	'hasCachedStaticFilesRemovedFromMinifiedBuild',
	'shouldRunStartupBlueprint',
	'finishSharedRuntimeInitialization',
] as const satisfies readonly (keyof WebClientMixin | 'cli')[];
const storageMethods = [
	'mountOpfs',
	'flushOpfs',
	'unmountOpfs',
	'hasOpfsMount',
	'shutdownSharedRuntime',
] as const;

type WorkerConnection = Pick<
	RemoteAPI<PlaygroundWorkerEndpoint>,
	| (typeof workerMethods)[number]
	| 'absoluteUrl'
	| 'documentRoot'
	| 'hasOpfsMount'
>;
type WorkerAPI = Pick<
	PlaygroundWorkerEndpoint,
	(typeof workerMethods)[number] | 'absoluteUrl' | 'documentRoot'
>;
type WebAPI = Pick<WebClientMixin, Exclude<(typeof webMethods)[number], 'cli'>>;
export type PublicWorkerBootOptions = Omit<WorkerBootOptions, 'mounts'> & {
	mounts?: never;
};
export type PublicRuntimeAPI = WorkerAPI &
	WebAPI & {
		boot(options: PublicWorkerBootOptions): Promise<void>;
	};
export type AppRuntimeAPI = WorkerAPI &
	WebClientMixin &
	Pick<PlaygroundWorkerEndpoint, 'hasOpfsMount'>;

/** Public connections cannot assign storage, including through boot or newly added options. */
export function createPublicRuntimeAPI(
	worker: WorkerConnection,
	web: WebClientMixin & Pick<PlaygroundWorkerEndpoint, 'cli'>
): PublicRuntimeAPI {
	return createFacade(worker, web, {
		async boot(options: PublicWorkerBootOptions) {
			if (
				!options ||
				typeof options !== 'object' ||
				options.mounts !== undefined
			) {
				throw new Error(
					'Storage mounts require the private app runtime connection.'
				);
			}
			// Copy only reviewed public boot options. New private options cannot silently
			// become public merely because the worker starts accepting another field.
			await web.boot({
				wpVersion: options.wpVersion,
				wordPressZip: options.wordPressZip,
				sqliteDriverVersion: options.sqliteDriverVersion,
				phpVersion: options.phpVersion,
				sapiName: options.sapiName,
				scope: options.scope,
				extensions: options.extensions,
				withNetworking: options.withNetworking,
				shouldInstallWordPress: options.shouldInstallWordPress,
				corsProxyUrl: options.corsProxyUrl,
				blueprint: options.blueprint,
				wordpressInstallMode: options.wordpressInstallMode,
				pathAliases: options.pathAliases,
			});
		},
	}) as PublicRuntimeAPI;
}

/** Only the authenticated app connection receives operations that assign persistent storage. */
export function createAppRuntimeAPI(
	worker: WorkerConnection,
	web: WebClientMixin & Pick<PlaygroundWorkerEndpoint, 'cli'>
): AppRuntimeAPI {
	const storage = Object.fromEntries(
		storageMethods.map((name) => [
			name,
			(...args: unknown[]) =>
				Reflect.apply(
					name === 'hasOpfsMount' ? worker[name] : web[name],
					name === 'hasOpfsMount' ? worker : web,
					args
				),
		])
	);
	return createFacade(worker, web, {
		...storage,
		boot: (options: WorkerBootOptions) => web.boot(options),
	}) as AppRuntimeAPI;
}

function createFacade(
	worker: WorkerConnection,
	web: WebClientMixin & Pick<PlaygroundWorkerEndpoint, 'cli'>,
	connectionMethods: object
) {
	const methods = Object.create(null);
	for (const name of workerMethods) {
		methods[name] = (...args: unknown[]) =>
			Reflect.apply(worker[name], worker, args);
	}
	for (const name of webMethods) {
		methods[name] = (...args: unknown[]) =>
			Reflect.apply(web[name], web, args);
	}
	Object.assign(methods, connectionMethods);
	// Accessors remain read-only without violating the RPC transport's binding proxy
	// invariants for non-configurable function-valued data properties.
	for (const [name, value] of Object.entries(methods)) {
		Object.defineProperty(methods, name, {
			get: () => value,
			enumerable: true,
		});
	}
	Object.defineProperties(methods, {
		absoluteUrl: { get: async () => worker.absoluteUrl, enumerable: true },
		documentRoot: {
			get: async () => worker.documentRoot,
			enumerable: true,
		},
	});
	return Object.freeze(methods);
}
