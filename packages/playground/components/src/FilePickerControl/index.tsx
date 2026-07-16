import React, { useState } from 'react';
import { Button, Modal } from '@wordpress/components';
import { PathPreview } from './PathPreview';
import css from './style.module.css';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import { FilePickerTree } from '../FilePickerTree';

export function FilePickerControl({
	value = '',
	onChange,
	filesystem,
	root,
	readOnly = false,
	directoriesOnly = false,
}: {
	value?: string;
	onChange: (selectedPath: string) => void;
	filesystem: AsyncWritableFilesystem;
	root?: string;
	readOnly?: boolean;
	directoriesOnly?: boolean;
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
				onClick={openModal}
			>
				<span className={css['browseLabel']}>Browse</span>
				<PathPreview path={value || ''} />
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
								Select Path
							</Button>
						</div>
					</form>
				</Modal>
			)}
		</>
	);
}
