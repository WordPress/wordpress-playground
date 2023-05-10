import { startServer } from 'wp-now';

startServer({
	documentRoot: process.cwd(),
	mode: 'plugin'
});
