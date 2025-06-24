import { openSync, closeSync } from 'fs';
import { flockSync } from 'fs-ext';

process.on('message', (message) => {
	if (message.type === 'acquire') {
		try {
			// Open the file
			const fd = openSync(message.filePath, 'a+');

			// Convert lock type to flock flags
			const flockFlags =
				message.lockType === 'exclusive' ? 'exnb' : 'shnb';

			// Attempt to acquire the lock
			try {
				flockSync(fd, flockFlags);
				process.send?.({ type: 'success', fd });
			} catch (error) {
				closeSync(fd);
				process.send?.({
					type: 'error',
					error: error?.message || 'Unknown error',
				});
			}
		} catch (error) {
			process.send?.({
				type: 'error',
				error: error?.message || 'Unknown error',
			});
		}
	} else if (message.type === 'release') {
		process.exit(0);
	}
});
