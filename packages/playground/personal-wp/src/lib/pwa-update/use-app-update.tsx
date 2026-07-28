import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import type { ReactNode } from 'react';
import { applyAppUpdate } from './apply-update';
import { checkAppVersion } from './app-version';
import { broadcastAppUpdate, openAppUpdateChannel } from './update-channel';

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

type AppUpdateState = {
	initialCheckCompleted: boolean;
	updateAvailable: boolean;
	updateRequired: boolean;
	isApplying: boolean;
	deployedVersion?: string;
	dismissedVersion?: string;
};

export type AppUpdateContextValue = AppUpdateState & {
	showUpdateNotice: boolean;
	applyUpdate: () => Promise<void>;
	checkForUpdate: () => Promise<void>;
	dismissUpdate: () => void;
};

const AppUpdateContext = createContext<AppUpdateContextValue | undefined>(
	undefined
);

export function AppUpdateProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AppUpdateState>({
		initialCheckCompleted: false,
		updateAvailable: false,
		updateRequired: false,
		isApplying: false,
	});
	const stateRef = useRef(state);
	const channelRef = useRef<BroadcastChannel | null>(null);
	const senderIdRef = useRef(createSenderId());

	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	const markUpdateAvailable = useCallback(
		(
			deployedVersion: string,
			updateRequired: boolean,
			shouldBroadcast = true
		) => {
			setState((current) => ({
				...current,
				updateAvailable: true,
				updateRequired: current.updateRequired || updateRequired,
				deployedVersion,
				dismissedVersion:
					current.deployedVersion === deployedVersion
						? current.dismissedVersion
						: undefined,
			}));

			if (shouldBroadcast) {
				broadcastAppUpdate(
					channelRef.current,
					senderIdRef.current,
					deployedVersion
				);
			}
		},
		[]
	);

	const checkForUpdate = useCallback(
		async (isInitialCheck = false) => {
			const result = await checkAppVersion();
			if (result.status === 'update-available') {
				markUpdateAvailable(
					result.deployedVersion,
					isInitialCheck,
					true
				);
			}

			if (isInitialCheck) {
				setState((current) => ({
					...current,
					initialCheckCompleted: true,
				}));
			}
		},
		[markUpdateAvailable]
	);

	const applyUpdate = useCallback(async () => {
		setState((current) => ({
			...current,
			isApplying: true,
			dismissedVersion: undefined,
		}));
		await applyAppUpdate();
	}, []);

	const dismissUpdate = useCallback(() => {
		setState((current) => ({
			...current,
			dismissedVersion: current.deployedVersion,
		}));
	}, []);

	useEffect(() => {
		const channel = openAppUpdateChannel(
			senderIdRef.current,
			(deployedVersion) => {
				markUpdateAvailable(
					deployedVersion,
					!stateRef.current.initialCheckCompleted,
					false
				);
			}
		);
		channelRef.current = channel;

		return () => {
			channel?.close();
			channelRef.current = null;
		};
	}, [markUpdateAvailable]);

	useEffect(() => {
		void checkForUpdate(true);
	}, [checkForUpdate]);

	useEffect(() => {
		const onFocus = () => {
			void checkForUpdate();
		};
		const onVisibilityChange = () => {
			if (!document.hidden) {
				void checkForUpdate();
			}
		};

		window.addEventListener('focus', onFocus);
		document.addEventListener('visibilitychange', onVisibilityChange);
		const interval = window.setInterval(() => {
			if (!document.hidden) {
				void checkForUpdate();
			}
		}, CHECK_INTERVAL_MS);

		return () => {
			window.removeEventListener('focus', onFocus);
			document.removeEventListener(
				'visibilitychange',
				onVisibilityChange
			);
			window.clearInterval(interval);
		};
	}, [checkForUpdate]);

	const value = useMemo<AppUpdateContextValue>(
		() => ({
			...state,
			showUpdateNotice:
				state.updateAvailable &&
				!state.updateRequired &&
				state.deployedVersion !== state.dismissedVersion,
			applyUpdate,
			checkForUpdate,
			dismissUpdate,
		}),
		[state, applyUpdate, checkForUpdate, dismissUpdate]
	);

	return (
		<AppUpdateContext.Provider value={value}>
			{children}
		</AppUpdateContext.Provider>
	);
}

export function useAppUpdate() {
	const context = useContext(AppUpdateContext);
	if (!context) {
		throw new Error('useAppUpdate must be used inside AppUpdateProvider');
	}
	return context;
}

function createSenderId() {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `sender-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
