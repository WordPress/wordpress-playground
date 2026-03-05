import { type ChangeEvent, useMemo } from 'react';

import { useAppDispatch, useAppSelector } from '../hooks';
import { queueRun, setPhpVersion, setWpVersion } from '../store';
import styles from './Layout.module.css';

interface ControlsProps {
	onHelpClick: () => void;
}

export const Controls = ({ onHelpClick }: ControlsProps) => {
	const dispatch = useAppDispatch();
	const {
		phpVersion,
		wpVersion,
		phpVersions,
		wpVersions,
		wpVersionsLoading,
	} = useAppSelector((state) => state.playground);

	const runLabel = useMemo(() => {
		const isMac =
			typeof navigator !== 'undefined' &&
			navigator.platform.toUpperCase().includes('MAC');
		return `Run (${isMac ? 'Cmd+S' : 'Ctrl+S'})`;
	}, []);

	const handlePhpVersionChange = (event: ChangeEvent<HTMLSelectElement>) => {
		dispatch(setPhpVersion(event.target.value));
	};

	const handleWpVersionChange = (event: ChangeEvent<HTMLSelectElement>) => {
		dispatch(setWpVersion(event.target.value));
	};

	const handleRunClick = () => {
		dispatch(queueRun());
	};

	return (
		<div className={styles.controls}>
			<h1 className={styles.controlsTitle}>WordPress PHP Playground</h1>
			<div className={styles.controlsRight}>
				<label htmlFor="wpVersion">WordPress</label>
				<select
					id="wpVersion"
					className={styles.select}
					value={wpVersion}
					onChange={handleWpVersionChange}
				>
					{wpVersionsLoading ? (
						<option value={wpVersion}>Loading...</option>
					) : (
						wpVersions.map((version) => (
							<option key={version} value={version}>
								{version}
							</option>
						))
					)}
					{!wpVersionsLoading && !wpVersions.includes(wpVersion) && (
						<option value={wpVersion}>{wpVersion}</option>
					)}
				</select>
				<label htmlFor="phpVersion">PHP</label>
				<select
					id="phpVersion"
					className={styles.select}
					value={phpVersion}
					onChange={handlePhpVersionChange}
				>
					{phpVersions.map((version) => (
						<option key={version} value={version}>
							{version}
						</option>
					))}
				</select>
				<button
					id="runBtn"
					type="button"
					className={styles.runButton}
					onClick={handleRunClick}
				>
					{runLabel}
				</button>
				<button
					id="helpBtn"
					className={styles.helpLink}
					onClick={onHelpClick}
				>
					How does this work?
				</button>
			</div>
		</div>
	);
};
