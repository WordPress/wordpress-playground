/**
 * Check if the Emscripten-thrown error is an exit code 0 error.
 *
 * @param e The error to check
 * @returns True if the error is an exit code 0 error
 */
export function isExitCode(e: any): e is { exitCode: number } {
	if (!(e instanceof Error)) {
		return false;
	}
	return 'exitCode' in e || (e?.name === 'ExitStatus' && 'status' in e);
}
