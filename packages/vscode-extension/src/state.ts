export interface InMemoryState {
	serverAddress?: string;
	wordPressVersion?: string;
	mode?: string;
	phpVersion?: string;
	projectPath?: string;
	state:
		| 'starting-server'
		| 'server-running'
		| 'stopping-server'
		| 'server-stopped'
		| 'idle';
}

export class InMemoryStateManager extends EventTarget {
	private state: InMemoryState = {
		state: 'idle',
		phpVersion: '7.4',
		wordPressVersion: '6.2',
	};

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
		this.dispatchEvent(new StateChangeEvent('change', this.state));
	}
}

export class StateChangeEvent extends Event {
	constructor(name: string, public state: InMemoryState) {
		super(name);
	}
}
