<?php
/**
 * Lets the default Playground administrator choose a different WordPress login.
 */

add_action( 'load-profile.php', function () {
	// Multisite also stores super admin usernames in network settings.
	if ( is_multisite() || ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$current_user = wp_get_current_user();
	$user_id      = (int) $current_user->ID;
	if ( 'admin' !== $current_user->user_login && $user_id !== (int) get_option( 'playground_renamed_admin_id' ) ) {
		return;
	}

	add_action( 'show_user_profile', function () {
		?>
		<h2>Change WordPress username</h2>
		<table class="form-table" role="presentation">
			<tr>
				<th><label for="playground_new_username">New username</label></th>
				<td><input type="text" id="playground_new_username" name="playground_new_username"
					class="regular-text" maxlength="60" autocomplete="off"></td>
			</tr>
		</table>
		<?php
	} );

	// WordPress has checked the profile form's nonce and edit permission before
	// calling this hook. Wait for the profile update to succeed before renaming.
	add_action( 'user_profile_update_errors', function ( $errors, $update, $user ) use ( $current_user, $user_id ) {
		if ( ! $update || (int) $user->ID !== $user_id || ! isset( $_POST['playground_new_username'] ) || ! is_string( $_POST['playground_new_username'] ) ) {
			return;
		}

		$login = trim( wp_unslash( $_POST['playground_new_username'] ) );
		if ( '' === $login || $login === $current_user->user_login ) {
			return;
		}

		$illegal_logins = (array) apply_filters( 'illegal_user_logins', array() );
		if (
			'0' === $login || ! validate_username( $login ) || mb_strlen( $login ) > 60
			|| in_array( strtolower( $login ), array_map( 'strtolower', $illegal_logins ), true )
		) {
			$errors->add( 'playground_invalid_username', 'Enter a valid WordPress username of at most 60 characters.' );
			return;
		}
		$existing_user_id = username_exists( $login );
		if ( $existing_user_id && (int) $existing_user_id !== $user_id ) {
			$errors->add( 'playground_username_taken', 'That username is already in use.' );
			return;
		}

		add_action( 'profile_update', function ( $updated_user_id, $old_user ) use ( $login, $user_id ) {
			if ( (int) $updated_user_id !== $user_id ) {
				return;
			}

			// wp_update_user() does not write user_login. Change only that
			// column so the account ID and public author slug stay the same.
			global $wpdb;
			$updated = $wpdb->update(
				$wpdb->users,
				array( 'user_login' => $login ),
				array( 'ID' => $user_id, 'user_login' => $old_user->user_login ),
				array( '%s' ),
				array( '%d', '%s' )
			);
			if ( 1 !== $updated ) {
				wp_die( 'Could not change the Playground username.' );
			}

			update_option( 'playground_renamed_admin_id', $user_id );
			clean_user_cache( $old_user );
			// Auth cookies contain the login name. Keep this session signed in
			// by issuing fresh cookies for the same account and token.
			wp_set_auth_cookie( $user_id, false, '', wp_get_session_token() );
		}, 10, 2 );
	}, 10, 3 );
} );
