#----------------------------------------------------------------
# Generated CMake target import file.
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "libzip::zip" for configuration ""
set_property(TARGET libzip::zip APPEND PROPERTY IMPORTED_CONFIGURATIONS NOCONFIG)
set_target_properties(libzip::zip PROPERTIES
  IMPORTED_LINK_INTERFACE_LANGUAGES_NOCONFIG "C"
  IMPORTED_LOCATION_NOCONFIG "${_IMPORT_PREFIX}/lib/libzip.a"
  )

list(APPEND _cmake_import_check_targets libzip::zip )
list(APPEND _cmake_import_check_files_for_libzip::zip "${_IMPORT_PREFIX}/lib/libzip.a" )

# Import target "libzip::zipcmp" for configuration ""
set_property(TARGET libzip::zipcmp APPEND PROPERTY IMPORTED_CONFIGURATIONS NOCONFIG)
set_target_properties(libzip::zipcmp PROPERTIES
  IMPORTED_LOCATION_NOCONFIG "${_IMPORT_PREFIX}/bin/zipcmp.js"
  )

list(APPEND _cmake_import_check_targets libzip::zipcmp )
list(APPEND _cmake_import_check_files_for_libzip::zipcmp "${_IMPORT_PREFIX}/bin/zipcmp.js" )

# Import target "libzip::zipmerge" for configuration ""
set_property(TARGET libzip::zipmerge APPEND PROPERTY IMPORTED_CONFIGURATIONS NOCONFIG)
set_target_properties(libzip::zipmerge PROPERTIES
  IMPORTED_LOCATION_NOCONFIG "${_IMPORT_PREFIX}/bin/zipmerge.js"
  )

list(APPEND _cmake_import_check_targets libzip::zipmerge )
list(APPEND _cmake_import_check_files_for_libzip::zipmerge "${_IMPORT_PREFIX}/bin/zipmerge.js" )

# Import target "libzip::ziptool" for configuration ""
set_property(TARGET libzip::ziptool APPEND PROPERTY IMPORTED_CONFIGURATIONS NOCONFIG)
set_target_properties(libzip::ziptool PROPERTIES
  IMPORTED_LOCATION_NOCONFIG "${_IMPORT_PREFIX}/bin/ziptool.js"
  )

list(APPEND _cmake_import_check_targets libzip::ziptool )
list(APPEND _cmake_import_check_files_for_libzip::ziptool "${_IMPORT_PREFIX}/bin/ziptool.js" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
