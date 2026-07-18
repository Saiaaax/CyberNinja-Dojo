## Build Commands

### General

```sh
python3 build.py  # Build all modules
python3 build.py --module backend,frontend  # Build specific modules
python3 build.py --release    # Release mode (Rust only)
```

### Stale Artifact Check

`--check-stale`: Checks for stale diagnostic artifacts and exits non-zero if any are found.

`--max-stale-bytes`: Maximum allowed bytes of stale diagnostic artifacts (default: 0).
