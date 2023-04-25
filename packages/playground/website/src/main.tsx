import { createRoot } from 'react-dom/client';
import PlaygroundViewport from './components/playground-viewport';
import ExportButton from './components/export-button';
import ImportButton from './components/import-button';
import VersionSelector from './components/version-select';
import './styles.css';

import { makeBlueprint } from './lib/make-blueprint';
import {
	LatestSupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';

const query = new URL(document.location.href).searchParams;
const blueprint = makeBlueprint({
	php: query.get('php') || '8.0',
	wp: query.get('wp') || 'latest',
	theme: query.get('theme') || undefined,
	plugins: query.getAll('plugin'),
	landingPage: query.get('url') || undefined,
});

const isSeamless = (query.get('mode') || 'browser') === 'seamless';
const SupportedWordPressVersionsList = ['6.2', '6.1', '6.0', '5.9'];
const LatestSupportedWordPressVersion = SupportedWordPressVersionsList[0];

const root = createRoot(document.getElementById('root')!);
root.render(
	<PlaygroundViewport
		isSeamless={isSeamless}
		blueprint={blueprint}
		toolbarButtons={[
			<VersionSelector
				name="php"
				versions={SupportedPHPVersionsList}
				selected={blueprint.preferredVersions?.php}
				default={LatestSupportedPHPVersion}
			/>,
			<VersionSelector
				name="wp"
				versions={SupportedWordPressVersionsList}
				selected={blueprint.preferredVersions?.wp}
				default={LatestSupportedWordPressVersion}
			/>,
			<ImportButton key="export" />,
			<ExportButton key="export" />,
		]}
	/>
);
