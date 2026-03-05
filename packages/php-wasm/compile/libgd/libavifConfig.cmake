# Minimal libavif config file for static build in php-wasm
set(PACKAGE_VERSION "0.8.2")

if(PACKAGE_FIND_VERSION)
  if(PACKAGE_FIND_VERSION_EXACT)
    if(PACKAGE_VERSION VERSION_EQUAL PACKAGE_FIND_VERSION)
      set(PACKAGE_VERSION_EXACT TRUE)
      set(PACKAGE_VERSION_COMPATIBLE TRUE)
    else()
      set(PACKAGE_VERSION_EXACT FALSE)
      set(PACKAGE_VERSION_COMPATIBLE FALSE)
    endif()
  else()
    if(PACKAGE_VERSION VERSION_LESS PACKAGE_FIND_VERSION)
      set(PACKAGE_VERSION_COMPATIBLE FALSE)
    else()
      set(PACKAGE_VERSION_COMPATIBLE TRUE)
      set(PACKAGE_VERSION_EXACT FALSE)
    endif()
  endif()
endif()

if(NOT TARGET avif)
  add_library(avif STATIC IMPORTED)
  set_target_properties(avif PROPERTIES
    IMPORTED_LOCATION "/root/lib/lib/libavif.a"
    INTERFACE_INCLUDE_DIRECTORIES "/root/lib/include"
  )
endif()
if(NOT TARGET avif::avif)
  add_library(avif::avif ALIAS avif)
endif()
set(libavif_VERSION "${PACKAGE_VERSION}")
set(libavif_FOUND TRUE)
