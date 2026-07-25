import pytest
import sys
import os
import tempfile
import shutil
from pathlib import Path

# Ensure build.py is importable from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import build as build_module


@pytest.fixture()
def tmp_diag(tmp_path):
    orig = build_module.DIAGNOSTIC_DIR
    build_module.DIAGNOSTIC_DIR = tmp_path
    yield tmp_path
    build_module.DIAGNOSTIC_DIR = orig


def test_check_stale_exits_zero_when_empty(tmp_diag):
    rc = build_module.do_check_stale(current_commit='abcd1234', max_stale_bytes=0)
    assert rc == 0


def test_check_stale_exits_one_with_stale(tmp_diag):
    (tmp_diag / 'build-deadbeef.logd').write_text('stale-logd')
    (tmp_diag / 'build-deadbeef.json').write_text('{}')
    rc = build_module.do_check_stale(current_commit='abcd1234', max_stale_bytes=0)
    assert rc == 1


def test_check_stale_respects_max_stale_bytes(tmp_diag):
    (tmp_diag / 'build-deadbeef.logd').write_text('x' * 1024)
    rc = build_module.do_check_stale(current_commit='abcd1234', max_stale_bytes=1024)
    assert rc == 0


def test_check_stale_ignores_current_commit(tmp_diag):
    (tmp_diag / 'build-abcd1234.logd').write_text('current')
    (tmp_diag / 'build-deadbeef.logd').write_text('stale')
    rc = build_module.do_check_stale(current_commit='abcd1234', max_stale_bytes=0)
    assert rc == 1
