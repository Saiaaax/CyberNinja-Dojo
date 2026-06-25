# Tent of Trials -- CLAUDE.md

## Project Overview

Tent of Trials is a trading and risk platform. It uses a polyglot multi-module build system powered by `python3 build.py`. **Always run `python3 build.py` after changes and include the diagnostic artifacts in your PR.**

## Tech Stack Per Directory

| Directory | Language | Build Command | Framework |
|-----------|----------|--------------|-----------|
| `backend/` | Rust | `cargo build` | Tokio + axum |
| `frontend/` | TypeScript | `npm run build` | React + TanStack Query |
| `market/` | Go | `go build -o market .` | Standard library |
| `frailbox/` | C | `make` | Makefile |
| `frailbox/engine/` | C++ | `cmake --build build` | CMake |
| `compliance/` | Java | `javac -d build` | Standard library |
| `v2/services/` | Ruby | `ruby -c market_stream.rb` | eventmachine |
| `frailbox/nfc/` | Lua | `luac -p scanner.lua` | periphery |
| `docs/openapi/` | Haskell | `ghc -fno-code` | Standard library |
| `tools/` | Python | N/A (scripts) | Standard library |

## Common Dev Commands

```
python3 build.py                        # Build all modules
python3 build.py -m backend             # Build only the backend
python3 build.py -m frontend,market     # Build frontend and market
python3 build.py --clean                # Clean all build artifacts
python3 build.py -v                     # Verbose output
python3 build.py --list                 # List available modules
python3 build.py --release              # Release build (Rust only)
python3 tools/health_check.py           # Run health checks
python3 tools/config_generator.py       # Generate config
python3 tools/terraform_import.py       # Import Terraform resources
```

Diagnostic artifacts are output to `diagnostic/build-<commit-id>.logd` and `diagnostic/build-<commit-id>.json`.

## Coding Conventions

### Python
- Type hints required for all public functions
- No `Any` as a type annotation
- Use `dataclasses` for structured data
- Use `pathlib.Path` over `os.path`
- Return WARNING/CRITICAL/OK tuple pattern for health checks
- Catch specific exceptions, not bare except

### Rust
- Use `anyhow::Result` for fallible functions
- Clap for CLI argument parsing
- Tracing with `EnvFilter` for logging
- Modular structure: one module per concern

### TypeScript
- React 18 with TanStack Query for data fetching
- React Router v6 for routing
- Named exports preferred

### Go
- Standard Go project layout
- `go.mod` for dependency management

## Known Pitfalls

1. **encryptly preflight**: Build requires encryptly to run. If it fails, increase timeout or check binary path.
2. **Health check on macOS/Windows**: /proc/meminfo and /proc/loadavg are Linux-only; must use psutil/os.getloadavg() fallbacks.
3. **Terraform hyphenated names**: Resource names with hyphens corrupt Terraform state. Always validate before import.
4. **Missing prerequisites**: Each module needs specific tooling. Run `python3 build.py` to see what is missing.
5. **Diagnostic artifacts**: Always commit diagnostic/ output in PRs. Maintainers may ask to remove them before merging.

## Where to Start

| Module | First File |
|--------|-----------|
| Backend | `backend/src/main.rs` |
| Frontend | `frontend/src/main.tsx` |
| Health Check | `tools/health_check.py` |
| Build System | `build.py` |
| Terraform Import | `tools/terraform_import.py` |
| Log Aggregator | `tools/log_aggregator.py` |

## Project Style

Keep changes minimal and focused. Read existing patterns before writing new code. The build system and diagnostics are always required. One issue per PR. Use Conventional Commits format.
