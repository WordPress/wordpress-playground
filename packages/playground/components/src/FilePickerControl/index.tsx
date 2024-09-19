import React, { useState } from 'react';
import { Button, Modal } from '@wordpress/components';
import { PathPreview } from './PathPreview';
import css from './style.module.css';
import FilePickerTree from '../FilePickerTree';
import type { FileNode, FilePickerControlProps } from '../FilePickerTree';

export function FilePickerControl({
	value = '',
	onChange,
	onOpen = () => {},
	onClose = () => {},
	files = [],
	filePickerTree: FilePickerTreeComponent = FilePickerTree,
}: {
	value?: string;
	onChange: (selectedPath: string) => void;
	onOpen?: () => void;
	onClose?: () => void;
	files?: FileNode[];
	filePickerTree?: React.ComponentType<FilePickerControlProps>;
}) {
	const [isOpen, setOpen] = useState(false);
	const openModal = () => {
		setOpen(true);
		onOpen();
	};
	const closeModal = () => {
		setOpen(false);
		onClose();
	};

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
				variant="secondary"
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
						<FilePickerTreeComponent
							files={files}
							initialPath={value}
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
