import * as React from '@wordpress/element';
import {
	Button,
	BaseControl,
	TextControl,
	SelectControl,
	Modal,
	Flex,
	FlexItem,
} from '@wordpress/components';
import { useState, useRef, useMemo } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as coreDataStore } from '@wordpress/core-data';
import { store as noticesStore } from '@wordpress/notices';
import { ToggleControl } from '@wordpress/components';

import CodeMirror from '../components/code-mirror';
import LibrariesControl from '../components/libraries-control';
import { ExecutionScript, outputFormats } from '../types';
import {
	isDefaultScriptId,
	getDefaultExecutionScript,
	SUPPORTED_RUNNERS,
} from '../components/code-runner';
import PHPRunner from '../components/php-runner';

export function CreateScriptButton() {
	const [isOpen, setOpen] = useState(false);
	const openModal = () => setOpen(true);
	const closeModal = () => setOpen(false);
	return (
		<>
			<Button onClick={openModal} variant="primary">
				+ Add Script
			</Button>
			{isOpen && (
				<Modal
					onRequestClose={(e) => {
						if (e.target.closest('.cm-editor')) {
							return;
						}
						closeModal();
					}}
					title="Create a new script"
				>
					<CreateScriptForm
						onSaveFinished={() => {
							closeModal();
						}}
					/>
				</Modal>
			)}
		</>
	);
}

export function CreateScriptForm({ onSaveFinished }) {
	const { createErrorNotice, createSuccessNotice } = useDispatch(
		noticesStore
	) as any;
	const [script, setScript] = useState<ExecutionScript>({
		id: '',
		name: '',
		runner: PHPRunner.id,
		content: '',
	});
	const { lastError, isSaving } = useSelect(
		(select) => ({
			lastError: select(coreDataStore).getLastEntitySaveError(
				'interactive-code-block',
				'script',
				undefined!
			),
			isSaving: select(coreDataStore).isSavingEntityRecord(
				'interactive-code-block',
				'script',
				undefined!
			),
		}),
		[]
	);

	const { saveEntityRecord } = useDispatch(coreDataStore);
	const handleSave = async () => {
		try {
			await saveEntityRecord('interactive-code-block', 'script', script, {
				throwOnError: true,
			});
			onSaveFinished();
			createSuccessNotice('Script created successfully', {
				type: 'snackbar',
			});
		} catch (error) {
			createErrorNotice(error.message, {
				type: 'snackbar',
			});
		}
	};

	return (
		<ScriptForm
			script={script}
			onChange={(fields) => setScript({ ...script, ...fields })}
			canSave={!!(script.name && script.content)}
			onSave={handleSave}
			lastError={lastError}
			isSaving={isSaving}
		/>
	);
}

export function EditScriptButton({ id }) {
	const [isOpen, setOpen] = useState(false);
	const openModal = () => setOpen(true);
	const closeModal = () => setOpen(false);
	return (
		<>
			<Button onClick={openModal} variant="primary">
				{isDefaultScriptId(id) ? 'View' : 'Edit'}
			</Button>
			{isOpen && (
				<Modal
					onRequestClose={closeModal}
					title={
						isDefaultScriptId(id) ? 'View script' : 'Edit script'
					}
				>
					<EditScriptForm id={id} onSaveFinished={closeModal} />
				</Modal>
			)}
		</>
	);
}

