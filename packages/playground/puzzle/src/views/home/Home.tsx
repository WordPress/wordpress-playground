import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import './Home.scss';
import { Footer } from '../../components/footer/Footer';
import { Button, Spinner } from '@wordpress/components';
import { capturePhoto } from '@wordpress/icons';

// @ts-ignore-next-linea
import backgroundImage from '../../assets/home-background.png';

export const Home = () => {
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();
	const onClick = () => {
		setLoading(true);
		navigator.mediaDevices
			.getUserMedia({
				video: {
					facingMode: 'environment',
				},
				audio: false,
			})
			.then(() => {
				navigate('/puzzle/scan');
			})
			.catch((error) => {
				// eslint-disable-next-line no-console
				console.error(error);
			})
			.finally(() => {
				setLoading(false);
			});
	};
	return (
		<>
			<article className="view view--home">
				<div className="home__content">
					<h1 className="home__title">
						Build your site with real blocks
					</h1>
					<p className="home__description">
						Arrange the puzzles, take a picture, and see your setup
						come to life in seconds.
					</p>
					<Button
						onClick={onClick}
						variant="secondary"
						className="home__action"
						disabled={loading}
						icon={loading ? undefined : capturePhoto}
					>
						{loading && <Spinner />}
						{!loading && 'Enable camera'}
					</Button>
				</div>
				<div className="home__image">
					<img src={backgroundImage} alt="Playground sites" />
				</div>
			</article>
			<Footer />
		</>
	);
};
