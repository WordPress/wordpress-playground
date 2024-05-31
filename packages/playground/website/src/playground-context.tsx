import { createContext, useContext } from 'react';
import { StorageType } from './types';
import { PlaygroundClient } from '@wp-playground/remote';

export const PlaygroundContext = createContext<{
	storage: StorageType;
	playground?: PlaygroundClient;
	currentUrl?: string;
}>({
	storage: 'none',
});
export const usePlaygroundContext = () => useContext(PlaygroundContext);
