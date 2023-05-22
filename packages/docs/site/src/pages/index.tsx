import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
// import HomepageEcosystem from '@site/src/components/HomepageEcosystem';
// import HomepageUseCases from '@site/src/components/HomepageUseCases';

import styles from './index.module.css';
import '../typedoc-model';

function HomepageHeader() {
	const { siteConfig } = useDocusaurusContext();
	return (
		<header className={clsx('hero hero--primary', styles.heroBanner)}>
			<div className="container margin-vert--lg">
				<div className="row row--align-center">
					<div className="col col--5 padding-vert--md">
						<h1 className={clsx('hero__title', styles.heroTitle)}>
							{siteConfig.title}
						</h1>
						<p
							className={clsx(
								'hero__subtitle',
								styles.heroSubtitle
							)}
						>
							Playground is a zero-setup WordPress.
							<br />
							It runs on JavaScript and works in your browser,
							terminal, and even Visual Studio Code.
						</p>
						<div className={styles.buttons}>
							<Link
								className={clsx(
									'button button--primary',
									styles.buttonXl
								)}
								to="https://playground.wordpress.net"
								target="_blank"
							>
								Try it now
							</Link>
							<Link
								className={clsx(
									'button button--secondary',
									styles.buttonXl
								)}
								to="/docs/start-here"
							>
								Get Started
							</Link>
						</div>
					</div>
					<div className="col col--7">
						<iframe
							className={styles.video}
							width="1120"
							height="630"
							src="https://www.youtube.com/embed/VeigCZuxnfY?start=2916"
							title="YouTube video player"
							frameBorder="0"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
						></iframe>
					</div>
				</div>
			</div>
		</header>
	);
}

export default function Home(): JSX.Element {
	const { siteConfig } = useDocusaurusContext();
	return (
		<Layout
			title={`Hello from ${siteConfig.title}`}
			description="Description will go into a meta tag in <head />"
		>
			<HomepageHeader />

			<main>
				{/* @TODO: feature tiles with direct link to doc pages: */}
				{/*
				<HomepageUseCases />
				<HomepageEcosystem />
				*/}

				<section className={styles.features}>
					<div className="container margin-vert--lg padding-bottom--lg">
						<div className="row margin-vert--lg">
							<h2 className="content-title margin-vert--lg">
								Start building with WordPress Playground today
							</h2>
						</div>

						<div className="row margin-vert--lg row--align-center">
							<div className="col col--8 col--offset-2">
								<p className="content-sub-title">
									It's free and open source – like the rest of
									WordPress.
								</p>
							</div>
						</div>
						<div className={styles.buttons}>
							<Link
								className={clsx(
									'button button--primary',
									styles.buttonXl
								)}
								to="/docs/start-here"
							>
								Get Started
							</Link>
						</div>
					</div>
				</section>
			</main>
		</Layout>
	);
}
