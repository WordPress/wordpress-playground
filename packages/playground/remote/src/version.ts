import info from '../package.json' assert { type: 'json' };

class VersionNumber extends HTMLElement {
	connectedCallback() {
		this.innerHTML = info.version;
	}
}

customElements.define('x-version', VersionNumber);
