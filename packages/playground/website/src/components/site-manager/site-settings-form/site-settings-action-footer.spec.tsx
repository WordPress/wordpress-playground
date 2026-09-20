// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import {
	SiteSettingsActionFooter,
	TemporarySiteSettingsActionFooter,
} from './site-settings-action-footer';
import type {
	SiteFormData,
	SiteSettingsFormFooterContext,
} from './unconnected-site-settings-form';

const defaults: SiteFormData = {
	phpVersion: '8.3',
	wpVersion: 'latest',
	language: '',
	withNetworking: true,
	multisite: false,
};

describe('settings action footer', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeAll(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		vi.stubGlobal(
			'matchMedia',
			vi.fn((query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				addListener: vi.fn(),
				removeListener: vi.fn(),
				dispatchEvent: vi.fn(),
			}))
		);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	beforeEach(() => {
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it('disables both halves of the saved-Playground action', () => {
		act(() => {
			root.render(
				<SiteSettingsActionFooter
					values={{ ...defaults, phpVersion: '8.4' }}
					defaultValues={defaults}
					submit={submit}
					sitePersistence="autosave"
					onApply={vi.fn()}
					onCreateFresh={vi.fn()}
					isPending
				/>
			);
		});

		expect(getButton('Apply to this Playground').disabled).toBe(true);
		expect(getButton('More settings actions').disabled).toBe(true);
	});

	it('uses the only available action as the primary action', () => {
		const onCreateFresh = vi.fn();
		act(() => {
			root.render(
				<SiteSettingsActionFooter
					values={{ ...defaults, wpVersion: '6.7' }}
					defaultValues={defaults}
					submit={submit}
					sitePersistence="autosave"
					onApply={vi.fn()}
					onCreateFresh={onCreateFresh}
					isPending={false}
				/>
			);
		});

		const primaryAction = getButton('Create a fresh Playground');
		expect(primaryAction.disabled).toBe(false);
		act(() => primaryAction.click());
		expect(onCreateFresh).toHaveBeenCalledWith(defaults);
	});

	it('keeps apply available when the form is unchanged', () => {
		act(() => {
			root.render(
				<SiteSettingsActionFooter
					values={defaults}
					defaultValues={defaults}
					submit={submit}
					sitePersistence="autosave"
					onApply={vi.fn()}
					onCreateFresh={vi.fn()}
					isPending={false}
				/>
			);
		});

		expect(getButton('Apply to this Playground').disabled).toBe(false);
	});

	it('focuses the only available action when the menu opens', async () => {
		await act(async () => {
			root.render(
				<SiteSettingsActionFooter
					values={{ ...defaults, wpVersion: '6.7' }}
					defaultValues={defaults}
					submit={submit}
					sitePersistence="autosave"
					onApply={vi.fn()}
					onCreateFresh={vi.fn()}
					isPending={false}
				/>
			);
		});

		await act(async () => getButton('More settings actions').click());

		expect(document.activeElement?.textContent).toContain(
			'Create a fresh Playground'
		);
	});

	it('keeps a temporary-Playground failure beside its disabled action', () => {
		act(() => {
			root.render(
				<TemporarySiteSettingsActionFooter
					isPending
					error="Browser storage is full."
				/>
			);
		});

		expect(
			getButton('Discard current work & create a fresh Playground')
				.disabled
		).toBe(true);
		expect(container.querySelector('[role="alert"]')?.textContent).toBe(
			'Browser storage is full.'
		);
	});

	const submit = ((callback: (data: SiteFormData) => void) => () =>
		callback(defaults)) as SiteSettingsFormFooterContext['submit'];

	function getButton(name: string): HTMLButtonElement {
		const button = Array.from(container.querySelectorAll('button')).find(
			(candidate) =>
				candidate.textContent?.trim() === name ||
				candidate.getAttribute('aria-label') === name
		);
		if (!button) {
			throw new Error(`Button not found: ${name}`);
		}
		return button;
	}
});
