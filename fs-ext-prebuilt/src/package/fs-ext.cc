// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

#include <node.h>
#ifndef _WIN32
#include <fcntl.h>
#endif
#include <errno.h>
#include <stdio.h>
#include <sys/types.h>
#include <stdlib.h>
#include <string.h>
#include <nan.h>

#ifndef _WIN32
#include <sys/file.h>
#include <unistd.h>
#include <sys/statvfs.h>
#endif

#ifdef _WIN32
#include <io.h>
#include <windows.h>
#define off_t LONGLONG
#define _LARGEFILE_SOURCE
#endif

using namespace v8;
using namespace node;

#define THROW_BAD_ARGS Nan::ThrowTypeError("Bad argument")

struct store_data_t {
  Nan::Callback *cb;
  int fs_op;  // operation type within this module
  int fd;
  int oper;
  int arg;
  off_t offset;
#ifndef _WIN32
  struct statvfs statvfs_buf;
#endif
#ifdef _WIN32
  DWORD lock_flags;
  DWORD offset_low;
  DWORD offset_high;
  DWORD length_low;
  DWORD length_high;
#endif
  char *path;
  int error;
  int result;
};

#ifndef _WIN32
static Nan::Persistent<String> f_namemax_symbol;
static Nan::Persistent<String> f_bsize_symbol;
static Nan::Persistent<String> f_frsize_symbol;

static Nan::Persistent<String> f_blocks_symbol;
static Nan::Persistent<String> f_bavail_symbol;
static Nan::Persistent<String> f_bfree_symbol;

static Nan::Persistent<String> f_files_symbol;
static Nan::Persistent<String> f_favail_symbol;
static Nan::Persistent<String> f_ffree_symbol;
#endif

#ifdef _WIN32
  #define LOCK_SH 1
  #define LOCK_EX 2
  #define LOCK_NB 4
  #define LOCK_UN 8
#endif

enum
{
  FS_OP_FLOCK,
  FS_OP_SEEK,
  FS_OP_STATVFS,
#ifndef _WIN32
  FS_OP_FCNTL,
#endif
#ifdef _WIN32
  FS_OP_LOCKFILEEX,
  FS_OP_UNLOCKFILEEX,
#endif
};

static void EIO_After(uv_work_t *req) {
  Nan::HandleScope scope;

  store_data_t *store_data = static_cast<store_data_t *>(req->data);

  // there is always at least one argument. "error"
  int argc = 1;

  // Allocate space for two args: error plus possible additional result
  Local<Value> argv[2];
  Local<Object> statvfs_result;
  // NOTE: This may need to be changed if something returns a -1
  // for a success, which is possible.
  if (store_data->result == -1) {
    // If the request doesn't have a path parameter set.
    argv[0] = Nan::ErrnoException(store_data->error, "EIO_After", "");
  } else {
    // error value is empty or null for non-error.
    argv[0] = Nan::Null();

    switch (store_data->fs_op) {
      // These operations have no data to pass other than "error".
      case FS_OP_FLOCK:
        argc = 1;
        break;

      case FS_OP_SEEK:
        argc = 2;
        argv[1] = Nan::New<Number>(static_cast<double>(store_data->offset));
        break;
      case FS_OP_STATVFS:
#ifndef _WIN32
        argc = 2;
        statvfs_result = Nan::New<Object>();
        argv[1] = statvfs_result;
        Nan::Set(statvfs_result, Nan::New<String>(f_namemax_symbol), Nan::New<Integer>(static_cast<uint32_t>(store_data->statvfs_buf.f_namemax)));
        Nan::Set(statvfs_result, Nan::New<String>(f_bsize_symbol), Nan::New<Integer>(static_cast<uint32_t>(store_data->statvfs_buf.f_bsize)));
        Nan::Set(statvfs_result, Nan::New<String>(f_frsize_symbol), Nan::New<Integer>(static_cast<uint32_t>(store_data->statvfs_buf.f_frsize)));
        Nan::Set(statvfs_result, Nan::New<String>(f_blocks_symbol), Nan::New<Number>(store_data->statvfs_buf.f_blocks));
        Nan::Set(statvfs_result, Nan::New<String>(f_bavail_symbol), Nan::New<Number>(store_data->statvfs_buf.f_bavail));
        Nan::Set(statvfs_result, Nan::New<String>(f_bfree_symbol), Nan::New<Number>(store_data->statvfs_buf.f_bfree));
        Nan::Set(statvfs_result, Nan::New<String>(f_files_symbol), Nan::New<Number>(store_data->statvfs_buf.f_files));
        Nan::Set(statvfs_result, Nan::New<String>(f_favail_symbol), Nan::New<Number>(store_data->statvfs_buf.f_favail));
        Nan::Set(statvfs_result, Nan::New<String>(f_ffree_symbol), Nan::New<Number>(store_data->statvfs_buf.f_ffree));
#else
        argc = 1;
#endif
        break;
#ifndef _WIN32
      case FS_OP_FCNTL:
        argc = 2;
        argv[1] = Nan::New<Number>(store_data->result);
        break;
#endif
#ifdef _WIN32
      case FS_OP_LOCKFILEEX:
      case FS_OP_UNLOCKFILEEX:
        argc = 1;
        break;
#endif
      default:
        assert(0 && "Unhandled op type value");
    }
  }

  Nan::TryCatch try_catch;

  Nan::AsyncResource async_resource("fs-ext:EIO_After");
  store_data->cb->Call(argc, argv, &async_resource);

  if (try_catch.HasCaught()) {
    Nan::FatalException(try_catch);
  }

  // Dispose of the persistent handle
  delete store_data->cb;
  delete store_data;
  delete req;
}

