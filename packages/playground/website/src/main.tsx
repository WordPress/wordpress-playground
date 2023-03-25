import { createRoot } from 'react-dom/client';
import PlaygroundViewport from './components/playground-viewport';
import TerminalButton from './components/terminal-button';
import ExportButton from './components/export-button';
import ImportButton from './components/import-button';
import VersionSelector from './components/version-select';
import './styles.css';

import { setupPlayground } from './lib/setup-playground';

const phpVersions = [
	'8.2',
	'8.1',
	'8.0',
	'7.4',
	'7.3',
	'7.2',
	'7.1',
	'7.0',
	'5.6',
];
const wpVersions = [
  '6.1',
  '6.0',
  '5.9',
  // 'nightly',
  // 'develop',
];
const query = new URL(document.location.href).searchParams;
const isSeamless = (query.get('mode') || 'browser') === 'seamless';

const root = createRoot(document.getElementById('root')!);
root.render(
	<PlaygroundViewport
		isSeamless={isSeamless}
		setupPlayground={setupPlayground}
		toolbarButtons={[
			<VersionSelector name="php" versions={phpVersions} />,
			<VersionSelector name="wp" versions={wpVersions} />,
			<ImportButton key="export" />,
			<ExportButton key="export" />,
			<TerminalButton key="terminal" />,
		]}
	/>
);
