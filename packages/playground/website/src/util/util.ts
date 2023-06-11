/**
 * @description: Utility functions to support the website.
 */

/**
 * @function isOnboardedFirstTime
 * @description: Checks if the user is onboarded for the first time.
 * @returns {boolean} true if the user is onboarded for the first time, false otherwise.
 * @example isOnboardedFirstTime() // false
 */
const isOnboardedFirstTime = (): boolean => {
	// Get the isOnboarded flag value from browser's local storage.
	const isOnboarded = window.localStorage.getItem('isOnboarded');

	// if the flag is set to 1, then the user is onboarded.
	if (isOnboarded && parseInt(isOnboarded) === 1) {
		return true;
	} else {
		// Set the flag to 1, so that the user is not onboarded again.
		window.localStorage.setItem('isOnboarded', '1');
		return false;
	}
};

export default { isOnboardedFirstTime };
