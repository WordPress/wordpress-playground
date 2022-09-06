import * as React from 'react';
import { useRef } from 'react';
import { createRoot } from 'react-dom/client';

import WordPressBrowser from './wordpress-browser';

function App() {
	const iframeElRef = useRef();
	return (
		<div
			className="flex flex-col justify-center py-2 px-4"
		>
			<WordPressBrowser
				style={ { width: 900, height: 600 } }
				initialUrl="/wp-login.php"
				ref={ iframeElRef } />
		</div>
	);
}

createRoot( document.querySelector( '#app' ) ).render(
	<App />,
);
