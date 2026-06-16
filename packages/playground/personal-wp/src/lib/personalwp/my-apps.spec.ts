import { describe, expect, it, vi } from 'vitest';
import {
	APP_LAUNCHER_BLUEPRINT,
	APP_LAUNCHER_BLUEPRINT_URL,
	MY_APPS_PLUGIN_FILE,
	hasMyAppsPlugin,
} from './my-apps';

describe('my-apps helpers', () => {
	it('builds the app launcher blueprint URL', async () => {
		const response = await fetch(APP_LAUNCHER_BLUEPRINT_URL);
		const blueprint = await response.json();

		expect(blueprint).toEqual(APP_LAUNCHER_BLUEPRINT);
	});

	it('checks for the main my-apps plugin file', async () => {
		const playground = {
			isFile: vi.fn().mockResolvedValue(true),
		};

		await expect(hasMyAppsPlugin(playground as never)).resolves.toBe(true);
		expect(playground.isFile).toHaveBeenCalledWith(MY_APPS_PLUGIN_FILE);
	});
});
