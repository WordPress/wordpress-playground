import { createRoot } from 'react-dom/client';
import PlaygroundViewport from './components/playground-viewport';
import ExportButton from './components/export-button';
import ImportButton from './components/import-button';
import VersionSelector from './components/version-select';
import './styles.css';

import { setupPlayground } from './lib/setup-playground';
import { SupportedPHPVersionsList } from '@php-wasm/abstract';

const query = new URL(document.location.href).searchParams;
const isSeamless = (query.get('mode') || 'browser') === 'seamless';
const SupportedWordPressVersionsList = ['6.2', '6.1', '6.0', '5.9'];

const root = createRoot(document.getElementById('root')!);
root.render(
	<PlaygroundViewport
		isSeamless={isSeamless}
		setupPlayground={setupPlayground}
		toolbarButtons={[
			<VersionSelector name="php" versions={SupportedPHPVersionsList} />,
			<VersionSelector
				name="wp"
				versions={SupportedWordPressVersionsList}
			/>,
			<ImportButton key="export" />,
			<ExportButton key="export" />,
		]}
	/>
);
