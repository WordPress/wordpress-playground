import { createContext, useContext } from 'react';
import { StorageType } from './types';

export type ActiveModal = 'error-report' | 'log' | false;

export const PlaygroundContext = createContext<{
	storage: StorageType;
	activeModal: ActiveModal;
	setActiveModal: (modal: ActiveModal) => void;
}>({
	storage: 'none',
	activeModal: false,
	setActiveModal: () => {},
});
export const usePlaygroundContext = () => useContext(PlaygroundContext);
