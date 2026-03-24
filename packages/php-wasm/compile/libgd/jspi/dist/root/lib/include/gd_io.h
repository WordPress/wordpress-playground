#ifndef GD_IO_H
#define GD_IO_H 1

#include <stdio.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
  Group: Types

  typedef: gdIOCtx

  gdIOCtx structures hold function pointers for doing image IO.

  Most of the gd functions that read and write files, such as
  <gdImagePng> also have variants that accept a <gdIOCtx> structure;
  see <gdImagePngCtx> and <gdImageCreateFromJpegCtx>.

  Those who wish to provide their own custom routines to read and
  write images can populate a gdIOCtx structure with functions of
  their own devising to to read and write data. For image reading, the
  only mandatory functions are getC and getBuf, which must return the
  number of characters actually read, or a negative value on error or
  EOF. These functions must read the number of characters requested
  unless at the end of the file.

  For image writing, the only mandatory functions are putC and putBuf,
  which return the number of characters written; these functions must
  write the number of characters requested except in the event of an
  error. The seek and tell functions are only required in conjunction
  with the gd2 file format, which supports quick loading of partial
  images. The gd_free function will not be invoked when calling the
  standard Ctx functions; it is an implementation convenience when
  adding new data types to gd. For examples, see gd_png.c, gd_gd2.c,
  gd_jpeg.c, etc., all of which rely on gdIOCtx to implement the
  standard image read and write functions.

  > typedef struct gdIOCtx
  > {
  >   int (*getC)(gdIOCtxPtr);
  >   int (*getBuf)(gdIOCtxPtr, void *, int wanted);
  >
  >   void (*putC)(gdIOCtxPtr, int);
  >   int (*putBuf)(gdIOCtxPtr, const void *, int wanted);
  >
  >   // seek must return 1 on SUCCESS, 0 on FAILURE. Unlike fseek!
  >   int (*seek)(gdIOCtxPtr, const int);
  >   long (*tell)(gdIOCtxPtr);
  >
  >   void (*gd_free)(gdIOCtxPtr);
  > } gdIOCtx;
 */
typedef struct gdIOCtx *gdIOCtxPtr;

typedef struct gdIOCtx {
    int (*getC)(gdIOCtxPtr);
    int (*getBuf)(gdIOCtxPtr, void *, int);
    void (*putC)(gdIOCtxPtr, int);
    int (*putBuf)(gdIOCtxPtr, const void *, int);
    /* seek must return 1 on SUCCESS, 0 on FAILURE. Unlike fseek! */
    int (*seek)(gdIOCtxPtr, const int);
    long (*tell)(gdIOCtxPtr);
    void (*gd_free)(gdIOCtxPtr);
    void *data;
} gdIOCtx;

void gdPutC(const unsigned char c, gdIOCtxPtr ctx);
int gdPutBuf(const void *, int, gdIOCtxPtr);
void gdPutWord(int w, gdIOCtxPtr ctx);
void gdPutInt(int w, gdIOCtxPtr ctx);

int gdGetC(gdIOCtxPtr ctx);
int gdGetBuf(void *, int, gdIOCtxPtr);
int gdGetByte(int *result, gdIOCtxPtr ctx);
int gdGetWord(int *result, gdIOCtxPtr ctx);
int gdGetWordLSB(signed short int *result, gdIOCtxPtr ctx);
int gdGetInt(int *result, gdIOCtxPtr ctx);
int gdGetIntLSB(signed int *result, gdIOCtxPtr ctx);

int gdSeek(gdIOCtxPtr ctx, const int offset);
long gdTell(gdIOCtxPtr ctx);

#ifdef __cplusplus
}
#endif

#endif
