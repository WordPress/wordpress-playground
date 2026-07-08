// @vitest-environment jsdom

import reducer, {
	__internal_uiSlice,
	listenToOnlineOfflineEventsMiddleware,
	retryActiveSiteBoot,
	setActiveSiteError,
	setSiteManagerPaneCloseBlocked,
	setSiteManagerOpen,
} from './slice-ui';

describe('uiSlice active site errors', () => {
	it('ignores late boot errors from inactive sites', () => {
		const activeState = reducer(
			undefined,
			__internal_uiSlice.actions.setActiveSite('active')
		);

		const afterLateError = reducer(
			activeState,
			setActiveSiteError({
				siteSlug: 'stale',
				error: 'site-boot-failed',
			})
		);

		expect(afterLateError.activeSite?.error).toBeUndefined();
	});

	it('keeps applying active and legacy boot errors', () => {
		const activeState = reducer(
			undefined,
			__internal_uiSlice.actions.setActiveSite('active')
		);

		expect(
			reducer(
				activeState,
				setActiveSiteError({
					siteSlug: 'active',
					error: 'site-boot-failed',
				})
			).activeSite?.error
		).toBe('site-boot-failed');
		expect(
			reducer(
				activeState,
				setActiveSiteError({
					error: 'resource-download-failed',
				})
			).activeSite?.error
		).toBe('resource-download-failed');
	});

	it('increments the active site boot retry key and clears stale errors', () => {
		const activeState = reducer(
			undefined,
			__internal_uiSlice.actions.setActiveSite('active')
		);
		const errorState = reducer(
			activeState,
			setActiveSiteError({
				siteSlug: 'active',
				error: 'site-boot-failed',
				details: new Error('old error'),
			})
		);

		const retryState = reducer(errorState, retryActiveSiteBoot());
		expect(retryState.activeSite?.bootRetryKey).toBe(1);
		expect(retryState.activeSite?.error).toBeUndefined();
		expect(retryState.activeSite?.errorDetails).toBeUndefined();

		const secondRetryState = reducer(retryState, retryActiveSiteBoot());
		expect(secondRetryState.activeSite?.bootRetryKey).toBe(2);
	});

	it('clears overlay title state when closing the dock pane', () => {
		window.history.replaceState(
			{},
			'',
			'/?overlay=playgrounds&page-title=Playgrounds&plugin=akismet'
		);

		runUiMiddleware(setSiteManagerOpen(false));

		const url = new URL(window.location.href);
		expect(url.searchParams.has('overlay')).toBe(false);
		expect(url.searchParams.has('page-title')).toBe(false);
		expect(url.searchParams.get('plugin')).toBe('akismet');
	});

	it('clears a stale page title even when the overlay param is gone', () => {
		window.history.replaceState({}, '', '/?page-title=Playgrounds');

		runUiMiddleware(setSiteManagerOpen(false));

		const url = new URL(window.location.href);
		expect(url.searchParams.has('page-title')).toBe(false);
	});

	it('tracks when the dock pane must stay open', () => {
		const blockedState = reducer(
			undefined,
			setSiteManagerPaneCloseBlocked(true)
		);
		expect(blockedState.siteManagerPaneCloseBlocked).toBe(true);

		const unblockedState = reducer(
			blockedState,
			setSiteManagerPaneCloseBlocked(false)
		);
		expect(unblockedState.siteManagerPaneCloseBlocked).toBe(false);
	});
});

function runUiMiddleware(action: ReturnType<typeof setSiteManagerOpen>) {
	const next = (receivedAction: typeof action) => receivedAction;
	listenToOnlineOfflineEventsMiddleware({
		dispatch: (receivedAction: unknown) => receivedAction,
		getState: () => undefined,
	} as any)(next as any)(action);
}
