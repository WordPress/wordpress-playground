import React from 'react';
import { useRef, useState } from 'react';
import type { PlaygroundClient } from '@wp-playground/client';

import css from './style.module.css';
import forms from '../../forms.module.css';
import { replaceSite } from '@wp-playground/client';

interface ImportFormProps {
	playground: PlaygroundClient;
	onImported: () => void;
	onClose: () => void;
}

export default function ImportForm({
	playground,
	onImported,
	onClose,
}: ImportFormProps) {
	const form = useRef<any>();
	const fileInputRef = useRef<any>();
	const [file, setFile] = useState<File | null>(null);
	const [error, setError] = useState<string>('');
	function handleSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
		setFile(e.target.files![0]);
	}
	function handleImportSelectFileClick(
		e: React.MouseEvent<HTMLLabelElement>
	) {
		e.preventDefault();
		form.current?.reset();
		fileInputRef.current?.click();
	}

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!file) {
			return;
		}

		try {
			await replaceSite(playground, { fullSiteZip: file });
		} catch (error) {
			setError(
				'Unable to import file. Is it a valid WordPress Playground export?'
			);
			return;
		}

		onImported();
	}

	return (
		<form id="import-playground-form" ref={form} onSubmit={handleSubmit}>
			<h2 tabIndex={0}>Import Playground</h2>
			<p className={css.modalText}>
				You may replace the current WordPress Playground site with a
				previously exported one.
			</p>
			<p className={css.modalText}>
				<strong>Known Limitations</strong>
			</p>
			<div className={forms.formGroup}>
				<input
					type="file"
					id="import-select-file"
					onChange={handleSelectFile}
					style={{ display: 'none' }}
					ref={fileInputRef}
					accept="application/zip"
				/>
				<label
					htmlFor="import-select-file"
					className={forms.fileInputLabel}
					onClick={handleImportSelectFileClick}
				>
					<div
						id="import-select-file--text"
						className={forms.fileInputText}
					>
						{error ? (
							<span className={forms.error}>{error}</span>
						) : file ? (
							file.name
						) : (
							'No File Selected'
						)}
					</div>
					<button id="import-select-file--btn" className={forms.btn}>
						Choose File
					</button>
				</label>
				<button
					id="import-submit--btn"
					className={forms.btn}
					disabled={!file}
				>
					Import
				</button>
			</div>
		</form>
	);
}
