function askForPlaygroundUrl() {
	return new Promise((resolve) => {
		chrome.runtime.sendMessage(
			{
				type: 'GET_PLAYGROUND_URL',
			},
			(response) => {
				console.log('Service worker response:', response);
				resolve(response?.url);
			}
		);
	});
}

function sleep(time) {
	return new Promise((resolve) => setTimeout(resolve, time));
}

async function getPlaygroundUrl() {
	console.log('Called getPlaygroundUrl()');
	const retryInterval = 500;
	let retryTime = 0;
	let retryTimeout = 25000;

	while (retryTime < retryTimeout) {
		const url = await askForPlaygroundUrl();
		if (url) {
			return url;
		}
		await sleep(retryInterval);
		retryTime += retryInterval;
	}

	throw new Error('Failed to get Playground URL');
}

class PlaygroundEditorComponent extends HTMLElement {
	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });
		shadow.innerHTML = `<iframe sandbox="allow-scripts allow-same-origin"></iframe>`;
		const iframe = shadow.querySelector('iframe');
		iframe.style.width = `100%`;
		iframe.style.height = `100%`;
		iframe.style.border = '1px solid #000';
	}

	static get observedAttributes() {
		return ['format', 'value'];
	}

	_value = '';
	get value() {
		return this._value;
	}
	set value(newValue) {
		this._value = newValue;
		this.setRemoteValue(newValue);
	}
	setAttribute(name, value) {
		super.setAttribute(name, value);
		console.log('setAttribute(', name, ',', value, ')');
	}

	windowHandle = undefined;
	connectedCallback() {
		const initialValue = this.getAttribute('value');
		const initialFormat = this.getAttribute('format');

		const url = getPlaygroundUrl().then((url) => {
			const targetUrl = url + '/wp-admin/post-new.php?post_type=post';
			console.log(url + '/wp-admin/post-new.php?post_type=post');

			this.shadowRoot.querySelector('iframe').src = targetUrl;
			this.windowHandle = window.open(
				targetUrl,
				'_blank',
				'toolbar=0,location=0,menubar=0,height=700,width=700'
			);
			// once the iframe is loaded, send the initial value
			setTimeout(() => {
				this.setRemoteValue(initialValue);
			}, 1500);
			setTimeout(() => {
				console.log('get remote');
				this.getRemoteValue().then((v) => {
					console.log({ v });
				});
			}, 2500);
		});

		window.addEventListener('message', (event) => {
			console.log('message', event.data);
			if (typeof event.data !== 'object') {
				return;
			}
			const { command, format, text } = event.data;
			if (command === 'playgroundEditorTextChanged') {
				this.dispatchEvent(
					new CustomEvent('change', {
						detail: {
							format,
							text,
						},
					})
				);
			}
		});
	}

	async getRemoteValue() {
		return new Promise((resolve) => {
			this.addEventListener('change', (event) => {
				resolve(event.detail);
			});
			// this.windowHandle?.postMessage(
			this.shadowRoot.querySelector('iframe').contentWindow.postMessage(
				{
					command: 'getEditorContent',
					format: this.getAttribute('format'),
					type: 'relay',
				},
				'*'
			);
		});
	}

	setRemoteValue(value) {
		const message = {
			command: 'playgroundEditorTextChanged',
			format: this.getAttribute('format'),
			text: this.value,
			type: 'relay',
		};
		this.shadowRoot
			.querySelector('iframe')
			?.contentWindow?.postMessage(message, '*');
		// this.windowHandle?.postMessage(message, '*');
		console.log('get remote', this.windowHandle);
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name === 'value') {
			this.value = newValue;
		}
	}
}

customElements.define('playground-editor', PlaygroundEditorComponent);

// Function to wait until DOM is fully loaded
function waitForDOMContentLoaded() {
	return new Promise((resolve) => {
		if (
			document.readyState === 'complete' ||
			document.readyState === 'interactive'
		) {
			resolve();
		} else {
			document.addEventListener('DOMContentLoaded', resolve);
		}
	});
}

function activatePlaygroundEditor(element = undefined) {
	element =
		element ??
		document.activeElement.closest('textarea, [contenteditable]');
	if (!element) {
		return;
	}

	if (element.tagName === 'TEXTAREA') {
		showPlaygroundDialog({
			value: element.value,
			format: 'markdown', // @TODO dynamic
			onClose: ({ text, format }) => {
				element.value = text;
			},
		});
	} else {
		showPlaygroundDialog({
			value: element.innerHTML,
			format: 'markdown', // @TODO dynamic
			onClose: ({ text, format }) => {
				element.innerHTML = text;
			},
		});
	}
}

// Function to show the Playground modal
function showPlaygroundDialog({
	value,
	format = 'markdown',
	onChange = () => {},
	onClose = () => {},
}) {
	// Create modal element
	const modal = document.createElement('dialog');
	modal.style.width = '80%';
	modal.style.height = '80%';
	modal.style.border = 'none';

	const editor = new PlaygroundEditorComponent();
	editor.setAttribute('value', value);
	editor.setAttribute('format', format);
	editor.addEventListener('change', (event) => {
		console.log({ value });
		// onChange(event.target.getRemoteValue);
	});

	// Append iframe to modal
	modal.appendChild(editor);
	document.body.appendChild(modal);
	modal.showModal();

	// Close modal when clicking outside of it
	modal.addEventListener('click', async (event) => {
		if (event.target === modal) {
			const value = await Promise.race([
				editor.getRemoteValue(),
				new Promise((resolve) => setTimeout(resolve, 500)),
			]);
			modal.close();
			modal.remove();
			onClose(value);
		}
	});
}

document.addEventListener('keydown', (event) => {
	if (event.ctrlKey && event.shiftKey && event.key === 'O') {
		activatePlaygroundEditor();
	}
});

// ---- Add Edit in Playground button ----

(function () {
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
			activatePlaygroundEditor();
		});
		return button;
	}

	function showButton(element, button) {
		const rect = element.getBoundingClientRect();
		button.style.display = 'block';
		button.style.top = `${window.scrollY + rect.top}px`;
		button.style.left = `${
			window.scrollX + rect.right - button.offsetWidth
		}px`;
	}

	function hideButton(button) {
		button.style.display = 'none';
	}

	const button = createEditButton();
	document.body.appendChild(button);

	document.body.addEventListener('focusin', (event) => {
		const element = event.target;
		if (element.tagName === 'TEXTAREA' || element.isContentEditable) {
			showButton(element, button);
		}
	});

	document.body.addEventListener('focusout', () => {
		hideButton(button);
	});
})();
