import { createContext, useContext, type ReactNode } from 'react';

const RecentAutosaveNudgeContext = createContext(false);
RecentAutosaveNudgeContext.displayName = 'RecentAutosaveNudgeContext';

export function RecentAutosaveNudgeProvider({
	children,
	visible,
}: {
	children: ReactNode;
	visible: boolean;
}) {
	return (
		<RecentAutosaveNudgeContext.Provider value={visible}>
			{children}
		</RecentAutosaveNudgeContext.Provider>
	);
}

export function useRecentAutosaveNudgeVisible(): boolean {
	return useContext(RecentAutosaveNudgeContext);
}
