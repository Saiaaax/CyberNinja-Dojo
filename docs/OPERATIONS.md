# Operations

This document tracks operational behavior and runtime characteristics of the
platform's services, including telemetry, batching, and flush behavior.

## Telemetry Batch Flush Behavior

The frontend telemetry service (`frontend/src/services/telemetry.ts`) batches
client-side analytics events in memory before sending them to the backend.
This section documents the flush behavior that is covered by automated tests
in `frontend/src/services/telemetry.test.ts`.

### Flush triggers

- **Threshold flush**: When the in-memory batch reaches `FLUSH_THRESHOLD`
  (100 events), the service automatically flushes the batch via `fetch` to
  the telemetry ingestion endpoint. The queue is cleared immediately after a
  successful flush.
- **Page unload flush**: On the `beforeunload` window event, any pending
  (partial) batch is flushed using `navigator.sendBeacon` to guarantee
  delivery even as the page is being torn down. This avoids losing events
  that haven't yet reached the size threshold.

### Partial batch preservation

If fewer than 100 events have been queued, the service does **not** flush
automatically. Events remain buffered in memory until either the threshold
is reached or the page unloads. This is verified by the
"preserves a partial batch below the flush threshold" test.

### Reset after flush

After any successful flush (threshold-triggered or unload-triggered), the
internal event queue is reset to an empty array. Subsequent `track()` calls
start a new batch rather than appending to previously-flushed data. This is
verified by the "resets the queue after a flush completes" test.

### Test coverage summary

| Behavior                                 | Test                                                        |
|-------------------------------------------|--------------------------------------------------------------|
| Flush at 100 events                       | `flushes automatically once the batch reaches the 100-event threshold` |
| Flush on page unload                      | `flushes the current batch when the page unload event fires` |
| Partial batch preserved below threshold   | `preserves a partial batch below the flush threshold`         |
| Queue reset after flush                   | `resets the queue after a flush completes`                    |

These tests run entirely in-memory using mocked `fetch` and
`navigator.sendBeacon` implementations and do not require any external
services or network access.
