#!/usr/bin/env python3
"""Tests for check_stale_artifacts and is_stale_diagnostic in build.py."""

import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from build import is_stale_diagnostic, check_stale_artifacts


class TestIsStaleDiagnostic(unittest.TestCase):

    def test_current_commit_not_stale(self):
        self.assertFalse(is_stale_diagnostic(
            Path("diagnostic/build-a1b2c3d4.logd"), "a1b2c3d4"))

    def test_other_commit_is_stale(self):
        self.assertTrue(is_stale_diagnostic(
            Path("diagnostic/build-deadbeef.logd"), "a1b2c3d4"))

    def test_chunked_file_current_not_stale(self):
        self.assertFalse(is_stale_diagnostic(
            Path("diagnostic/build-a1b2c3d4-part001.logd"), "a1b2c3d4"))

    def test_chunked_file_other_is_stale(self):
        self.assertTrue(is_stale_diagnostic(
            Path("diagnostic/build-deadbeef-part003.logd"), "a1b2c3d4"))

    def test_json_metadata_other_is_stale(self):
        self.assertTrue(is_stale_diagnostic(
            Path("diagnostic/build-facefeed.json"), "a1b2c3d4"))

    def test_unrelated_file_ignored(self):
        self.assertFalse(is_stale_diagnostic(
            Path("diagnostic/random.txt"), "a1b2c3d4"))


class TestCheckStaleArtifacts(unittest.TestCase):

    def setUp(self):
        self.tmpdir = Path(tempfile.mkdtemp(prefix="check_stale_test_"))
        self.current = "deadc0de"
        self._diag = lambda: self.tmpdir / "diagnostic"

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _touch(self, rel, size=100):
        p = self.tmpdir / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"x" * size)

    def test_no_diagnostic_dir(self):
        h, p, t = check_stale_artifacts(self._diag(), self.current)
        self.assertFalse(h); self.assertEqual(p, []); self.assertEqual(t, 0)

    def test_empty_dir(self):
        self._diag().mkdir()
        h, p, t = check_stale_artifacts(self._diag(), self.current)
        self.assertFalse(h)

    def test_only_current_commit(self):
        self._diag().mkdir()
        self._touch("diagnostic/build-%s.logd" % self.current)
        h, p, t = check_stale_artifacts(self._diag(), self.current)
        self.assertFalse(h)

    def test_has_stale(self):
        self._diag().mkdir()
        self._touch("diagnostic/build-aaaa0001.logd", 200)
        self._touch("diagnostic/build-aaaa0001.json", 50)
        h, p, t = check_stale_artifacts(self._diag(), self.current)
        self.assertTrue(h); self.assertEqual(len(p), 2); self.assertEqual(t, 250)

    def test_max_bytes_threshold(self):
        self._diag().mkdir()
        self._touch("diagnostic/build-aaaa0001.logd", 100)
        h, _, _ = check_stale_artifacts(self._diag(), self.current, max_bytes=200)
        self.assertFalse(h)
        h2, _, _ = check_stale_artifacts(self._diag(), self.current, max_bytes=50)
        self.assertTrue(h2)

    def test_unrelated_files_ignored(self):
        self._diag().mkdir()
        self._touch("diagnostic/build-deadbeef.logd", 150)
        self._touch("diagnostic/README.txt", 99999)
        h, p, t = check_stale_artifacts(self._diag(), self.current)
        self.assertTrue(h); self.assertEqual(len(p), 1); self.assertEqual(t, 150)

    def test_mixed_current_and_stale(self):
        self._diag().mkdir()
        self._touch("diagnostic/build-%s.logd" % self.current, 5000)
        self._touch("diagnostic/build-ffff0001.logd", 300)
        h, p, t = check_stale_artifacts(self._diag(), self.current)
        self.assertTrue(h); self.assertEqual(len(p), 1); self.assertEqual(t, 300)


if __name__ == "__main__":
    unittest.main()
