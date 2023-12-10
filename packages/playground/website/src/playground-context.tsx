import { createContext } from 'react';
import { StorageType } from './types';

export const PlaygroundContext = createContext<{
	storage: StorageType;
}>({ storage: 'none' });
