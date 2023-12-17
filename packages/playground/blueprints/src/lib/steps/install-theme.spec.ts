import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/wordpress';
import {
	collectFile,
	encodeZip,
	iteratorToStream,
} from '@wp-playground/stream-compression';
import { installTheme } from './install-theme';

describe('Blueprint step installPlugin', () => {
	let php: NodePHP;
	let rootPath: string | undefined;
	let themesPath: string | undefined;
	const themeName = 'test-theme';
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion, {
			requestHandler: {
				documentRoot: '/wordpress',
			},
		});
		rootPath = php.documentRoot;
		// Create plugins folder
		themesPath = `${rootPath}/wp-content/themes`;
		php.mkdir(themesPath);
	});

	it('should install a plugin', async () => {
		await installTheme(php, {
			themeZipFile: await collectFile(
				`${themeName}-0.0.1.zip`,
				encodeZip(
					iteratorToStream([
						new File(
							[`/**\n * Theme Name: Test Theme`],
							`${themeName}/index.php`
						),
					])
				)
			),
			options: { activate: false },
		});
		expect(php.fileExists(`${themesPath}/${themeName}`)).toBe(true);
	});
});