static void EIO_StatVFS(uv_work_t *req) {
  store_data_t* statvfs_data = static_cast<store_data_t *>(req->data);
  statvfs_data->result = 0;
#ifndef _WIN32
  struct statvfs *data = &(statvfs_data->statvfs_buf);
  if (statvfs(statvfs_data->path, data)) {
    statvfs_data->result = -1;
  	memset(data, 0, sizeof(struct statvfs));
  };
#endif
  free(statvfs_data->path);
  ;
}

#ifdef _WIN32
static off_t _win32_lseek(int fd, off_t offset, int whence) {
  HANDLE fh;
  LARGE_INTEGER new_offset;

  fh = (HANDLE)uv_get_osfhandle(fd);
  if (fh == (HANDLE)-1) {
    errno = EBADF;
    return -1;
  }

  DWORD method;
  switch (whence) {
  case SEEK_SET:
      method = FILE_BEGIN;
      break;
  case SEEK_CUR:
      method = FILE_CURRENT;
      break;
  case SEEK_END:
      method = FILE_END;
      break;
  default:
      errno = EINVAL;
      return -1;
  }

  LARGE_INTEGER distance;
  distance.QuadPart = offset;

  if (SetFilePointerEx(fh, distance, &new_offset, method)) {
    return new_offset.QuadPart;
  }

  errno = EINVAL;
  return -1;
}
#endif

static void EIO_Seek(uv_work_t *req) {
  store_data_t* seek_data = static_cast<store_data_t *>(req->data);

#ifdef _WIN32
  off_t offs = _win32_lseek(seek_data->fd, seek_data->offset, seek_data->oper);
#else
  off_t offs = lseek(seek_data->fd, seek_data->offset, seek_data->oper);
#endif

  if (offs == -1) {
    seek_data->result = -1;
    seek_data->error = errno;
  } else {
    seek_data->offset = offs;
  }

}

#ifndef _WIN32
static void EIO_Fcntl(uv_work_t *req) {
  store_data_t* data = static_cast<store_data_t *>(req->data);

  struct flock lk;
  lk.l_start = 0;
  lk.l_len = 0;
  lk.l_type = 0;
  lk.l_whence = 0;
  lk.l_pid = 0;

  int result = -1;
  if (data->oper == F_GETLK || data->oper == F_SETLK || data->oper == F_SETLKW) {
	if (data->oper == F_SETLK || data->oper == F_SETLKW) {
		lk.l_whence = SEEK_SET;
		lk.l_type   = data->arg;
	}
	data->result = result = fcntl(data->fd, data->oper, &lk);
  } else {
  	data->result = result = fcntl(data->fd, data->oper, data->arg);
  }
  if (result == -1) {
   	data->error = errno;
  }
}
#endif

