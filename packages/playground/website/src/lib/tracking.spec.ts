import { afterEach, describe, expect, it, vi } from 'vitest';
import { logBlueprintEvents } from './tracking';
import { GENERATED_GUTENBERG_INSTALLER_MARKER } from './gutenberg-preview';

describe('logBlueprintEvents', () => {
	afterEach(() => {
		delete (globalThis as any).window;
	});

	it('tracks generated Blueprint v2 Gutenberg installers as plugin installs', async () => {
		const gtag = vi.fn();
		(globalThis as any).window = { gtag };

		await logBlueprintEvents({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'runPHP',
					code: {
						filename: 'install-gutenberg.php',
						content: '<?php',
					},
					env: {
						[GENERATED_GUTENBERG_INSTALLER_MARKER]: '1',
					},
				},
			],
		} as any);

		expect(gtag).toHaveBeenCalledWith('event', 'step', {
			step: 'runPHP',
		});
		expect(gtag).toHaveBeenCalledWith('event', 'step', {
			step: 'installPlugin',
		});
		expect(gtag).toHaveBeenCalledWith('event', 'installPlugin', {
			resource: 'vfs',
			plugin: 'gutenberg',
		});
	});

	it('does not track user-authored PHP with the same filename as a plugin install', async () => {
		const gtag = vi.fn();
		(globalThis as any).window = { gtag };

		await logBlueprintEvents({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'runPHP',
					code: {
						filename: 'install-gutenberg.php',
						content: '<?php',
					},
				},
			],
		} as any);

		expect(gtag).toHaveBeenCalledWith('event', 'step', {
			step: 'runPHP',
		});
		expect(gtag).not.toHaveBeenCalledWith('event', 'step', {
			step: 'installPlugin',
		});
		expect(gtag).not.toHaveBeenCalledWith('event', 'installPlugin', {
			resource: 'vfs',
			plugin: 'gutenberg',
		});
	});

	it('tracks Blueprint v2 additional install steps without duplicate step events', async () => {
		const gtag = vi.fn();
		(globalThis as any).window = { gtag };

		await logBlueprintEvents({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'activitypub',
					},
				},
				{
					step: 'installTheme',
					themeData: {
						resource: 'wordpress.org/themes',
						slug: 'pendant',
					},
				},
			],
		} as any);

		expect(
			gtag.mock.calls.filter(
				([, event, data]) =>
					event === 'step' && data?.step === 'installPlugin'
			)
		).toHaveLength(1);
		expect(
			gtag.mock.calls.filter(
				([, event, data]) =>
					event === 'step' && data?.step === 'installTheme'
			)
		).toHaveLength(1);
		expect(gtag).toHaveBeenCalledWith('event', 'installPlugin', {
			resource: 'wordpress.org/plugins',
			plugin: 'activitypub',
		});
		expect(gtag).toHaveBeenCalledWith('event', 'installTheme', {
			resource: 'wordpress.org/themes',
			theme: 'pendant',
		});
	});
});
