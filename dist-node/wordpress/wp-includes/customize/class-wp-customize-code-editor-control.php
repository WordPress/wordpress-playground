<?php
 class WP_Customize_Code_Editor_Control extends WP_Customize_Control { public $type = 'code_editor'; public $code_type = ''; public $editor_settings = array(); public function enqueue() { $this->editor_settings = wp_enqueue_code_editor( array_merge( array( 'type' => $this->code_type, 'codemirror' => array( 'indentUnit' => 2, 'tabSize' => 2, ), ), $this->editor_settings ) ); } public function json() { $json = parent::json(); $json['editor_settings'] = $this->editor_settings; $json['input_attrs'] = $this->input_attrs; return $json; } public function render_content() {} public function content_template() { ?>
		<# var elementIdPrefix = 'el' + String( Math.random() ); #>
		<# if ( data.label ) { #>
			<label for="{{ elementIdPrefix }}_editor" class="customize-control-title">
				{{ data.label }}
			</label>
		<# } #>
		<# if ( data.description ) { #>
			<span class="description customize-control-description">{{{ data.description }}}</span>
		<# } #>
		<div class="customize-control-notifications-container"></div>
		<textarea id="{{ elementIdPrefix }}_editor"
			<# _.each( _.extend( { 'class': 'code' }, data.input_attrs ), function( value, key ) { #>
				{{{ key }}}="{{ value }}"
			<# }); #>
			></textarea>
		<?php
 } } 