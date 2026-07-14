import { createContext, useContext } from 'react';

export const RecentAutosaveNudgeContext = createContext(false);

export function useRecentAutosaveNudgeVisible(): boolean {
	return useContext(RecentAutosaveNudgeContext);
}
