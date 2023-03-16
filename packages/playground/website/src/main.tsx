import { createRoot } from 'react-dom/client';

import PlaygroundViewport from './components/playground-viewport';
import ExportButton from './components/export-button';
import ImportButton from './components/import-button';

import { setupPlayground } from './lib/setup-playground';

const query = new URL(document.location.href).searchParams;
const isSeamless = (query.get('mode') || 'browser') === 'seamless';

const root = createRoot(document.getElementById('root')!);
root.render(
  <PlaygroundViewport
    isSeamless={isSeamless}
    setupPlayground={setupPlayground}
    toolbarButtons={[
      <ImportButton key="export" />,
      <ExportButton key="export" />,
    ]}
  />
);
