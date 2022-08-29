import * as React from 'react';
import { createRoot } from 'react-dom/client';

import Editor from './editor';
import WordPressBrowser from './wordpress-browser';
import { ObjectInspector } from 'react-inspector';
import wpWorker from './wp-worker-bridge';
import { useEffect } from 'react';

const INITIAL_OUTPUT = {};
function App() {
	const [ output, setOutput ] = React.useState( INITIAL_OUTPUT );
	const [ postEditorReady, setPostEditorReady ] = React.useState( false );

	const editorRef = React.useRef();
	const iframeElRef = React.useRef();
	const initialValue = React.useMemo( () =>
		window.localStorage.getItem( 'monaco-editor-js' ) ||
		"wp.data.select( 'core' ).getEntityRecords( 'postType', 'page' )",
	[] );

	const onRun = React.useCallback( ( ) => {
		try {
			const code = editorRef.current.getValue();
			window.localStorage.setItem( 'monaco-editor-js', code );
			const result = document.querySelector( 'iframe' ).contentWindow.eval( code );
			console.log( result );
			setOutput( result );
		} catch ( e ) {
			console.error( e );
			setOutput( e );
		}
	}, [] );

	useEffect( () => {
		loadPostEditor( iframeElRef.current ).then( () => setPostEditorReady( true ) );
	}, [] );

	return (
		<div className="flex justify-center w-screen h-screen py-2 px-4">
			<div className="min-w-20 max-w-40 w-1/2">
				<p className="my-2">
					To fetch the list of pages, we will use the getEntityRecords selector. In broad strokes, it will
					issue the correct API request, cache the results, and return the list of the records we need. Here’s
					how to use it:
				</p>

				{ postEditorReady && (
					<div className="flex flex-col">
						<Editor
							key="editor"
							ref={ editorRef }
							initialLanguage="javascript"
							initialValue={ initialValue }
							onRun={ onRun }
							className="border-solid border-1 border-indigo-600 flex-grow-0"
							singleLine
						/>
						<div className="flex justify-end my-2">
							<button
								onClick={ onRun }
								className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
							>
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={ 1.5 } stroke="currentColor" className="inline-block mr-1 w-6 h-6">
									<path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
								</svg>
								Run
							</button>
						</div>
						{ output !== INITIAL_OUTPUT && (
							<ObjectInspector data={ output } />
						) }
					</div>
				) }

				<p className="my-2">
					Once you run that code, you will see it returns null. Why? The
					pages are only requested by the getEntityRecords resolver after first running the selector. If you wait a
					moment and re-run it, it will return the list of all pages.
				</p>

				<WordPressBrowser
					initialUrl="/wp-login.php"
					className=" hidden"
					ref={ iframeElRef } />
			</div>
		</div>
	);
}

function loadPostEditor( iframe ) {
	return wpWorker.request( {
		path: '/wp-login.php',
		method: 'POST',
		_POST: {
			log: 'admin',
			pwd: 'password',
			rememberme: 'forever',
		},
	} ).then( () => new Promise( ( resolve ) => {
		iframe.src = '/wp-admin/post-new.php';
		const interval = setInterval( () => {
			if ( iframe.contentWindow.wp ) {
				clearInterval( interval );
				resolve();
			}
		}, 100 );
	} ) );
}

createRoot( document.querySelector( '#app' ) ).render(
	<App />,
);