#ifdef _WIN32

static void uv__crt_invalid_parameter_handler(const wchar_t* expression,
    const wchar_t* function, const wchar_t * file, unsigned int line,
    uintptr_t reserved) {
  /* No-op. */
}

#define LK_LEN          0xffff0000

static int _win32_flock(int fd, int oper) {
  OVERLAPPED o;
  HANDLE fh;

  int i = -1;

  fh = (HANDLE)uv_get_osfhandle(fd);
  if (fh == (HANDLE)-1) {
    errno = EBADF;
    return -1;
  }

  memset(&o, 0, sizeof(o));

  switch(oper) {
  case LOCK_SH:               /* shared lock */
      if (LockFileEx(fh, 0, 0, LK_LEN, 0, &o))
        i = 0;
      break;
  case LOCK_EX:               /* exclusive lock */
      if (LockFileEx(fh, LOCKFILE_EXCLUSIVE_LOCK, 0, LK_LEN, 0, &o))
        i = 0;
      break;
  case LOCK_SH|LOCK_NB:       /* non-blocking shared lock */
      if (LockFileEx(fh, LOCKFILE_FAIL_IMMEDIATELY, 0, LK_LEN, 0, &o))
        i = 0;
      break;
  case LOCK_EX|LOCK_NB:       /* non-blocking exclusive lock */
      if (LockFileEx(fh, LOCKFILE_EXCLUSIVE_LOCK|LOCKFILE_FAIL_IMMEDIATELY,
                     0, LK_LEN, 0, &o))
        i = 0;
      break;
  case LOCK_UN:               /* unlock lock */
      if (UnlockFileEx(fh, 0, LK_LEN, 0, &o) ||
          GetLastError() == ERROR_NOT_LOCKED)
        i = 0;
      break;
  default:                    /* unknown */
      errno = EINVAL;
      return -1;
  }
  if (i == -1) {
    if (GetLastError() == ERROR_LOCK_VIOLATION)
      errno = EWOULDBLOCK;
    else
      errno = EINVAL;
  }
  return i;
}
#endif

static void EIO_Flock(uv_work_t *req) {
  store_data_t* flock_data = static_cast<store_data_t *>(req->data);

#ifdef _WIN32
  int i = _win32_flock(flock_data->fd, flock_data->oper);
#else
  int i = flock(flock_data->fd, flock_data->oper);
#endif

  flock_data->result = i;
  flock_data->error = errno;

}

#ifdef _WIN32
static void EIO_LockFileEx(uv_work_t *req) {
  store_data_t* lock_data = static_cast<store_data_t *>(req->data);

  HANDLE fh = (HANDLE)uv_get_osfhandle(lock_data->fd);
  if (fh == (HANDLE)-1) {
    lock_data->result = -1;
    lock_data->error = EBADF;
    return;
  }

  OVERLAPPED o;
  memset(&o, 0, sizeof(o));
  o.Offset = lock_data->offset_low;
  o.OffsetHigh = lock_data->offset_high;

  BOOL success = LockFileEx(fh, lock_data->lock_flags, 0,
                            lock_data->length_low, lock_data->length_high, &o);

  if (success) {
    lock_data->result = 0;
  } else {
    lock_data->result = -1;
    DWORD err = GetLastError();
    if (err == ERROR_LOCK_VIOLATION) {
      lock_data->error = EWOULDBLOCK;
    } else {
      lock_data->error = EINVAL;
    }
  }
}

static void EIO_UnlockFileEx(uv_work_t *req) {
  store_data_t* lock_data = static_cast<store_data_t *>(req->data);

  HANDLE fh = (HANDLE)uv_get_osfhandle(lock_data->fd);
  if (fh == (HANDLE)-1) {
    lock_data->result = -1;
    lock_data->error = EBADF;
    return;
  }

  OVERLAPPED o;
  memset(&o, 0, sizeof(o));
  o.Offset = lock_data->offset_low;
  o.OffsetHigh = lock_data->offset_high;

  BOOL success = UnlockFileEx(fh, 0,
                              lock_data->length_low, lock_data->length_high, &o);

  if (success || GetLastError() == ERROR_NOT_LOCKED) {
    lock_data->result = 0;
  } else {
    lock_data->result = -1;
    lock_data->error = EINVAL;
  }
}
#endif

