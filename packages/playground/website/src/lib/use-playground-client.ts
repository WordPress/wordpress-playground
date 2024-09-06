import { useAppSelector, getActiveClient } from './redux-store';

export function usePlaygroundClient() {
	return useAppSelector(getActiveClient)?.client;
}
