import path from 'path';
import { getPluginFile } from '../get-plugin-file';

const modesPath = path.resolve(__dirname, '..', '..', 'tests', 'mode-examples');

describe('getPluginFile', () => {
	it('should return the path to the plugin file if it exists', () => {
		const pluginFilePath = getPluginFile(path.join(modesPath, 'plugin'));
		expect(pluginFilePath).toEqual(
			path.join('plugin', 'sample-plugin.php')
		);
	});

	it('should return null if no plugin file is found', () => {
		const pluginFilePath = getPluginFile(
			path.join(modesPath, 'not-plugin')
		);
		expect(pluginFilePath).toBeNull();
	});

	it('should handle non-existing directories', () => {
		expect(() =>
			getPluginFile(path.resolve('non-existing'))
		).toThrowError();
	});
});
