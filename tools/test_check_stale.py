#!/usr/bin/env python3

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD_PY = ROOT / "build.py"
DIAG = ROOT / "diagnostic"

BACKUP_SUFFIX = ".test_backup"


def run_check_stale(extra_args=None):
    cmd = [sys.executable, str(BUILD_PY), "--check-stale"]
    if extra_args:
        cmd.extend(extra_args)
    return subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))


def backup_existing_diagnostics():
    backups = []
    if DIAG.exists():
        for f in DIAG.iterdir():
            bak = f.with_suffix(f.suffix + BACKUP_SUFFIX)
            f.rename(bak)
            backups.append((bak, f))
    return backups


def restore_backups(backups):
    for bak, original in backups:
        if bak.exists():
            bak.rename(original)


def get_current_commit_id():
    result = subprocess.run(
        ["git", "rev-parse", "--verify", "HEAD"],
        capture_output=True, text=True, cwd=str(ROOT)
    )
    return result.stdout.strip()[:8]


def test_no_stale_artifacts():
    DIAG.mkdir(exist_ok=True)
    backups = backup_existing_diagnostics()
    current = get_current_commit_id()
    target = DIAG / f"build-{current}.logd"
    target.write_text("current commit artifact\n")
    try:
        result = run_check_stale()
        assert result.returncode == 0, f"Expected exit 0, got {result.returncode}: {result.stdout} {result.stderr}"
        assert "No stale diagnostic artifacts" in result.stdout
    finally:
        target.unlink(missing_ok=True)
        restore_backups(backups)


def test_stale_artifacts_detected():
    DIAG.mkdir(exist_ok=True)
    backups = backup_existing_diagnostics()
    stale = DIAG / "build-aaaaaaaa.logd"
    stale.write_text("stale artifact\n")
    try:
        result = run_check_stale()
        assert result.returncode == 1, f"Expected exit 1, got {result.returncode}: {result.stdout}"
        assert "Stale diagnostic artifacts detected" in result.stdout
    finally:
        stale.unlink(missing_ok=True)
        restore_backups(backups)


def test_max_stale_bytes_threshold():
    DIAG.mkdir(exist_ok=True)
    backups = backup_existing_diagnostics()
    stale = DIAG / "build-bbbbbbbb.logd"
    stale.write_text("x" * 100)
    try:
        result = run_check_stale(["--max-stale-bytes", "200"])
        assert result.returncode == 0, f"Expected exit 0 with threshold, got {result.returncode}: {result.stdout}"
        assert "within threshold" in result.stdout
    finally:
        stale.unlink(missing_ok=True)
        restore_backups(backups)


def test_max_stale_bytes_exceeded():
    DIAG.mkdir(exist_ok=True)
    backups = backup_existing_diagnostics()
    stale = DIAG / "build-cccccccc.logd"
    stale.write_text("x" * 500)
    try:
        result = run_check_stale(["--max-stale-bytes", "100"])
        assert result.returncode == 1, f"Expected exit 1 when threshold exceeded, got {result.returncode}: {result.stdout}"
    finally:
        stale.unlink(missing_ok=True)
        restore_backups(backups)


if __name__ == "__main__":
    test_no_stale_artifacts()
    print("  PASS test_no_stale_artifacts")
    test_stale_artifacts_detected()
    print("  PASS test_stale_artifacts_detected")
    test_max_stale_bytes_threshold()
    print("  PASS test_max_stale_bytes_threshold")
    test_max_stale_bytes_exceeded()
    print("  PASS test_max_stale_bytes_exceeded")
    print("\nAll 4 tests passed!")
