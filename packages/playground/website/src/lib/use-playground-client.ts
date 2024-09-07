import { useAppSelector, getActiveClient } from './redux-store';

export function usePlaygroundClient(siteSlug?: string) {
	return useAppSelector((state) => {
		if (siteSlug) {
			return state.clients[siteSlug]?.client;
		}
		return getActiveClient(state)?.client;
	});
}
