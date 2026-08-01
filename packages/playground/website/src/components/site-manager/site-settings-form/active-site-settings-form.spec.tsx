// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { ActiveSiteSettingsForm } from './active-site-settings-form';
import type { SiteFormData } from './unconnected-site-settings-form';
import type { SiteSettingsSubmission } from './use-site-settings-submission';

const mocks = vi.hoisted(() => ({
	activeSite: undefined as
		| {
				slug: string;
				metadata: { storage: string; persistence: string };
		  }
		| undefined,
	renderedForm: '',
	submission: undefined as SiteSettingsSubmission | undefined,
}));

vi.mock('../../../lib/state/redux/store', () => ({
	useActiveSite: () => mocks.activeSite,
}));

vi.mock('../../../lib/state/redux/slice-sites', () => ({
	isAutosavedSite: (site: { metadata: { persistence: string } }) =>
		site.metadata.persistence === 'autosave',
}));

vi.mock('./autosaved-site-settings-form', () => ({
	AutosavedSiteSettingsForm: ({
		submission,
	}: {
		submission: SiteSettingsSubmission;
	}) => {
		mocks.renderedForm = 'autosaved';
		mocks.submission = submission;
		return null;
	},
}));

vi.mock('./stored-site-settings-form', () => ({
	StoredSiteSettingsForm: ({
		submission,
	}: {
		submission: SiteSettingsSubmission;
	}) => {
		mocks.renderedForm = 'stored';
		mocks.submission = submission;
		return null;
	},
}));

vi.mock('./temporary-site-settings-form', () => ({
	TemporarySiteSettingsForm: ({
		submission,
	}: {
		submission: SiteSettingsSubmission;
	}) => {
		mocks.renderedForm = 'temporary';
		mocks.submission = submission;
		return null;
	},
}));

const formData: SiteFormData = {
	phpVersion: '8.3',
	wpVersion: 'latest',
	language: '',
	withNetworking: true,
	multisite: false,
};

describe('ActiveSiteSettingsForm', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeAll(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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

	it('keeps a submission locked when a saved site activates a fresh autosave', async () => {
		mocks.activeSite = {
			slug: 'saved-site',
			metadata: { storage: 'opfs', persistence: 'explicit' },
		};
		const onSuccess = vi.fn();
		act(() => root.render(<ActiveSiteSettingsForm onSubmit={onSuccess} />));
		expect(mocks.renderedForm).toBe('stored');

		let finish!: () => void;
		const firstAction = vi.fn(
			() => new Promise<void>((resolve) => (finish = resolve))
		);
		let firstRun!: Promise<void>;
		act(() => {
			firstRun = mocks.submission!.run(firstAction, formData);
		});
		expect(mocks.submission?.isPending).toBe(true);

		mocks.activeSite = {
			slug: 'fresh-site',
			metadata: { storage: 'opfs', persistence: 'autosave' },
		};
		act(() => root.render(<ActiveSiteSettingsForm onSubmit={onSuccess} />));
		expect(mocks.renderedForm).toBe('autosaved');
		expect(mocks.submission?.isPending).toBe(true);

		const duplicateAction = vi.fn().mockResolvedValue(undefined);
		await act(() => mocks.submission!.run(duplicateAction, formData));
		expect(duplicateAction).not.toHaveBeenCalled();

		await act(async () => {
			finish();
			await firstRun;
		});
		expect(mocks.submission?.isPending).toBe(false);
		expect(onSuccess).toHaveBeenCalledOnce();
	});
});
