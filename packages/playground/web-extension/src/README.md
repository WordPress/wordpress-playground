## Edit Visually Browser Extension powered by WordPress Playground

This is an experimental browser extension that allows you to edit GitHub issues and other text formats using WordPress blocks in Playground.

To use it, go to the extensions page in your web browser, load the extension from the `packages/editor-browser-extension` directory, and then navigate to any GitHub issue. Edit it, and you should see a new "Edit in Playground" button in the corner of the editor. Click it to edit the issue in Playground.

Another use-case here: replying to people. It’s frustrating to keep scrolling between what someone posted and the textarea where I can type, but with this extension we could front-load what they said to the editor, package it as quotes, and it would be easy to break it up and type.

### Implementation details

We can't use WordPress Playground client here, because it internally evaluates JavaScript code which seems very difficult to do in browser extensions. Therefore, this extension merely embeds an iframe that handles the client connection, and communicates with Playground via the `postMessage` API.
