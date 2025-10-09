import React from 'react';
import Search from '@theme-original/Navbar/Search';

export default function SearchWrapper(props) {
	const handleClick = (e) => {
		e.preventDefault();
		window.Kapa?.open?.();
	};

	/*
	 * This add the Kapa AI button to the end of the navbar. It is impossible to add it
	 * by using themeConfig.navbar.items because the Search component it hardcoded.
	 * See https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-theme-classic/src/theme/Navbar/Content/index.tsx#L100
	 *
	 * By swizzling the Search component, we can add the Kapa AI button to the right of it.
	 */
	return (
		<>
			<Search {...props} />
			<div>
				<a
					className="kapa-ai-button"
					onClick={handleClick}
					aria-label="Ask AI"
				>
					Ask AI
				</a>
			</div>
		</>
	);
}
