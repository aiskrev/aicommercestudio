"""What a project document may be: a strict allowlist, checked by name *and* by content.

A file is accepted only when its extension is on the list and its first bytes (and, for Office files, its structure)
agree with that extension. The content type that is stored and sent back on download comes from this table, never from
the request. Not accepted, on purpose: SVG, HTML, scripts, executables, archives, macro-enabled Office files and
anything whose name or content disagrees with its type. Files are only ever sent as attachments.

This is a content *check*, not a malware scan. Scanning is a separate, recorded step (`scan_status`): nothing here
claims that an accepted file is safe to open.
"""

from __future__ import annotations

import re
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path

OOXML = "application/vnd.openxmlformats-officedocument"
MAX_UNCOMPRESSED = 100 * 1024 * 1024
MAX_ZIP_ENTRIES = 2000


@dataclass(frozen=True)
class FileType:
    extensions: tuple[str, ...]
    content_type: str
    kind: str  # "magic", "text" or "ooxml"
    magic: tuple[bytes, ...] = ()
    part: str = ""  # the top-level folder an Office file must contain


TYPES: tuple[FileType, ...] = (
    FileType((".pdf",), "application/pdf", "magic", (b"%PDF-",)),
    FileType((".png",), "image/png", "magic", (b"\x89PNG\r\n\x1a\n",)),
    FileType((".jpg", ".jpeg"), "image/jpeg", "magic", (b"\xff\xd8\xff",)),
    FileType((".webp",), "image/webp", "magic"),
    FileType((".txt",), "text/plain", "text"),
    FileType((".md",), "text/markdown", "text"),
    FileType((".csv",), "text/csv", "text"),
    FileType((".docx",), f"{OOXML}.wordprocessingml.document", "ooxml", part="word/"),
    FileType((".xlsx",), f"{OOXML}.spreadsheetml.sheet", "ooxml", part="xl/"),
    FileType((".pptx",), f"{OOXML}.presentationml.presentation", "ooxml", part="ppt/"),
)
BY_EXTENSION = {extension: item for item in TYPES for extension in item.extensions}
ALLOWED_EXTENSIONS = tuple(sorted(BY_EXTENSION))


class FileRejected(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code)
        self.code = code
        self.message = message


_CONTROL = re.compile(r"[\x00-\x1f\x7f]")
_SEPARATORS = re.compile(r"[\\/:*?\"<>|]")


def clean_filename(name: str) -> str:
    """A safe display name: no path, no control characters, no separators, at most 120 characters."""
    name = unicodedata.normalize("NFC", name or "")
    name = name.replace("\\", "/").rsplit("/", 1)[-1]
    name = _SEPARATORS.sub("_", _CONTROL.sub("", name)).strip().strip(".")
    # Keep the extension when shortening.
    stem, dot, extension = name.rpartition(".")
    if len(name) > 120:
        name = stem[: 119 - len(extension)] + dot + extension if dot else name[:120]
    return name


def type_for(filename: str) -> FileType:
    name = clean_filename(filename)
    extension = Path(name).suffix.lower()
    if not name or extension not in BY_EXTENSION:
        raise FileRejected("file_type_not_allowed", "This file type is not allowed.")
    return BY_EXTENSION[extension]


def _check_ooxml(path: Path, item: FileType) -> None:
    try:
        with zipfile.ZipFile(path) as archive:
            infos = archive.infolist()
            if len(infos) > MAX_ZIP_ENTRIES:
                raise FileRejected("file_content_invalid", "The file has too many parts.")
            names = [info.filename for info in infos]
            if sum(info.file_size for info in infos) > MAX_UNCOMPRESSED:
                raise FileRejected("file_content_invalid", "The file expands to too much data.")
            if "[Content_Types].xml" not in names or not any(name.startswith(item.part) for name in names):
                raise FileRejected("file_content_invalid", "The content does not match the file type.")
            for name in names:
                lower = name.lower()
                if (
                    name.startswith(("/", "\\"))
                    or ".." in name.split("/")
                    or "vbaproject" in lower
                    or lower.endswith(".bin")
                ):
                    raise FileRejected("file_content_invalid", "The file contains parts that are not allowed.")
    except zipfile.BadZipFile as exc:
        raise FileRejected("file_content_invalid", "The content does not match the file type.") from exc


def check_content(path: Path, head: bytes, item: FileType) -> None:
    """Raises `FileRejected` unless the bytes agree with the type the name claims."""
    if item.kind == "magic":
        if item.content_type == "image/webp":
            ok = head[:4] == b"RIFF" and head[8:12] == b"WEBP"
        else:
            ok = any(head.startswith(magic) for magic in item.magic)
        if not ok:
            raise FileRejected("file_content_invalid", "The content does not match the file type.")
    elif item.kind == "text":
        data = path.read_bytes()
        if b"\x00" in data:
            raise FileRejected("file_content_invalid", "The content does not match the file type.")
        try:
            data.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise FileRejected("file_content_invalid", "Text files must be UTF-8.") from exc
    else:
        if not head.startswith(b"PK\x03\x04"):
            raise FileRejected("file_content_invalid", "The content does not match the file type.")
        _check_ooxml(path, item)


def describe() -> list[dict[str, str]]:
    """What the page may show as the allowed types (extension and content type)."""
    return [
        {"extension": extension, "content_type": item.content_type} for extension, item in sorted(BY_EXTENSION.items())
    ]
