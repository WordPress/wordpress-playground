export const getImageFromCanvas = (canvas, scanArea) => {
	const videoCanvas = document.createElement('canvas');
	videoCanvas.width = canvas.width;
	videoCanvas.height = canvas.height;
	const videoCtx = videoCanvas.getContext('2d');
	if (!videoCtx) {
		return;
	}
	videoCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height);

	const imageCanvas = document.createElement('canvas');
	imageCanvas.width = scanArea.width;
	imageCanvas.height = scanArea.height;
	const imageCtx = imageCanvas.getContext('2d');
	if (!imageCtx) {
		return;
	}
	const x = (canvas.width - scanArea.width) / 2;
	const y = (canvas.height - scanArea.height) / 2;
	imageCtx.drawImage(
		videoCanvas,
		x,
		y,
		scanArea.width,
		scanArea.height,
		0,
		0,
		imageCanvas.width,
		imageCanvas.height
	);

	const image = imageCanvas.toDataURL('image/png');

	videoCanvas.remove();
	imageCanvas.remove();
	return image;
};
