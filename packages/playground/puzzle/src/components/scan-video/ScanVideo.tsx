import React, { useEffect, useRef } from 'react';

import './ScanVideo.scss';
import { Loader } from '../loader/Loader.tsx';
import { useScanContext } from '../../context/scan.ts';
import { ScanOverlay } from '../../components/scan-overlay/ScanOverlay.tsx';

export const ScanVideo = () => {
	const { loading, setLoading, videoElement, setVideoElement } =
		useScanContext();

	const video = useRef(null);

	useEffect(() => {
		if (!video.current) {
			return;
		}

		setVideoElement(video.current);
	}, [setLoading, setVideoElement, video]);

	useEffect(() => {
		if (!videoElement) {
			return;
		}

		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			return;
		}
		const resizeElements = () => {
			if (!videoElement) {
				return;
			}
			let ratio = 4 / 3;
			if (videoElement.videoHeight) {
				ratio = videoElement.videoWidth / videoElement.videoHeight;
			}

			let width = window.innerWidth;
			let height = window.innerHeight;
			if (window.innerHeight > window.innerWidth) {
				width = height * ratio;
			} else {
				height = width / ratio;
			}

			videoElement.setAttribute('width', width.toString());
			videoElement.setAttribute('height', height.toString());
		};

		navigator.mediaDevices
			.getUserMedia({
				video: {
					facingMode: 'environment',
				},
				audio: false,
			})
			.then((stream) => {
				videoElement.srcObject = stream;
				videoElement
					.play()
					.then(() => {
						setLoading(false);
					})
					.catch((err) => {
						console.error(`An error occurred: ${err}`);
					});
			})
			.catch((err) => {
				console.error(`An error occurred: ${err}`);
			});
		videoElement.addEventListener('canplay', resizeElements, false);
		window.addEventListener('resize', resizeElements);
		return () => {
			videoElement.removeEventListener('canplay', resizeElements);
			window.removeEventListener('resize', resizeElements);
		};
	}, [videoElement, setLoading]);

	return (
		<>
			{loading && <Loader />}
			{!loading && <ScanOverlay />}
			<video
				id="scan-video"
				ref={video}
				autoPlay={true}
				playsInline={true}
				muted={true}
				className="scan-video__video"
			>
				Video stream not available.
			</video>
		</>
	);
};
