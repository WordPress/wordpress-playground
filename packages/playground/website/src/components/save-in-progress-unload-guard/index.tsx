import { useEffect } from 'react';
import { useAppSelector } from '../../lib/state/redux/store';
import { selectAllClientInfo } from '../../lib/state/redux/slice-clients';

/**
 * Warns before the tab is closed or reloaded while a Playground's *initial*
 * full copy into browser storage is still running.
 *
 * That first memfs→opfs copy writes the whole WordPress tree, and interrupting
 * it — closing the tab, navigating away, losing power — can leave a partial,
 * unbootable save (a later boot then fatals on a missing core file). The copy is
 * the only operation that sets `opfsSync.status === 'syncing'`: routine delta
 * autosaves early-return before persisting again (see `autosaveTemporarySite`),
 * so this guard arms for exactly that risky window and stays out of the way
 * otherwise.
 *
 * The browser shows its own generic "Leave site?" prompt — the wording can't be
 * customized, and no in-app modal can intercept a tab close, so `beforeunload`
 * is the only lever available here.
 */
export function SaveInProgressUnloadGuard() {
	const isInitialSaveInProgress = useAppSelector((state) =>
		selectAllClientInfo(state).some(
			(clientInfo) => clientInfo.opfsSync?.status === 'syncing'
		)
	);

	useEffect(() => {
		if (!isInitialSaveInProgress) {
			return;
		}
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			// Both lines are needed for cross-browser coverage: preventDefault for
			// the modern spec, assigning returnValue for Chrome and older browsers.
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () =>
			window.removeEventListener('beforeunload', handleBeforeUnload);
	}, [isInitialSaveInProgress]);

	return null;
}
