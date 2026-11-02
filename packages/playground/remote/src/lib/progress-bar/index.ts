// @ts-ignore
import css from './style.module.css';

export interface ProgressBarOptions {
	caption?: string;
	progress?: number;
	isIndefinite?: boolean;
	visible?: boolean;
}

class ProgressBar {
	element: HTMLDivElement;
	captionElement: HTMLHeadingElement;
	statusElement: HTMLDivElement;
	caption = 'Preparing WordPress';
	progress = 0;
	isIndefinite = false;
	visible = true;

	constructor(options: ProgressBarOptions = {}) {
		this.element = document.createElement('div');
		this.captionElement = document.createElement('h1');
		this.statusElement = document.createElement('div');
		this.statusElement.setAttribute('role', 'status');
		this.statusElement.setAttribute('aria-live', 'polite');
		this.statusElement.setAttribute('aria-atomic', 'true');
		this.element.appendChild(this.captionElement);
		this.element.appendChild(this.statusElement);
		this.setOptions(options);
	}

	setOptions(options: ProgressBarOptions) {
		if ('caption' in options) {
			this.caption = options.caption ?? '';
		}
		if ('progress' in options) {
			this.progress = options.progress!;
		}
		if ('isIndefinite' in options) {
			this.isIndefinite = options.isIndefinite!;
		}
		if ('visible' in options) {
			this.visible = options.visible!;
		}

		this.updateElement();
	}

	destroy() {
		this.setOptions({
			visible: false,
		});
		setTimeout(() => {
			this.element.remove();
		}, 500);
	}

	updateElement() {
		this.element.className = '';
		this.element.classList.add(css['overlay']);

		if (!this.visible) {
			this.element.classList.add(css['isHidden']);
		}

		this.captionElement.className = '';
		this.captionElement.classList.add(css['caption']);
		this.captionElement.textContent = this.caption;
		this.statusElement.className = '';
		this.statusElement.classList.add(css['visuallyHidden']);
		this.statusElement.textContent = this.caption;

		const progressBarWrapper = this.element.querySelector(
			`.${css['wrapper']}`
		);
		if (progressBarWrapper) {
			this.element.removeChild(progressBarWrapper);
		}

		if (this.isIndefinite) {
			this.element.appendChild(this.createProgressIndefinite());
		} else {
			this.element.appendChild(this.createProgress());
		}
	}

	createProgress() {
		const wrapper = document.createElement('div');
		wrapper.classList.add(css['wrapper'], css['wrapperDefinite']);

		const progressBar = document.createElement('div');
		progressBar.classList.add(css['progressBar'], css['isDefinite']);
		progressBar.style.width = this.progress + '%';

		wrapper.appendChild(progressBar);
		return wrapper;
	}

	createProgressIndefinite() {
		const wrapper = document.createElement('div');
		wrapper.classList.add(css['wrapper'], css['wrapperIndefinite']);

		const progressBar = document.createElement('div');
		progressBar.classList.add(css['progressBar'], css['isIndefinite']);

		wrapper.appendChild(progressBar);
		return wrapper;
	}
}

export default ProgressBar;
