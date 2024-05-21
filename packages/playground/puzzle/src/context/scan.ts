import { createContext, useContext } from 'react';

export const ScanContext = createContext<{
	loading: boolean;
	setLoading: (loading: boolean) => void;
	videoElement: HTMLVideoElement | null;
	setVideoElement: (videoElement: HTMLVideoElement | null) => void;
	scanArea: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	setScanArea: (scanArea: {
		x: number;
		y: number;
		width: number;
		height: number;
	}) => void;
	error: string | null;
	setError: (error: string | null) => void;
}>({
	loading: true,
	setLoading: () => {},
	videoElement: null,
	setVideoElement: () => {},
	scanArea: {
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	},
	setScanArea: () => {},
	error: null,
	setError: () => {},
});
export const useScanContext = () => useContext(ScanContext);
