/*
  Copyright @ 1999 ImageMagick Studio LLC, a non-profit organization
  dedicated to making software imaging solutions freely available.
  
  You may not use this file except in compliance with the License.
  obtain a copy of the License at
  
    https://imagemagick.org/script/license.php
  
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

  MagickCore version methods.
*/
#ifndef _MAGICKCORE_VERSION_H
#define _MAGICKCORE_VERSION_H

#if defined(__cplusplus) || defined(c_plusplus)
extern "C" {
#endif

/*
  Define declarations.
*/
#define MagickPackageName "ImageMagick"
#define MagickCopyright  "(C) 1999 ImageMagick Studio LLC"
#define MagickLibVersion  0x711
#define MagickLibVersionText  "7.1.1"
#define MagickLibVersionNumber  10,0,1
#define MagickLibAddendum  "-39"
#define MagickLibInterface  10
#define MagickLibMinInterface  10
#define MagickPlatform  "i386"
#define MagickppLibVersionText  "7.1.1"
#define MagickppLibVersionNumber  5:0:0
#define MagickppLibAddendum  "-39"
#define MagickppLibInterface  5
#define MagickppLibMinInterface  5
#define MagickGitRevision  "e339a05ed:20241002"
#define MagickReleaseDate  "2024-10-02"
#define MagickAuthoritativeLicense  \
  "https://imagemagick.org/script/license.php"
#define MagickAuthoritativeURL  "https://imagemagick.org"
#define MagickHomeURL  "file:///root/install/share/doc/ImageMagick-7/index.html"
#if (MAGICKCORE_QUANTUM_DEPTH == 8)
#define MagickQuantumDepth  "Q8"
#define MagickQuantumRange  "255"
#elif (MAGICKCORE_QUANTUM_DEPTH == 16)
#define MagickQuantumDepth  "Q16"
#define MagickQuantumRange  "65535"
#elif (MAGICKCORE_QUANTUM_DEPTH == 32)
#define MagickQuantumDepth  "Q32"
#define MagickQuantumRange  "4294967295"
#elif (MAGICKCORE_QUANTUM_DEPTH == 64)
#define MagickQuantumDepth  "Q64"
#define MagickQuantumRange  "65535"
#else
#define MagickQuantumDepth  "Q?"
#define MagickQuantumRange  "?"
#endif
#if defined(MAGICKCORE_HDRI_SUPPORT)
#define MagickHDRISupport  "-HDRI"
#else
#define MagickHDRISupport  ""
#endif
#define MagickVersion  \
  MagickPackageName " " MagickLibVersionText MagickLibAddendum " " \
  MagickQuantumDepth MagickHDRISupport " " MagickPlatform " " \
  MagickGitRevision " " MagickAuthoritativeURL

extern MagickExport char
  *GetMagickHomeURL(void);

extern MagickExport const char
  *GetMagickCopyright(void) magick_attribute((__const__)),
  *GetMagickDelegates(void) magick_attribute((__const__)),
  *GetMagickFeatures(void) magick_attribute((__const__)),
  *GetMagickLicense(void) magick_attribute((__const__)),
  *GetMagickPackageName(void) magick_attribute((__const__)),
  *GetMagickQuantumDepth(size_t *),
  *GetMagickQuantumRange(size_t *),
  *GetMagickReleaseDate(void) magick_attribute((__const__)),
  *GetMagickVersion(size_t *);

extern MagickExport void
  ListMagickVersion(FILE *);

#if defined(__cplusplus) || defined(c_plusplus)
}
#endif

#endif
