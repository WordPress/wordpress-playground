const chokidar = require('chokidar');
const archiver = require('archiver');
const fs = require('fs');

const helloFolderPath = './hello';
const outputZipPath = './zips/hello.zip';

// Function to zip the 'hello' folder and save it as 'hello.zip'
function zipHelloFolder() {
	const output = fs.createWriteStream(outputZipPath);
	const archive = archiver('zip', {
		zlib: { level: 9 }, // Sets the compression level.
	});

	output.on('close', () => {
		console.log(`hello.zip has been created.`);
	});

	archive.on('error', (err) => {
		throw err;
	});

	archive.pipe(output);

	archive.directory(helloFolderPath, false);

	archive.finalize();
}

// Watch the 'hello' folder for changes
const watcher = chokidar.watch(helloFolderPath, {
	persistent: true,
	ignoreInitial: true,
});

watcher
	.on('add', (path) => {
		console.log(`File ${path} has been added.`);
		zipHelloFolder();
	})
	.on('change', (path) => {
		console.log(`File ${path} has been changed.`);
		zipHelloFolder();
	})
	.on('unlink', (path) => {
		console.log(`File ${path} has been removed.`);
		zipHelloFolder();
	});
