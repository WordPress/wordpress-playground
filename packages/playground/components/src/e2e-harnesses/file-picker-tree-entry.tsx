import React from 'react';
import { createRoot } from 'react-dom/client';
import { FilePickerTreeHarness } from './file-picker-tree-harness';

const container = document.getElementById('root');
if (!container) {
	throw new Error('Harness root element missing');
}

createRoot(container).render(<FilePickerTreeHarness />);
