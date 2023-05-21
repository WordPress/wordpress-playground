import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';
import Link from '@docusaurus/Link';

type FeatureItem = {
	title: string;
	href: string;
	Svg: React.ComponentType<React.ComponentProps<'svg'>>;
	description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
	{
		title: 'In-browser WordPress',
		href: '/docs/getting-started/how-to-do-X',
		Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
		description: (
			<>
				Start with a click, try blocks and plugins, and save your work.
				You can even build apps with it!
			</>
		),
	},
	{
		title: 'WebAssembly PHP',
		href: '/docs/getting-started/how-to-do-X',
		Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
		description: (
			<>
				PHP running in JavaScript. Install an npm package and use it in
				your code.
			</>
		),
	},
	{
		title: 'CLI tool',
		href: '/docs/getting-started/how-to-do-X',
		Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
		description: (
			<>
				Develop with WordPress on your computer without PHP, MySQL, or
				Docker.
			</>
		),
	},
	{
		title: 'VisualStudio Code Extension',
		href: '/docs/getting-started/how-to-do-X',
		Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
		description: (
			<>
				WordPress development environment you can set up with a single
				click. Seriously.
			</>
		),
	},
	{
		title: 'Interactive Code Snippets',
		href: '/docs/getting-started/how-to-do-X',
		Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
		description: <>Teach WordPress online with interactive code.</>,
	},
];

function Feature({ title, Svg, description, href }: FeatureItem) {
	return (
		<Link className={clsx('col col--4 homepage-link-tile')} to={href}>
			<div className="text--center">
				<Svg className={styles.featureSvg} role="img" />
			</div>
			<div className="text--center padding-horiz--md">
				<h3>{title}</h3>
				<p>{description}</p>
			</div>
		</Link>
	);
}

export default function HomepageEcosystem(): JSX.Element {
	return (
		<section className={styles.features}>
			<div className="container margin-vert--lg">
				<div className="row margin-vert--lg">
					<h2 className="content-title">
						WordPress Playground Ecosystem
					</h2>
				</div>
				<div className="row row--justify-center">
					{FeatureList.map((props, idx) => (
						<Feature key={idx} {...props} />
					))}
				</div>
			</div>
		</section>
	);
}
