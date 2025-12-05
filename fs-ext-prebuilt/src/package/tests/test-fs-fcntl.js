'use strict';

// Test these APIs as published in extension module 'fs-ext'
//
// fsExt.fcntl(fd, cmd, [arg], [callback])
//
//  console.log( require.resolve('../fs-ext'));

var assert = require('assert'),
	path = require('path'),
	util = require('util'),
	fs = require('fs'),
	fsExt = require('../fs-ext'),
	os = require('os');

var tests_ok = 0,
	tests_run = 0;

var debug_me = false;

var tmp_dir = os.tmpdir(),
	file_path = path.join(tmp_dir, 'what.when.fcntl.test');

var file_fd, err;

// Report on test results -  -  -  -  -  -  -  -  -  -  -  -

// Clean up and report on final success or failure of tests here
process.addListener('exit', function () {
	try {
		fs.closeSync(file_fd);
	} catch (e) {
		// might not be open, that's okay.
	}

	remove_file_wo_error(file_path);

	console.log('Tests run: %d     ok: %d', tests_run, tests_ok);
	assert.equal(tests_ok, tests_run, 'One or more subtests failed');
});

// Test helpers -  -  -  -  -  -  -  -  -  -  -  -  -  -  -

function remove_file_wo_error(file_path) {
	try {
		fs.unlinkSync(file_path);
	} catch (e) {
		// might not exist, that's okay.
	}
}

function expect_errno(api_name, resource, err, expected_errno) {
	var fault_msg;

	if (debug_me) console.log('  expected_errno(err): ' + err);

	if (err && err.code !== expected_errno) {
		fault_msg =
			api_name +
			'(): expected error ' +
			expected_errno +
			', got another error';
	} else if (!err) {
		fault_msg =
			api_name +
			'(): expected error ' +
			expected_errno +
			', got another error';
	}

	if (!fault_msg) {
		tests_ok++;
		if (debug_me) console.log(' FAILED OK: ' + api_name);
	} else {
		console.log('FAILURE: ' + fault_msg);
		console.log('   ARGS: ', util.inspect(arguments));
	}
}

function expect_ok(api_name, resource, err) {
	var fault_msg;

	if (err) {
		fault_msg = api_name + '(): returned error';
	}

	if (!fault_msg) {
		tests_ok++;
		if (debug_me) console.log('        OK: ' + api_name);
	} else {
		console.log('FAILURE: ' + fault_msg);
		console.log('   ARGS: ', util.inspect(arguments));
	}
}

// Setup for testing    -  -  -  -  -  -  -  -  -  -  -  -

// Check whether this version of node.js has these APIs to test
//XXX Consider just exiting without error after displaying notices

tests_run++;
if (typeof fsExt.fcntl !== 'function') {
	console.log('fsExt.fcntl API is missing');
} else {
	tests_ok++;
}

tests_run++;
if (typeof fsExt.fcntlSync !== 'function') {
	console.log('fsExt.fcntlSync API is missing');
} else {
	tests_ok++;
}

// If any pre-checks and setup fail, quit before tests
if (tests_run !== tests_ok) {
	process.exit(1);
}

// Delete any prior copy of test data file(s)
remove_file_wo_error(file_path);

// Create a new file
tests_run++;
try {
	file_fd = fs.openSync(file_path, 'w');
	tests_ok++;
} catch (e) {
	console.log('  Unable to create test data file %j', file_path);
	console.log('    Error was: %j', e);
}

if (tests_run !== tests_ok) {
	process.exit(1);
}

// Test that constants are published -  -  -  -  -  -  -  -

var constant_names = ['F_SETFD', 'F_GETFD', 'FD_CLOEXEC'];

constant_names.forEach(function (name) {
	if (debug_me)
		console.log(
			'  %s    %j    %j',
			name,
			fsExt.constants[name],
			typeof fsExt.constants[name]
		);

	tests_run++;
	if (
		fsExt.constants[name] !== undefined &&
		typeof fsExt.constants[name] === 'number'
	) {
		tests_ok++;
	} else {
		console.log('FAILURE: %s is not defined correctly', name);
		console.log(
			'  %s    %j    %j',
			name,
			fsExt.constants[name],
			typeof fsExt.constants[name]
		);
	}
});

// Test bad argument handling   -  -  -  -  -  -  -  -  -  -  -

// fd value is undefined

tests_run++;
try {
	err = fsExt.fcntlSync(undefined, 0);
} catch (e) {
	err = e;
}

if (err) {
	if (debug_me) console.log('    err    %j', err);
	tests_ok++;
} else if (debug_me) {
	console.log('    expected error from undefined fd argument');
}

// fd value is non-number

