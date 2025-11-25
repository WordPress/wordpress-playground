import type { PlaygroundClient } from '@wp-playground/client';
import { AdminerButton } from './adminer-button';
import { PhpMyAdminButton } from './phpmyadmin-button';

export function SiteDatabasePanel({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
			<AdminerButton playground={playground} />
			<PhpMyAdminButton playground={playground} />
		</div>
	);
}
