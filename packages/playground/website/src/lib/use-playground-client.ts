import { PlaygroundClient } from '@wp-playground/remote';
import { useRef, useEffect } from 'react';
import { usePlaygroundContext } from '../playground-context';

export function usePlaygroundClient() {
	const playgroundRef = useRef<{
		promise: Promise<PlaygroundClient>;
		resolve: any;
		isResolved: boolean;
	}>();
	const { playground } = usePlaygroundContext();
	useEffect(() => {
		if (!playgroundRef.current) {
			let resolve;
			const promise = new Promise<PlaygroundClient>((_resolve) => {
				resolve = _resolve;
			});
			playgroundRef.current = {
				promise,
				resolve,
				isResolved: false,
			};
		}
		if (playground) {
			playgroundRef.current!.resolve(playground);
			playgroundRef.current!.isResolved = true;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [!!playground]);
}
