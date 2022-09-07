<?php
 class WP_Customize_Date_Time_Control extends WP_Customize_Control { public $type = 'date_time'; public $min_year = 1000; public $max_year = 9999; public $allow_past_date = true; public $include_time = true; public $twelve_hour_format = true; public function render_content() {} public function json() { $data = parent::json(); $data['maxYear'] = (int) $this->max_year; $data['minYear'] = (int) $this->min_year; $data['allowPastDate'] = (bool) $this->allow_past_date; $data['twelveHourFormat'] = (bool) $this->twelve_hour_format; $data['includeTime'] = (bool) $this->include_time; return $data; } public function content_template() { $data = array_merge( $this->json(), $this->get_month_choices() ); $timezone_info = $this->get_timezone_info(); $date_format = get_option( 'date_format' ); $date_format = preg_replace( '/(?<!\\\\)[Yyo]/', '%1$s', $date_format ); $date_format = preg_replace( '/(?<!\\\\)[FmMn]/', '%2$s', $date_format ); $date_format = preg_replace( '/(?<!\\\\)[jd]/', '%3$s', $date_format ); if ( 1 !== substr_count( $date_format, '%1$s' ) || 1 !== substr_count( $date_format, '%2$s' ) || 1 !== substr_count( $date_format, '%3$s' ) ) { $date_format = '%1$s-%2$s-%3$s'; } ?>

		<# _.defaults( data, <?php echo wp_json_encode( $data ); ?> ); #>
		<# var idPrefix = _.uniqueId( 'el' ) + '-'; #>

		<# if ( data.label ) { #>
			<span class="customize-control-title">
				{{ data.label }}
			</span>
		<# } #>
		<div class="customize-control-notifications-container"></div>
		<# if ( data.description ) { #>
			<span class="description customize-control-description">{{ data.description }}</span>
		<# } #>
		<div class="date-time-fields {{ data.includeTime ? 'includes-time' : '' }}">
			<fieldset class="day-row">
				<legend class="title-day {{ ! data.includeTime ? 'screen-reader-text' : '' }}"><?php esc_html_e( 'Date' ); ?></legend>
				<div class="day-fields clear">
					<?php ob_start(); ?>
					<label for="{{ idPrefix }}date-time-month" class="screen-reader-text"><?php esc_html_e( 'Month' ); ?></label>
					<select id="{{ idPrefix }}date-time-month" class="date-input month" data-component="month">
						<# _.each( data.month_choices, function( choice ) {
							if ( _.isObject( choice ) && ! _.isUndefined( choice.text ) && ! _.isUndefined( choice.value ) ) {
								text = choice.text;
								value = choice.value;
							}
							#>
							<option value="{{ value }}" >
								{{ text }}
							</option>
						<# } ); #>
					</select>
					<?php $month_field = trim( ob_get_clean() ); ?>

					<?php ob_start(); ?>
					<label for="{{ idPrefix }}date-time-day" class="screen-reader-text"><?php esc_html_e( 'Day' ); ?></label>
					<input id="{{ idPrefix }}date-time-day" type="number" size="2" autocomplete="off" class="date-input day" data-component="day" min="1" max="31" />
					<?php $day_field = trim( ob_get_clean() ); ?>

					<?php ob_start(); ?>
					<label for="{{ idPrefix }}date-time-year" class="screen-reader-text"><?php esc_html_e( 'Year' ); ?></label>
					<input id="{{ idPrefix }}date-time-year" type="number" size="4" autocomplete="off" class="date-input year" data-component="year" min="{{ data.minYear }}" max="{{ data.maxYear }}">
					<?php $year_field = trim( ob_get_clean() ); ?>

					<?php printf( $date_format, $year_field, $month_field, $day_field ); ?>
				</div>
			</fieldset>
			<# if ( data.includeTime ) { #>
				<fieldset class="time-row clear">
					<legend class="title-time"><?php esc_html_e( 'Time' ); ?></legend>
					<div class="time-fields clear">
						<label for="{{ idPrefix }}date-time-hour" class="screen-reader-text"><?php esc_html_e( 'Hour' ); ?></label>
						<# var maxHour = data.twelveHourFormat ? 12 : 23; #>
						<# var minHour = data.twelveHourFormat ? 1 : 0; #>
						<input id="{{ idPrefix }}date-time-hour" type="number" size="2" autocomplete="off" class="date-input hour" data-component="hour" min="{{ minHour }}" max="{{ maxHour }}">
						:
						<label for="{{ idPrefix }}date-time-minute" class="screen-reader-text"><?php esc_html_e( 'Minute' ); ?></label>
						<input id="{{ idPrefix }}date-time-minute" type="number" size="2" autocomplete="off" class="date-input minute" data-component="minute" min="0" max="59">
						<# if ( data.twelveHourFormat ) { #>
							<label for="{{ idPrefix }}date-time-meridian" class="screen-reader-text"><?php esc_html_e( 'Meridian' ); ?></label>
							<select id="{{ idPrefix }}date-time-meridian" class="date-input meridian" data-component="meridian">
								<option value="am"><?php esc_html_e( 'AM' ); ?></option>
								<option value="pm"><?php esc_html_e( 'PM' ); ?></option>
							</select>
						<# } #>
						<p><?php echo $timezone_info['description']; ?></p>
					</div>
				</fieldset>
			<# } #>
		</div>
		<?php
 } public function get_month_choices() { global $wp_locale; $months = array(); for ( $i = 1; $i < 13; $i++ ) { $month_text = $wp_locale->get_month_abbrev( $wp_locale->get_month( $i ) ); $months[ $i ]['text'] = sprintf( __( '%1$s-%2$s' ), $i, $month_text ); $months[ $i ]['value'] = $i; } return array( 'month_choices' => $months, ); } public function get_timezone_info() { $tz_string = get_option( 'timezone_string' ); $timezone_info = array(); if ( $tz_string ) { try { $tz = new DateTimeZone( $tz_string ); } catch ( Exception $e ) { $tz = ''; } if ( $tz ) { $now = new DateTime( 'now', $tz ); $formatted_gmt_offset = $this->format_gmt_offset( $tz->getOffset( $now ) / 3600 ); $tz_name = str_replace( '_', ' ', $tz->getName() ); $timezone_info['abbr'] = $now->format( 'T' ); $timezone_info['description'] = sprintf( __( 'Your timezone is set to %1$s (%2$s), currently %3$s (Coordinated Universal Time %4$s).' ), $tz_name, '<abbr>' . $timezone_info['abbr'] . '</abbr>', '<abbr>UTC</abbr>' . $formatted_gmt_offset, $formatted_gmt_offset ); } else { $timezone_info['description'] = ''; } } else { $formatted_gmt_offset = $this->format_gmt_offset( (int) get_option( 'gmt_offset', 0 ) ); $timezone_info['description'] = sprintf( __( 'Your timezone is set to %1$s (Coordinated Universal Time %2$s).' ), '<abbr>UTC</abbr>' . $formatted_gmt_offset, $formatted_gmt_offset ); } return $timezone_info; } public function format_gmt_offset( $offset ) { if ( 0 <= $offset ) { $formatted_offset = '+' . (string) $offset; } else { $formatted_offset = (string) $offset; } $formatted_offset = str_replace( array( '.25', '.5', '.75' ), array( ':15', ':30', ':45' ), $formatted_offset ); return $formatted_offset; } } 