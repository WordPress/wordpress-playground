import React from 'react';
import { useEffect, useRef } from 'react';

import shape from '../../assets/shape.png';

import './ScanOverlay.scss';
import { useScanContext } from '../../context/scan.ts';

export const ScanOverlay = () => {
	const { setScanArea } = useScanContext();
	const overlay = useRef(null);

	const drawOverlay = () => {
		if (!overlay.current) {
			return;
		}
		const overlayElement = overlay.current as HTMLCanvasElement;
		overlayElement.width = window.innerWidth;
		overlayElement.height = window.innerHeight;
		const ctx = overlayElement.getContext('2d');
		if (!ctx) {
			return;
		}
		ctx.fillStyle = 'rgba(35, 40, 45, 0.9)';
		ctx.fillRect(0, 0, overlayElement.width, overlayElement.height);
		ctx.globalCompositeOperation = 'destination-out';

		const originalImageWidth = 526;
		const originalImageHeight = 458;
		const img = new Image();
		img.src = shape;

		img.onload = () => {
			img.width = window.innerWidth - 70;
			if (img.width > originalImageWidth) {
				img.width = originalImageWidth;
			}
			img.height = img.width * (originalImageHeight / originalImageWidth);

			const x = (window.innerWidth - img.width) / 2;
			const y = (window.innerHeight - img.height) / 2;

			setScanArea({
				x,
				y,
				width: img.width,
				height: img.height,
			});

			ctx.drawImage(img, x, y, img.width, img.height);
			ctx.fill();
		};
	};

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(drawOverlay, [overlay]);
	useEffect(() => {
		window.addEventListener('resize', drawOverlay);
		return () => {
			window.removeEventListener('resize', drawOverlay);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return <canvas ref={overlay} className="scan-overlay" />;
};
