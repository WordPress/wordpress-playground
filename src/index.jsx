import * as React from 'react';
import { createRoot } from 'react-dom/client';

import FilesExplorer from './files-explorer';
import Editor from './editor';
import wpWorker from './wp-worker-bridge';
import WordPressBrowser from './wordpress-browser';

function App() {
	const [ filePath, setFilePath ] = React.useState( '' );
	const [ output, setOutput ] = React.useState( '' );

	const editorRef = React.useRef();
	const iframeElRef = React.useRef();
	const initialValue = React.useMemo( () => window.localStorage.getItem( 'monaco-editor-php' ) || '<?php\n', [] );
	const runPhp = React.useCallback( ( phpCode ) =>
		wpWorker.run( phpCode ).then( ( result ) => {
			const _output = [];
			_output.push( 'Exit code: ' + result.exitCode + '\n\n' );
			if ( result.stderr.length > 1 || result.stderr[ 0 ][ 0 ] !== '\n' ) {
				_output.push( 'StdErr:\n' );
				_output.push( result.stderr.join( '' ) );
				_output.push( '\n\n' );
			}
			_output.push( 'StdOut:\n' );
			_output.push( result.stdout );
			_output.push( '\n' );
			return _output.join( '\n' );
		} )
	, [] );

	const onRun = React.useCallback( ( code ) => {
		async function execute() {
			let _output;
			if ( getLanguage( filePath ) === 'javascript' ) {
				try {
					_output = document.querySelector( 'iframe' ).contentWindow.eval( code );
				} catch ( e ) {
					_output = e + '';
				}
			} else {
				window.localStorage.setItem( 'monaco-editor-php', code );
				_output = await runPhp( code );
			}
			setOutput( _output );
		}
		execute();
	}, [ filePath ] );

	const onSave = React.useCallback( ( value ) => {
		wpWorker.writeFile( filePath, value );
	}, [ filePath ] );

	const handleSelectFile = React.useCallback( ( path ) => {
		async function load() {
			const contents = await wpWorker.readFile( path );

			const model = editorRef.current.getModel();
			model.setValue( contents );

			window.monaco.editor.setModelLanguage( model, getLanguage( path ) );
			setFilePath( path );
		}
		load();
	}, [] );

	return (
		<div className="flex w-screen h-screen">
			<div className="flex flex-col w-50">
				<FilesExplorer onSelectFile={ handleSelectFile } />
			</div>
			<div className="flex flex-col h-full flex-grow">
				{ filePath ? `Editing: ${ filePath.substr( 1 ) }` : `Code editor` }
				<Editor
					key="editor"
					ref={ editorRef }
					initialLanguage="php"
					initialValue={ initialValue }
					onRun={ onRun }
					onSave={ onSave }
					className="h-2/5 border-solid border-2 border-indigo-600 flex-grow-0"
				/>
				Code results
				<pre className="h-2/5 border-solid border-2 border-indigo-600 flex-grow-0 text-sm overflow-y-auto">
					{ output }
				</pre>
			</div>
			<WordPressBrowser initialUrl="/wp-login.php" className="h-full w-1/2" ref={ iframeElRef } />
		</div>
	);
}

function getLanguage( filePath ) {
	const extension = filePath.split( '.' ).pop();
	if ( extension === 'php' ) {
		return 'php';
	} else if ( extension === 'js' || extension === 'jsx' ) {
		return 'javascript';
	} else if ( extension === 'css' ) {
		return 'css';
	}
	return 'plaintext';
}

createRoot( document.querySelector( '#app' ) ).render(
	<App />,
);
