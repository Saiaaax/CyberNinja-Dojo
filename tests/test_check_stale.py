"""Tests for build.py stale diagnostic artifact checks."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
BUILD_PATH = ROOT / "build.py"


def load_build_module():
    spec = importlib.util.spec_from_file_location("build", BUILD_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["build"] = module
    spec.loader.exec_module(module)
    return module


build = load_build_module()


@pytest.fixture
def diagnostic_dir(tmp_path: Path, monkeypatch):
    diag = tmp_path / "diagnostic"
    diag.mkdir()
    monkeypatch.setattr(build, "ROOT", tmp_path)
    monkeypatch.setattr(build, "DIAGNOSTIC_DIR", diag)
    monkeypatch.setattr(build, "current_commit_id", lambda: "abcd1234")
    return diag


def test_retention_report_splits_current_and_stale(diagnostic_dir: Path):
    (diagnostic_dir / "build-abcd1234.json").write_text("{}", encoding="utf-8")
    (diagnostic_dir / "build-deadbeef.logd").write_bytes(b"stale")

    report = build.diagnostic_retention_report()

    assert report["commit"] == "abcd1234"
    assert len(report["current"]) == 1
    assert len(report["stale"]) == 1
    assert report["stale_bytes"] == len(b"stale")


def test_check_stale_passes_when_only_current_artifacts(diagnostic_dir: Path):
    (diagnostic_dir / "build-abcd1234.json").write_text("{}", encoding="utf-8")

    assert build.check_stale_diagnostic_artifacts(max_stale_bytes=0) == 0


def test_check_stale_fails_when_stale_bytes_exceed_threshold(diagnostic_dir: Path):
    (diagnostic_dir / "build-abcd1234.json").write_text("{}", encoding="utf-8")
    (diagnostic_dir / "build-old0001.logd").write_bytes(b"x" * 10)

    assert build.check_stale_diagnostic_artifacts(max_stale_bytes=0) == 1


def test_check_stale_respects_max_stale_bytes_threshold(diagnostic_dir: Path):
    (diagnostic_dir / "build-old0001.logd").write_bytes(b"x" * 10)

    assert build.check_stale_diagnostic_artifacts(max_stale_bytes=10) == 0
    assert build.check_stale_diagnostic_artifacts(max_stale_bytes=9) == 1


def test_retention_report_is_read_only(diagnostic_dir: Path):
    stale = diagnostic_dir / "build-old0001.json"
    stale.write_text('{"keep": true}', encoding="utf-8")

    build.diagnostic_retention_report()

    assert json.loads(stale.read_text(encoding="utf-8")) == {"keep": True}
