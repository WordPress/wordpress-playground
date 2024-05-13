import React from 'react';
import { useNavigate } from 'react-router-dom';

import background from '../../assets/home-background.png';

import './Home.scss';
import { Footer } from '../../components/footer/Footer.tsx';
import { Button } from '@wordpress/components';
import { capturePhoto } from '@wordpress/icons';

export const Home = () => {
	const navigate = useNavigate();
	const onClick = () => {
		navigate('/scan');
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
					src={background}
					alt="Playground sites"
					className="home__image"
				/>
			</article>
			<Footer />
		</>
	);
};
