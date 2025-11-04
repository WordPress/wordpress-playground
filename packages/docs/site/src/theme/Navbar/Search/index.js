import React from 'react';
import Search from '@theme-original/Navbar/Search';

export default function SearchWrapper(props) {
	/*
	 * This component wraps the Search component.
	 * Previously used to add Kapa AI button, but that has been removed.
	 */
	return <Search {...props} />;
}
