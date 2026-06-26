#!/usr/bin/env python3
"""Verify native CLI release archives before uploading them to GitHub Releases."""

import hashlib
import json
import os
import pathlib
import sys
from typing import Optional


EXPECTED_TARGETS = {
    "linux-x64": "x86_64-unknown-linux-gnu",
    "linux-arm64": "aarch64-unknown-linux-gnu",
    "windows-x64": "x86_64-pc-windows-msvc",
    "windows-arm64": "aarch64-pc-windows-msvc",
    "macos-x64": "x86_64-apple-darwin",
    "macos-arm64": "aarch64-apple-darwin",
}


def main() -> int:
    version = required_env("VERSION")
    release_sha = required_env("RELEASE_SHA")
    asset_dir = pathlib.Path(required_env("ASSET_DIR"))

    failures = []
    packages = []
    for label, target in EXPECTED_TARGETS.items():
        archive = asset_dir / f"wp-playground-native-{version}-{label}.zip"
        checksum = asset_dir / f"{archive.name}.sha256"
        manifest = asset_dir / f"{archive.name}.manifest.json"
        missing = [path.name for path in (archive, checksum, manifest) if not path.is_file()]
        if missing:
            failures.extend(f"missing {name}" for name in missing)
            continue

        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        checksum_digest, checksum_name = read_checksum(checksum, failures)
        package_manifest = read_json(manifest, failures)
        if package_manifest is None:
            continue

        if checksum_digest and checksum_digest.lower() != digest:
            failures.append(f"{checksum.name} digest mismatch")
        if checksum_name and checksum_name != archive.name:
            failures.append(
                f"{checksum.name} names {checksum_name}, expected {archive.name}"
            )
        if package_manifest.get("targetTriple") != target:
            failures.append(f"{manifest.name} targetTriple mismatch")
        if package_manifest.get("sourceCommit") != release_sha:
            failures.append(f"{manifest.name} sourceCommit mismatch")
        if package_manifest.get("version") != version:
            failures.append(f"{manifest.name} version mismatch")
        if package_manifest.get("archive", {}).get("sha256") != digest:
            failures.append(f"{manifest.name} archive sha256 mismatch")

        packages.append(
            {
                "label": label,
                "targetTriple": target,
                "archive": archive.name,
                "sha256": digest,
                "sizeBytes": archive.stat().st_size,
                "manifest": manifest.name,
                "checksum": checksum.name,
            }
        )

    if failures:
        for failure in failures:
            print(f"::error::{failure}")
        return 1

    release_manifest = {
        "schemaVersion": 1,
        "version": version,
        "sourceCommit": release_sha,
        "packages": packages,
    }
    (asset_dir / "wp-playground-native-release-manifest.json").write_text(
        json.dumps(release_manifest, indent=2) + "\n"
    )
    return 0


def required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(f"::error::{name} is required", file=sys.stderr)
        sys.exit(1)
    return value


def read_checksum(
    path: pathlib.Path, failures: list[str]
) -> tuple[Optional[str], Optional[str]]:
    parts = path.read_text().strip().split(maxsplit=1)
    if len(parts) != 2:
        failures.append(f"{path.name} must contain '<sha256>  <filename>'")
        return None, None
    return parts[0], parts[1].strip()


def read_json(path: pathlib.Path, failures: list[str]) -> Optional[dict]:
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as error:
        failures.append(f"{path.name} is invalid JSON: {error}")
        return None


if __name__ == "__main__":
    raise SystemExit(main())
