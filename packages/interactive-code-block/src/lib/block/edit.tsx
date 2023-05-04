import * as React from 'react';
import { useCallback, useMemo } from '@wordpress/element';
import { useEntityRecords } from '@wordpress/core-data';
import type { BlockEditProps } from '@wordpress/blocks';
import { BlockControls, InspectorControls } from '@wordpress/block-editor';

import {
	ToolbarGroup,
	ToggleControl,
	SelectControl,
	Spinner,
	PanelBody,
	PanelRow,
} from '@wordpress/components';
import { settings } from '@wordpress/icons';

import LibrariesControl from '../components/libraries-control';
import { InteractiveCodeSnippet } from '../components/interactive-code-snippet';
import { base64ToUtf8, utf8ToBase64 } from './base64-utils';
import ToolbarDropdown from '../components/toolbar-dropdown';
import {
	ExecutionScript,
	Library,
	InteractiveCodeSnippetBlockAttributes,
} from '../types';
import {
	getDefaultExecutionScript,
	SUPPORTED_RUNNERS,
} from '../components/code-runner';
import { WithoutGutenbergKeyboardShortcuts } from './without-gutenberg-keyboard-shortcuts';

// CSS isn't injected into the block editor without
// putting this asynchronous import here (this is
// probably a bug in Vite):
document.addEventListener('DOMContentLoaded', () => {
	import('../components/interactive-code-snippet');
});

export const SUPPORTED_HIGHLIGHTERS = [
	{ label: 'PHP', value: 'php' },
	{ label: 'SQL', value: 'sql' },
	{ label: 'JavaScript', value: 'js' },
];

export default function EditInteractiveCodeSnippet({
	attributes,
	isSelected,
	setAttributes,
}: BlockEditProps<InteractiveCodeSnippetBlockAttributes>) {
	const executionScripts = useEntityRecords<ExecutionScript>(
		'interactive-code-block',
		'script'
	);
	function getExecutionScript(scriptId) {
		return (
			getDefaultExecutionScript(scriptId) ||
			executionScripts.records?.find((script) => script.id === scriptId)
		);
	}
	const usedExecutionScript =
		getExecutionScript(attributes.executionScript) || executionScripts?.[0];
	// Reset libraries if the runner changes
	const setExecutionScript = useCallback(
		(newScriptName: string) => {
			const newScript = getExecutionScript(newScriptName);
			if (
				newScript &&
				usedExecutionScript?.runner !== newScript?.runner
			) {
				setAttributes({ libraries: [] });
			}
			setAttributes({ executionScript: newScriptName });
		},
		[usedExecutionScript]
	);

	const libraries = useEntityRecords<Library>(
		'interactive-code-block',
		'library'
	);
	const usedLibraries = useMemo(
		() =>
			libraries.records?.filter(
				(library) =>
					attributes.libraries.includes(library.id) ||
					usedExecutionScript?.libraries?.includes(library.id)
			),
		[attributes.libraries, libraries.hasResolved]
	);

	const handleCodeChange = useCallback((newCode: string) => {
		setAttributes({ code: utf8ToBase64(newCode) });
	}, []);

	const handleCacheOutput = useCallback((output: string) => {
		setAttributes({ cachedOutput: utf8ToBase64(output) });
	}, []);

	return (
		<>
			<BlockControls>
				<ToolbarGroup>
					<ToolbarDropdown
						optionsLabel="Display settings"
						icon={settings as any}
						value={attributes.fileType}
						onChange={(fileType: any) =>
							setAttributes({ fileType })
						}
						options={SUPPORTED_HIGHLIGHTERS.map((highlighter) => ({
							label: `Highlighting: ${highlighter.label}`,
							value: highlighter.value,
						}))}
					/>
				</ToolbarGroup>
			</BlockControls>
			<InspectorControls>
				<PanelBody title="PHP Snippet settings">
					<PanelRow>
						<ToggleControl
							label="Show the output on the first load?"
							onChange={() =>
								setAttributes({
									showCachedOutput:
										!attributes.showCachedOutput,
								})
							}
							checked={attributes.showCachedOutput}
						/>
					</PanelRow>
					<PanelRow className="interactive-code-block__panel-row">
						<SelectControl
							label="Code highlighting"
							value={attributes.fileType}
							options={SUPPORTED_HIGHLIGHTERS}
							onChange={(fileType) => setAttributes({ fileType })}
						/>
					</PanelRow>
					<PanelRow className="interactive-code-block__panel-row">
						<ExecutionScriptControl
							selected={usedExecutionScript?.id || ''}
							onChange={setExecutionScript}
						/>
					</PanelRow>
					<PanelRow className="interactive-code-block__panel-row">
						<LibrariesControl
							selected={attributes.libraries}
							librariesIncludedByScript={
								usedExecutionScript?.libraries
							}
							onChange={(libraries: string[]) =>
								setAttributes({ libraries })
							}
						/>
					</PanelRow>
				</PanelBody>
			</InspectorControls>
			{!usedLibraries || !usedExecutionScript ? (
				<Spinner />
			) : (
				<WithoutGutenbergKeyboardShortcuts isSelected={isSelected}>
					<InteractiveCodeSnippet
						executionScript={usedExecutionScript}
						libraries={usedLibraries}
						fileType={attributes.fileType}
						initialCode={decodeAttr(attributes.code)}
						initialOutput={decodeAttr(attributes.cachedOutput)}
						onChange={handleCodeChange}
						onSave={handleCodeChange}
						onEval={handleCacheOutput}
					/>
				</WithoutGutenbergKeyboardShortcuts>
			)}
		</>
	);
}

function decodeAttr(value: string) {
	if (!value) {
		return '';
	}

	try {
		return base64ToUtf8(value);
	} catch (e) {
		return value;
	}
}

interface ExecutionScriptControlProps {
	selected: string;
	onChange: (value: string) => void;
}

function ExecutionScriptControl({
	selected,
	onChange,
}: ExecutionScriptControlProps) {
	const executionScripts = useEntityRecords<ExecutionScript>(
		'interactive-code-block',
		'script'
	);

	if (executionScripts.records === null) {
		return <Spinner />;
	}

	const defaultExecutionScripts = SUPPORTED_RUNNERS.map((runner) => ({
		label: runner.defaultExecutionScript.name!,
		value: runner.defaultExecutionScript.id,
	}));
	const userCreatedScripts = executionScripts.records.map(
		(script: ExecutionScript) => ({
			label: script.name || '',
			value: script.id,
		})
	);

	const options = [...defaultExecutionScripts, ...userCreatedScripts];

	return (
		<SelectControl
			label="Execution script"
			value={selected}
			options={options}
			onChange={onChange}
		/>
	);
}
