import { createContext, useContext } from 'react';
import { StorageType } from './types';

export const PlaygroundContext = createContext<{
	storage: StorageType;
	showErrorModal: boolean;
	setShowErrorModal: (show: boolean) => void;
}>({ storage: 'none', showErrorModal: false, setShowErrorModal: () => {} });
export const usePlaygroundContext = () => useContext(PlaygroundContext);
