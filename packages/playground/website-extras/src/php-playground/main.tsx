/**
 * Follow-up work:
 *
 * * Files explorer
 *    * "Refresh" button to refresh the directory tree – OR auto-refresh every ~five seconds.
 *    * Ability to create top-level directories
 *    * Single click a file -> open it
 *    * Double click a file -> focus the code editor
 *    * ✅ Bug – sometimes collapsing a directory = children are not visible after reopening.
 *         It an actual bug, not a faulty vite hot reloader!
 *    * ✅ When I click "new file" and have a file selected, create a file in the parent
 *         directory
 *    * ✅ Download file / directory action
 *    * ✅ Left/right arrows/delete don't work when renaming a file.
 *    * ✅ Indicate the terminal and file explorer are loading
 *    * ✅ Detect when a binary file is opened, show a special message "binary file. can't
 *         edit (download)"
 *    * ✅ Create and delete files and directories.
 *    * ✅ CSS papercuts, e.g. dark font on dark background for active hovered selected files.
 *    * ✅ Improve visual feedback when loading files (don't replace filename with loader).
 *    * ✅ Don't re-render (and show the loading indicator) when not needed.
 *    * ✅ Don't display "/", display just "home", "tmp", and "wordpress" directly
 *    * ✅ Refresh the files after collapsing and expanding the parent directory
 *    * ✅ Ensure it's scrollable with overflow: auto
 *    * ✅ Initialization UX – show the expanded path right away
 *    * ✅ Separate "focus" from "open" actions so that I can browse files
 *         without editing them
 * * Editor
 *    * ✅ Save changes when editing files other than code.php
 *    * ✅ Display breadcrumbs of the currently open file above the editor?
 * * Preview
 *    * ✅ Add address bar for easy navigation
 * * Terminal
 *    * Need to click the terminal twice to focus it
 *    * ✅ Implement cwd, cd
 *    * ✅ Communicate cwd in current prompt (like fish)
 *    * ✅ Disable terminal collapsing for now
 *
 * ------- later: -------
 * * A "World" module for triggering syscalls such as
 *   Filesystem interactions, spawning processes, etc.
 *   Also a global-ish state for currently edited path
 *   with a way to track file operations.
 * * Responsive design, useful support for mobile phones
 * * Sharing
 *    * UX for sharing more involved projects, e.g. when I edit a WordPress plugin
 *      and not just the code snippet (Maybe connect GitHub and save diff in a
 *      repository or in a gist?)
 *    * "Git" tool to see diff against the initial state
 *    * "Save patch"
 *    * Maybe put that patch in the URL? Or, if too large, tell the user we need some place to store
 *      the data to keep it shareable?
 *    * Or add a "share" button that will tell them? But that changes the semantics vs the default
 *      way of "just copy the URL."
 *    * Or display a modal "Hey, this is the limit of the shareable URL. It won't be updated
 *      anymore until you connect Github or so".
 * * Terminal
 *    * Tab completion for paths
 *    * Implement basic `curl` and `curl -O` and `wget` to download remote files
 *    * Implement `git clone` and `git checkout`
 *    * Implement `unzip` (via PHP `ZipArchive`)
 * * Tool palette (file browser, environment setup form with wp+php versions, Blueprint editor)
 * * Integrate with Playground.wordpress.net – bring over a tool
 *   palette (file browser, sites browser, Blueprints browser).
 * * A way to run composer install by default (simply via Blueprints?)
 *   Communicate what it's doing by displaying the output in the terminal
 * * Tabs for opening multiple files
 * * A way to save the workspace (Mount OPFS in Playground and sync it all there?)
 * * ✅ Find a way to put my workspace outside of WordPress and still serve it?
 *    * ✅ ln -s /workspace /wordpress/workspace?
 */

import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Layout } from './components/Layout';
import { store } from './store';

collectWindowErrors(logger);

const root = createRoot(document.getElementById('root')!);
root.render(
	<Provider store={store}>
		<Layout />
	</Provider>
);
