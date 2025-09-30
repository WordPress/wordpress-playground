import React, { useState } from 'react';
import { Button, Modal } from '@wordpress/components';
import { PathPreview } from './PathPreview';
import css from './style.module.css';
import type { AsyncWritableFilesystem } from '../FilePickerTree';
import { FilePickerTree } from '../FilePickerTree';

export function FilePickerControl({
	value = '',
	onChange,
	filesystem,
}: {
	value?: string;
	onChange: (selectedPath: string) => void;
	filesystem: AsyncWritableFilesystem;
}) {
	const [isOpen, setOpen] = useState(false);
	const openModal = () => setOpen(true);
	const closeModal = () => setOpen(false);

	const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(
		value || null
	);
	function handleSubmit(event?: React.FormEvent<HTMLFormElement>) {
		event?.preventDefault();
		onChange(lastSelectedPath || '');
		closeModal();
	}

	return (
		<>
			<Button
				variant="tertiary"
				className={css['control']}
				onClick={openModal}
			>
				<span className={css['browseLabel']}>Browse</span>
				<PathPreview path={value || ''} />
			</Button>
			{isOpen && (
				<Modal
					title="Select a path "
					onRequestClose={closeModal}
					className={css['modal']}
				>
					<form onSubmit={handleSubmit}>
						<FilePickerTree
							filesystem={filesystem}
							initialSelectedPath={value}
							onSelect={setLastSelectedPath}
						/>
						<div className={css['modalFooter']}>
							<Button type="submit" variant="primary">
								Select Path
							</Button>
						</div>
					</form>
				</Modal>
			)}
		</>
	);
}
