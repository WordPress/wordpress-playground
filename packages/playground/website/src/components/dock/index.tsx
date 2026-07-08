import classNames from 'classnames';
import { SyncLocalFilesButton } from '../sync-local-files-button';
import {
	setSiteManagerOpen,
	setSiteManagerSection,
	type SiteManagerSection,
} from '../../lib/state/redux/slice-ui';
import {
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import css from './style.module.css';

type DockSection = Extract<
	SiteManagerSection,
	'settings' | 'files' | 'blueprint' | 'database' | 'logs'
>;

const SITE_MANAGER_TOOLS: Array<{
	section: DockSection;
	label: string;
}> = [
	{ section: 'settings', label: 'Settings' },
	{ section: 'files', label: 'Files' },
	{ section: 'blueprint', label: 'Blueprint' },
	{ section: 'database', label: 'Database' },
	{ section: 'logs', label: 'Logs' },
];

export function Dock({
	onOpenPlaygrounds,
	onOpenBlueprints,
}: {
	onOpenPlaygrounds: () => void;
	onOpenBlueprints: () => void;
}) {
	const dispatch = useAppDispatch();
	const activeSite = useActiveSite();
	const siteManagerIsOpen = useAppSelector(
		(state) => state.ui.siteManagerIsOpen
	);
	const activeSection = useAppSelector(
		(state) => state.ui.siteManagerSection
	);

	function openSiteManagerSection(section: DockSection) {
		dispatch(setSiteManagerSection(section));
		dispatch(setSiteManagerOpen(true));
	}

	return (
		<nav className={css.dock} aria-label="Playground tools">
			<div className={css.tools}>
				<button
					type="button"
					className={css.tool}
					onClick={onOpenPlaygrounds}
				>
					Playgrounds
				</button>
				<button
					type="button"
					className={css.tool}
					onClick={onOpenBlueprints}
				>
					New
				</button>
				{SITE_MANAGER_TOOLS.map(({ section, label }) => (
					<button
						key={section}
						type="button"
						className={classNames(css.tool, {
							[css.active]:
								siteManagerIsOpen && activeSection === section,
						})}
						aria-pressed={
							siteManagerIsOpen && activeSection === section
						}
						onClick={() => openSiteManagerSection(section)}
					>
						{label}
					</button>
				))}
				{activeSite?.metadata.storage === 'local-fs' ? (
					<div className={css.syncButton}>
						<SyncLocalFilesButton />
					</div>
				) : null}
			</div>
		</nav>
	);
}
