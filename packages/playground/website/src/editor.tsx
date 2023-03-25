import { createRoot } from 'react-dom/client';

import Editor from './components/editor';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
root.render(
    <Editor />,
);
