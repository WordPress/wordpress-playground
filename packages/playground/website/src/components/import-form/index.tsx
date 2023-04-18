import React from 'react';
import { useRef, useState } from 'react';
import type { PlaygroundClient } from '@wp-playground/client';

import css from './style.module.css';
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
			await replaceSite(playground, file);
		} catch (error) {
			setError(
				'Unable to import file. Is it a valid WordPress Playground export?'
			);
			return;
		}

		onImported();
	}

	return (
		<div className={css.modalInner}>
			<form
				id="import-playground-form"
				ref={form}
				onSubmit={handleSubmit}
			>
				<button
					id="import-close-modal--btn"
					onClick={onClose}
					className={`${css.btn} ${css.btnClose}`}
					aria-label="Close import window"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						width="32"
						height="32"
						aria-hidden="true"
						focusable="false"
					>
						<path d="M13 11.8l6.1-6.3-1-1-6.1 6.2-6.1-6.2-1 1 6.1 6.3-6.5 6.7 1 1 6.5-6.6 6.5 6.6 1-1z"></path>
					</svg>
				</button>
				<h2 tabIndex={0}>Import Playground</h2>
				<p className={css.modalText}>
					You may replace the current WordPress Playground site with a
					previously exported one.
				</p>
				<p className={css.modalText}>
					<strong>Known Limitations</strong>
				</p>
				<div className={css.inputsContainer}>
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
						className={css.fileInputLabel}
						onClick={handleImportSelectFileClick}
					>
						<div
							id="import-select-file--text"
							className={css.fileInputText}
						>
							{error ? (
								<span className={css.error}>{error}</span>
							) : file ? (
								file.name
							) : (
								'No File Selected'
							)}
						</div>
						<button
							id="import-select-file--btn"
							className={css.btn}
						>
							Choose File
						</button>
					</label>
					<button
						id="import-submit--btn"
						className={css.btn}
						disabled={!file}
					>
						Import
					</button>
				</div>
			</form>
		</div>
	);
}
