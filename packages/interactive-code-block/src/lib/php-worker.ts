import {
	exposeAPI,
	parseWorkerStartupOptions,
	PublicAPI,
	WebPHP,
	WebPHPEndpoint,
} from '@php-wasm/web';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import {
	LatestSupportedPHPVersion,
	SupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';

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
const { php, phpReady } = WebPHP.loadSync(phpVersion, {
	requestHandler: {
		documentRoot: '/',
		absoluteUrl: 'https://example.com/',
	},
	downloadMonitor: monitor,
});

const [setApiReady, client] = exposeAPI(new WebPHPEndpoint(php, monitor));
await phpReady;

setApiReady();

export type PHPClient = PublicAPI<WebPHPEndpoint>;
export const assertClientType: PHPClient = client;
