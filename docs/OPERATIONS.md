# Operations Guide

## Build System

### Basic Commands

```bash
# Build all modules
python3 build.py

# Build specific module
python3 build.py -m backend
python3 build.py -m frontend,market

# Clean build artifacts
python3 build.py --clean

# Release build (Rust backend)
python3 build.py --release

# Verbose output
python3 build.py --verbose
```

### Stale Artifact Detection

The `--check-stale` flag enables CI gate mode to detect stale diagnostic artifacts from previous builds.

#### Usage

```bash
# Check for stale artifacts (default threshold: 0 bytes)
python3 build.py --check-stale

# Check with custom threshold (e.g., allow up to 1MB stale)
python3 build.py --check-stale --max-stale-bytes 1048576

# Clean stale artifacts
python3 build.py --clean
```

#### Exit Codes

- `0`: No stale artifacts found (or within threshold)
- `1`: Stale artifacts detected (exceeds threshold)

#### How It Works

1. Scans `diagnostic/` directory for build artifacts
2. Identifies artifacts from commits other than current HEAD
3. Ignores chunked files (e.g., `build-abc12345-part001.logd`)
4. Ignores metadata files (e.g., `build-abc12345-metadata.json`)
5. Counts total bytes of stale artifacts
6. Compares against `--max-stale-bytes` threshold
7. Returns exit code based on comparison

#### Example Output

**Clean state:**
```
✓ No stale diagnostic artifacts found
```

**Stale detected:**
```
✗ Stale diagnostic artifacts detected!
  33 files, 804838967 bytes
  Threshold: 0 bytes
  Run 'python3 build.py --clean' to remove stale artifacts
```

#### CI Integration

Add to CI pipeline to enforce clean state:

```yaml
- name: Check for stale artifacts
  run: python3 build.py --check-stale
```

### Diagnostic Artifacts

Build system generates diagnostic artifacts in `diagnostic/` directory:

- `build-{commit_id}.logd` - Encrypted build log
- `build-{commit_id}.json` - Build metadata
- `build-{commit_id}-part*.logd` - Chunked logs (if >40MB)

These artifacts are automatically committed to git for reproducibility.

## Testing

### Run Tests

```bash
# Run all tests
python3 -m pytest tests/

# Run specific test file
python3 -m pytest tests/test_check_stale.py

# Verbose output
python3 -m pytest tests/ -v
```

### Test Coverage

- `test_check_stale.py` - Tests for `--check-stale` flag functionality
  - No stale artifacts detection
  - Stale artifacts detection
  - Threshold validation
  - Chunked file handling
  - Metadata file handling
  - Mixed artifact scenarios

- `telemetry.test.ts` - Tests for frontend telemetry batch flush behavior
  - Module exports verification
  - Stats structure validation
  - Config properties check
  - Enable/disable toggle
  - Sample rate clamping (0-1)

## Frontend Telemetry

### Batch Flush Behavior

The telemetry service batches events and flushes them to the backend based on multiple triggers:

1. **Batch Size Threshold**: Flushes when queued events reach `batchSize` (default: 100)
2. **Flush Interval**: Periodic flush every `flushInterval` ms (default: 30000ms / 30s)
3. **Page Unload**: Flushes on `beforeunload` event using Beacon API
4. **Visibility Change**: Flushes when page becomes hidden

### Configuration

```typescript
interface TelemetryConfig {
  endpoint: string;        // Backend URL (from VITE_TELEMETRY_ENDPOINT)
  batchSize: number;       // Events per batch (default: 100)
  flushInterval: number;   // Flush interval in ms (default: 30000)
  maxRetries: number;      // Retry attempts on failure (default: 3)
  sampleRate: number;      // Event sampling rate 0-1 (default: 1.0)
  enabled: boolean;        // Enable/disable telemetry
  debug: boolean;          // Debug logging
}
```

### Running Telemetry Tests

```bash
# Run telemetry tests
npm run test:telemetry

# Or directly
node --experimental-strip-types --test src/services/telemetry.test.ts
```

### Stats & Monitoring

```typescript
import { getTelemetryStats } from './services/telemetry';

const stats = getTelemetryStats();
// {
//   queued: number,      // Events waiting to be sent
//   sent: number,        // Total events sent
//   dropped: number,     // Events dropped (queue full)
//   errors: number,      // Flush errors
//   sessionId: string,   // Current session ID
//   config: { ... }      // Current config
// }
```

## Troubleshooting

### Stale Artifacts Warning

If `--check-stale` fails:

1. Review stale artifacts:
   ```bash
   ls -lh diagnostic/
   ```

2. Clean stale artifacts:
   ```bash
   python3 build.py --clean
   ```

3. Rebuild:
   ```bash
   python3 build.py
   ```

### Build Failures

1. Check prerequisites:
   ```bash
   python3 build.py --list
   ```

2. Build specific module with verbose output:
   ```bash
   python3 build.py -m backend --verbose
   ```

3. Review diagnostic artifacts:
   ```bash
   cat diagnostic/build-*.json
   ```
