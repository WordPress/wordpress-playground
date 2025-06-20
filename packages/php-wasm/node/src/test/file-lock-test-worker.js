import { openSync, closeSync } from 'fs';
import { lock as nativeFileLock } from 'os-lock';

process.on('message', (message) => {
	if (message.type === 'acquire') {
		try {
			const fd = openSync(message.filePath, 'a+');

			try {
				nativeFileLock(fd, {
					exclusive: message.lockType === 'exclusive',
					immediate: true,
				});
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
