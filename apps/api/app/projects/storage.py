"""Private storage for project documents.

A small interface (`put`, `open`, `delete`, `exists`) so the rest of the code never touches a path.
`LocalPrivateStorage` keeps files in one directory that is not served by any web server
(`PROJECT_STORAGE_DIR`, a Docker volume owned by the API user, nowhere near the public assets of the website).
A private object store can implement the same four methods later without changing a caller.

Safety rules, all enforced here and tested:

* a storage key is made by the server (`new_key`) and must match a strict pattern; anything else is refused, so a key
  that came from a request can never walk out of the directory;
* the resolved path must stay inside the root;
* a file is written to a temporary name and renamed, so a half-written file is never readable under its key;
* files are created with mode 0600 and directories with 0700.
"""

from __future__ import annotations

import hashlib
import os
import re
import uuid
from collections.abc import Iterable, Iterator
from pathlib import Path
from typing import Protocol

_KEY = re.compile(r"^[0-9a-f]{32}/[0-9a-f]{32}/[0-9a-f]{32}$")
CHUNK = 64 * 1024


class StorageError(Exception):
    """The storage refused or could not do what was asked (a bad key, too much data, a missing file)."""


class TooLarge(StorageError):
    pass


class PrivateStorage(Protocol):
    def put(self, key: str, chunks: Iterable[bytes], *, max_bytes: int) -> tuple[int, str]: ...
    def open(self, key: str) -> Iterator[bytes]: ...
    def delete(self, key: str) -> bool: ...
    def exists(self, key: str) -> bool: ...


def new_key(project_id: uuid.UUID, document_id: uuid.UUID) -> str:
    """`<project>/<document>/<random>` in hex: no person-chosen text anywhere in it."""
    return f"{project_id.hex}/{document_id.hex}/{uuid.uuid4().hex}"


class LocalPrivateStorage:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        if not isinstance(key, str) or not _KEY.fullmatch(key):
            raise StorageError("invalid storage key")
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise StorageError("invalid storage key")
        return path

    def put(self, key: str, chunks: Iterable[bytes], *, max_bytes: int) -> tuple[int, str]:
        """Writes the chunks, returns (size, sha256). Refuses more than `max_bytes`, leaving nothing behind."""
        path = self._path(key)
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        temporary = path.with_name(f".{path.name}.part")
        digest = hashlib.sha256()
        size = 0
        try:
            fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as handle:
                for chunk in chunks:
                    size += len(chunk)
                    if size > max_bytes:
                        raise TooLarge("file is too large")
                    digest.update(chunk)
                    handle.write(chunk)
            os.replace(temporary, path)
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise
        return size, digest.hexdigest()

    def open(self, key: str) -> Iterator[bytes]:
        path = self._path(key)
        try:
            handle = path.open("rb")
        except FileNotFoundError as exc:
            raise StorageError("file not found") from exc
        return self._read(handle)

    @staticmethod
    def _read(handle) -> Iterator[bytes]:
        with handle:
            while chunk := handle.read(CHUNK):
                yield chunk

    def delete(self, key: str) -> bool:
        path = self._path(key)
        try:
            path.unlink()
        except FileNotFoundError:
            return False
        return True

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def local_path(self, key: str) -> Path:
        """For the content check only (it needs random access to a zip); never given to a caller outside the package."""
        return self._path(key)


_STORAGE: LocalPrivateStorage | None = None


def get_storage() -> LocalPrivateStorage:
    from app.config import get_settings

    global _STORAGE
    root = get_settings().project_storage_dir
    if _STORAGE is None or str(_STORAGE.root) != str(Path(root).resolve()):
        _STORAGE = LocalPrivateStorage(root)
    return _STORAGE
