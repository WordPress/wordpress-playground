import { useState, useEffect } from 'react';
import { getShuffledTips } from '@php-wasm/progress';

/**
 * Hook for rotating loading tips with fade animation.
 *
 * @param intervalMs - Time between tip rotations in milliseconds (default: 6000)
 * @returns Current tip text and whether it's fading out
 */
export function useRotatingTips(intervalMs = 6000) {
	const [tips] = useState(() => getShuffledTips());
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isFading, setIsFading] = useState(false);

	useEffect(() => {
		const timer = setInterval(() => {
			setIsFading(true);

			// After fade out animation (300ms), change the tip
			setTimeout(() => {
				setCurrentIndex((i) => (i + 1) % tips.length);
				setIsFading(false);
			}, 300);
		}, intervalMs);

		return () => clearInterval(timer);
	}, [tips.length, intervalMs]);

	return {
		currentTip: tips[currentIndex],
		isFading,
	};
}