tests_run++;
try {
	err = fsExt.fcntlSync('foo', 0);
} catch (e) {
	err = e;
}

if (err) {
	if (debug_me) console.log('    err    %j', err);
	tests_ok++;
} else if (debug_me) {
	console.log('    expected error from non-numeric fd argument');
}

// fd value is negative

tests_run++;
try {
	err = fsExt.fcntlSync(-9, 0);
} catch (e) {
	err = e;
}
expect_errno('fcntlSync', -9, err, 'EBADF');

// fd value is 'impossible'

tests_run++;
try {
	err = fsExt.fcntlSync(98765, 0);
} catch (e) {
	err = e;
}
expect_errno('fcntlSync', 98765, err, 'EBADF');

// flags value is invalid

tests_run++;
try {
	err = fsExt.fcntlSync(file_fd, 'foo');
} catch (e) {
	err = e;
}

//    "message": "Unknown fcntl flag: foo"
if (err) {
	if (debug_me) console.log('    err    %j', err);
	tests_ok++;
} else if (debug_me) {
	console.log('    expected error from non-numeric fd argument');
}

// Test valid calls: fcntlSync  -  -  -  -  -  -  -  -  -  -

tests_run++;
try {
	err = null;
	fsExt.fcntlSync(file_fd, 'getfd');
} catch (e) {
	err = e;
}
expect_ok('fcntlSync', file_fd, err);

// operation setfd then getfd

tests_run++;
try {
	err = null;
	var flags = fsExt.fcntlSync(file_fd, 'getfd');
	console.log('initial flags:' + flags);

	fsExt.fcntlSync(file_fd, 'setfd', flags | fsExt.constants.FD_CLOEXEC);
	flags = fsExt.fcntlSync(file_fd, 'getfd');
	if ((flags & fsExt.constants.FD_CLOEXEC) !== fsExt.constants.FD_CLOEXEC) {
		throw new Error('Expected FD_CLOEXEC to be set: ' + flags);
	}

	fsExt.fcntlSync(file_fd, 'setfd', flags & ~fsExt.constants.FD_CLOEXEC);
	flags = fsExt.fcntlSync(file_fd, 'getfd');
	if ((flags & fsExt.constants.FD_CLOEXEC) === fsExt.constants.FD_CLOEXEC) {
		throw new Error('Expected FD_CLOEXEC to be cleared');
	}
} catch (e) {
	err = e;
}
expect_ok('fcntlSync', file_fd, err);

// Test valid calls: fcntl  -  -  -  -  -  -  -  -  -  -  -

// SEEK_SET to 0

tests_run++;
fsExt.fcntl(file_fd, 'getfd', function (err, flags) {
	expect_ok('fcntl', file_fd, err);

	tests_run++;
	fsExt.fcntl(
		file_fd,
		'setfd',
		flags | fsExt.constants.FD_CLOEXEC,
		function (err) {
			expect_ok('fcntl', file_fd, err);

			tests_run++;
			fsExt.fcntl(file_fd, 'getfd', function (err, flags) {
				expect_ok('fcntl', file_fd, err);

				if (
					(flags & fsExt.constants.FD_CLOEXEC) !==
					fsExt.constants.FD_CLOEXEC
				) {
					tests_run++;
					expect_ok(
						'fcntl',
						file_fd,
						new Error('did not set cloexec')
					);
				}

				tests_run++;
				fsExt.fcntl(
					file_fd,
					'setfd',
					flags & ~fsExt.constants.FD_CLOEXEC,
					function (err, flags) {
						expect_ok('fcntl', file_fd, err);

						tests_run++;
						fsExt.fcntl(file_fd, 'getfd', function (err, flags) {
							expect_ok('fcntl', file_fd, err);

							if (
								(flags & fsExt.constants.FD_CLOEXEC) ===
								fsExt.constants.FD_CLOEXEC
							) {
								tests_run++;
								expect_ok(
									'fcntl',
									file_fd,
									new Error('did not clear cloexec')
								);
							}

							// Test invalid calls: fcntl  -  -  -  -  -  -  -  -  -

							// offset value is negative
							tests_run++;

							try {
								fsExt.fcntl(file_fd, 'foo', function (err) {
									console.log(
										'  unexpected callback from fcntl() with bad argument'
									);
								});
								err = undefined;
							} catch (e) {
								err = e;
							}
							//    "message": "Unknown fcntl flag: foo"
							if (err) {
								if (debug_me) console.log('    err    %j', err);
								tests_ok++;
							} else if (debug_me) {
								console.log(
									'  unexpected success  from fcntl() with bad argument'
								);
							}
						});
					}
				);
			});
		}
	);
});
