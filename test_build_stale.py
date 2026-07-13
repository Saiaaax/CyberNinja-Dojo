import os
import unittest
import tempfile
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent

class TestBuildStale(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.env = os.environ.copy()
        self.env["DIAGNOSTIC_DIR"] = self.temp_dir
        
        # Get current commit ID from the actual build.py function or replicate it
        # to ensure we don't accidentally mark current commit files as stale.
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--verify", "HEAD"],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=5,
            )
            self.commit_id = result.stdout.strip()[:8]
        except Exception:
            self.commit_id = "00000000"

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_no_stale(self):
        # Create a file matching current commit ID
        current_file = Path(self.temp_dir) / f"build-{self.commit_id}.logd"
        current_file.write_text("current commit content")
        
        cmd = ["python3", "build.py", "--check-stale"]
        res = subprocess.run(cmd, env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertIn("No stale diagnostic artifacts found", res.stdout)

    def test_stale_default_threshold(self):
        # Create a stale file (matching different commit ID)
        stale_file = Path(self.temp_dir) / "build-12345678.logd"
        stale_file.write_text("stale commit content")
        
        cmd = ["python3", "build.py", "--check-stale"]
        res = subprocess.run(cmd, env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 1)
        self.assertIn("Stale diagnostic artifacts found", res.stdout)

    def test_stale_under_threshold(self):
        # Create a stale file with 10 bytes
        stale_file = Path(self.temp_dir) / "build-12345678.logd"
        stale_file.write_text("1234567890") # 10 bytes
        
        # Set max-stale-bytes to 20
        cmd = ["python3", "build.py", "--check-stale", "--max-stale-bytes", "20"]
        res = subprocess.run(cmd, env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertIn("Total stale bytes: 10", res.stdout)

    def test_stale_over_threshold(self):
        # Create a stale file with 30 bytes
        stale_file = Path(self.temp_dir) / "build-12345678.logd"
        stale_file.write_text("1234567890" * 3) # 30 bytes
        
        # Set max-stale-bytes to 20
        cmd = ["python3", "build.py", "--check-stale", "--max-stale-bytes", "20"]
        res = subprocess.run(cmd, env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 1)
        self.assertIn("Total stale bytes: 30", res.stdout)

if __name__ == "__main__":
    unittest.main()
