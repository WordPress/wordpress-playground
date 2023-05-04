/**
 * WordPress dependencies
 */
import * as React from '@wordpress/element';
import { Button, Flex, FlexItem, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';
import { useDispatch } from '@wordpress/data';
import { useEntityRecords, useEntityRecord } from '@wordpress/core-data';

/**
 * Internal dependencies
 */
import {
	CreateScriptButton,
	EditScriptButton,
} from './execution-scripts-forms';
import { ExecutionScript } from '../types';
import {
	SUPPORTED_RUNNERS,
	isDefaultScriptId,
	getDefaultExecutionScript,
} from '../components/code-runner';

export default function ExecutionScriptsPanel() {
	return (
		<Flex direction="column" gap={4}>
			<FlexItem className="interactive-code-snippet-items-list-wrapper">
				<p>
					When the user clicks "Run" in an interactive code block,
					they <b>don't</b> actually run the code snippet. Instead,
					they run an <i>execution script</i> associated with the code
					block.
				</p>

				<p>
					The built-in execution scripts are quite simple, but you're
					free to get more fancy and:
				</p>

				<ul className="ul-disc">
					<li>Load a few libraries</li>
					<li>Expose some variables to the code snippet</li>
					<li>Preload an SQLite database</li>
					<li>Highlight the code snippet instead of executing it</li>
				</ul>
			</FlexItem>
			<FlexItem className="interactive-code-snippet-items-list-wrapper">
				<ScriptsList />
			</FlexItem>
			<FlexItem>
				<CreateScriptButton />
			</FlexItem>
		</Flex>
	);
}

// List of scripts
function ScriptsList() {
	const scripts = useEntityRecords<ExecutionScript>(
		'interactive-code-block',
		'script'
	);

	if (scripts.records === null) {
		return (
			<Flex align="center" justify="center">
				<FlexItem>
					<Spinner />
				</FlexItem>
			</Flex>
		);
	}

	if (!scripts.records?.length && !SUPPORTED_RUNNERS.length) {
		return <div>No results</div>;
	}

	return (
		<ul className="interactive-code-snippet-items-list">
			{SUPPORTED_RUNNERS.map((runnerClass) => (
				<ScriptsListItem key={runnerClass.id} id={runnerClass.id} />
			))}
			{scripts.records.map(({ id }) => (
				<ScriptsListItem key={id} id={id} />
			))}
		</ul>
	);
}

const ScriptsListItem = ({ id }) => {
	const { createSuccessNotice, createErrorNotice } = useDispatch(
		noticesStore
	) as any;
	const script = useEntityRecord<ExecutionScript>(
		'interactive-code-block',
		'script',
		id
	);
	if (isDefaultScriptId(id)) {
		script.editedRecord = getDefaultExecutionScript(id)!;
		script.editedRecord = {
			...script.editedRecord,
			name: `${script.editedRecord.name} (built-in)`,
		};
	}
	const { deleteEntityRecord } = useDispatch('core');

	const handleDelete = async () => {
		// eslint-disable-next-line no-alert
		const confirmation = window.confirm(
			__(
				'Are you sure you want to delete this script? ALL code blocks using this script will stop working.'
			)
		);
		if (!confirmation) {
			return;
		}
		try {
			await deleteEntityRecord(
				'interactive-code-block',
				'script',
				id,
				null,
				{
					throwOnError: true,
				}
			);
			// Tell the user the operation succeeded:
			createSuccessNotice('The script was deleted!', {
				type: 'snackbar',
			});
		} catch (e) {
			const message =
				(e?.message || 'There was an error.') +
				' Please refresh the page and try again.';
			// Tell the user how exactly the operation has failed:
			createErrorNotice(message, {
				type: 'snackbar',
			});
		}
	};

	const AnyItem = FlexItem as any;
	return (
		<Flex className="list-item">
			<AnyItem isBlock>{script.editedRecord.name}</AnyItem>
			<FlexItem>
				<EditScriptButton id={id} />
			</FlexItem>
			<FlexItem>
				{!isDefaultScriptId(id) && (
					<Button isDestructive onClick={handleDelete}>
						{__('Delete')}
					</Button>
				)}
			</FlexItem>
		</Flex>
	);
};
