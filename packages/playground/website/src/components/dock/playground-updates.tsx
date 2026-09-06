import { Icon, external } from '@wordpress/icons';
import type { usePlaygroundUpdates } from '../../lib/hooks/use-playground-updates';
import { PaneLoading } from '../pane-loading';
import css from './playground-updates.module.css';

/** Shows Make announcements without navigating or modifying the running site. */
export function PlaygroundUpdates({
	posts,
	status,
}: Pick<ReturnType<typeof usePlaygroundUpdates>, 'posts' | 'status'>) {
	return (
		<div className={css.updates}>
			{status === 'loading' && !posts.length ? (
				<PaneLoading message="Loading Playground updates…" />
			) : (
				<>
					{status === 'error' && (
						<p className={css.notice} role="status">
							{posts.length
								? 'Showing saved updates. The latest posts could not be checked.'
								: 'Updates could not be loaded. You can read them on the Playground blog.'}
						</p>
					)}
					{status === 'ready' && !posts.length && (
						<p className={css.notice}>
							No updates have been published yet.
						</p>
					)}
					<ul className={css.posts}>
						{posts.map((post) => (
							<li key={post.id}>
								<a
									href={post.url}
									target="_blank"
									rel="noopener noreferrer"
								>
									<time
										dateTime={new Date(
											post.date
										).toISOString()}
									>
										{new Date(post.date).toLocaleDateString(
											undefined,
											{
												year: 'numeric',
												month: 'long',
												day: 'numeric',
											}
										)}
									</time>
									<h3>
										{post.title}
										<Icon icon={external} size={16} />
									</h3>
								</a>
							</li>
						))}
					</ul>
				</>
			)}
			<a
				className={css.blogLink}
				href="https://make.wordpress.org/playground/category/updates/"
				target="_blank"
				rel="noopener noreferrer"
			>
				All Playground updates <Icon icon={external} size={16} />
			</a>
		</div>
	);
}
