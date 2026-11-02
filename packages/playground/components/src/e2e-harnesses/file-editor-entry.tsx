import React from 'react';
import { createRoot } from 'react-dom/client';
import { FileEditorHarness } from './file-editor-harness';

const container = document.getElementById('root');
if (!container) {
	throw new Error('Harness root element missing');
}

createRoot(container).render(<FileEditorHarness />);
