import os
import shutil
import tempfile
import unittest
from pathlib import Path
import subprocess
import sys

import build

class CheckStaleTest(unittest.TestCase):
    def setUp(self):
        # Create a temporary diagnostic directory
        self.temp_dir = tempfile.TemporaryDirectory()
        self.orig_diag_dir = build.DIAGNOSTIC_DIR
        build.DIAGNOSTIC_DIR = Path(self.temp_dir.name)

    def tearDown(self):
        # Restore original diagnostic directory and cleanup
        build.DIAGNOSTIC_DIR = self.orig_diag_dir
        self.temp_dir.cleanup()

    def create_artifact(self, name: str, size: int = 10):
        path = build.DIAGNOSTIC_DIR / name
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            f.write(b"x" * size)
        return path

    def test_no_stale_artifacts(self):
        current_commit = "deadbeef"
        # Create only current commit artifacts
        self.create_artifact(f"build-{current_commit}.logd")
        self.create_artifact(f"build-{current_commit}.json")
        stale = build.find_stale_diagnostic_artifacts(current_commit)
        self.assertEqual(len(stale), 0)

    def test_with_stale_artifacts(self):
        current_commit = "deadbeef"
        # Create current commit artifacts
        self.create_artifact(f"build-{current_commit}.logd")
        self.create_artifact(f"build-{current_commit}.json")
        # Create stale artifacts
        self.create_artifact("build-12345678.logd")
        self.create_artifact("build-12345678.json")
        stale = build.find_stale_diagnostic_artifacts(current_commit)
        self.assertEqual(len(stale), 2)

    def test_check_stale_flag_exit_code(self):
        # This test runs the build.py script with --check-stale flag
        current_commit = "deadbeef"
        self.create_artifact(f"build-{current_commit}.logd")
        self.create_artifact(f"build-{current_commit}.json")
        self.create_artifact("build-12345678.logd")
        self.create_artifact("build-12345678.json")

        # Run with max-stale-bytes=0 (default) should fail
        result = subprocess.run(
            [sys.executable, "build.py", "--check-stale"],
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("stale diagnostic artifacts detected", result.stdout)

        # Run with max-stale-bytes large enough to allow stale artifacts
        result = subprocess.run(
            [sys.executable, "build.py", "--check-stale", "--max-stale-bytes", "10000"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("no stale diagnostic artifacts found", result.stdout)

if __name__ == "__main__":
    unittest.main()
