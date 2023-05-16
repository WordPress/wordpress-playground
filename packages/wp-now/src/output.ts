function shouldOutput() {
	return process.env.NODE_ENV !== 'test';
}

export const output = shouldOutput() ? console : null;
