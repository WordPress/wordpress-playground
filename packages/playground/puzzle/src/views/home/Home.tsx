import React from 'react';
import { useNavigate } from 'react-router-dom';

import './Home.scss';
import { Footer } from '../../components/footer/Footer';
import { Button } from '@wordpress/components';
import { capturePhoto } from '@wordpress/icons';

// @ts-ignore-next-linea
import backgroundImage from '../../assets/home-background.png';

export const Home = () => {
	const navigate = useNavigate();
	const onClick = () => {
		navigate('/puzzle/scan');
	};
	return (
		<>
			<article className="view view--home">
				<h1 className="home__title">
					Build your site with <span>real blocks</span>
				</h1>
				<p className="home__description">
					Arrange the puzzles, take a picture, and see your setup come
					to life in seconds.
				</p>
				<Button
					onClick={onClick}
					variant="primary"
					className="home__action"
					icon={capturePhoto}
				>
					Build your site
				</Button>
				<img
					src={backgroundImage}
					alt="Playground sites"
					className="home__image"
				/>
			</article>
			<Footer />
		</>
	);
};
