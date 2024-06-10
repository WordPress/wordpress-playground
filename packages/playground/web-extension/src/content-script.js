// ../../php-wasm/web-service-worker/src/messaging.ts
function postMessageExpectReply(target, message, ...postMessageArgs) {
	const requestId = getNextRequestId();
	target.postMessage(
		{
			...message,
			requestId,
		},
		...postMessageArgs
	);
	return requestId;
}
function getNextRequestId() {
	return ++lastRequestId;
}
function awaitReply(
	messageTarget,
	requestId,
	timeout = DEFAULT_RESPONSE_TIMEOUT
) {
	return new Promise((resolve, reject) => {
		const responseHandler = (event) => {
			if (
				event.data.type === 'response' &&
				event.data.requestId === requestId
			) {
				messageTarget.removeEventListener('message', responseHandler);
				clearTimeout(failOntimeout);
				resolve(event.data.response);
			}
		};
		const failOntimeout = setTimeout(() => {
			reject(new Error('Request timed out'));
			messageTarget.removeEventListener('message', responseHandler);
		}, timeout);
		messageTarget.addEventListener('message', responseHandler);
	});
}
function responseTo(requestId, response) {
	return {
		type: 'response',
		requestId,
		response,
	};
}
var DEFAULT_RESPONSE_TIMEOUT = 25000;
var lastRequestId = 0;
// src/content-script.ts
var enableEditInPlaygroundButton = function () {
	let currentElement = undefined;
	let activeEditor = undefined;
	const button = createEditButton();
	document.body.appendChild(button);
	document.body.addEventListener('focusin', (event) => {
		showButtonIfNeeded(event.target);
	});
	showButtonIfNeeded(document.activeElement);
	document.body.addEventListener('focusout', () => {
		hideButton(button);
	});
	function showButtonIfNeeded(element) {
		if (element.tagName === 'TEXTAREA' || element.isContentEditable) {
			showButton(element);
		}
	}
	function showButton(element) {
		currentElement = element;
		const rect = element.getBoundingClientRect();
		button.style.display = 'block';
		button.style.top = `${
			window.scrollY + rect.bottom - button.offsetHeight
		}px`;
		button.style.left = `${
			window.scrollX + rect.right - button.offsetWidth
		}px`;
	}
	function hideButton(button2) {
		currentElement = undefined;
		button2.style.display = 'none';
	}
	function createEditButton() {
		const button2 = document.createElement('button');
		button2.textContent = 'Edit in Playground';
		button2.className = 'edit-btn';
		button2.style.position = 'absolute';
		button2.style.display = 'none';
		button2.style.padding = '5px 10px';
		button2.style.backgroundColor = '#007bff';
		button2.style.color = 'white';
		button2.style.border = 'none';
		button2.style.cursor = 'pointer';
		button2.addEventListener('mousedown', (event) => {
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
		return button2;
	}
};
async function openPlaygroundEditorFor(element) {
	const localEditor = wrapLocalEditable(element);
	const initialValue = localEditor.getValue();
	const playgroundEditor = await openPlaygroundEditor({
		format: 'markdown',
		initialValue,
	});
	let lastRemoteValue = initialValue;
	const pollInterval = setInterval(() => {
		playgroundEditor.getValue().then((value) => {
			if (value !== lastRemoteValue) {
				lastRemoteValue = value;
				localEditor.setValue(value);
			}
		});
	}, 1000);
	const cleanup = [
		bindEventListener(element, 'change', () => {
			const value = localEditor.getValue();
			playgroundEditor.setValue(value);
			lastRemoteValue = value;
		}),
		bindEventListener(window, 'beforeunload', () => {
			playgroundEditor.windowHandle.close();
		}),
		() => {
			pollInterval && clearInterval(pollInterval);
		},
	];
	onWindowClosed(playgroundEditor.windowHandle, () => {
		cleanup.forEach((fn) => fn());
	});
	return playgroundEditor;
}
var bindEventListener = function (target, type, listener) {
	target.addEventListener(type, listener);
	return () => target.removeEventListener(type, listener);
};
var wrapLocalEditable = function (element) {
	if (element.tagName === 'TEXTAREA') {
		return {
			getValue() {
				return element.value;
			},
			setValue(value) {
				element.value = value;
			},
		};
	} else if (element.isContentEditable) {
		return {
			getValue() {
				return element.innerHTML;
			},
			setValue(value) {
				element.innerHTML = value;
			},
		};
	}
	throw new Error(
		'Unsupported element type, only Textarea and contenteditable elements are accepted.'
	);
};
async function openPlaygroundEditor({ format, initialValue }) {
	const windowHandle = window.open(
		'http://localhost:5400/scope:777777777/wp-admin/post-new.php?post_type=post',
		'_blank',
		'width=800,height=600'
	);
	if (windowHandle === null) {
		throw new Error('Failed to open the playground editor window');
	}
	await new Promise((resolve, reject) => {
		const unbindRejectionListener = onWindowClosed(windowHandle, () => {
			unbindBootListener();
			unbindRejectionListener();
			reject();
		});
		const unbindBootListener = bindEventListener(
			window,
			'message',
			(event) => {
				if (
					event.source === windowHandle &&
					event.data.command === 'getBootParameters'
				) {
					unbindBootListener();
					unbindRejectionListener();
					windowHandle.postMessage(
						responseTo(event.data.requestId, {
							value: initialValue,
							format,
						}),
						'*'
					);
					resolve(null);
				}
			}
		);
	});
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
		setValue(value) {
			windowHandle.postMessage(
				{
					command: 'setEditorContent',
					value,
					type: 'relay',
				},
				'*'
			);
		},
	};
}
var onWindowClosed = function (windowObject, callback) {
	const timer = setInterval(checkWindowClosed, 500);
	function unbind() {
		clearInterval(timer);
	}
	function checkWindowClosed() {
		if (windowObject.closed) {
			unbind();
			callback();
		}
	}
	return unbind;
};
enableEditInPlaygroundButton();
