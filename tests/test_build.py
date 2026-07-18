import os
import shutil
import subprocess
import unittest
from pathlib import Path

from build import build_module, clean_module, main, total_stale_bytes, current_commit_id

ROOT = Path(__file__).resolve().parent.parent
DIAGNOSTIC_DIR = ROOT / "diagnostic"
TMP_DIAGNOSTIC_DIR = ROOT / "tmp_diagnostic"

class TestBuild(unittest.TestCase):
    def setUp(self):
        if not TMP_DIAGNOSTIC_DIR.exists():
            TMP_DIAGNOSTIC_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copytree(DIAGNOSTIC_DIR, TMP_DIAGNOSTIC_DIR, dirs_exist_ok=True)

    def tearDown(self):
        shutil.rmtree(TMP_DIAGNOSTIC_DIR, ignore_errors=True)

    def test_no_stale_artifacts(self):
        result = subprocess.run(
            ["python3", "build.py", "--check-stale", "--max-stale-bytes", "0"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, "Unexpected non-zero exit code when no stale artifacts")

    def test_stale_artifacts_exceed_threshold(self):
        current_commit = current_commit_id()
        stale_file = TMP_DIAGNOSTIC_DIR / f"build-00000000.logd"
        stale_file.write_bytes(b"stale data" * 1024 * 1024)  # 1MB of stale data
        result = subprocess.run(
            ["python3", "build.py", "--check-stale", "--max-stale-bytes", "1048576"],  # 1MB
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 1, "Expected non-zero exit code when stale artifacts exceed threshold")

    def test_stale_artifacts_below_threshold(self):
        current_commit = current_commit_id()
        stale_file = TMP_DIAGNOSTIC_DIR / f"build-00000000.logd"
        stale_file.write_bytes(b"stale data" * 512 * 1024)  # 512KB of stale data
        result = subprocess.run(
            ["python3", "build.py", "--check-stale", "--max-stale-bytes", "1048576"],  # 1MB
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, "Unexpected non-zero exit code when stale artifacts below threshold")

    def test_stale_artifacts_exact_threshold(self):
        current_commit = current_commit_id()
        stale_file = TMP_DIAGNOSTIC_DIR / f"build-00000000.logd"
        stale_file.write_bytes(b"stale data" * 1024 * 1024)  # 1MB of stale data
        result = subprocess.run(
            ["python3", "build.py", "--check-stale", "--max-stale-bytes", "1048576"],  # 1MB
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 1, "Expected non-zero exit code when stale artifacts exactly at threshold")

    def test_no_stale_artifacts_with_threshold(self):
        result = subprocess.run(
            ["python3", "build.py", "--check-stale", "--max-stale-bytes", "1048576"],  # 1MB
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, "Unexpected non-zero exit code when no stale artifacts with threshold")

if __name__ == "__main__":
    unittest.main()