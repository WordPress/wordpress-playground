import { useCallback, useState, useEffect } from 'react';
import { usePlaygroundClientInfo } from '../use-playground-client';
import { useActiveSite } from '../state/redux/store';
import {
	requestTakeover,
	requestRemoteBackup,
} from '../state/redux/tab-coordinator';

const PENDING_ACTION_KEY = 'playground-pending-takeover-action';

export type PendingAction = 'import' | null;

/**
 * Store a pending action to execute after takeover + reload
 */
export function setPendingAction(action: PendingAction): void {
	if (action) {
		sessionStorage.setItem(PENDING_ACTION_KEY, action);
	} else {
		sessionStorage.removeItem(PENDING_ACTION_KEY);
	}
}

/**
 * Get and clear the pending action (if any)
 */
export function consumePendingAction(): PendingAction {
	const action = sessionStorage.getItem(PENDING_ACTION_KEY) as PendingAction;
	if (action) {
		sessionStorage.removeItem(PENDING_ACTION_KEY);
	}
	return action;
}

/**
 * Hook to request taking over as the main tab from a dependent tab.
 * After successful takeover, the page will reload and boot as main.
 *
 * @param pendingAction - Optional action to execute after reload (e.g., 'backup')
 */
export function useTakeover() {
	const clientInfo = usePlaygroundClientInfo();
	const activeSite = useActiveSite();
	const [isTakingOver, setIsTakingOver] = useState(false);

	const isDependentMode = clientInfo?.isDependentMode ?? false;

	const performTakeover = useCallback(
		async (pendingAction?: PendingAction): Promise<boolean> => {
			if (!activeSite || !isDependentMode || isTakingOver) {
				return false;
			}

			setIsTakingOver(true);
			try {
				if (pendingAction) {
					setPendingAction(pendingAction);
				}

				const acknowledged = await requestTakeover(activeSite.slug);

				if (acknowledged) {
					window.location.reload();
					return true;
				}

				window.location.reload();
				return true;
			} finally {
				setIsTakingOver(false);
			}
		},
		[activeSite, isDependentMode, isTakingOver]
	);

	return {
		performTakeover,
		isTakingOver,
		isDependentMode,
		canTakeover: isDependentMode && !!activeSite,
	};
}

/**
 * Hook to check for and execute pending actions after takeover + reload.
 * Currently only handles 'import' action to open the backup overlay.
 */
export function usePendingTakeoverAction(onImport: () => void) {
	const clientInfo = usePlaygroundClientInfo();
	const isMainMode = clientInfo && !clientInfo.isDependentMode;

	useEffect(() => {
		if (!isMainMode) return;

		const pendingAction = consumePendingAction();
		if (pendingAction === 'import') {
			const timer = setTimeout(() => {
				onImport();
			}, 500);
			return () => clearTimeout(timer);
		}
	}, [isMainMode, onImport]);
}

/**
 * Hook to request a backup from the main tab when in dependent mode.
 * The backup file will be downloaded in the main tab.
 */
export function useRemoteBackup() {
	const clientInfo = usePlaygroundClientInfo();
	const activeSite = useActiveSite();
	const [isRequestingBackup, setIsRequestingBackup] = useState(false);

	const isDependentMode = clientInfo?.isDependentMode ?? false;

	const requestBackup = useCallback(async (): Promise<boolean> => {
		if (!activeSite || !isDependentMode || isRequestingBackup) {
			return false;
		}

		setIsRequestingBackup(true);
		try {
			const success = await requestRemoteBackup(activeSite.slug);
			return success;
		} finally {
			setIsRequestingBackup(false);
		}
	}, [activeSite, isDependentMode, isRequestingBackup]);

	return {
		requestBackup,
		isRequestingBackup,
		isDependentMode,
		canRequestBackup: isDependentMode && !!activeSite,
	};
}
