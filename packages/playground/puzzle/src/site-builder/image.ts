export const getImageFromVideo = (
	video: HTMLVideoElement,
	scanArea: { width: number; height: number }
) => {
	const videoCanvas = document.createElement('canvas');
	videoCanvas.width = video.width;
	videoCanvas.height = video.height;
	const videoCtx = videoCanvas.getContext('2d');
	if (!videoCtx) {
		return;
	}
	videoCtx.drawImage(video, 0, 0, video.width, video.height);

	const imageCanvas = document.createElement('canvas');
	imageCanvas.width = scanArea.width;
	imageCanvas.height = scanArea.height;
	const imageCtx = imageCanvas.getContext('2d');
	if (!imageCtx) {
		return;
	}
	const x = (video.width - scanArea.width) / 2;
	const y = (video.height - scanArea.height) / 2;
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
