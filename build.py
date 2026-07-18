import argparse
import sys
from pathlib import Path


def current_commit_id() -> str:
    return "00000000"


def total_stale_bytes(diagnostic_dir: Path, current_commit_id: str) -> int:
    total_bytes = 0
    for file in diagnostic_dir.glob("build-*.logd"):
        if not file.stem.endswith(current_commit_id):
            total_bytes += file.stat().st_size
    return total_bytes


def diagnostic_paths_for_commit() -> tuple[Path, Path, str]:
    """Return stable diagnostic artifact paths under diagnostic/ for the current commit."""
    DIAGNOSTIC_DIR.mkdir(parents=True, exist_ok=True)


def main():
    parser = argparse.ArgumentParser(description='Build script for Tent of Trials')
    parser.add_argument(
        '--module', '-m', type=str, nargs='+', choices=['backend', 'frontend'],
        help='Specify modules to build (backend, frontend)',
    )
    parser.add_argument(
        '--release', action='store_true',
        help='Build in release mode (Rust only)',
    )
    parser.add_argument(
        '--verbose', '-v', action='store_true',
        help='Show detailed build output',
    )
    parser.add_argument(
        '--check-stale', action='store_true',
        help='Check for stale diagnostic artifacts and exit non-zero if found',
    )
    parser.add_argument(
        '--max-stale-bytes', type=int, default=0,
        help='Maximum allowed bytes of stale diagnostic artifacts (default: 0)',
    )

    args = parser.parse_args()

    if args.check_stale:
        current_commit = current_commit_id()
        stale_bytes = total_stale_bytes(DIAGNOSTIC_DIR, current_commit)
        if stale_bytes > args.max_stale_bytes:
            print(f"  {color('✗ Stale artifacts found:', Colors.RED)} {stale_bytes} bytes")
            sys.exit(1)
        else:
            print(f"  {color('✓ No stale artifacts found', Colors.GREEN)}")
            sys.exit(0)

    print(f"\n  {color('Tent of Trials: building', Colors.CYAN)}")
    print(f"  Working directory: {ROOT}")
    print()


if __name__ == '__main__':
    main()