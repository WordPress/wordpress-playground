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
	welcomeElement: HTMLDivElement | null = null;
	progressSection: HTMLDivElement;
	caption = 'Preparing WordPress';
	progress = 0;
	isIndefinite = false;
	visible = true;
	private minimized = false;

	constructor(options: ProgressBarOptions = {}) {
		this.element = document.createElement('div');

		this.progressSection = document.createElement('div');
		this.progressSection.classList.add(css['progressSection']);
		this.captionElement = document.createElement('h1');
		this.statusElement = document.createElement('div');
		this.statusElement.setAttribute('role', 'status');
		this.statusElement.setAttribute('aria-live', 'polite');
		this.statusElement.setAttribute('aria-atomic', 'true');
		this.progressSection.appendChild(this.captionElement);
		this.progressSection.appendChild(this.statusElement);
		this.element.appendChild(this.progressSection);

		this.setOptions(options);
	}

	/**
	 * Injects welcome HTML above the progress section.
	 * Must be called before the progress bar is destroyed.
	 */
	setWelcomeHtml(html: string) {
		if (this.welcomeElement) {
			return;
		}
		this.welcomeElement = document.createElement('div');
		this.welcomeElement.classList.add(css['welcomeContent']);
		this.welcomeElement.textContent = '';
		// Parse the HTML string safely: only allow known
		// tags and strip scripts / event handlers.
		const doc = new DOMParser().parseFromString(html, 'text/html');
		for (const node of Array.from(doc.body.childNodes)) {
			this.welcomeElement.appendChild(document.importNode(node, true));
		}
		this.welcomeElement.addEventListener('scroll', () => {
			this.minimize();
		});
		this.welcomeElement.addEventListener('click', () => {
			this.minimize();
		});
		// Insert welcome content before the progress section
		this.element.insertBefore(this.welcomeElement, this.progressSection);
		this.element.classList.add(css['overlayWithWelcome']);
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

	minimize() {
		if (this.minimized) {
			return;
		}
		this.minimized = true;
		// Only move the progress section into a corner pill —
		// the welcome content stays visible and scrollable.
		this.progressSection.classList.add(css['progressSectionMinimized']);
	}

	destroy() {
		if (this.welcomeElement && this.minimized) {
			// User already interacted — replace the progress
			// pill with a "ready" button in the corner.
			this.progressSection.innerHTML = '';
			const readyButton = document.createElement('button');
			readyButton.className = css['readyButton'];
			readyButton.textContent =
				'\u2713 WordPress is ready \u2014 click to start';
			readyButton.addEventListener('click', () => {
				this.element.classList.add(css['isHidden']);
				setTimeout(() => {
					this.element.remove();
				}, 500);
			});
			this.progressSection.appendChild(readyButton);
			return;
		}
		// No interaction — dismiss everything immediately.
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
		if (this.welcomeElement) {
			this.element.classList.add(css['overlayWithWelcome']);
		}

		if (!this.visible) {
			this.element.classList.add(css['isHidden']);
		}

		this.captionElement.className = '';
		this.captionElement.classList.add(css['caption']);
		this.captionElement.textContent = this.caption;
		this.statusElement.className = '';
		this.statusElement.classList.add(css['visuallyHidden']);
		this.statusElement.textContent = this.caption;

		const progressBarWrapper = this.progressSection.querySelector(
			`.${css['wrapper']}`
		);
		if (progressBarWrapper) {
			this.progressSection.removeChild(progressBarWrapper);
		}

		if (this.isIndefinite) {
			this.progressSection.appendChild(this.createProgressIndefinite());
		} else {
			this.progressSection.appendChild(this.createProgress());
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
