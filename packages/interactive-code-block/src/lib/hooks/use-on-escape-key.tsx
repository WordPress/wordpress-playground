import { useEffect } from '@wordpress/element';

export const useOnEscapeKey = (callback) => {
	const handleKeyDown = (event) => {
		if (event.key === 'Escape') {
			callback();
		}
	};

	useEffect(() => {
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [callback]);
};
