import { useEffect, useState, useRef } from 'react';

export interface PromiseState<T> {
	isLoading: boolean;
	error: Error | null;
	data: T | null;
	isResolved: boolean;
}

export function usePromise<T>(promise: Promise<T>): PromiseState<T> {
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const [data, setData] = useState<T | null>(null);
	const [isResolved, setIsResolved] = useState(false);
	const lastPromise = useRef<Promise<T> | null>(null);

	useEffect(() => {
		setIsLoading(true);
		setIsResolved(false);
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
					setIsResolved(true);
				}
			}
		}
		handlePromise();
	}, [promise]);

	return { isLoading, error, data, isResolved };
}
