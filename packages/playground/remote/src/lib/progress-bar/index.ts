// @ts-ignore
import css from './style.module.css';

export interface ProgressBarOptions {
	/**
	 * A stable heading for the Playground being started. Unlike the caption, it
	 * is not overwritten as boot stages advance.
	 */
	title?: string;
	caption?: string;
	progress?: number;
	isIndefinite?: boolean;
	visible?: boolean;
}

class ProgressBar {
	element: HTMLDivElement;
	labelElement: HTMLParagraphElement;
	titleElement: HTMLDivElement;
	captionElement: HTMLDivElement;
	title = '';
	caption = 'Preparing WordPress';
	progress = 0;
	isIndefinite = false;
	visible = true;

	constructor(options: ProgressBarOptions = {}) {
		this.element = document.createElement('div');
		this.labelElement = document.createElement('p');
		this.titleElement = document.createElement('div');
		this.captionElement = document.createElement('div');
		this.captionElement.setAttribute('role', 'status');
		this.captionElement.setAttribute('aria-live', 'polite');
		this.captionElement.setAttribute('aria-atomic', 'true');
		this.element.appendChild(this.labelElement);
		this.element.appendChild(this.titleElement);
		this.element.appendChild(this.captionElement);
		this.setOptions(options);
	}

	setOptions(options: ProgressBarOptions) {
		if ('title' in options) {
			this.title = options.title ?? '';
		}
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

		// Frame the stable site name as the Playground being started. Hide both
		// elements when an embedding client does not provide a name.
		this.labelElement.className = '';
		this.labelElement.classList.add(css['label']);
		this.labelElement.textContent = 'Starting Your Playground:';
		this.labelElement.hidden = !this.title;

		this.titleElement.className = '';
		this.titleElement.classList.add(css['title']);
		this.titleElement.textContent = this.title;
		this.titleElement.hidden = !this.title;

		this.captionElement.className = '';
		this.captionElement.classList.add(css['caption']);
		this.captionElement.textContent = this.caption;

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
