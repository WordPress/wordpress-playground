import { useState, useEffect } from 'react';

export interface FetchState<T> {
	isLoading: boolean;
	isError: boolean;
	data: T | null;
	error: Error | null;
}

export function useFetch<T>(
	url: string,
	options?: RequestInit,
	fetch: typeof globalThis.fetch = globalThis.fetch
): FetchState<T> {
	const [state, setState] = useState<FetchState<T>>({
		isLoading: true,
		isError: false,
		data: null,
		error: null,
	});

	useEffect(() => {
		const fetchData = async () => {
			try {
				const response = await fetch(url, options);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const result = await response.json();
				setState({
					isLoading: false,
					isError: false,
					data: result,
					error: null,
				});
			} catch (error) {
				setState({
					isLoading: false,
					isError: true,
					data: null,
					error:
						error instanceof Error
							? error
							: new Error('An unknown error occurred'),
				});
			}
		};

		fetchData();
	}, [url, options, fetch]);

	return state;
}

export default useFetch;
