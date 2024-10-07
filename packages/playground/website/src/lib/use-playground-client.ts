import { selectClientInfoBySiteSlug } from './state/redux/slice-clients';
import { useAppSelector, getActiveClientInfo } from './state/redux/store';

export function usePlaygroundClientInfo(siteSlug?: string) {
	return useAppSelector((state) => {
		if (siteSlug) {
			return selectClientInfoBySiteSlug(state, siteSlug);
		}
		return getActiveClientInfo(state);
	});
}

export function usePlaygroundClient(siteSlug?: string) {
	const clientInfo = usePlaygroundClientInfo(siteSlug);

	if (!clientInfo) {
		return null;
	}

	return clientInfo.client;
}
