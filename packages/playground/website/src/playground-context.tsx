import { createContext, useContext } from 'react';
import { StorageType } from './types';
import { PlaygroundClient } from '@wp-playground/remote';

export type ActiveModal =
	| 'error-report'
	| 'log'
	| 'start-error'
	| 'mount-markdown-directory'
	| false;

export const PlaygroundContext = createContext<{
	storage: StorageType;
	activeModal: ActiveModal;
	setActiveModal: (modal: ActiveModal) => void;
	playground?: PlaygroundClient;
	currentUrl?: string;
}>({
	storage: 'none',
	activeModal: false,
	setActiveModal: () => {},
});
export const usePlaygroundContext = () => useContext(PlaygroundContext);
