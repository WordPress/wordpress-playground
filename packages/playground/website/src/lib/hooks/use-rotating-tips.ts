import { useState, useEffect } from 'react';

const LOADING_TIPS: string[] = [
	// Testing & Safety
	'Test plugins and themes safely—nothing affects your live site.',
	'Try any plugin from WordPress.org without installation worries.',
	'Made a mistake? Just refresh to start fresh.',
	'Switch between PHP 7.4 and 8.4 to test compatibility instantly.',
	'Preview branches from your repository with the Playground GitHub Action.',
	// Development
	'Debug PHP with Xdebug right in your browser.',
	'Mount your local plugin folder and see changes live.',
	'Preview WordPress Core and Gutenberg Pull Requests without cloning repositories.',
	'No Docker, no MySQL, no Apache. Just WordPress in your browser.',
	// Blueprints
	'Use Blueprints to configure your perfect WordPress setup in JSON.',
	'Blueprints allow you to share your exact environment with a single URL.',
	'Blueprints install plugins, import content, and configure settings automatically.',
	// Demos & Sharing
	'Show clients your theme with a live, customized demo link.',
	'Embed a working WordPress site directly in your blog post.',
	'Create product demos that viewers can interact with—no login required.',
	// Learning
	'New to WordPress? Experiment freely without breaking anything.',
	'Learn the Site Editor by trying every option safely.',
	'Practice theme development in a real WordPress environment.',
	// Technical Capabilities
	'WordPress runs entirely in your browser using WebAssembly.',
	'Works offline after your first visit—take WordPress anywhere.',
];

function getShuffledTips(): string[] {
	return [...LOADING_TIPS].sort(() => Math.random() - 0.5);
}

/**
 * Hook for rotating loading tips with fade animation.
 *
 * @param intervalMs - Time between tip rotations in milliseconds (default: 7000)
 * @returns Current tip text and whether it's fading out
 */
export function useRotatingTips(intervalMs = 7000) {
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
