import { useEffect, useState } from 'react';
import { useRef } from 'react';

export function useHasTransitionClassName(
	isActive: boolean,
	minActiveDuration: number
) {
	const [hasClass, setHasClass] = useState(isActive);
	const lastUpdate = useRef(Date.now());
	useEffect(() => {
		if (isActive) {
			lastUpdate.current = Date.now();
			setHasClass(true);
		}

		const remainingTime = Math.max(
			0,
			lastUpdate.current + minActiveDuration - Date.now()
		);
		const timeout = setTimeout(() => {
			lastUpdate.current = Date.now();
			setHasClass(false);
		}, remainingTime);
		return () => clearTimeout(timeout);
	}, [isActive]);

	return hasClass;
}
