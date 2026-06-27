import unittest
import tempfile
import sys
import shutil
from pathlib import Path
from unittest.mock import patch

# Import build module
import build

class TestStaleDiagnostics(unittest.TestCase):
    def setUp(self):
        # Create a temporary directory for diagnostics
        self.test_dir = tempfile.TemporaryDirectory()
        self.diagnostic_dir_path = Path(self.test_dir.name)
        
        # Patch build variables
        self.dir_patcher = patch('build.DIAGNOSTIC_DIR', self.diagnostic_dir_path)
        self.commit_patcher = patch('build.current_commit_id', return_value="abcdef12")
        
        self.dir_patcher.start()
        self.commit_patcher.start()

    def tearDown(self):
        # Stop patchers and cleanup temp directory
        self.dir_patcher.stop()
        self.commit_patcher.stop()
        self.test_dir.cleanup()

    def write_dummy_file(self, filename, size_bytes):
        file_path = self.diagnostic_dir_path / filename
        with open(file_path, "wb") as f:
            f.write(b"x" * size_bytes)
        return file_path

    def test_no_stale_artifacts(self):
        # Create only current commit files
        self.write_dummy_file("build-abcdef12.logd", 100)
        self.write_dummy_file("build-abcdef12.json", 50)
        
        with patch('sys.argv', ['build.py', '--check-stale']):
            exit_code = build.main()
            self.assertEqual(exit_code, 0)

    def test_stale_artifact_exits_one(self):
        # Create a stale file
        self.write_dummy_file("build-11111111.logd", 100)
        
        with patch('sys.argv', ['build.py', '--check-stale']):
            exit_code = build.main()
            self.assertEqual(exit_code, 1)

    def test_stale_within_threshold_exits_zero(self):
        # Create stale files totalling 100 bytes
        self.write_dummy_file("build-11111111.logd", 60)
        self.write_dummy_file("build-22222222.json", 40)
        
        with patch('sys.argv', ['build.py', '--check-stale', '--max-stale-bytes', '150']):
            exit_code = build.main()
            self.assertEqual(exit_code, 0)

    def test_stale_exceeding_threshold_exits_one(self):
        # Create stale files totalling 200 bytes
        self.write_dummy_file("build-11111111.logd", 120)
        self.write_dummy_file("build-22222222.json", 80)
        
        with patch('sys.argv', ['build.py', '--check-stale', '--max-stale-bytes', '150']):
            exit_code = build.main()
            self.assertEqual(exit_code, 1)

if __name__ == '__main__':
    unittest.main()
