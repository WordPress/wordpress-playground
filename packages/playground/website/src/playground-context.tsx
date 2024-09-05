import { createContext, useContext } from 'react';
import { PlaygroundClient } from '@wp-playground/remote';
import { SiteStorageType } from './lib/site-storage';

export const PlaygroundContext = createContext<{
	storage: SiteStorageType;
	playground?: PlaygroundClient;
	currentUrl?: string;
}>({
	storage: 'none',
});
export const usePlaygroundContext = () => useContext(PlaygroundContext);
