import build


def write_artifact(path, size):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"x" * size)
    return path


def test_stale_diagnostic_artifacts_empty_directory(tmp_path):
    assert build.stale_diagnostic_artifacts("12345678", tmp_path) == []
    assert build.stale_diagnostic_bytes([]) == 0


def test_current_commit_logd_and_json_are_not_stale(tmp_path):
    write_artifact(tmp_path / "build-12345678.logd", 10)
    write_artifact(tmp_path / "build-12345678.json", 20)

    assert build.stale_diagnostic_artifacts("12345678", tmp_path) == []


def test_other_commit_artifacts_are_stale(tmp_path):
    stale_log = write_artifact(tmp_path / "build-aaaaaaaa.logd", 10)
    stale_json = write_artifact(tmp_path / "build-aaaaaaaa.json", 20)
    write_artifact(tmp_path / "build-12345678.logd", 30)

    assert set(build.stale_diagnostic_artifacts("12345678", tmp_path)) == {
        stale_log,
        stale_json,
    }
    assert build.stale_diagnostic_bytes([stale_log, stale_json]) == 30


def test_current_commit_chunked_logd_parts_are_not_stale(tmp_path):
    write_artifact(tmp_path / "build-12345678-part001.logd", 10)
    stale_chunk = write_artifact(tmp_path / "build-aaaaaaaa-part001.logd", 20)

    assert build.stale_diagnostic_artifacts("12345678", tmp_path) == [stale_chunk]


def test_non_diagnostic_files_are_ignored(tmp_path):
    write_artifact(tmp_path / "notes.txt", 10)
    write_artifact(tmp_path / "build-notasha.logd", 10)

    assert build.diagnostic_artifact_paths(tmp_path) == []


def test_stub_diagnostic_artifacts_are_not_stale(tmp_path):
    write_artifact(tmp_path / "build-00000000.logd", 10)
    write_artifact(tmp_path / "build-00000000.json", 20)
    write_artifact(tmp_path / "build-00000000-metadata.json", 30)

    assert build.stale_diagnostic_artifacts("12345678", tmp_path) == []


def test_legacy_metadata_json_is_supported(tmp_path):
    stale_metadata = write_artifact(tmp_path / "build-aaaaaaaa-metadata.json", 20)

    assert build.stale_diagnostic_artifacts("12345678", tmp_path) == [stale_metadata]


def test_check_stale_threshold_allows_small_stale_artifacts(tmp_path):
    stale_log = write_artifact(tmp_path / "build-aaaaaaaa.logd", 10)
    stale_artifacts = build.stale_diagnostic_artifacts("12345678", tmp_path)

    assert stale_artifacts == [stale_log]
    assert build.stale_diagnostic_bytes(stale_artifacts) <= 10