static NAN_METHOD(Flock) {
  if (info.Length() < 2 || !info[0]->IsInt32() || !info[1]->IsInt32()) {
    return THROW_BAD_ARGS;
  }

  store_data_t* flock_data = new store_data_t();

  flock_data->fs_op = FS_OP_FLOCK;
  flock_data->fd = info[0].As<v8::Int32>()->Value();
  flock_data->oper = info[1].As<v8::Int32>()->Value();

  if (info[2]->IsFunction()) {
    flock_data->cb = new Nan::Callback((Local<Function>) info[2].As<Function>());
    uv_work_t *req = new uv_work_t;
    req->data = flock_data;
    uv_queue_work(uv_default_loop(), req, EIO_Flock, (uv_after_work_cb)EIO_After);
    info.GetReturnValue().SetUndefined();
  } else {
#ifdef _WIN32
    int i = _win32_flock(flock_data->fd, flock_data->oper);
#else
    int i = flock(flock_data->fd, flock_data->oper);
#endif
    delete flock_data;
    if (i != 0) return Nan::ThrowError(Nan::ErrnoException(errno, "Flock", ""));
    info.GetReturnValue().SetUndefined();
  }
}

#ifdef _WIN32
// lockFileEx(fd, flags, offsetLow, offsetHigh, lengthLow, lengthHigh [, callback])
static NAN_METHOD(LockFileExMethod) {
  if (info.Length() < 6 ||
      !info[0]->IsInt32() ||
      !info[1]->IsUint32() ||
      !info[2]->IsUint32() ||
      !info[3]->IsUint32() ||
      !info[4]->IsUint32() ||
      !info[5]->IsUint32()) {
    return THROW_BAD_ARGS;
  }

  int fd = info[0].As<v8::Int32>()->Value();
  DWORD flags = info[1].As<v8::Uint32>()->Value();
  DWORD offsetLow = info[2].As<v8::Uint32>()->Value();
  DWORD offsetHigh = info[3].As<v8::Uint32>()->Value();
  DWORD lengthLow = info[4].As<v8::Uint32>()->Value();
  DWORD lengthHigh = info[5].As<v8::Uint32>()->Value();

  if (info[6]->IsFunction()) {
    store_data_t* lock_data = new store_data_t();
    lock_data->cb = new Nan::Callback((Local<Function>) info[6].As<Function>());
    lock_data->fs_op = FS_OP_LOCKFILEEX;
    lock_data->fd = fd;
    lock_data->lock_flags = flags;
    lock_data->offset_low = offsetLow;
    lock_data->offset_high = offsetHigh;
    lock_data->length_low = lengthLow;
    lock_data->length_high = lengthHigh;

    uv_work_t *req = new uv_work_t;
    req->data = lock_data;
    uv_queue_work(uv_default_loop(), req, EIO_LockFileEx, (uv_after_work_cb)EIO_After);
    info.GetReturnValue().SetUndefined();
  } else {
    // Synchronous
    HANDLE fh = (HANDLE)uv_get_osfhandle(fd);
    if (fh == (HANDLE)-1) {
      return Nan::ThrowError(Nan::ErrnoException(EBADF, "LockFileEx", ""));
    }

    OVERLAPPED o;
    memset(&o, 0, sizeof(o));
    o.Offset = offsetLow;
    o.OffsetHigh = offsetHigh;

    BOOL success = LockFileEx(fh, flags, 0, lengthLow, lengthHigh, &o);
    if (!success) {
      DWORD err = GetLastError();
      int errcode = (err == ERROR_LOCK_VIOLATION) ? EWOULDBLOCK : EINVAL;
      return Nan::ThrowError(Nan::ErrnoException(errcode, "LockFileEx", ""));
    }
    info.GetReturnValue().SetUndefined();
  }
}

