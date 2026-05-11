/**
 * Release code names for WordPress versions, taken from the shorthand
 * each release's announcement URL uses on wordpress.org/news (e.g.
 * `/news/2025/12/gene/` → "Gene" for 6.9). The full jazz-musician names
 * are listed at https://wordpress.org/about/history/.
 */
export const WordPressReleaseNames: Record<string, string> = {
	'1.0': 'Miles',
	'1.2': 'Mingus',
	'1.5': 'Strayhorn',
	'2.0': 'Duke',
	'2.1': 'Ella',
	'2.2': 'Getz',
	'2.3': 'Dexter',
	'2.5': 'Brecker',
	'2.6': 'Tyner',
	'2.7': 'Coltrane',
	'2.8': 'Baker',
	'2.9': 'Carmen',
	'3.0': 'Thelonious',
	'3.1': 'Reinhardt',
	'3.2': 'Gershwin',
	'3.3': 'Sonny',
	'3.4': 'Green',
	'3.5': 'Elvin',
	'3.6': 'Oscar',
	'3.7': 'Basie',
	'3.8': 'Parker',
	'3.9': 'Smith',
	'4.0': 'Benny',
	'4.1': 'Dinah',
	'4.2': 'Powell',
	'4.3': 'Billie',
	'4.4': 'Clifford',
	'4.5': 'Coleman',
	'4.6': 'Pepper',
	'4.7': 'Vaughan',
	'4.8': 'Evans',
	'4.9': 'Tipton',
	'5.0': 'Bebo',
	'5.1': 'Betty',
	'5.2': 'Jaco',
	'5.3': 'Kirk',
	'5.4': 'Adderley',
	'5.5': 'Eckstine',
	'5.6': 'Simone',
	'5.7': 'Esperanza',
	'5.8': 'Tatum',
	'5.9': 'Joséphine',
	'6.0': 'Arturo',
	'6.1': 'Misha',
	'6.2': 'Dolphy',
	'6.3': 'Lionel',
	'6.4': 'Shirley',
	'6.5': 'Regina',
	'6.6': 'Dorsey',
	'6.7': 'Rollins',
	'6.8': 'Cecil',
	'6.9': 'Gene',
};

/**
 * Decorates a WordPress version label with its release code name when
 * one is known, e.g. "6.9" → "6.9 (Gene)". Labels that don't map to a
 * released version (trunk, beta, unreleased majors) are returned as-is.
 */
export function formatWordPressVersionLabel(label: string): string {
	const name = WordPressReleaseNames[label];
	return name ? `${label} (${name})` : label;
}
