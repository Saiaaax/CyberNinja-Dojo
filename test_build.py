import unittest
import tempfile
import sys
from pathlib import Path
from unittest.mock import patch

# Import build.py
import build

class TestBuildCheckStale(unittest.TestCase):
    def setUp(self):
        # Create a temporary directory for diagnostics
        self.test_dir = tempfile.TemporaryDirectory()
        self.diagnostic_path = Path(self.test_dir.name)
        
        # Save original DIAGNOSTIC_DIR
        self.original_diagnostic_dir = build.DIAGNOSTIC_DIR
        build.DIAGNOSTIC_DIR = self.diagnostic_path

    def tearDown(self):
        # Restore original DIAGNOSTIC_DIR
        build.DIAGNOSTIC_DIR = self.original_diagnostic_dir
        self.test_dir.cleanup()

    @patch("build.current_commit_id")
    def test_no_stale_artifacts(self, mock_commit_id):
        # Current commit is "abcdef12"
        mock_commit_id.return_value = "abcdef12"
        
        # Create files matching the current commit
        (self.diagnostic_path / "build-abcdef12.logd").write_text("current logd")
        (self.diagnostic_path / "build-abcdef12.json").write_text("current json")
        
        # Run main with --check-stale
        with patch.object(sys, "argv", ["build.py", "--check-stale"]):
            exit_code = build.main()
            self.assertEqual(exit_code, 0)

    @patch("build.current_commit_id")
    def test_stale_artifacts_fail_default_threshold(self, mock_commit_id):
        # Current commit is "abcdef12"
        mock_commit_id.return_value = "abcdef12"
        
        # Create a stale file with a different commit ID
        (self.diagnostic_path / "build-99999999.logd").write_text("stale logd")
        
        # Run main with --check-stale
        with patch.object(sys, "argv", ["build.py", "--check-stale"]):
            exit_code = build.main()
            self.assertEqual(exit_code, 1)

    @patch("build.current_commit_id")
    def test_stale_artifacts_within_threshold(self, mock_commit_id):
        # Current commit is "abcdef12"
        mock_commit_id.return_value = "abcdef12"
        
        # Create a stale file (size: 10 bytes)
        stale_file = self.diagnostic_path / "build-99999999.json"
        stale_file.write_text("1234567890")
        
        # Run main with --check-stale and --max-stale-bytes=20
        with patch.object(sys, "argv", ["build.py", "--check-stale", "--max-stale-bytes", "20"]):
            exit_code = build.main()
            self.assertEqual(exit_code, 0)

    @patch("build.current_commit_id")
    def test_stale_artifacts_exceed_threshold(self, mock_commit_id):
        # Current commit is "abcdef12"
        mock_commit_id.return_value = "abcdef12"
        
        # Create a stale file (size: 30 bytes)
        stale_file = self.diagnostic_path / "build-99999999-metadata.json"
        stale_file.write_text("a" * 30)
        
        # Run main with --check-stale and --max-stale-bytes=20
        with patch.object(sys, "argv", ["build.py", "--check-stale", "--max-stale-bytes", "20"]):
            exit_code = build.main()
            self.assertEqual(exit_code, 1)

if __name__ == "__main__":
    unittest.main()