// unlockFileEx(fd, offsetLow, offsetHigh, lengthLow, lengthHigh [, callback])
static NAN_METHOD(UnlockFileExMethod) {
  if (info.Length() < 5 ||
      !info[0]->IsInt32() ||
      !info[1]->IsUint32() ||
      !info[2]->IsUint32() ||
      !info[3]->IsUint32() ||
      !info[4]->IsUint32()) {
    return THROW_BAD_ARGS;
  }

  int fd = info[0].As<v8::Int32>()->Value();
  DWORD offsetLow = info[1].As<v8::Uint32>()->Value();
  DWORD offsetHigh = info[2].As<v8::Uint32>()->Value();
  DWORD lengthLow = info[3].As<v8::Uint32>()->Value();
  DWORD lengthHigh = info[4].As<v8::Uint32>()->Value();

  if (info[5]->IsFunction()) {
    store_data_t* lock_data = new store_data_t();
    lock_data->cb = new Nan::Callback((Local<Function>) info[5].As<Function>());
    lock_data->fs_op = FS_OP_UNLOCKFILEEX;
    lock_data->fd = fd;
    lock_data->offset_low = offsetLow;
    lock_data->offset_high = offsetHigh;
    lock_data->length_low = lengthLow;
    lock_data->length_high = lengthHigh;

    uv_work_t *req = new uv_work_t;
    req->data = lock_data;
    uv_queue_work(uv_default_loop(), req, EIO_UnlockFileEx, (uv_after_work_cb)EIO_After);
    info.GetReturnValue().SetUndefined();
  } else {
    // Synchronous
    HANDLE fh = (HANDLE)uv_get_osfhandle(fd);
    if (fh == (HANDLE)-1) {
      return Nan::ThrowError(Nan::ErrnoException(EBADF, "UnlockFileEx", ""));
    }

    OVERLAPPED o;
    memset(&o, 0, sizeof(o));
    o.Offset = offsetLow;
    o.OffsetHigh = offsetHigh;

    BOOL success = UnlockFileEx(fh, 0, lengthLow, lengthHigh, &o);
    if (!success && GetLastError() != ERROR_NOT_LOCKED) {
      return Nan::ThrowError(Nan::ErrnoException(EINVAL, "UnlockFileEx", ""));
    }
    info.GetReturnValue().SetUndefined();
  }
}
#endif

#ifdef _LARGEFILE_SOURCE
static inline int IsInt64(double x) {
  return x == static_cast<double>(static_cast<int64_t>(x));
}
#endif

#ifndef _LARGEFILE_SOURCE
#define ASSERT_OFFSET(a) \
  if (!(a)->IsUndefined() && !(a)->IsNull() && !(a)->IsInt32()) { \
    return Nan::ThrowTypeError("Not an integer"); \
  }
#define GET_OFFSET(a) ((a)->IsInt32() ? (a).As<v8::Int32>()->Value() : -1)
#else
#define ASSERT_OFFSET(a) \
  if (!(a)->IsUndefined() && !(a)->IsNull() && !((a)->IsNumber() && IsInt64((a).As<v8::Number>()->Value()))) { \
    return Nan::ThrowTypeError("Not an integer"); \
  }
#define GET_OFFSET(a) ((a)->IsNumber() ? static_cast<int64_t>((a).As<v8::Number>()->Value()) : -1)
#endif

//  fs.seek(fd, position, whence [, callback] )

static NAN_METHOD(Seek) {
  if (info.Length() < 3 ||
     !info[0]->IsInt32() ||
     !info[2]->IsInt32()) {
    return THROW_BAD_ARGS;
  }

  int fd = info[0].As<v8::Int32>()->Value();
  ASSERT_OFFSET(info[1]);
  off_t offs = GET_OFFSET(info[1]);
  int whence = info[2].As<v8::Int32>()->Value();

  if ( ! info[3]->IsFunction()) {
#ifdef _WIN32
    off_t offs_result = _win32_lseek(fd, offs, whence);
#else
    off_t offs_result = lseek(fd, offs, whence);
#endif
    if (offs_result == -1) return Nan::ThrowError(Nan::ErrnoException(errno, "Seek", ""));
    info.GetReturnValue().Set(Nan::New<Number>(static_cast<double>(offs_result)));
    return;
  }

  store_data_t* seek_data = new store_data_t();

  seek_data->cb = new Nan::Callback((Local<Function>) info[3].As<Function>());
  seek_data->fs_op = FS_OP_SEEK;
  seek_data->fd = fd;
  seek_data->offset = offs;
  seek_data->oper = whence;

  uv_work_t *req = new uv_work_t;
  req->data = seek_data;
  uv_queue_work(uv_default_loop(), req, EIO_Seek, (uv_after_work_cb)EIO_After);

  info.GetReturnValue().SetUndefined();
}

