export interface InMemoryState {
	serverAddress?: string;
}

export class InMemoryStateManager extends EventTarget {
	private state: InMemoryState = {};

	read() {
		return {
			...this.state,
		};
	}

	async write(newState: Partial<InMemoryState>) {
		this.state = {
			...this.state,
			...newState,
		};
		this.dispatchEvent(new StateChangeEvent('change', newState));
	}
}

export class StateChangeEvent extends Event {
	constructor(name: string, public state: InMemoryState) {
		super(name);
	}
}
