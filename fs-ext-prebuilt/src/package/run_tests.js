'use strict';

if (process.platform !== 'win32') {
	require('./tests/test-fs-fcntl');
}

require('./tests/test-fs-seek');

require('./tests/test-fs-flock');

require('./tests/worker-test.js');

// for stress testing only
if (process.argv[2] == '--stress') {
	require('./tests/test-fs-seek_stress');
	require('./tests/test-fs-flock_stress');
}
