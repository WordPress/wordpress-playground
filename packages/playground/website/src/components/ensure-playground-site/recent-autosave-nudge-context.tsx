import {
	createContext,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from 'react';

type NudgeAnchor = Pick<HTMLElement, 'getBoundingClientRect' | 'ownerDocument'>;

type RecentAutosaveNudgeContextValue = {
	visible: boolean;
	anchor: NudgeAnchor | null;
	setAnchor: (anchor: NudgeAnchor | null) => void;
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
	const [anchor, setAnchor] = useState<NudgeAnchor | null>(null);
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

/** The Dock anchor the nudge should point at, if any. */
export function useRecentAutosaveNudgeAnchor(): NudgeAnchor | null {
	return useContext(RecentAutosaveNudgeContext).anchor;
}

/** Lets the Dock report an anchor that keeps the nudge clear of its controls. */
export function useSetRecentAutosaveNudgeAnchor(): (
	anchor: NudgeAnchor | null
) => void {
	return useContext(RecentAutosaveNudgeContext).setAnchor;
}
