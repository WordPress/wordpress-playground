import { useAppSelector, getActiveClient } from './state/redux/store';

export function usePlaygroundClientInfo(siteSlug?: string) {
	return useAppSelector((state) => {
		if (siteSlug) {
			return state.clients[siteSlug];
		}
		return getActiveClient(state);
	});
}

export function usePlaygroundClient(siteSlug?: string) {
	const clientInfo = usePlaygroundClientInfo(siteSlug);

	if (!clientInfo) {
		return null;
	}

	return clientInfo.client;
}
