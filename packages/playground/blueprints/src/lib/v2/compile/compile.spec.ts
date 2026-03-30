import { describe, it, expect } from 'vitest';
import { extractRuntimeConfig } from './compile';
import type { BlueprintV2Declaration } from '../types';

describe('extractRuntimeConfig', () => {
	it('should extract a simple PHP version string', () => {
		const blueprint: BlueprintV2Declaration = {
			version: 2,
			phpVersion: '8.1',
		};
		const config = extractRuntimeConfig(blueprint);
		expect(config.phpVersion).toEqual({
			preferred: '8.1',
		});
	});

	it('should extract a PHP version constraint object', () => {
		const blueprint = {
			version: 2,
			phpVersion: {
				min: '8.0',
				recommended: '8.2',
				max: '8.4',
			},
		} as BlueprintV2Declaration;
		const config = extractRuntimeConfig(blueprint);
		expect(config.phpVersion).toEqual({
			min: '8.0',
			max: '8.4',
			preferred: '8.2',
		});
	});

	it('should extract a WordPress version string', () => {
		const blueprint: BlueprintV2Declaration = {
			version: 2,
			wordpressVersion: '6.4',
		};
		const config = extractRuntimeConfig(blueprint);
		expect(config.wordpressVersion).toEqual({
			preferred: '6.4',
		});
	});

	it('should extract application options', () => {
		const blueprint: BlueprintV2Declaration = {
			version: 2,
			applicationOptions: {
				'wordpress-playground': {
					landingPage: '/wp-admin/plugins.php',
					login: true,
					networkAccess: false,
				},
			},
		};
		const config = extractRuntimeConfig(blueprint);
		expect(config.applicationOptions).toEqual({
			'wordpress-playground': {
				landingPage: '/wp-admin/plugins.php',
				login: true,
				networkAccess: false,
			},
		});
	});

	it('should return an empty config for a minimal blueprint', () => {
		const blueprint: BlueprintV2Declaration = {
			version: 2,
		};
		const config = extractRuntimeConfig(blueprint);
		expect(config).toEqual({});
	});

	it('should handle "latest" as a version string', () => {
		const blueprint: BlueprintV2Declaration = {
			version: 2,
			phpVersion: 'latest',
			wordpressVersion: 'latest',
		};
		const config = extractRuntimeConfig(blueprint);
		expect(config.phpVersion).toEqual({
			preferred: 'latest',
		});
		expect(config.wordpressVersion).toEqual({
			preferred: 'latest',
		});
	});

	it('should extract a WordPress version constraint object with preferred', () => {
		const blueprint = {
			version: 2,
			wordpressVersion: {
				min: '6.2',
				preferred: '6.4',
			},
		} as BlueprintV2Declaration;
		const config = extractRuntimeConfig(blueprint);
		expect(config.wordpressVersion).toEqual({
			min: '6.2',
			preferred: '6.4',
		});
	});
});
