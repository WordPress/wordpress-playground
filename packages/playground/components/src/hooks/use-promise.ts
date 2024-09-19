import { useEffect, useState, useRef } from 'react';

export function usePromise<T>(promise: Promise<T>) {
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const [data, setData] = useState<T | null>(null);
	const lastPromise = useRef<Promise<T> | null>(null);

	useEffect(() => {
		setIsLoading(true);
		lastPromise.current = promise;
		async function handlePromise() {
			try {
				const result = await promise;
				if (lastPromise.current === promise) {
					setData(result);
				}
			} catch (error) {
				if (lastPromise.current === promise) {
					setError(error as Error);
				}
			} finally {
				if (lastPromise.current === promise) {
					setIsLoading(false);
				}
			}
		}
		handlePromise();
	}, [promise]);

	return { isLoading, error, data };
}
