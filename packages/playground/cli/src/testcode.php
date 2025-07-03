<?php

use WordPress\ByteStream\FileReadWriteStream;
use WordPress\ByteStream\ReadStream\BaseByteReadStream;
use WordPress\HttpClient\Request;
use WordPress\HttpClient\ByteStream\RequestReadStream;
use WordPress\ByteStream\ByteStreamException;
use WordPress\ByteStream\NotEnoughDataException;
use WordPress\ByteStream\ReadStream\ByteReadStream;
use WordPress\ByteStream\ReadStream\InflateReadStream;
use WordPress\ByteStream\ReadStream\LimitedByteReadStream;
use WordPress\Zip\FileEntry;
use WordPress\Zip\CentralDirectoryEntry;
use WordPress\Zip\EndCentralDirectoryEntry;
use WordPress\Filesystem\Filesystem;
use WordPress\Filesystem\FilesystemException;
use WordPress\Filesystem\Layer\ChrootLayer;
use WordPress\Filesystem\Mixin\GetContentsViaReadStream;
use WordPress\Filesystem\Mixin\ReadOnlyFilesystem;


$did_download_wordpress_zip = false;
function verbose_log() {
	global $did_download_wordpress_zip;
	if(!$did_download_wordpress_zip) {
		return;
	}
	$args = func_get_args();
	var_dump($args);
}

