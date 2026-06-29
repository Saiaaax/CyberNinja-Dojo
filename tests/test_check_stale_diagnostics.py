import tempfile
import unittest
from pathlib import Path

import build


class CheckStaleDiagnosticsTests(unittest.TestCase):
    def write_artifact(self, directory: Path, name: str, content: str = "x") -> Path:
        path = directory / name
        path.write_text(content, encoding="utf-8")
        return path

    def test_no_diagnostic_directory_is_clean(self):
        with tempfile.TemporaryDirectory() as tmp:
            diagnostic_dir = Path(tmp) / "missing"
            ok, stale, total_bytes = build.check_stale_diagnostics(
                current_commit="deadbeef",
                diagnostic_dir=diagnostic_dir,
            )

        self.assertTrue(ok)
        self.assertEqual(stale, [])
        self.assertEqual(total_bytes, 0)

    def test_current_commit_artifacts_are_not_stale(self):
        with tempfile.TemporaryDirectory() as tmp:
            diagnostic_dir = Path(tmp)
            self.write_artifact(diagnostic_dir, "build-deadbeef.logd", "abc")
            self.write_artifact(diagnostic_dir, "build-deadbeef.json", "{}")
            self.write_artifact(diagnostic_dir, "build-deadbeef-part001.logd", "chunk")

            ok, stale, total_bytes = build.check_stale_diagnostics(
                current_commit="deadbeef",
                diagnostic_dir=diagnostic_dir,
            )

        self.assertTrue(ok)
        self.assertEqual(stale, [])
        self.assertEqual(total_bytes, 0)

    def test_older_commit_artifacts_fail_with_default_threshold(self):
        with tempfile.TemporaryDirectory() as tmp:
            diagnostic_dir = Path(tmp)
            self.write_artifact(diagnostic_dir, "build-deadbeef.logd", "current")
            old = self.write_artifact(diagnostic_dir, "build-cafebabe.logd", "stale")

            ok, stale, total_bytes = build.check_stale_diagnostics(
                current_commit="deadbeef",
                diagnostic_dir=diagnostic_dir,
            )

        self.assertFalse(ok)
        self.assertEqual(stale, [old])
        self.assertEqual(total_bytes, 5)

    def test_threshold_allows_small_stale_artifacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            diagnostic_dir = Path(tmp)
            self.write_artifact(diagnostic_dir, "build-cafebabe.json", "12345")

            ok, stale, total_bytes = build.check_stale_diagnostics(
                max_stale_bytes=5,
                current_commit="deadbeef",
                diagnostic_dir=diagnostic_dir,
            )

        self.assertTrue(ok)
        self.assertEqual(len(stale), 1)
        self.assertEqual(total_bytes, 5)


if __name__ == "__main__":
    unittest.main()
