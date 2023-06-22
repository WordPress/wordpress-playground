import type { PlaygroundClient } from '@wp-playground/remote';
import { createContext, useContext } from 'react';

export interface PlaygroundContextProps {
	playground?: PlaygroundClient;
	currentUrl?: string;
}

const PlaygroundContext = createContext({} as PlaygroundContextProps);
export const usePlaygroundContext = () => useContext(PlaygroundContext);
export default PlaygroundContext;
