import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/wordpress';
import {
	collectFile,
	encodeZip,
	iteratorToStream,
} from '@wp-playground/stream-compression';
import { installPlugin } from './install-plugin';

describe('Blueprint step installPlugin', () => {
	let php: NodePHP;
	let rootPath: string | undefined;
	let pluginsPath: string | undefined;
	const pluginName = 'test-plugin';
	const zipFileName = `${pluginName}-0.0.1.zip`;
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion, {
			requestHandler: {
				documentRoot: '/wordpress',
			},
		});
		rootPath = php.documentRoot;
		// Create plugins folder
		pluginsPath = `${rootPath}/wp-content/plugins`;
		php.mkdir(pluginsPath);
	});

	async function createPluginZip(pathPrefix = '') {
		return await collectFile(
			zipFileName,
			encodeZip(
				iteratorToStream([
					new File(
						[`/**\n * Plugin Name: Test Plugin`],
						`${pathPrefix}/index.php`
					),
				])
			)
		);
	}

	it('should install a plugin', async () => {
		await installPlugin(php, {
			pluginZipFile: await createPluginZip(`/${pluginName}`),
			options: { activate: false },
		});
		expect(php.fileExists(`${pluginsPath}/${pluginName}`)).toBe(true);
	});

	it('should install a plugin even when it is zipped directly without a root-level folder', async () => {
		await installPlugin(php, {
			pluginZipFile: await createPluginZip(),
			options: { activate: false },
		});
		expect(php.fileExists(`${pluginsPath}/${pluginName}-0.0.1`)).toBe(true);
	});
});
