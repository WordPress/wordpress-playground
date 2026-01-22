/**
 * Generates a random, human readable site name.
 * For example: "Abandoned Road", "Old School", "Greenwich Village" etc.
 */
export function randomSiteName() {
	const adjectives = [
		'Happy',
		'Sad',
		'Excited',
		'Calm',
		'Brave',
		'Shy',
		'Clever',
		'Funny',
		'Kind',
		'Honest',
		'Loyal',
		'Patient',
		'Creative',
		'Energetic',
		'Ambitious',
		'Generous',
		'Humble',
		'Confident',
		'Curious',
		'Determined',
	];
	const differentAdjectives = [
		'Abandoned',
		'Old',
		'Sunny',
		'Quiet',
		'Busy',
		'Noisy',
		'Peaceful',
		'Cozy',
		'Modern',
		'Vintage',
		'Classic',
		'Trendy',
		'Hip',
		'Chic',
		'Glamorous',
	];
	const nouns = [
		'Road',
		'School',
		'Village',
		'Town',
		'City',
		'State',
		'Country',
		'Garden',
		'Park',
		'Forest',
		'Mountain',
		'Lake',
		'Ocean',
		'River',
		'Valley',
	];
	return [
		adjectives[Math.floor(Math.random() * adjectives.length)],
		differentAdjectives[
			Math.floor(Math.random() * differentAdjectives.length)
		],
		nouns[Math.floor(Math.random() * nouns.length)],
	].join(' ');
}
