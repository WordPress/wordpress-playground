import React, { type ReactNode } from 'react';
import Content from '@theme-original/DocSidebar/Desktop/Content';
import type ContentType from '@theme/DocSidebar/Desktop/Content';
import type { WrapperProps } from '@docusaurus/types';
import Logo from '@theme/Logo';
import styles from './styles.module.css';

type Props = WrapperProps<typeof ContentType>;

export default function ContentWrapper(props: Props): ReactNode {
	return (
		<>
			<Logo tabIndex={-1} className={styles.sidebarLogo} />
			<Content {...props} />
		</>
	);
}
