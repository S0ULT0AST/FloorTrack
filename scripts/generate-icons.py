#!/usr/bin/env python3
"""Draw FloorTrack PWA icons. No third-party image library."""

import struct
import zlib
from pathlib import Path


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(size: int) -> bytes:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(pixel(x, y, size))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def pixel(x: int, y: int, size: int) -> tuple[int, int, int]:
    margin = size * 0.12
    radius = size * 0.18
    if not in_round_rect(x, y, margin, margin, size - margin, size - margin, radius):
        return (16, 19, 24)
    nx = (x - margin) / (size - 2 * margin)
    ny = (y - margin) / (size - 2 * margin)
    amber = (240, 162, 2)
    ink = (20, 24, 29)
    col = int(nx * 4)
    row = int(ny * 4)
    if col >= 4 or row >= 4:
        return amber
    gap = 0.035
    fx = (nx * 4) % 1
    fy = (ny * 4) % 1
    if fx < gap or fy < gap or fx > 1 - gap or fy > 1 - gap:
        return ink
    # A short aisle and a couple of occupied cells so the mark reads as a floor.
    if row == 1 and col in (0, 1, 2):
        return (224, 122, 61)
    if row == 2 and col == 3:
        return (232, 93, 76)
    return amber


def in_round_rect(x: float, y: float, left: float, top: float, right: float, bottom: float, radius: float) -> bool:
    if x < left or x > right or y < top or y > bottom:
        return False
    corners = (
        (left + radius, top + radius, x < left + radius and y < top + radius),
        (right - radius, top + radius, x > right - radius and y < top + radius),
        (left + radius, bottom - radius, x < left + radius and y > bottom - radius),
        (right - radius, bottom - radius, x > right - radius and y > bottom - radius),
    )
    for cx, cy, in_corner in corners:
        if in_corner:
            return (x - cx) ** 2 + (y - cy) ** 2 <= radius**2
    return True


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "public" / "icons"
    root.mkdir(parents=True, exist_ok=True)
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
        (root / name).write_bytes(png(size))
        print(root / name)


if __name__ == "__main__":
    main()