export function EditScriptForm({ id, onSaveFinished }) {
	const { createErrorNotice, createSuccessNotice } = useDispatch(
		noticesStore
	) as any;
	const { script, lastError, isSaving, hasEdits } = useSelect(
		(select) => ({
			script: select(coreDataStore).getEditedEntityRecord(
				'interactive-code-block',
				'script',
				id
			) as any as ExecutionScript,
			lastError: select(coreDataStore).getLastEntitySaveError(
				'interactive-code-block',
				'script',
				id
			),
			isSaving: select(coreDataStore).isSavingEntityRecord(
				'interactive-code-block',
				'script',
				id
			),
			hasEdits: select(coreDataStore).hasEditsForEntityRecord(
				'interactive-code-block',
				'script',
				id
			),
		}),
		[id]
	);

	const { saveEditedEntityRecord, editEntityRecord } =
		useDispatch(coreDataStore);
	const handleSave = async () => {
		try {
			await saveEditedEntityRecord(
				'interactive-code-block',
				'script',
				id,
				{
					throwOnError: true,
				}
			);
			createSuccessNotice('Script saved successfully', {
				type: 'snackbar',
			});
			onSaveFinished();
		} catch (error) {
			createErrorNotice(error.message, {
				type: 'snackbar',
			});
		}
	};
	const handleChange = (delta) =>
		editEntityRecord('interactive-code-block', 'script', id, delta);

	if (isDefaultScriptId(id)) {
		return (
			<ScriptForm
				script={getDefaultExecutionScript(id)!}
				onChange={handleChange}
				canSave={false}
			/>
		);
	}

	return (
		<ScriptForm
			script={script}
			onChange={handleChange}
			canSave={hasEdits}
			lastError={lastError}
			isSaving={isSaving}
			onSave={handleSave}
		/>
	);
}

interface ScriptFormProps {
	script: ExecutionScript;
	onChange: (delta: Partial<ExecutionScript>) => void;
	canSave: boolean;
	lastError?: Error;
	isSaving?: boolean;
	onSave?: () => void;
}
function ScriptForm({
	script,
	onChange,
	canSave,
	lastError,
	isSaving,
	onSave,
}: ScriptFormProps) {
	const initialContents = useMemo(() => script.content, []);
	const editorRef = useRef(null);
	function handleSave(e) {
		e.preventDefault();
		onSave?.();
	}
	return (
		<form className="interactive-code-block-form" onSubmit={handleSave}>
			{lastError ? (
				<div className="form-error">Error: {lastError.message}</div>
			) : (
				false
			)}

			<Flex direction="column" gap={2}>
				<FlexItem>
					<TextControl
						label="Script name"
						value={script.name!}
						onChange={(newName) => onChange({ name: newName })}
						autoFocus
					/>
				</FlexItem>

				<FlexItem>
					<SelectControl
						label="Code Runner"
						value={script.runner!}
						options={SUPPORTED_RUNNERS.map(({ id }) => ({
							label: id,
							value: id,
						}))}
						onChange={(newRunner) =>
							onChange({ runner: newRunner })
						}
					/>
				</FlexItem>

				<FlexItem>
					<SelectControl
						label="Output format"
						value={script.outputFormat!}
						options={Object.entries(outputFormats).map(
							([value, label]) => ({
								label,
								value,
							})
						)}
						onChange={(newOutputFormat) =>
							onChange({ outputFormat: newOutputFormat })
						}
					/>
				</FlexItem>

				<FlexItem>
					<BaseControl label="Script contents" id="script-contents">
						<CodeMirror
							key="code-mirror"
							fileType="php"
							initialContents={initialContents}
							onChange={(content) => onChange({ content })}
							onSave={(content) => onChange({ content })}
							ref={editorRef}
						/>
					</BaseControl>
				</FlexItem>

				{isDefaultScriptId(script.id) ? (
					false
				) : (
					<FlexItem>
						<BaseControl id={script.id} label="Libraries to load">
							<LibrariesControl
								onChange={(libraries) =>
									onChange({ libraries })
								}
								selected={script.libraries || []}
							/>
						</BaseControl>
					</FlexItem>
				)}

				<FlexItem>
					{isDefaultScriptId(script.id) ? (
						"This is the default execution script and can't be changed."
					) : (
						<div className="interactive-code-block-form__buttons">
							<Button
								type="submit"
								isBusy={isSaving}
								variant="primary"
								disabled={!canSave || isSaving}
							>
								{isSaving ? 'Saving' : 'Save'}
							</Button>
						</div>
					)}
				</FlexItem>
			</Flex>
		</form>
	);
}
