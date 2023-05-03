import {
	exposeAPI,
	LatestSupportedPHPVersion,
	parseWorkerStartupOptions,
	PHP,
	PHPClient as BasePHPClient,
	PublicAPI,
	SupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/web';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';

interface WorkerOptions extends Record<string, string> {
	php: string;
}
const options = parseWorkerStartupOptions<WorkerOptions>();
const phpVersion = (options?.php?.replace('_', '.') ||
	LatestSupportedPHPVersion) as SupportedPHPVersion;
if (!SupportedPHPVersionsList.includes(phpVersion)) {
	throw new Error(`Unsupported PHP version ${phpVersion}`);
}

const monitor = new EmscriptenDownloadMonitor();
const { php, phpReady } = PHP.loadSync(phpVersion, {
	requestHandler: {
		documentRoot: '/',
		absoluteUrl: 'https://example.com/',
	},
	downloadMonitor: monitor,
});

const [setApiReady, client] = exposeAPI(new BasePHPClient(php, monitor));
await phpReady;

setApiReady();

export type PHPClient = PublicAPI<BasePHPClient>;
export const assertClientType: PHPClient = client;
