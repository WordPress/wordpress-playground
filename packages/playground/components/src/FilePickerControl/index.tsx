import React, { useState } from 'react';
import { Button, Icon, Modal } from '@wordpress/components';
import { chevronRight } from '@wordpress/icons';
import { PathPreview } from './PathPreview';
import css from './style.module.css';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { FilePickerTree } from '../FilePickerTree';
import { folder } from '../icons';

export function FilePickerControl({
	value = '',
	onChange,
	filesystem,
	root,
	readOnly = false,
	directoriesOnly = false,
	disabled = false,
}: {
	value?: string;
	onChange: (selectedPath: string) => void;
	filesystem: AsyncWritableFilesystem;
	root?: string;
	readOnly?: boolean;
	directoriesOnly?: boolean;
	disabled?: boolean;
}) {
	const [isOpen, setOpen] = useState(false);
	const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(
		value || null
	);
	const openModal = () => {
		setLastSelectedPath(value || null);
		setOpen(true);
	};
	const closeModal = () => setOpen(false);
	function handleSubmit(event?: React.FormEvent<HTMLFormElement>) {
		event?.preventDefault();
		event?.stopPropagation();
		onChange(lastSelectedPath || '');
		closeModal();
	}

	return (
		<>
			<Button
				type="button"
				variant="tertiary"
				className={css['control']}
				disabled={disabled}
				aria-label={`Choose path. Current path: ${
					value || 'No path selected'
				}`}
				title={value || 'Select a path'}
				onClick={openModal}
			>
				<span className={css['folderIcon']} aria-hidden="true">
					<Icon icon={folder} size={18} />
				</span>
				<PathPreview path={value || ''} />
				<span className={css['chevron']} aria-hidden="true">
					<Icon icon={chevronRight} size={18} />
				</span>
			</Button>
			{isOpen && (
				<Modal
					title="Select a path"
					onRequestClose={closeModal}
					className={css['modal']}
				>
					<form onSubmit={handleSubmit}>
						<FilePickerTree
							filesystem={filesystem}
							root={root}
							readOnly={readOnly}
							directoriesOnly={directoriesOnly}
							initialSelectedPath={value}
							onSelect={setLastSelectedPath}
						/>
						<div className={css['modalFooter']}>
							<Button
								type="submit"
								variant="primary"
								disabled={!lastSelectedPath}
							>
								Select path
							</Button>
						</div>
					</form>
				</Modal>
			)}
		</>
	);
}