//  fs.fcntl(fd, cmd, [arg])

#ifndef _WIN32
static NAN_METHOD(Fcntl) {
  if (info.Length() < 3 ||
     !info[0]->IsInt32() ||
     !info[1]->IsInt32() ||
     !info[2]->IsInt32()) {
    return THROW_BAD_ARGS;
  }

  int fd = info[0].As<v8::Int32>()->Value();
  int cmd = info[1].As<v8::Int32>()->Value();
  int arg = info[2].As<v8::Int32>()->Value();

  if ( ! info[3]->IsFunction()) {
    int result = fcntl(fd, cmd, arg);
    if (result == -1) return Nan::ThrowError(Nan::ErrnoException(errno, "Fcntl", ""));
    info.GetReturnValue().Set(Nan::New<Number>(result));
    return;
  }

  store_data_t* data = new store_data_t();

  data->cb = new Nan::Callback((Local<Function>) info[3].As<Function>());
  data->fs_op = FS_OP_FCNTL;
  data->fd = fd;
  data->oper = cmd;
  data->arg = arg;

  uv_work_t *req = new uv_work_t;
  req->data = data;
  uv_queue_work(uv_default_loop(), req, EIO_Fcntl, (uv_after_work_cb)EIO_After);

  info.GetReturnValue().SetUndefined();
}
#endif

// Wrapper for statvfs(2).
//   fs.statVFS( path, [callback] )

static NAN_METHOD(StatVFS) {
  if (info.Length() < 1 ||
      !info[0]->IsString() ) {
    return THROW_BAD_ARGS;
  }

  Nan::Utf8String path(info[0]);

  // Synchronous call needs much less work
  if (!info[1]->IsFunction()) {
#ifndef _WIN32
    struct statvfs buf;
    int ret = statvfs(*path, &buf);
    if (ret != 0) return Nan::ThrowError(Nan::ErrnoException(errno, "statvfs", "", *path));
    Local<Object> result = Nan::New<Object>();
    Nan::Set(result, Nan::New<String>(f_namemax_symbol), Nan::New<Integer>(static_cast<uint32_t>(buf.f_namemax)));
    Nan::Set(result, Nan::New<String>(f_bsize_symbol), Nan::New<Integer>(static_cast<uint32_t>(buf.f_bsize)));
    Nan::Set(result, Nan::New<String>(f_frsize_symbol), Nan::New<Integer>(static_cast<uint32_t>(buf.f_frsize)));

    Nan::Set(result, Nan::New<String>(f_blocks_symbol), Nan::New<Number>(buf.f_blocks));
    Nan::Set(result, Nan::New<String>(f_bavail_symbol), Nan::New<Number>(buf.f_bavail));
    Nan::Set(result, Nan::New<String>(f_bfree_symbol), Nan::New<Number>(buf.f_bfree));

    Nan::Set(result, Nan::New<String>(f_files_symbol), Nan::New<Number>(buf.f_files));
    Nan::Set(result, Nan::New<String>(f_favail_symbol), Nan::New<Number>(buf.f_favail));
    Nan::Set(result, Nan::New<String>(f_ffree_symbol), Nan::New<Number>(buf.f_ffree));
    info.GetReturnValue().Set(result);
#else
    info.GetReturnValue().SetUndefined();
#endif
    return;
  }

  store_data_t* statvfs_data = new store_data_t();

  statvfs_data->cb = new Nan::Callback((Local<Function>) info[1].As<Function>());
  statvfs_data->fs_op = FS_OP_STATVFS;
  statvfs_data->path = strdup(*path);

  uv_work_t *req = new uv_work_t;
  req->data = statvfs_data;
  uv_queue_work(uv_default_loop(), req, EIO_StatVFS,(uv_after_work_cb)EIO_After);

  info.GetReturnValue().SetUndefined();
}

