import { NodePHP, getPHPLoaderModule } from '@php-wasm/node';
import {
	RecommendedPHPVersion,
	getWordPressModule,
} from '@wp-playground/wordpress';
import { login } from './login';
import { unzip } from './unzip';
import {
	PHPProcessManager,
	PHPRequestHandler,
	loadPHPRuntime,
} from '@php-wasm/universal';

describe('Blueprint step installPlugin', () => {
	let php: NodePHP;
	let requestHandler: PHPRequestHandler<NodePHP>;
	beforeEach(async () => {
		const phpFactory = async () => {
			const phpLoaderModule = await getPHPLoaderModule(
				RecommendedPHPVersion
			);
			const runtimeId = await loadPHPRuntime(phpLoaderModule);
			return new NodePHP(runtimeId);
		};
		php = await phpFactory();
		const processManager = new PHPProcessManager<NodePHP>();
		processManager.setPhpFactory(phpFactory);
		processManager.setPrimaryPhp(php);

		requestHandler = new PHPRequestHandler({
			processManager,
			documentRoot: '/',
		}) as any;

		await unzip(php, {
			zipFile: await getWordPressModule(),
			extractToPath: '/wordpress',
		});
	});

	it('should log the user in', async () => {
		await login(php, {});
		const response = await requestHandler.request({
			url: '/wp-admin',
		});
		expect(response.text).toContain('Dashboard');
	});
});
