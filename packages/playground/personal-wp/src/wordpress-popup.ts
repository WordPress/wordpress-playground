import { bootWordPressPopup } from '@wp-playground/remote/wordpress-popup';

// Personal WP owns this document, including on local and independently hosted origins.
bootWordPressPopup({ allowLoopbackNetwork: true });
