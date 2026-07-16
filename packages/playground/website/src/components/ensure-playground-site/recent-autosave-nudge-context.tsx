import {
	createContext,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from 'react';

type RecentAutosaveNudgeContextValue = {
	visible: boolean;
	anchor: HTMLElement | null;
	setAnchor: (anchor: HTMLElement | null) => void;
};

const RecentAutosaveNudgeContext =
	createContext<RecentAutosaveNudgeContextValue>({
		visible: false,
		anchor: null,
		setAnchor: () => {},
	});
RecentAutosaveNudgeContext.displayName = 'RecentAutosaveNudgeContext';

export function RecentAutosaveNudgeProvider({
	children,
	visible,
}: {
	children: ReactNode;
	visible: boolean;
}) {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const value = useMemo(
		() => ({ visible, anchor, setAnchor }),
		[visible, anchor]
	);
	return (
		<RecentAutosaveNudgeContext.Provider value={value}>
			{children}
		</RecentAutosaveNudgeContext.Provider>
	);
}

export function useRecentAutosaveNudgeVisible(): boolean {
	return useContext(RecentAutosaveNudgeContext).visible;
}

/** The on-screen Playgrounds Dock button the nudge should point at, if any. */
export function useRecentAutosaveNudgeAnchor(): HTMLElement | null {
	return useContext(RecentAutosaveNudgeContext).anchor;
}

/** Lets the Dock report the Playgrounds button as the nudge anchor. */
export function useSetRecentAutosaveNudgeAnchor(): (
	anchor: HTMLElement | null
) => void {
	return useContext(RecentAutosaveNudgeContext).setAnchor;
}