extern "C"
NAN_MODULE_INIT(init)
{
  Nan::HandleScope scope;

#ifdef _WIN32
  _set_invalid_parameter_handler(uv__crt_invalid_parameter_handler);
#endif

  v8::Local<v8::Object> constants = Nan::New<v8::Object>();

#ifdef SEEK_SET
  NODE_DEFINE_CONSTANT(constants, SEEK_SET);
#endif

#ifdef SEEK_CUR
  NODE_DEFINE_CONSTANT(constants, SEEK_CUR);
#endif

#ifdef SEEK_END
  NODE_DEFINE_CONSTANT(constants, SEEK_END);
#endif

#ifdef LOCK_SH
  NODE_DEFINE_CONSTANT(constants, LOCK_SH);
#endif

#ifdef LOCK_EX
  NODE_DEFINE_CONSTANT(constants, LOCK_EX);
#endif

#ifdef LOCK_NB
  NODE_DEFINE_CONSTANT(constants, LOCK_NB);
#endif

#ifdef LOCK_UN
  NODE_DEFINE_CONSTANT(constants, LOCK_UN);
#endif

#ifdef F_GETFD
  NODE_DEFINE_CONSTANT(constants, F_GETFD);
#endif

#ifdef F_SETFD
  NODE_DEFINE_CONSTANT(constants, F_SETFD);
#endif

#ifdef FD_CLOEXEC
  NODE_DEFINE_CONSTANT(constants, FD_CLOEXEC);
#endif

#ifdef F_RDLCK
  NODE_DEFINE_CONSTANT(constants, F_RDLCK);
#endif

#ifdef F_WRLCK
  NODE_DEFINE_CONSTANT(constants, F_WRLCK);
#endif

#ifdef F_UNLCK
  NODE_DEFINE_CONSTANT(constants, F_UNLCK);
#endif

#ifdef F_SETLK
  NODE_DEFINE_CONSTANT(constants, F_SETLK);
#endif

#ifdef F_GETLK
  NODE_DEFINE_CONSTANT(constants, F_GETLK);
#endif

#ifdef F_SETLKW
  NODE_DEFINE_CONSTANT(constants, F_SETLKW);
#endif

#ifdef _WIN32
  NODE_DEFINE_CONSTANT(constants, LOCKFILE_EXCLUSIVE_LOCK);
  NODE_DEFINE_CONSTANT(constants, LOCKFILE_FAIL_IMMEDIATELY);
#endif

  Nan::Set(target, Nan::New("constants").ToLocalChecked(), constants);

  Export(target, "seek", Seek);
#ifndef _WIN32
  Export(target, "fcntl", Fcntl);
#endif
  Export(target, "flock", Flock);
  Export(target, "statVFS", StatVFS);
#ifdef _WIN32
  Export(target, "lockFileEx", LockFileExMethod);
  Export(target, "unlockFileEx", UnlockFileExMethod);
#endif

#ifndef _WIN32
  f_namemax_symbol.Reset(Nan::New<String>("f_namemax").ToLocalChecked());
  f_bsize_symbol.Reset(Nan::New<String>("f_bsize").ToLocalChecked());
  f_frsize_symbol.Reset(Nan::New<String>("f_frsize").ToLocalChecked());

  f_blocks_symbol.Reset(Nan::New<String>("f_blocks").ToLocalChecked());
  f_bavail_symbol.Reset(Nan::New<String>("f_bavail").ToLocalChecked());
  f_bfree_symbol.Reset(Nan::New<String>("f_bfree").ToLocalChecked());

  f_files_symbol.Reset(Nan::New<String>("f_files").ToLocalChecked());
  f_favail_symbol.Reset(Nan::New<String>("f_favail").ToLocalChecked());
  f_ffree_symbol.Reset(Nan::New<String>("f_ffree").ToLocalChecked());
#endif
}

#if NODE_MODULE_VERSION > 1
  NODE_MODULE_INIT() {
    init(exports);
  }
#endif
