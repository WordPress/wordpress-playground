// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type {
	SiteFormData,
	SiteSettingsFormFooterContext,
} from './unconnected-site-settings-form';
import { UnconnectedSiteSettingsForm } from './unconnected-site-settings-form';

const versions = vi.hoisted(() => ({
	latestWPVersion: null as string | null,
	supportedWPVersions: {} as Record<string, string>,
}));

vi.mock('./use-supported-wordpress-versions', () => ({
	useSupportedWordPressVersions: () => versions,
}));

it('keeps edits when the version list arrives and resolves latest after a settings reset', () => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	vi.stubGlobal('matchMedia', () => ({ matches: false }));
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	let context: SiteSettingsFormFooterContext;
	const defaults: Partial<SiteFormData> = {
		phpVersion: '8.3',
		wpVersion: 'latest',
		withNetworking: true,
	};

	const render = (defaultValues = defaults) =>
		act(() =>
			root.render(
				<UnconnectedSiteSettingsForm
					defaultValues={defaultValues}
					onSubmit={vi.fn()}
					footer={(nextContext) => {
						context = nextContext;
						return null;
					}}
				/>
			)
		);

	try {
		render();
		act(() => {
			for (const [name, value] of [
				['phpVersion', '8.4'],
				['wpVersion', ''],
			]) {
				const select = container.querySelector<HTMLSelectElement>(
					`select[name="${name}"]`
				)!;
				select.value = value;
				select.dispatchEvent(new Event('change', { bubbles: true }));
			}
		});
		expect(context!.values).toMatchObject({
			phpVersion: '8.4',
			wpVersion: '',
		});

		versions.latestWPVersion = '7.1';
		versions.supportedWPVersions = { '7.1': '7.1' };
		render();
		expect(context!.values).toMatchObject({
			phpVersion: '8.4',
			wpVersion: '',
		});

		render({ ...defaults, phpVersion: '8.4', withNetworking: false });
		expect(context!.values).toMatchObject({
			phpVersion: '8.4',
			wpVersion: '7.1',
			withNetworking: false,
		});
	} finally {
		act(() => root.unmount());
		container.remove();
		vi.unstubAllGlobals();
	}
});