function playground_http_client_factory() {
	class ZipFilesystem implements Filesystem {
	
		use ReadOnlyFilesystem;
		use GetContentsViaReadStream;
	
		private $zip;
		private $byte_reader;
	
		private $central_directory;
		private $central_directory_end_header;
	
		private $last_file_stream;
	
		const TYPE_DIR = 'dir';
		const TYPE_FILE = 'file';
	
		const CENTRAL_DIRECTORY_INDEX = 'central-directory-index';
		const FILE_ENTRY = 'file-entry';
	
		/**
		 * Don't support ZIP files with more than 2MB of central directory data.
		 *
		 * This is an arbitrary limitation. This reader is buffering the entire
		 * central directory in memory and we need to be mindful of the available
		 * resources. For those huge ZIP files where the central directory alone
		 * is megabytes large, we need a more complex, streaming reader.
		 */
		const MAX_CENTRAL_DIRECTORY_SIZE = 2 * 1024 * 1024;
	
		public static function create( ByteReadStream $byte_reader ) {
			return new ChrootLayer(
				new ZipFilesystem( $byte_reader ),
				'/'
			);
		}
	
		private function __construct( ByteReadStream $byte_reader ) {
			$this->zip         = new ZipDecoder2( $byte_reader );
			$this->byte_reader = $byte_reader;
		}
	
		public function ls( $parent = '/' ) {
			$this->load_central_directory();
			$descendants = $this->central_directory;
	
			// Only keep the descendants of the given parent.
			$parent = trim( $parent, '/' );
			$prefix = $parent ? $parent . '/' : '';
			if ( strlen( $prefix ) > 1 ) {
				$filtered_descendants = array();
				foreach ( $descendants as $entry ) {
					$path = $entry->path;
					if ( strpos( $path, $prefix ) !== 0 ) {
						continue;
					}
					$filtered_descendants[] = $entry;
				}
				$descendants = $filtered_descendants;
			}
	
			// Only keep the direct children of the parent.
			$children = array();
			foreach ( $descendants as $entry ) {
				$suffix = rtrim( substr( $entry->path, strlen( $prefix ) ), '/' );
				if ( strpos( $suffix, '/' ) !== false ) {
					continue;
				}
				// No need to include the directory itself.
				if ( strlen( $suffix ) === 0 ) {
					continue;
				}
				$children[] = $suffix;
			}
	
			return $children;
		}
	
		public function is_dir( $path ) {
			if ( '/' === $path ) {
				return true;
			}
			$this->load_central_directory();
			$path = trim( $path, '/' ) . '/';
	
			return isset( $this->central_directory[ $path ] ) && $this->central_directory[ $path ]->is_directory();
		}
	
		public function is_file( $path ) {
			$this->load_central_directory();
			$path = trim( $path, '/' );
	
			return isset( $this->central_directory[ $path ] ) && ! $this->central_directory[ $path ]->is_directory();
		}
	
		public function exists( $path ) {
			return $this->is_file( $path ) || $this->is_dir( $path );
		}
	
		public function open_read_stream( $path ): ByteReadStream {
			if ( $this->last_file_stream !== null && ! $this->last_file_stream->reached_end_of_data() ) {
				throw new FilesystemException(
					'ZipFilesystem cannot open a read stream while another read stream is open'
				);
			}
			$this->load_central_directory();
			$path = trim( $path, '/' );
			if ( ! isset( $this->central_directory[ $path ] ) ) {
				throw new FilesystemException(
					sprintf( 'File %s not found', $path )
				);
			}
			if ( $this->central_directory[ $path ]->is_directory() ) {
				throw new FilesystemException(
					sprintf( 'Path %s is not a file', $path )
				);
			}
			$this->zip->seek_to_record( $this->central_directory[ $path ]->firstByteAt );
			if ( ! $this->zip->next_object() ) {
				throw new FilesystemException(
					sprintf( 'Failed to open file %s', $path )
				);
			}
			$this->last_file_stream = $this->zip->get_object()->body_reader;
	
			return $this->last_file_stream;
		}
	
		private function load_central_directory() {
			if ( null !== $this->central_directory ) {
				return true;
			}
	
			if ( $this->central_directory_size() >= self::MAX_CENTRAL_DIRECTORY_SIZE ) {
				throw new FilesystemException(
					sprintf( 'Central directory size %d exceeds the maximum allowed size of %d', $this->central_directory_size(),
						self::MAX_CENTRAL_DIRECTORY_SIZE )
				);
			}
	
			// Read the central directory into memory.
			$this->seek_to_central_directory_index();
	
			$central_directory = array();
			while ( $this->zip->next_object() ) {
				$object = $this->zip->get_object();
				if ( ! ( $object instanceof CentralDirectoryEntry ) ) {
					continue;
				}
				$central_directory[ $object->path ] = $object;
			}
	
			// Transform the central directory into a tree structure with
			// directories and files.
			foreach ( $central_directory as $entry ) {
				/**
				 * Directory are sometimes indicated by a path
				 * ending with a right trailing slash. Let's remove it
				 * to avoid an empty entry at the end of $path_segments.
				 */
				$path_segments = explode( '/', $entry->path );
	
				for ( $i = 0; $i < count( $path_segments ) - 1; $i ++ ) {
					$path_so_far                             = implode( '/', array_slice( $path_segments, 0, $i + 1 ) ) . '/';
					$this->central_directory[ $path_so_far ] = new CentralDirectoryEntry(
						array(
							'path' => $path_so_far,
						)
					);
				}
				/**
				 * Only create a file entry if it's not a directory.
				 */
				if ( substr_compare( $entry->path, '/', - strlen( '/' ) ) !== 0 ) {
					$this->central_directory[ $entry->path ] = $entry;
				}
			}
	
			return true;
		}
	
		private function central_directory_size() {
			$this->collect_central_directory_end_header();
	
			return $this->central_directory_end_header->centralDirectorySize;
		}
	
		private function seek_to_central_directory_index() {
			$this->collect_central_directory_end_header();
	
			return $this->zip->seek_to_record( $this->central_directory_end_header->centralDirectoryOffset );
		}
	
		private function collect_central_directory_end_header() {
			if ( null !== $this->central_directory_end_header ) {
				return;
			}
	
			$length = $this->byte_reader->length();
			$this->zip->seek_to_record( $length - 22 );
			if ( ! $this->zip->next_object() ) {
				throw new FilesystemException(
					'Failed to read the end central directory index at the end of the ZIP file'
				);
			}
			if ( ! ( $this->zip->get_object() instanceof EndCentralDirectoryEntry ) ) {
				throw new FilesystemException(
					sprintf( 'Expected end central directory index at the end of the ZIP file but found %s',
						get_class( $this->zip->get_object() ) )
				);
			}
	
			$this->central_directory_end_header = $this->zip->get_object();
		}
	
		public function get_meta(): array {
			return [];
		}
	}
	class ZipDecoder2 {

		const COMPRESSION_DEFLATE = 8;
		const COMPRESSION_NONE = 0;

		const STATE_SCAN = 'scan';
		const STATE_FILE_ENTRY = 'file-entry';
		const STATE_CENTRAL_DIRECTORY_ENTRY_READING = 'central-directory-entry-reading';
		const STATE_END_CENTRAL_DIRECTORY_ENTRY_READING = 'end-central-directory-entry-reading';
		const STATE_OBJECT_READY = 'object-ready';
		const STATE_COMPLETE = 'complete';

		private $state = self::STATE_SCAN;
		private $object = null;
		private $byte_reader;

		public function __construct( ByteReadStream $byte_reader ) {
			$this->byte_reader = $byte_reader;
		}

		public function reached_end_of_data(): bool {
			return self::STATE_COMPLETE === $this->state;
		}

		public $iterations = 0;
		public function next_object(): bool {
			// If we're calling next_object() when an object is ready,
			// it means we want to scan for the next object. Let's clear
			// the state and start scanning again.
			if ( $this->state === self::STATE_OBJECT_READY ) {
				$this->after_record();
			}

			while ( true ) {
				// if(++$this->iterations > 15) {
				// 	var_dump("hai here");
				// 	die();
				// }
				var_dump([
					'state' => $this->state,
				]);
				switch ( $this->state ) {
					case self::STATE_SCAN:
						try {
							var_dump("pulling 4 bytes");
							$this->byte_reader->pull( 4, ByteReadStream::PULL_EXACTLY );
							var_dump("pulled 4 bytes");
						} catch ( NotEnoughDataException $e ) {
							$this->state = self::STATE_COMPLETE;

							return false;
						}
						$signature = $this->byte_reader->consume( 4 );
						// verbose_log([
						// 	'signature' => $signature,
						// ]);
						$signature = unpack( 'V', $signature )[1];
						switch ( $signature ) {
							case FileEntry::SIGNATURE:
								$this->state = self::STATE_FILE_ENTRY;
								break;
							case CentralDirectoryEntry::SIGNATURE:
								$this->state = self::STATE_CENTRAL_DIRECTORY_ENTRY_READING;
								break;
							case EndCentralDirectoryEntry::SIGNATURE:
								$this->state = self::STATE_END_CENTRAL_DIRECTORY_ENTRY_READING;
								break;
							default:
								throw new ByteStreamException(
									sprintf( 'Invalid ZIP object signature %d', $signature )
								);
						}
						break;

					case self::STATE_FILE_ENTRY:
						$this->read_file_entry();
						break;

					case self::STATE_CENTRAL_DIRECTORY_ENTRY_READING:
						$this->read_central_directory_entry();
						break;

					case self::STATE_END_CENTRAL_DIRECTORY_ENTRY_READING:
						$this->read_end_central_directory_entry();
						break;

					case self::STATE_OBJECT_READY:
						return true;

					default:
						return false;
				}
			}
		}

		public function get_object() {
			return $this->object;
		}

		public function seek_to_record( $record_offset ) {
			$this->after_record();
			$this->byte_reader->seek( $record_offset );
		}

		private function read_file_entry() {
			$this->byte_reader->pull( FileEntry::HEADER_SIZE, ByteReadStream::PULL_EXACTLY );
			$data          = $this->byte_reader->consume( FileEntry::HEADER_SIZE );
			$header_fields = unpack(
				'vversion/vgeneralPurpose/vcompressionMethod/vlastModifiedTime/vlastModifiedDate/Vcrc/VcompressedSize/VuncompressedSize/vpathLength/vextraLength',
				$data
			);
			$this->object  = new FileEntry( $header_fields );

			$this->byte_reader->pull( $this->object->pathLength, ByteReadStream::PULL_EXACTLY );
			$path               = $this->byte_reader->consume( $this->object->pathLength );
			$this->object->path = self::sanitize_path( $path );

			$this->byte_reader->pull( $this->object->extraLength, ByteReadStream::PULL_EXACTLY );
			$extra               = $this->byte_reader->consume( $this->object->extraLength );
			$this->object->extra = $extra;

			$limit_reader = new LimitedByteReadStream(
				$this->byte_reader,
				$this->object->compressedSize
			);

			$is_compressed = $this->object->compressionMethod === self::COMPRESSION_DEFLATE;
			if ( $is_compressed ) {
				$this->object->body_reader = new InflateReadStream( $limit_reader, ZLIB_ENCODING_RAW );
			} else {
				$this->object->body_reader = $limit_reader;
			}
			$this->state = self::STATE_OBJECT_READY;
		}

		private function read_central_directory_entry() {
			$this->byte_reader->pull( CentralDirectoryEntry::HEADER_SIZE, ByteReadStream::PULL_EXACTLY );
			$data          = $this->byte_reader->consume( CentralDirectoryEntry::HEADER_SIZE );
			$header_fields = unpack(
				'vversionCreated/vversionNeeded/vgeneralPurpose/vcompressionMethod/vlastModifiedTime/vlastModifiedDate/Vcrc/VcompressedSize/VuncompressedSize/vpathLength/vextraLength/vfileCommentLength/vdiskNumber/vinternalAttributes/VexternalAttributes/VfirstByteAt',
				$data
			);
			$this->object  = new CentralDirectoryEntry( $header_fields );

			$this->byte_reader->pull( $this->object->pathLength, ByteReadStream::PULL_EXACTLY );
			$path_bytes         = $this->byte_reader->consume( $this->object->pathLength );
			$this->object->path = self::sanitize_path( $path_bytes );

			$this->byte_reader->pull( $this->object->extraLength, ByteReadStream::PULL_EXACTLY );
			$extra_bytes         = $this->byte_reader->consume( $this->object->extraLength );
			$this->object->extra = $extra_bytes;

			$this->byte_reader->pull( $this->object->fileCommentLength, ByteReadStream::PULL_EXACTLY );
			$file_comment_bytes        = $this->byte_reader->consume( $this->object->fileCommentLength );
			$this->object->fileComment = $file_comment_bytes;
			$this->state               = self::STATE_OBJECT_READY;
		}

		private function read_end_central_directory_entry() {
			$this->byte_reader->pull( EndCentralDirectoryEntry::HEADER_SIZE, ByteReadStream::PULL_EXACTLY );
			$data          = $this->byte_reader->consume( EndCentralDirectoryEntry::HEADER_SIZE );
			$header_fields = unpack(
				'vdiskNumber/vcentralDirectoryStartDisk/vnumberCentralDirectoryRecordsOnThisDisk/vnumberCentralDirectoryRecords/VcentralDirectorySize/VcentralDirectoryOffset/vcommentLength',
				$data
			);
			$this->object  = new EndCentralDirectoryEntry(
				$header_fields
			);

			$this->byte_reader->pull( $this->object->commentLength, ByteReadStream::PULL_EXACTLY );
			$comment_bytes         = $this->byte_reader->consume( $this->object->commentLength );
			$this->object->comment = $comment_bytes;
			$this->state           = self::STATE_OBJECT_READY;
		}

		private function after_record() {
			if ( $this->object instanceof FileEntry ) {
				// Skip past the file bytes
				$this->object->body_reader->consume_all();
				$this->object->body_reader->close_reading();
			}
			$this->state  = self::STATE_SCAN;
			$this->object = null;
		}

		/**
		 * Normalizes the parsed path to prevent directory traversal,
		 * a.k.a zip slip attacks.
		 *
		 * In ZIP, paths are arbitrary byte sequences. Nothing prevents
		 * a ZIP file from containing a path such as /etc/passwd or
		 * ../../../../etc/passwd.
		 *
		 * This function normalizes paths found in the ZIP file.
		 *
		 * @TODO: Scrutinize the implementation of this function. Consider
		 *        unicode characters in the path, including ones that are
		 *        just embelishments of the following character. Consider
		 *        the impact of **all** seemingly "invalid" byte sequences,
		 *        e.g. spaces, ASCII control characters, etc. What will the
		 *        OS do when it receives a path containing .{null byte}./etc/passwd?
		 */
		public static function sanitize_path( $path ) {
			// Replace multiple slashes with a single slash.
			$path = preg_replace( '#/+#', '/', $path );
			// Remove all the leading ../ segments.
			$path = preg_replace( '#^(\.\./)+#', '', $path );
			// Remove all the /./ and /../ segments.
			$path = preg_replace( '#/\.\.?/#', '/', $path );

			return $path;
		}
	}

	class SeekableRequestReadStream2 implements WordPress\ByteStream\ReadStream\ByteReadStream {

		public $remote;    // RequestReadStream
		private $cache;    // FileReadWriteStream
		private $temp;
		private $length_resolved = false;

		public function __construct( $request, array $options = array() ) {
			verbose_log("SeekableRequestReadStream::__construct() - START");
			if ( is_string( $request ) ) {
				verbose_log("SeekableRequestReadStream::__construct() - Converting string request to Request object");
				$request = new Request( $request );
			}
			verbose_log("SeekableRequestReadStream::__construct() - Creating RequestReadStream");
			$this->remote = new RequestReadStream( $request, $options );
			verbose_log("SeekableRequestReadStream::__construct() - RequestReadStream created");
			
			$this->temp   = $options['cache_path'] ?? tempnam( sys_get_temp_dir(), 'wp_http_cache_' );
			verbose_log("SeekableRequestReadStream::__construct() - Temp file: " . $this->temp);
			
			verbose_log("SeekableRequestReadStream::__construct() - Creating FileReadWriteStream");
			$this->cache  = FileReadWriteStream::from_path( $this->temp, true );
			verbose_log("SeekableRequestReadStream::__construct() - END");
		}

		private function pipe_until( int $offset ): void {
			verbose_log("SeekableRequestReadStream::pipe_until() - START - target offset: $offset");
			$iteration = 0;
			while ( $this->cache->length() === null || $this->cache->length() < $offset ) {
				$iteration++;
				$cache_length = $this->cache->length();
				verbose_log("SeekableRequestReadStream::pipe_until() - iteration $iteration - cache length: " . ($cache_length ?? 'null') . ", target: $offset");
				
				verbose_log("SeekableRequestReadStream::pipe_until() - calling remote->pull()");
				$pulled = $this->remote->pull( BaseByteReadStream::CHUNK_SIZE );
				verbose_log("SeekableRequestReadStream::pipe_until() - remote->pull() returned: $pulled bytes");
				
				if ( 0 === $pulled ) {
					verbose_log("SeekableRequestReadStream::pipe_until() - No more data pulled, breaking");
					break;
				}
				
				verbose_log("SeekableRequestReadStream::pipe_until() - calling remote->consume()");
				$data = $this->remote->consume( $pulled );
				verbose_log("SeekableRequestReadStream::pipe_until() - remote->consume() returned " . strlen($data) . " bytes");
				
				verbose_log("SeekableRequestReadStream::pipe_until() - calling cache->append_bytes()");
				$this->cache->append_bytes( $data );
				verbose_log("SeekableRequestReadStream::pipe_until() - cache->append_bytes() completed");
				
				// Safety check to prevent infinite loops
				if ($iteration > 10000) {
					verbose_log("SeekableRequestReadStream::pipe_until() - WARNING: Too many iterations ($iteration), breaking to prevent infinite loop");
					break;
				}
			}
			verbose_log("SeekableRequestReadStream::pipe_until() - END - final cache length: " . ($this->cache->length() ?? 'null'));
		}

		public function length(): ?int {
			verbose_log("SeekableRequestReadStream::length() - START");
			if ( ! $this->length_resolved && null === $this->remote->length() ) {
				verbose_log("SeekableRequestReadStream::length() - Length not resolved and remote length is null");
				/**
				 * Wait for the remote headers before returning the length.
				 *
				 * This is an inconsistency between RequestReadStream::length():
				 *
				 * * RequestReadStream returns null until the remote headers are known.
				 * * SeekableRequestReadStream proactively waits for the remote headers.
				 *
				 * That's because:
				 *
				 * * RequestReadStream class is a lower-level utility where we simply
				 *   expose what's available at the moment. The developer is responsible
				 *   for awaiting the response headers.
				 * * SeekableRequestReadStream is a higher-level tool meant for usage
				 *   when knowing the length is vital, e.g. reading from a remote ZIP file.
				 */
				verbose_log("SeekableRequestReadStream::length() - calling remote->await_response()");
				$this->remote->await_response();
				verbose_log("SeekableRequestReadStream::length() - remote->await_response() completed");
				
				if ( null === $this->remote->length() ) {
					verbose_log("SeekableRequestReadStream::length() - Remote length still null, consuming entire stream");
					// The server did not send the Content-Length header.
					// We need to consume the entire stream to infer the length.
					$position = $this->tell();
					verbose_log("SeekableRequestReadStream::length() - Current position: $position");
					
					verbose_log("SeekableRequestReadStream::length() - calling consume_all()");
					$this->consume_all();
					verbose_log("SeekableRequestReadStream::length() - consume_all() completed");
					
					verbose_log("SeekableRequestReadStream::length() - seeking back to position: $position");
					$this->seek( $position );
					verbose_log("SeekableRequestReadStream::length() - seek completed");
				}
				$this->length_resolved = true;
				verbose_log("SeekableRequestReadStream::length() - Length resolved");
			}

			$result = $this->remote->length();
			verbose_log("SeekableRequestReadStream::length() - END - returning: " . ($result ?? 'null'));
			return $result;
		}

		public function tell(): int {
			verbose_log("SeekableRequestReadStream::tell() - START");
			$result = $this->cache->tell();
			verbose_log("SeekableRequestReadStream::tell() - END - returning: $result");
			return $result;
		}

		public function seek( int $offset ) {
			verbose_log("SeekableRequestReadStream::seek() - START - offset: $offset");
			verbose_log("SeekableRequestReadStream::seek() - calling pipe_until()");
			$this->pipe_until( $offset );
			verbose_log("SeekableRequestReadStream::seek() - pipe_until() completed");
			
			var_dump("SeekableRequestReadStream::seek() - calling cache->seek()");
			var_dump($this->cache->tell());
			$this->cache->seek( $offset );
			verbose_log("SeekableRequestReadStream::seek() - END");
		}

		public function reached_end_of_data(): bool {
			verbose_log("SeekableRequestReadStream::reached_end_of_data() - START");
			$remote_end = $this->remote->reached_end_of_data();
			$cache_end = $this->cache->reached_end_of_data();
			$result = $remote_end && $cache_end;
			verbose_log("SeekableRequestReadStream::reached_end_of_data() - remote_end: " . ($remote_end ? 'true' : 'false') . ", cache_end: " . ($cache_end ? 'true' : 'false') . ", result: " . ($result ? 'true' : 'false'));
			return $result;
		}

		public function pull( $n, $mode = self::PULL_NO_MORE_THAN ): int {
			verbose_log("SeekableRequestReadStream::pull() - START - n: $n, mode: $mode");
			$current_pos = $this->tell();
			verbose_log("SeekableRequestReadStream::pull() - current position: $current_pos");
			
			verbose_log("SeekableRequestReadStream::pull() - calling pipe_until()");
			$this->pipe_until( $current_pos + $n );
			verbose_log("SeekableRequestReadStream::pull() - pipe_until() completed");

			verbose_log("SeekableRequestReadStream::pull() - calling cache->pull()");
			$result = $this->cache->pull( $n, $mode );
			verbose_log("SeekableRequestReadStream::pull() - END - returning: $result");
			return $result;
		}

		public function peek( $n ): string {
			verbose_log("SeekableRequestReadStream::peek() - START - n: $n");
			$current_pos = $this->tell();
			verbose_log("SeekableRequestReadStream::peek() - current position: $current_pos");
			
			verbose_log("SeekableRequestReadStream::peek() - calling pipe_until()");
			$this->pipe_until( $current_pos + $n );
			verbose_log("SeekableRequestReadStream::peek() - pipe_until() completed");

			verbose_log("SeekableRequestReadStream::peek() - calling cache->peek()");
			$result = $this->cache->peek( $n );
			verbose_log("SeekableRequestReadStream::peek() - END - returning " . strlen($result) . " bytes");
			return $result;
		}

		public function consume( $n ): string {
			verbose_log("SeekableRequestReadStream::consume() - START - n: $n");
			verbose_log("SeekableRequestReadStream::consume() - calling cache->consume()");
			$result = $this->cache->consume( $n );
			verbose_log("SeekableRequestReadStream::consume() - END - returning " . strlen($result) . " bytes");
			return $result;
		}

		public function consume_all(): string {
			global $did_download_wordpress_zip;
			verbose_log("SeekableRequestReadStream::consume_all() - START");
			$iteration = 0;
			while ( ! $this->remote->reached_end_of_data() ) {
				$iteration++;
				verbose_log("SeekableRequestReadStream::consume_all() - iteration $iteration");
				
				verbose_log("SeekableRequestReadStream::consume_all() - calling remote->pull()");
				$pulled = $this->remote->pull( BaseByteReadStream::CHUNK_SIZE );
				verbose_log("SeekableRequestReadStream::consume_all() - remote->pull() returned: $pulled bytes");
				
				if ( 0 === $pulled ) {
					verbose_log("SeekableRequestReadStream::consume_all() - No more data pulled, breaking");
					break;
				}
				
				verbose_log("SeekableRequestReadStream::consume_all() - calling remote->consume()");
				$data = $this->remote->consume( $pulled );
				verbose_log("SeekableRequestReadStream::consume_all() - remote->consume() returned " . strlen($data) . " bytes");
				
				verbose_log("SeekableRequestReadStream::consume_all() - calling cache->append_bytes()");
				$this->cache->append_bytes( $data );
				verbose_log("SeekableRequestReadStream::consume_all() - cache->append_bytes() completed");
				
				// Safety check to prevent infinite loops
				if ($iteration > 10000) {
					var_dump("SeekableRequestReadStream::consume_all() - WARNING: Too many iterations ($iteration), breaking to prevent infinite loop");
					break;
				}
			}
			verbose_log("SeekableRequestReadStream::consume_all() - calling cache->close_writing()");
			$this->cache->close_writing();
			verbose_log("SeekableRequestReadStream::consume_all() - cache->close_writing() completed");

			verbose_log("SeekableRequestReadStream::consume_all() - calling cache->consume_all()");
			$result = $this->cache->consume_all();
			$did_download_wordpress_zip = true;
			verbose_log("SeekableRequestReadStream::consume_all() - END - returning " . strlen($result) . " bytes");
			return $result;
		}

		public function await_response() {
			verbose_log("SeekableRequestReadStream::await_response() - START");
			verbose_log("SeekableRequestReadStream::await_response() - calling remote->await_response()");
			$result = $this->remote->await_response();
			verbose_log("SeekableRequestReadStream::await_response() - END");
			return $result;
		}

		public function close_reading(): void {
			verbose_log("SeekableRequestReadStream::close_reading() - START");
			verbose_log("SeekableRequestReadStream::close_reading() - calling remote->close_reading()");
			$this->remote->close_reading();
			verbose_log("SeekableRequestReadStream::close_reading() - remote->close_reading() completed");
			
			verbose_log("SeekableRequestReadStream::close_reading() - calling cache->close_reading()");
			$this->cache->close_reading();
			verbose_log("SeekableRequestReadStream::close_reading() - cache->close_reading() completed");
			
			verbose_log("SeekableRequestReadStream::close_reading() - unlinking temp file: " . $this->temp);
			@unlink( $this->temp );
		}
	}

	$client = new WordPress\HttpClient\Client([
		// sockets transport is somehow faster than curl in Playground. Maybe
		// it uses a larger chunk size?
		// 'transport' => 'curl',
	]);

	$stream = new SeekableRequestReadStream2(
		new WordPress\HttpClient\Request('https://wordpress.org/latest.zip'),
		[
			'client' => $client,
		]
	);
	$fs = ZipFilesystem::create($stream);
	var_dump($fs->ls());

	// $decoder = new ZipDecoder2($stream);
	// var_dump($decoder->next_object());
	// var_dump($decoder->next_object());
	// var_dump($decoder->next_object());
	// var_dump('done');
	// die();
	$stream = new WordPress\HttpClient\ByteStream\SeekableRequestReadStream(
		new WordPress\HttpClient\Request('https://downloads.wordpress.org/plugin/simple-local-avatars.latest-stable.zip'),
		[
			'client' => $client,
		]
	);
	$fs = WordPress\Zip\ZipFilesystem::create($stream);
	verbose_log($fs->ls());
	die();
	return $client;
	
}
playground_add_filter('blueprint.http_client', 'playground_http_client_factory');