# Operations Guide

## Table of Contents

- [Telemetry Service](#telemetry-service)
  - [Batch Flush Behavior](#batch-flush-behavior)
  - [Flush Triggers](#flush-triggers)
  - [Threshold Behavior](#threshold-behavior)
  - [Partial Batch Preservation](#partial-batch-preservation)
  - [State After Flush](#state-after-flush)
  - [Running Telemetry Tests](#running-telemetry-tests)
- [Monitoring](#monitoring)
- [Incident Response](#incident-response)
- [Backup and Recovery](#backup-and-recovery)
- [Database Administration](#database-administration)
- [Capacity Planning](#capacity-planning)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

---

## Telemetry Service

The telemetry service (`frontend/src/services/telemetry.ts`) collects client-side events and batches them for efficient transmission to the telemetry backend.

### Batch Flush Behavior

The telemetry batch is flushed under three conditions:

1. **Batch Size Threshold** - When the event queue reaches the configured `batchSize` (default: 100 events), an automatic flush is triggered. This is the primary flush mechanism during normal operation.

2. **Page Unload** - When the user navigates away or closes the page, the `beforeunload` event triggers an immediate flush of any remaining events in the queue. This prevents data loss during session termination.

3. **Visibility Change** - When the page becomes hidden (`visibilityState === 'hidden'`), any queued events are flushed. This catches mobile tab switches and browser minimization.

### Flush Triggers

| Trigger | Condition | Behavior |
|---------|-----------|----------|
| Batch threshold | Queue size >= 100 events | Automatic flush of exactly 100 events |
| Page unload | `beforeunload` event fires | Flush all remaining events |
| Visibility hidden | `visibilitychange` to hidden | Flush all remaining events |

### Threshold Behavior

| Scenario | Queue Size | Action |
|----------|-----------|--------|
| Below threshold | 1-99 | Events accumulate in queue |
| At threshold | 100 | Immediate auto-flush |
| Above threshold | 101-199 | First 100 flushed, remainder (1-99) kept |
| Multiple thresholds | 200+ | Multiple 100-event flushes, remainder kept |

### Partial Batch Preservation

When a flush occurs, events are processed in FIFO (first-in-first-out) order:

- A batch of exactly `batchSize` events is extracted from the front of the queue
- These events are sent to the telemetry endpoint
- Any remaining events (fewer than `batchSize`) stay in the queue for the next flush cycle
- Event ordering is preserved across flushes

This ensures that:
- No events are lost during partial flushes
- Event ordering is maintained
- The system degrades gracefully under high load

### State After Flush

After a successful flush:

- **Event queue**: Cleared of the flushed batch
- **totalEventsSent**: Incremented by the number of events flushed
- **lastFlushTime**: Updated to the current timestamp
- **isFlushing**: Reset to `false`
- **retryCount**: Reset to 0

After a force flush (page unload):

- All remaining events are flushed, regardless of batch size
- The queue is completely emptied
- Stats are updated with the final event count

### Running Telemetry Tests

The telemetry flush behavior is covered by unit tests in `frontend/src/services/telemetry.test.ts`.

```bash
# Using vitest
npx vitest run frontend/src/services/telemetry.test.ts

# Or with coverage
npx vitest run --coverage frontend/src/services/telemetry.test.ts
```

Tests cover:
- Flush at threshold (100 events)
- No flush below threshold
- Multiple flushes for large batches
- Page unload flush behavior
- Partial batch preservation
- State reset after flush
- Edge cases (0 events, single event, boundary conditions)

---

## Monitoring

> WARNING: This operations guide section is a LEGACY document. It was last updated
> when the system was running on bare-metal servers in a colocation facility.
> The system has since been migrated to Kubernetes on AWS EKS. Some of the
> commands and procedures in this document are specific to the old infrastructure
> and will not work in the current environment. The Kubernetes-specific operations
> are documented in the internal wiki under "Kubernetes Operations."

### Health Check Endpoints

Each service exposes a health check endpoint:

| Service | Endpoint | Port |
|---------|----------|------|
| Backend API | `/health` | 8080 |
| Market Engine | `/health` | 8081 |
| Frailbox Runtime | `/health` | 8082 |
| Frontend | `/` | 3000 |

The health check returns a 200 OK response with a JSON body:

```json
{
  "status": "ok",
  "version": "3.2.0",
  "uptime_seconds": 86400,
  "timestamp": "2024-01-15T00:00:00Z"
}
```

### Prometheus Metrics

Each service exposes Prometheus metrics at `/metrics` on the same port as the
health check endpoint. The metrics are scraped by the Prometheus server every
15 seconds.

Key metrics to monitor:

| Metric | Type | Description | Warning Threshold | Critical Threshold |
|--------|------|-------------|-------------------|-------------------|
| `http_requests_total` | Counter | Total HTTP requests | - | - |
| `http_request_duration_ms` | Histogram | Request latency | p99 > 500ms | p99 > 2000ms |
| `http_errors_total` | Counter | HTTP error responses | > 1% of requests | > 5% of requests |
| `active_connections` | Gauge | Active connections | > 80% of max | > 95% of max |
| `memory_usage_bytes` | Gauge | Process memory | > 80% of limit | > 90% of limit |
| `cpu_usage_percent` | Gauge | CPU usage | > 70% | > 90% |
| `db_connection_pool_size` | Gauge | Database connections | > 80% of pool | > 95% of pool |
| `queue_depth` | Gauge | Message queue depth | > 1000 | > 10000 |
| `goroutine_count` | Gauge | Go routine count | > 5000 | > 10000 |
| `gc_pause_time_ms` | Histogram | GC pause time | > 100ms | > 500ms |

### Grafana Dashboards

Pre-built Grafana dashboards are available:

| Dashboard | Description | UID |
|-----------|-------------|-----|
| System Overview | CPU, memory, disk, network | `tot-system-overview` |
| API Performance | Request latency, throughput, errors | `tot-api-performance` |
| Market Data | Order book, trade volume, spread | `tot-market-data` |
| Business Metrics | Active users, trades, volume | `tot-business-metrics` |
| Service Health | Per-service health and dependencies | `tot-service-health` |

### Alerting Rules

Alerts are sent to PagerDuty and Slack (#ops-alerts channel).

| Alert | Condition | Severity | Response Time |
|-------|-----------|----------|---------------|
| ServiceDown | Health check fails for 1 minute | Critical | 5 minutes |
| HighLatency | p99 latency > 2s for 5 minutes | Warning | 15 minutes |
| HighErrorRate | Error rate > 5% for 5 minutes | Critical | 10 minutes |
| LowDiskSpace | Disk usage > 90% | Warning | 1 hour |
| HighMemory | Memory > 90% for 10 minutes | Warning | 15 minutes |
| CertificateExpiry | TLS cert expires in < 7 days | Warning | 24 hours |
| DBConnectionPool | Pool exhaustion risk | Critical | 10 minutes |
| QueueBacklog | Queue depth > 10000 for 5 minutes | Warning | 15 minutes |

## Incident Response

### Severity Levels

| Level | Description | Examples | Response Time |
|-------|-------------|----------|---------------|
| SEV1 | Complete service outage | All users affected, data loss | Immediate |
| SEV2 | Major feature degradation | Core trading affected | 15 minutes |
| SEV3 | Minor feature degradation | Non-critical feature broken | 1 hour |
| SEV4 | Cosmetic issue | UI bug, typo | Next business day |

### Runbooks

Runbooks are maintained in the internal wiki under "Operations Runbooks."

Key runbooks:

- **Service Recovery**: Steps to restart and verify a failed service
- **Database Failover**: Steps to promote a replica to primary
- **Data Recovery**: Steps to restore from backup
- **Certificate Rotation**: Steps to update TLS certificates
- **Capacity Scaling**: Steps to scale services horizontally
- **Incident Post-Mortem**: Template for post-incident analysis

### Communication

During an incident, use the following channels:

| Channel | Purpose |
|---------|---------|
| `#ops-alerts` | Automated alerts from monitoring |
| `#ops-incident` | Real-time incident coordination |
| `#ops-postmortem` | Post-incident discussion |
| PagerDuty | On-call engineer notification |
| Email | Stakeholder updates (SEV1 only) |

## Backup and Recovery

### Backup Schedule

| Data | Frequency | Retention | Type |
|------|-----------|-----------|------|
| PostgreSQL | Daily | 30 days | Full dump |
| PostgreSQL WAL | Continuous | 7 days | WAL archive |
| Redis snapshot | Every 6 hours | 7 days | RDB file |
| Application logs | Daily | 90 days | Compressed archive |
| Configuration | Per change | 90 days | Git history |
| TLS certificates | Per change | 3 years | Encrypted backup |

### Recovery Procedure

1. Identify the recovery point (time or transaction ID)
2. Stop all services that write to the database
3. Restore the database from the backup
4. Verify data integrity
5. Resume services
6. Verify application functionality

## Database Administration

### Connection Pool Configuration

| Service | Min Connections | Max Connections | Timeout |
|---------|---------------|----------------|---------|
| Backend API | 10 | 50 | 30s |
| Market Engine | 5 | 20 | 10s |
| Frailbox | 2 | 10 | 30s |
| Admin tools | 1 | 5 | 60s |

## Capacity Planning

### Resource Utilization

| Resource | Total | Used | Available | Trend |
|----------|-------|------|-----------|-------|
| CPU (cores) | 64 | 32 | 32 | Stable |
| Memory (GB) | 256 | 144 | 112 | Growing +5%/month |
| Disk (TB) | 5 | 2.4 | 2.6 | Growing +3%/month |
| Network (Gbps) | 10 | 3.2 | 6.8 | Stable |
| DB Storage (TB) | 1.5 | 0.8 | 0.7 | Growing +8%/month |

## Security

### Access Control

| Role | Access Level | MFA Required | Approval Required |
|------|-------------|--------------|-------------------|
| Admin | Full | Yes | N/A |
| Developer | Read-write (non-prod) | Yes | Manager |
| Operator | Read-write (prod) | Yes | Team lead |
| Viewer | Read-only | No | N/A |

### Audit Logs

Audit logs are retained for 365 days and include:

- All authentication attempts
- All configuration changes
- All permission changes
- All data access (for GDPR compliance)
- All deployment events
- All backup and restore operations

## Troubleshooting

### Common Issues

**Service won't start**
1. Check logs: `kubectl logs -n tent-production deployment/backend-api`
2. Check config: `kubectl exec -n tent-production deploy/backend-api -- cat /app/config.yaml`
3. Check database connectivity: `kubectl exec -n tent-production deploy/backend-api -- nc -zv postgresql 5432`
4. Check resource limits: `kubectl describe pod -n tent-production -l app=backend-api`

**High latency**
1. Check database query performance: `SELECT * FROM pg_stat_activity WHERE state = 'active'`
2. Check connection pool utilization
3. Check for slow external API calls
4. Check garbage collection metrics

**Memory leak**
1. Capture heap dump: `kubectl exec -n tent-production deploy/backend-api -- kill -3 1`
2. Analyze heap dump with your preferred tool
3. Check for unclosed connections or goroutine leaks
4. Review recent code changes

**Database connection exhaustion**
1. Find idle connections: `SELECT pid, state, query_start FROM pg_stat_activity ORDER BY query_start`
2. Kill long-running queries: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '30 minutes'`
3. Check application connection pool settings
