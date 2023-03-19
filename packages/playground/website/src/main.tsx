import { createRoot } from 'react-dom/client';

import PlaygroundViewport from './components/playground-viewport';
import EditorButton from './components/editor-button';
import TerminalButton from './components/terminal-button';

import { setupPlayground } from './lib/setup-playground';

const query = new URL(document.location.href).searchParams;
const isSeamless = (query.get('mode') || 'browser') === 'seamless';

const root = createRoot(document.getElementById('root')!);
root.render(
	<PlaygroundViewport
		isSeamless={isSeamless}
		setupPlayground={setupPlayground}
		toolbarButtons={[
			<EditorButton key="editor" />,
			<TerminalButton key="terminal" />,
		]}
	/>
);
