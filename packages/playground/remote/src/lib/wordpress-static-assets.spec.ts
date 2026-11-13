import {
	runtimeStaticAssetsDirectory,
	wordPressStaticAssetOrigin,
} from './wordpress-static-assets';

// A still-running PHP runtime can report metadata to a newer controlling worker.
// Producer metadata and worker configuration are independent versioned paths.
it.each([
	[{ staticAssetsDirectory: 'wp-6.8' }, 'wp-6.8', 'https://app.example'],
	[
		{ staticAssetsDirectory: 'releases/old/wp-6.8' },
		'releases/old/wp-6.8',
		'https://sandbox.example',
	],
	[
		{
			staticAssetsDirectory: 'releases/old/wp-6.8',
			releaseBase: '/releases/old/',
		},
		'releases/old/wp-6.8',
		'https://sandbox.example',
	],
	[
		{ staticAssetsDirectory: 'wp-6.8', releaseBase: '/releases/old/' },
		'releases/old/wp-6.8',
		'https://sandbox.example',
	],
	[
		{ staticAssetsDirectory: 'wp-6.8', releaseBase: '/' },
		'wp-6.8',
		'https://app.example',
	],
])(
	'preserves runtime-owned assets and legacy host aliases: %j',
	(details, directory, origin) => {
		expect(runtimeStaticAssetsDirectory(details)).toBe(directory);
		expect(
			wordPressStaticAssetOrigin(
				directory,
				'https://sandbox.example',
				'https://app.example'
			)
		).toBe(origin);
	}
);
