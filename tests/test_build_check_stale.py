import tempfile
import unittest
from pathlib import Path
from unittest import mock

import build


class CheckStaleDiagnosticsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.diagnostic_dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write_artifact(self, name: str, content: str = "x") -> Path:
        path = self.diagnostic_dir / name
        path.write_text(content, encoding="utf-8")
        return path

    def test_current_commit_artifacts_are_not_stale(self):
        self.write_artifact("build-1234abcd.logd")
        self.write_artifact("build-1234abcd.json")

        stale = build.list_stale_diagnostic_artifacts("1234abcd", self.diagnostic_dir)

        self.assertEqual(stale, [])

    def test_older_commit_artifacts_are_stale(self):
        old = self.write_artifact("build-deadbeef.logd")
        self.write_artifact("build-1234abcd.logd")

        stale = build.list_stale_diagnostic_artifacts("1234abcd", self.diagnostic_dir)

        self.assertEqual(stale, [old])

    def test_check_stale_fails_when_any_stale_artifact_exists_by_default(self):
        self.write_artifact("build-deadbeef.json")

        with mock.patch.object(build, "DIAGNOSTIC_DIR", self.diagnostic_dir), mock.patch.object(
            build, "current_commit_id", return_value="1234abcd"
        ):
            exit_code = build.check_stale_diagnostics()

        self.assertEqual(exit_code, 1)

    def test_check_stale_allows_stale_artifacts_within_byte_budget(self):
        self.write_artifact("build-deadbeef-part001.logd", "abc")
        self.write_artifact("build-deadbeef-metadata.json", "{}")

        with mock.patch.object(build, "DIAGNOSTIC_DIR", self.diagnostic_dir), mock.patch.object(
            build, "current_commit_id", return_value="1234abcd"
        ):
            exit_code = build.check_stale_diagnostics(max_stale_bytes=10)

        self.assertEqual(exit_code, 0)


if __name__ == "__main__":
    unittest.main()
