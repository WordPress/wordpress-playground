export const SaveState = {
	IDLE: 'idle',
	PENDING: 'pending',
	SAVING: 'saving',
	SAVED: 'saved',
	ERROR: 'error',
} as const;

export type SaveState = (typeof SaveState)[keyof typeof SaveState];
