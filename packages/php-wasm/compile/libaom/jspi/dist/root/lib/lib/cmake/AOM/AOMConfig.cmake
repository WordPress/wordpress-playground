set(AOM_VERSION 3.13.1)

####### Expanded from @PACKAGE_INIT@ by configure_package_config_file() #######
####### Any changes to this file will be overwritten by the next CMake run ####
####### The input file was config.cmake.in                            ########

get_filename_component(PACKAGE_PREFIX_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../" ABSOLUTE)

macro(set_and_check _var _file)
  set(${_var} "${_file}")
  if(NOT EXISTS "${_file}")
    message(FATAL_ERROR "File or directory ${_file} referenced by variable ${_var} does not exist !")
  endif()
endmacro()

macro(check_required_components _NAME)
  foreach(comp ${${_NAME}_FIND_COMPONENTS})
    if(NOT ${_NAME}_${comp}_FOUND)
      if(${_NAME}_FIND_REQUIRED_${comp})
        set(${_NAME}_FOUND FALSE)
      endif()
    endif()
  endforeach()
endmacro()

####################################################################################

if(0)
  include(CMakeFindDependencyMacro)
  find_dependency(Threads REQUIRED)
endif()

include("${CMAKE_CURRENT_LIST_DIR}/AOMTargets.cmake")

set_and_check(AOM_INCLUDE_DIRS "${PACKAGE_PREFIX_DIR}/include")

# AOM::aom_static is defined only if BUILD_SHARED_LIBS=1 when libaom
# was configured. When it is false, AOM::aom is a static library.
if(TARGET AOM::aom_static)
  set(AOM_STATIC_LIBRARIES "AOM::aom_static")
else()
  set(AOM_STATIC_LIBRARIES "AOM::aom")
endif()
set(AOM_LIBRARIES "AOM::aom")

check_required_components(AOM)
