import * as React from 'react';
import { useEffect } from 'react';

const noop = () => {};
export const Editor = React.memo( React.forwardRef( function EditorComponent( {
	initialValue = "<?php \n\n echo 'hello world'; \n",
	initialLanguage = 'php',
	onRun = noop,
	onSave = noop,
	className = '',
	style = {},
	singleLine = false,
}, ref ) {
	const editorElRef = React.useRef();
	const callbacksRef = React.useRef( { onRun, onSave } );
	useEffect( () => {
		callbacksRef.current = { onRun, onSave };
	}, [ onRun, onSave ] );

	useEffect( () => {
		console.log( 'RERENDER' );
		require.config( { paths: { vs: 'monaco-editor/min/vs' } } );
		require( [ 'vs/editor/editor.main' ], function() {
			let config = {
				value: initialValue,
				language: initialLanguage,
				// automaticLayout: true,
				minimap: {
					enabled: false,
				},
			};
			if ( singleLine ) {
				config = {
					...config,
					wordWrap: 'off',
					lineNumbers: 'off',
					lineNumbersMinChars: 0,
					// overviewRulerLanes: 0,
					overviewRulerBorder: false,
					// lineDecorationsWidth: 0,
					hideCursorInOverviewRuler: true,
					// glyphMargin: false,
					folding: false,
					scrollBeyondLastColumn: 0,
					scrollbar: { horizontal: 'hidden', vertical: 'hidden' },
					find: {
						// addExtraSpaceOnTop: false,
						// autoFindInSelection: 'never',
						// seedSearchStringFromSelection: false
					},
				};
			}
			ref.current = window.monaco.editor.create(
				editorElRef.current,
				config,
			);

			ref.current.addAction( {
				id: 'run-php',
				label: 'Run!',
				keybindings: [
					window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Enter,
					window.monaco.KeyMod.WinCtrl | window.monaco.KeyCode.Enter,
				],
				precondition: null,
				keybindingContext: null,
				contextMenuGroupId: 'navigation',
				contextMenuOrder: 1.5,
				run( ed ) {
					callbacksRef.current.onRun( ed.getValue() );
				},
			} );

			ref.current.addAction( {
				id: 'save-php',
				label: 'Save',
				keybindings: [
					window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyS,
					window.monaco.KeyMod.WinCtrl | window.monaco.KeyCode.KeyS,
				],
				precondition: null,
				keybindingContext: null,
				contextMenuGroupId: 'navigation',
				contextMenuOrder: 1.5,
				run( ed ) {
					callbacksRef.current.onSave( ed.getValue() );
				},
			} );
		} );
	}, [ ] );

	if ( singleLine ) {
		style.height = '1.5em';
	}
	return (
		<div
			ref={ editorElRef }
			style={ style }
			className={ className }
		>
		</div>
	);
} ) );

export default Editor;
