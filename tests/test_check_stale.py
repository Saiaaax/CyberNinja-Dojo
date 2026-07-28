#!/usr/bin/env python3
"""Tests for --check-stale flag in build.py"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Add parent directory to path to import build
sys.path.insert(0, str(Path(__file__).parent.parent))
import build


class TestCheckStaleArtifacts(unittest.TestCase):
    """Test cases for check_stale_artifacts function"""

    def setUp(self):
        """Create temporary diagnostic directory for each test"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.diag_dir = Path(self.temp_dir.name) / "diagnostic"
        self.diag_dir.mkdir(parents=True, exist_ok=True)
        
        # Mock DIAGNOSTIC_DIR and current_commit_id
        self.patcher_dir = patch.object(build, 'DIAGNOSTIC_DIR', self.diag_dir)
        self.patcher_commit = patch.object(build, 'current_commit_id', return_value='abc12345')
        self.patcher_dir.start()
        self.patcher_commit.start()

    def tearDown(self):
        """Cleanup temporary directory and stop patches"""
        self.patcher_dir.stop()
        self.patcher_commit.stop()
        self.temp_dir.cleanup()

    def test_no_stale_artifacts(self):
        """Test: No stale artifacts returns clean"""
        # Create only current commit artifacts
        (self.diag_dir / "build-abc12345.logd").write_bytes(b"current")
        (self.diag_dir / "build-abc12345.json").write_bytes(b"{}")
        
        is_clean, count, bytes_total = build.check_stale_artifacts(0)
        
        self.assertTrue(is_clean)
        self.assertEqual(count, 0)
        self.assertEqual(bytes_total, 0)

    def test_stale_artifacts_detected(self):
        """Test: Stale artifacts from old commit are detected"""
        # Create current commit artifact
        (self.diag_dir / "build-abc12345.logd").write_bytes(b"current")
        
        # Create stale artifact from old commit
        stale_file = self.diag_dir / "build-oldcommit1.logd"
        stale_file.write_bytes(b"x" * 1000)
        
        is_clean, count, bytes_total = build.check_stale_artifacts(0)
        
        self.assertFalse(is_clean)
        self.assertEqual(count, 1)
        self.assertEqual(bytes_total, 1000)

    def test_max_stale_bytes_threshold(self):
        """Test: --max-stale-bytes threshold works correctly"""
        # Create stale artifact
        stale_file = self.diag_dir / "build-oldcommit1.logd"
        stale_file.write_bytes(b"x" * 500)
        
        # With threshold 0: should fail
        is_clean, count, bytes_total = build.check_stale_artifacts(0)
        self.assertFalse(is_clean)
        
        # With threshold 1000: should pass
        is_clean, count, bytes_total = build.check_stale_artifacts(1000)
        self.assertTrue(is_clean)

    def test_chunked_files_ignored(self):
        """Test: Chunked files (part001, etc.) are not counted as stale"""
        # Create chunked files from old commit
        (self.diag_dir / "build-oldcommit1-part001.logd").write_bytes(b"x" * 1000)
        (self.diag_dir / "build-oldcommit1-part002.logd").write_bytes(b"y" * 1000)
        
        is_clean, count, bytes_total = build.check_stale_artifacts(0)
        
        # Should be clean because chunked files are ignored
        self.assertTrue(is_clean)
        self.assertEqual(count, 0)

    def test_metadata_files_counted(self):
        """Test: JSON metadata files are counted as stale"""
        # Create stale metadata
        stale_json = self.diag_dir / "build-oldcommit1.json"
        stale_json.write_bytes(b'{"test": "data"}')
        
        is_clean, count, bytes_total = build.check_stale_artifacts(0)
        
        self.assertFalse(is_clean)
        self.assertEqual(count, 1)
        self.assertGreater(bytes_total, 0)

    def test_empty_diagnostic_dir(self):
        """Test: Empty diagnostic directory returns clean"""
        is_clean, count, bytes_total = build.check_stale_artifacts(0)
        
        self.assertTrue(is_clean)
        self.assertEqual(count, 0)
        self.assertEqual(bytes_total, 0)

    def test_mixed_current_and_stale(self):
        """Test: Mix of current and stale artifacts"""
        # Current commit
        (self.diag_dir / "build-abc12345.logd").write_bytes(b"current")
        (self.diag_dir / "build-abc12345.json").write_bytes(b"{}")
        
        # Stale commits
        (self.diag_dir / "build-old1.logd").write_bytes(b"x" * 100)
        (self.diag_dir / "build-old2.logd").write_bytes(b"y" * 200)
        (self.diag_dir / "build-old1.json").write_bytes(b'{"old": 1}')
        
        is_clean, count, bytes_total = build.check_stale_artifacts(0)
        
        self.assertFalse(is_clean)
        self.assertEqual(count, 3)  # 2 logd + 1 json
        self.assertEqual(bytes_total, 300 + len(b'{"old": 1}'))


if __name__ == '__main__':
    unittest.main()
