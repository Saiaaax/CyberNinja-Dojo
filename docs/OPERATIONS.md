## Telemetry Service

### Batch Flush Logic

The telemetry service batches events and flushes them under the following conditions:
- When the batch size exceeds 100 events.
- On page unload.

#### Tests

- **Flush Threshold**: Ensures that the flush method is called when the batch size exceeds 100 events.
- **Page Unload Trigger**: Verifies that the flush method is called when the `beforeunload` event is dispatched.
- **Partial Batch Preservation**: Confirms that partial batches are preserved after a flush.
- **Reset After Flush**: Checks that the batch is reset after a flush, allowing new events to be batched.
