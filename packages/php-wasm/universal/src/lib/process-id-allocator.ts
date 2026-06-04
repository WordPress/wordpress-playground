// Process IDs appear to be defined as `int` in Emscripten and
// those are typically 32 bits wide in both 32-bit and 64-bit systems.
// Apparently, this is a signed type, so we cannot use the leftmost bit.
const maxValueForSigned32BitInteger = 2 ** (32 - 1) - 1;

export class ProcessIdAllocator {
	private initialId: number;
	private maxId: number;
	private nextId: number;
	private claimed = new Set<number>();

	constructor(initialId = 1, maxId = maxValueForSigned32BitInteger) {
		this.initialId = initialId;
		this.maxId = maxId;
		this.nextId = initialId;
	}

	claim(): number {
		const maxTries = this.maxId - this.initialId + 1;
		for (let i = 0; i < maxTries; i++) {
			if (this.claimed.has(this.nextId)) {
				this.nextId++;
				if (this.nextId > this.maxId) {
					this.nextId = this.initialId;
				}
			} else {
				this.claimed.add(this.nextId);
				return this.nextId;
			}
		}

		throw new Error(
			`Unable to find free process ID after ${maxTries} tries.`
		);
	}

	release(id: number): boolean {
		if (!this.claimed.has(id)) {
			return false;
		}
		this.claimed.delete(id);
		return true;
	}
}
