// @ts-ignore
import css from './style.module.css';

export interface ProgressBarOptions {
	/**
	 * A stable heading — the name of the Playground being spawned. Unlike the
	 * caption, it is not overwritten as boot stages advance, so the site stays
	 * named for the whole load.
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
	titleElement: HTMLHeadingElement;
	captionElement: HTMLHeadingElement;
	title = '';
	caption = 'Preparing WordPress';
	progress = 0;
	isIndefinite = false;
	visible = true;

	constructor(options: ProgressBarOptions = {}) {
		this.element = document.createElement('div');
		this.labelElement = document.createElement('p');
		this.titleElement = document.createElement('h2');
		this.captionElement = document.createElement('h3');
		this.element.appendChild(this.labelElement);
		this.element.appendChild(this.titleElement);
		this.element.appendChild(this.captionElement);
		this.setOptions(options);
	}

	setOptions(options: ProgressBarOptions) {
		if ('title' in options && options.title) {
			this.title = options.title!;
		}
		if ('caption' in options && options.caption) {
			this.caption = options.caption!;
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

		// A small prefix above the name, so the big text below reads clearly as
		// the Playground being started rather than a document/page title. Shown
		// only when there's a name to frame.
		this.labelElement.className = '';
		this.labelElement.classList.add(css['label']);
		this.labelElement.textContent = 'Starting Your Playground:';
		if (!this.title) {
			this.labelElement.classList.add(css['titleHidden']);
		}

		// The stable Playground name; hidden entirely when none was provided so
		// the caption stays vertically centered as before.
		this.titleElement.className = '';
		this.titleElement.classList.add(css['title']);
		this.titleElement.textContent = this.title;
		if (!this.title) {
			this.titleElement.classList.add(css['titleHidden']);
		}

		this.captionElement.className = '';
		this.captionElement.classList.add(css['caption']);
		this.captionElement.textContent = this.caption + '...';

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
