import { useEffect, useState } from '@wordpress/element';

export function usePromise(promise: Promise<any>) {
	const [isResolved, setIsResolved] = useState(false);
	useEffect(() => {
		promise.then(() => setIsResolved(true));
	}, [promise]);
	return isResolved;
}
