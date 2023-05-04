import * as React from '@wordpress/element';

/**
 * WordPress dependencies
 */
import { Button, Flex, FlexItem, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';
import { useState } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import {
	useEntityRecords,
	useEntityRecord,
	store as coreDataStore,
} from '@wordpress/core-data';

/**
 * Internal dependencies
 */
import UploadOverlay from './upload-overlay';
import { useOnEscapeKey } from '../hooks/use-on-escape-key';
import { Library } from '../types';

export default function PharLibrariesPanel() {
	const { createErrorNotice, createSuccessNotice } = useDispatch(
		noticesStore
	) as any;
	const { saveEntityRecord } = useDispatch(coreDataStore);
	const [isUploading, setIsUploading] = useState(false);

	const handleUpload = async (file) => {
		setIsUploading(true);

		const formData = new FormData();
		formData.append('file', file);
		try {
			await saveEntityRecord(
				'interactive-code-block',
				'library',
				{
					name: file.name,
				},
				{
					throwOnError: true,
					__unstableFetch: ({ data, ...options }) => {
						for (const key in data) {
							formData.append(key, data[key]);
						}
						const headers = { ...options.headers };
						delete headers['Content-Type'];
						return apiFetch({
							...options,
							headers,
							body: formData,
						});
					},
				}
			);

			createSuccessNotice(`Library uploaded successfully`, {
				type: 'snackbar',
			});
		} catch (error) {
			createErrorNotice(`Error creating a library: ${error.message}`, {
				type: 'snackbar',
			});
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<Flex direction="column" gap={4}>
			<FlexItem>
				Upload libraries (e.g. .phar files) to use in your interative
				code blocks. Uploading a library with the same name twice
				overwrites the previous version.
			</FlexItem>
			<FlexItem className="interactive-code-snippet-items-list-wrapper">
				<LibraryList />
			</FlexItem>
			<FlexItem>
				<Button
					variant="primary"
					isBusy={isUploading}
					style={{ position: 'relative' }}
				>
					Upload a library
					<UploadOverlay onFileSelected={handleUpload} />
				</Button>
			</FlexItem>
		</Flex>
	);
}

// List of libraries
function LibraryList() {
	const libraries = useEntityRecords<Library>(
		'interactive-code-block',
		'library'
	);

	if (libraries.records === null) {
		return (
			<Flex align="center" justify="center">
				<FlexItem>
					<Spinner />
				</FlexItem>
			</Flex>
		);
	}

	if (!libraries.records?.length) {
		return <div>No results</div>;
	}

	return (
		<ul className="interactive-code-snippet-items-list">
			{libraries.records.map(({ id }) => (
				<LibraryListItem key={id} id={id} />
			))}
		</ul>
	);
}

const LibraryListItem = ({ id }) => {
	const { createSuccessNotice, createErrorNotice } = useDispatch(
		noticesStore
	) as any;
	const library = useEntityRecord<Library>(
		'interactive-code-block',
		'library',
		id
	);
	const { deleteEntityRecord } = useDispatch('core');

	const [isEditing, setIsEditing] = useState(false);
	useOnEscapeKey(function () {
		if (isEditing) {
			library.edit({ name: library.record!.name });
			setIsEditing(false);
		}
	});

	const handleDelete = async () => {
		// eslint-disable-next-line no-alert
		const confirmation = window.confirm(
			__(
				'Are you sure you want to delete this library? ALL code blocks using this library will stop working.'
			)
		);
		if (!confirmation) {
			return;
		}
		try {
			await deleteEntityRecord(
				'interactive-code-block',
				'library',
				id,
				null,
				{ throwOnError: true }
			);
			// Tell the user the operation succeeded:
			createSuccessNotice('The library was deleted!', {
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
			<AnyItem isBlock onDoubleClick={() => setIsEditing(true)}>
				{library.editedRecord.name}
			</AnyItem>
			<FlexItem>
				<Button isDestructive onClick={handleDelete}>
					{__('Delete')}
				</Button>
			</FlexItem>
		</Flex>
	);
};
