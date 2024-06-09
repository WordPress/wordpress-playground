import {
	awaitReply,
	postMessageExpectReply,
	responseTo,
} from '@php-wasm/web-service-worker';

function enableEditInPlaygroundButton() {
	let currentElement: any = undefined;
	let activeEditor: any = undefined;
	const button = createEditButton();

	document.body.appendChild(button);
	document.body.addEventListener('focusin', (event: any) => {
		showButtonIfNeeded(event.target!);
	});
	showButtonIfNeeded(document.activeElement);

	document.body.addEventListener('focusout', () => {
		hideButton(button);
	});

	function showButtonIfNeeded(element: any) {
		if (element!.tagName === 'TEXTAREA' || element!.isContentEditable) {
			showButton(element);
		}
	}
	function showButton(element: any) {
		currentElement = element;
		const rect = element.getBoundingClientRect();
		button.style.display = 'block';
		button.style.top = `${window.scrollY + rect.top}px`;
		button.style.left = `${
			window.scrollX + rect.right - button.offsetWidth
		}px`;
	}

	function hideButton(button: HTMLButtonElement) {
		currentElement = undefined;
		button.style.display = 'none';
	}

	function createEditButton() {
		const button = document.createElement('button');
		button.textContent = 'Edit in Playground';
		button.className = 'edit-btn';
		button.style.position = 'absolute';
		button.style.display = 'none';
		button.style.padding = '5px 10px';
		button.style.backgroundColor = '#007bff';
		button.style.color = 'white';
		button.style.border = 'none';
		button.style.cursor = 'pointer';
		button.addEventListener('mousedown', (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (
				activeEditor?.editor?.windowObject?.closed ||
				activeEditor?.element !== currentElement
			) {
				activeEditor?.editor?.windowObject?.close();
				activeEditor = {
					element: currentElement,
					editor: openPlaygroundEditorFor(currentElement),
				};
			}
		});
		return button;
	}
}

enableEditInPlaygroundButton();

// Function to wait until DOM is fully loaded
function openPlaygroundEditorFor(element: any) {
	const localEditor = wrapLocalEditable(element);
	const initialValue = localEditor.getValue();
	const playgroundEditor = openPlaygroundEditor({
		format: 'markdown',
		initialValue,
	});

	const unbindBootListener = bindEventListener(
		window,
		'message',
		(event: MessageEvent) => {
			if (
				event.source === playgroundEditor.windowHandle &&
				event.data.command === 'getBootParameters'
			) {
				playgroundEditor.windowHandle.postMessage(
					responseTo(event.data.requestId, {
						value: initialValue,
						format: 'markdown',
					}),
					'*'
				);
				unbindBootListener();
				pollEditorValue();
			}
		}
	);

	// Update the local editor when the playground editor changes
	let lastRemoteValue = initialValue;
	let pollInterval: any = null;
	function pollEditorValue() {
		pollInterval = setInterval(() => {
			playgroundEditor.getValue().then((value) => {
				if (value !== lastRemoteValue) {
					lastRemoteValue = value;
					localEditor.setValue(value);
				}
			});
		}, 1000);
	}

	const cleanup = [
		// When typing in the textarea, update the playground editor
		bindEventListener(element, 'change', () => {
			const value = localEditor.getValue();
			playgroundEditor.setValue(value);
			lastRemoteValue = value;
		}),
		// Close the editor popup if the user navigates away
		bindEventListener(window, 'beforeunload', () => {
			playgroundEditor.windowHandle.close();
		}),
		unbindBootListener,
		() => {
			pollInterval && clearInterval(pollInterval);
		},
	];

	onWindowClosed(playgroundEditor.windowHandle, () => {
		cleanup.forEach((fn) => fn());
	});

	return playgroundEditor;
}

function bindEventListener(target: any, type: string, listener: any) {
	target.addEventListener(type, listener);
	return () => target.removeEventListener(type, listener);
}

function wrapLocalEditable(element: any) {
	if (element.tagName === 'TEXTAREA') {
		return {
			getValue() {
				return element.value;
			},
			setValue(value: string) {
				element.value = value;
			},
		};
	} else if (element.isContentEditable) {
		return {
			getValue() {
				return element.innerHTML;
			},
			setValue(value: string) {
				element.innerHTML = value;
			},
		};
	}
	throw new Error(
		'Unsupported element type, only Textarea and contenteditable elements are accepted.'
	);
}

interface PlaygroundEditorOptions {
	format: 'markdown' | 'trac';
	initialValue: string;
}

function openPlaygroundEditor({
	format,
	initialValue,
}: PlaygroundEditorOptions) {
	const windowHandle = window.open(
		'http://localhost:5400/scope:777777777/wp-admin/post-new.php?post_type=post#' +
			encodeURIComponent(initialValue),
		'_blank',
		'width=800,height=600'
	)!;

	if (null === windowHandle) {
		throw new Error('Failed to open the playground editor window');
	}

	return {
		windowHandle,
		async getValue() {
			const requestId = postMessageExpectReply(
				windowHandle,
				{
					command: 'getEditorContent',
				},
				'*'
			);
			const response = await awaitReply(window, requestId);
			return response.value;
		},
		setValue(value: string) {
			windowHandle.postMessage(
				{
					command: 'setEditorContent',
					format,
					text: value,
					type: 'relay',
				},
				'*'
			);
		},
	};
}

// Function to check if the window is closed
function onWindowClosed(windowObject: any, callback: any) {
	// Set an interval to periodically check if the window is closed
	const timer = setInterval(checkWindowClosed, 500);
	function checkWindowClosed() {
		if (windowObject.closed) {
			clearInterval(timer);
			callback();
		}
	}
}
