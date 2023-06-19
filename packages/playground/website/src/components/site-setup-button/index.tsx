import { SupportedPHPVersionsList } from '@php-wasm/universal';
import type { PlaygroundClient } from '@wp-playground/client';

import Button from '../button';
import { useEffect, useState } from 'react';
import Modal from '../modal';
import css from './style.module.css';
import forms from '../../forms.module.css';

interface SiteSetupButton {
	playground?: PlaygroundClient;
	selectedPHP?: string;
	preferredWP?: string;
	persistent: boolean;
}

const SupportedWordPressVersionsList = ['nightly', '6.2', '6.1', '6.0', '5.9'];

const resolveVersion = (
	version: string | undefined,
	allVersions: string[],
	_default: string
) => {
	if (!version || version === 'latest' || !allVersions.includes(version)) {
		return _default;
	}
	return version;
};

export default function SiteSetupButton({
	playground,
	selectedPHP,
	preferredWP,
	persistent,
}: SiteSetupButton) {
	const [isOpen, setOpen] = useState(false);
	const openModal = () => setOpen(true);
	const closeModal = () => setOpen(false);

	const [playgroundWp, setPlaygroundWp] = useState(() =>
		resolveVersion(preferredWP, SupportedWordPressVersionsList, '6.2')
	);
	const [php, setPhp] = useState(
		resolveVersion(selectedPHP, SupportedPHPVersionsList, '8.0')
	);
	const [wp, setWp] = useState(playgroundWp);
	const [storage, setStorage] = useState(
		persistent ? 'persistent' : 'temporary'
	);
	const [resetSite, setResetSite] = useState(false);

	useEffect(() => {
		if (wp !== playgroundWp) {
			setResetSite(true);
		}
	}, [wp, playgroundWp, resetSite]);

	useEffect(() => {
		if (playground) {
			playground.getWordPressModuleDetails().then((details) => {
				setPlaygroundWp(details.majorVersion);
				setWp(details.majorVersion);
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [!playground]);

	const handleStorageChange = (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		setStorage(event.target.value);
	};

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!playground) return;

		if (resetSite && persistent) {
			if (
				!window.confirm(
					'This will wipe out all stored data and start a new site. Do you want to proceed?'
				)
			) {
				return;
			}
			await playground?.resetOpfs();
		}

		const url = new URL(window.location.toString());
		url.searchParams.set('php', php);
		url.searchParams.set('wp', wp);

		url.searchParams.set(
			'persistent',
			storage === 'persistent' ? '1' : '0'
		);
		window.location.assign(url);
	}

	return (
		<>
			<Button onClick={openModal}>
				PHP {selectedPHP} {' | '}
				WP {playgroundWp} {' | '}
				{persistent ? 'Persistent' : '⚠️ Temporary'}
			</Button>
			<Modal isOpen={isOpen} onRequestClose={closeModal}>
				<form onSubmit={handleSubmit}>
					<h2 tabIndex={0} style={{ textAlign: 'center' }}>
						Customize Playground
					</h2>
					<div className={forms.formGroup}>
						<label
							htmlFor="php-version"
							className={forms.groupLabel}
						>
							PHP Version
						</label>
						<select
							id="php-version"
							value={php}
							className={forms.largeSelect}
							onChange={(
								event: React.ChangeEvent<HTMLSelectElement>
							) => {
								setPhp(event.target.value);
							}}
						>
							{SupportedPHPVersionsList.map((version) => (
								<option key={version} value={version}>
									PHP {version}&nbsp;
								</option>
							))}
						</select>
					</div>
					<div className={forms.formGroup}>
						<label
							htmlFor="wp-version"
							className={forms.groupLabel}
						>
							WordPress Version
						</label>
						<select
							id="wp-version"
							value={wp}
							className={forms.largeSelect}
							onChange={(
								event: React.ChangeEvent<HTMLSelectElement>
							) => {
								setWp(event.target.value);
							}}
						>
							{SupportedWordPressVersionsList.map((version) => (
								<option key={version} value={version}>
									WordPress {version}&nbsp;&nbsp;
								</option>
							))}
						</select>
					</div>
					<div
						className={`${forms.formGroup} ${forms.formGroupLast}`}
					>
						<label
							htmlFor="wp-version"
							className={forms.groupLabel}
						>
							Storage type
						</label>
						<ul className={css.radioList}>
							<li>
								<input
									type="radio"
									name="storage"
									value="temporary"
									id="storage-temporary"
									className={forms.radioInput}
									onChange={handleStorageChange}
									checked={storage === 'temporary'}
								/>
								<label
									htmlFor="storage-temporary"
									className={forms.radioLabel}
								>
									Temporary – reset on page refresh
								</label>
							</li>
							<li>
								<input
									type="radio"
									name="storage"
									value="persistent"
									id="storage-persistent"
									className={forms.radioInput}
									onChange={handleStorageChange}
									checked={storage === 'persistent'}
								/>
								<label
									htmlFor="storage-persistent"
									className={forms.radioLabel}
								>
									Persistent – stored in this browser
								</label>
							</li>
							{storage === 'persistent' ? (
								<li
									style={{ marginLeft: 40 }}
									className={resetSite ? css.danger : ''}
								>
									<input
										type="checkbox"
										name="reset"
										value="1"
										disabled={wp !== playgroundWp}
										id="storage-persistent-reset"
										className={forms.radioInput}
										onChange={(
											event: React.ChangeEvent<HTMLInputElement>
										) => {
											setResetSite(event.target.checked);
										}}
										checked={resetSite}
									/>
									<label
										htmlFor="storage-persistent-reset"
										className={forms.radioLabel}
									>
										Delete stored data and start fresh
									</label>
								</li>
							) : null}
						</ul>
					</div>
					<button
						type="submit"
						disabled={!playground}
						className={`${forms.btn} ${css.submit}`}
					>
						Apply changes
					</button>
				</form>
			</Modal>
		</>
	);
}
