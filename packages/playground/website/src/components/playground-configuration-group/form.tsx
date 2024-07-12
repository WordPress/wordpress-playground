import css from './style.module.css';
import forms from '../../forms.module.css';
import { useEffect, useState } from 'react';
import {
	SupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import { StorageType } from '../../types';
import { OPFSButton } from './opfs-button';
import Button from '../button';
import { PlaygroundReduxState } from '../../lib/redux-store';
import { useSelector } from 'react-redux';

export interface PlaygroundConfiguration {
	wp: string;
	php: SupportedPHPVersion;
	withExtensions: boolean;
	withNetworking: boolean;
	storage: StorageType;
	resetSite: boolean;
}

export interface PlaygroundConfigurationFormProps {
	supportedWPVersions: Record<string, string>;
	currentlyRunningWordPressVersion: string | undefined;
	initialData: PlaygroundConfiguration;
	onSubmit: (config: PlaygroundConfiguration) => void;
	onSelectLocalDirectory: 'not-available' | 'origin-mismatch' | (() => any);
	isMountingLocalDirectory: boolean;
	mountProgress?: {
		files: number;
		total: number;
	};
}

export function PlaygroundConfigurationForm({
	supportedWPVersions,
	currentlyRunningWordPressVersion,
	isMountingLocalDirectory = false,
	mountProgress,
	initialData,
	onSubmit,
	onSelectLocalDirectory,
}: PlaygroundConfigurationFormProps) {
	const offline = useSelector((state: PlaygroundReduxState) => state.offline);

	const [php, setPhp] = useState(initialData.php);
	const [storage, setStorage] = useState<StorageType>(initialData.storage);
	const [withExtensions, setWithExtensions] = useState<boolean>(
		initialData.withExtensions
	);
	const [withNetworking, setWithNetworking] = useState<boolean>(
		initialData.withNetworking
	);
	const [wp, setWp] = useState(initialData.wp);
	const handleStorageChange = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		setStorage(event.target.value as any as StorageType);
	};

	const [resetSite, setResetSite] = useState(initialData.resetSite);

	useEffect(() => {
		if (
			currentlyRunningWordPressVersion &&
			wp !== currentlyRunningWordPressVersion
		) {
			setResetSite(true);
		}
	}, [wp, resetSite, currentlyRunningWordPressVersion]);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		onSubmit({
			php,
			storage,
			wp,
			resetSite,
			withExtensions,
			withNetworking,
		});
	}

	async function handleSelectLocalDirectory(
		e: React.MouseEvent<HTMLButtonElement>
	) {
		e.preventDefault();
		if ('function' === typeof onSelectLocalDirectory) {
			onSelectLocalDirectory();
		}
	}

	const liveDirectoryAvailable = ![
		'not-available',
		'origin-mismatch',
	].includes(onSelectLocalDirectory as any);

	return (
		<form onSubmit={handleSubmit}>
			<h2 tabIndex={0} style={{ textAlign: 'center', marginTop: 0 }}>
				Customize Playground
			</h2>
			<div className={forms.formGroup}>
				<label htmlFor="wp-version" className={forms.groupLabel}>
					Storage type
				</label>
				<ul className={css.radioList}>
					<li>
						<input
							type="radio"
							name="storage"
							value="none"
							id="storage-none"
							className={forms.radioInput}
							onChange={handleStorageChange}
							checked={storage === 'none'}
						/>
						<label
							htmlFor="storage-none"
							className={forms.radioLabel}
						>
							None: changes will be lost on page refresh.
						</label>
					</li>
					<li>
						<input
							type="radio"
							name="storage"
							value="browser"
							id="storage-browser"
							className={forms.radioInput}
							onChange={handleStorageChange}
							checked={storage === 'browser'}
						/>
						<label
							htmlFor="storage-browser"
							className={forms.radioLabel}
						>
							Browser: stored in this browser.
						</label>
					</li>
					{storage === 'browser' ? (
						<li
							style={{ marginLeft: 40 }}
							className={resetSite ? css.danger : ''}
						>
							<input
								type="checkbox"
								name="reset"
								value="1"
								disabled={
									!!currentlyRunningWordPressVersion &&
									wp !== currentlyRunningWordPressVersion
								}
								id="storage-browser-reset"
								className={forms.radioInput}
								onChange={(
									event: React.ChangeEvent<HTMLInputElement>
								) => {
									setResetSite(event.target.checked);
								}}
								checked={resetSite}
							/>
							<label
								htmlFor="storage-browser-reset"
								className={forms.radioLabel}
							>
								Delete stored data and start fresh
							</label>
						</li>
					) : null}
					<li>
						<input
							type="radio"
							name="storage"
							value="device"
							id="device"
							className={
								liveDirectoryAvailable
									? forms.radioInput
									: `${forms.radioInput} ${forms.notAvailable}`
							}
							onChange={handleStorageChange}
							checked={storage === 'device'}
							disabled={!liveDirectoryAvailable}
						/>
						<label htmlFor="device" className={forms.radioLabel}>
							Device: stored locally in your device (beta).
							{'not-available' === onSelectLocalDirectory && (
								<span>
									<br />
									Not supported in this browser.
								</span>
							)}
							{'origin-mismatch' === onSelectLocalDirectory && (
								<span>
									<br />
									Not supported on this site.
								</span>
							)}
						</label>
					</li>
					{storage === 'device' ? (
						<li>
							<div>
								<p>
									Sync Playground with a local directory. Your
									files stay private and are <b>not</b>{' '}
									uploaded anywhere.
								</p>
								<p>Select either a:</p>
								<ul>
									<li>
										<b>Empty directory</b> – to save this
										Playground and start syncing
									</li>
									<li>
										<b>Existing Playground directory</b> –
										to load it here and start syncing
									</li>
								</ul>
								<p>
									Files changed in Playground <b>will</b> be
									synchronized to on your computer.
								</p>
								<p>
									Files changed on your computer{' '}
									<b>will not</b> be synchronized to
									Playground. You'll need to click the "Sync
									local files" button.
								</p>
								<div className={forms.submitRow}>
									<OPFSButton
										isMounting={isMountingLocalDirectory}
										mountProgress={mountProgress}
										onClick={handleSelectLocalDirectory}
										size="large"
										variant="primary"
									>
										Select a local directory
									</OPFSButton>
								</div>
							</div>
						</li>
					) : null}
				</ul>
			</div>
			{storage !== 'device' ? (
				<>
					<div
						className={`${forms.formGroup} ${forms.formGroupLinear}`}
					>
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
							disabled={offline}
							onChange={(
								event: React.ChangeEvent<HTMLSelectElement>
							) => {
								setPhp(
									event.target.value as SupportedPHPVersion
								);
							}}
						>
							{SupportedPHPVersionsList.map((version) => (
								<option key={version} value={version}>
									PHP {version}&nbsp;
								</option>
							))}
						</select>
						<label
							className={forms.groupLabel}
							style={{ marginTop: 15, cursor: 'pointer' }}
						>
							<input
								type="checkbox"
								name="with-extensions"
								disabled={offline}
								checked={withExtensions}
								onChange={() =>
									setWithExtensions(!withExtensions)
								}
							/>
							&nbsp; Load extensions: libxml, openssl, mbstring,
							iconv, gd. Uncheck to save ~6MB of initial
							downloads.
						</label>
						<label
							className={forms.groupLabel}
							style={{ marginTop: 15, cursor: 'pointer' }}
						>
							<input
								type="checkbox"
								name="with-networking"
								disabled={offline}
								checked={withNetworking}
								onChange={() =>
									setWithNetworking(!withNetworking)
								}
							/>
							&nbsp; Network access (e.g. for browsing plugins)
						</label>
					</div>
					<div
						className={`${forms.formGroup} ${forms.formGroupLinear} ${forms.formGroupLast}`}
					>
						<label
							htmlFor="wp-version"
							className={forms.groupLabel}
							style={{ marginTop: 15, cursor: 'pointer' }}
						>
							WordPress Version
						</label>
						<div
							style={{
								display: 'flex',
								gap: '0.5rem',
								flexDirection: 'column',
							}}
						>
							<select
								id="wp-version"
								value={wp}
								className={forms.largeSelect}
								disabled={offline}
								onChange={(
									event: React.ChangeEvent<HTMLSelectElement>
								) => {
									setWp(event.target.value as string);
								}}
							>
								{/*
								 * Without an empty option, React sometimes says
								 * the current selected version is "nightly" when
								 * `wp` is actually "6.4".
								 */}
								<option value="">-- Select a version --</option>
								{Object.keys(supportedWPVersions).map(
									(version) => (
										<option key={version} value={version}>
											WordPress{' '}
											{supportedWPVersions[version]}
											&nbsp;&nbsp;
										</option>
									)
								)}
							</select>
							<br />
							<a
								href="https://wordpress.github.io/wordpress-playground/blueprints-api/examples#load-an-older-wordpress-version"
								target="_blank"
								rel="noreferrer"
								style={{ fontSize: '0.9em' }}
							>
								Need an older version?
							</a>
						</div>
					</div>
					<div className={forms.submitRow}>
						<Button type="submit" variant="primary" size="large">
							Apply changes
						</Button>
					</div>
				</>
			) : null}
		</form>
	);
}
