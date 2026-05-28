# Compact Context Pack: Notifications After Approval

Task: prepare implementation context for sending notifications after content
approval.

## Required Objects

- `pkg.content_workflow`: owns draft/review/approved/published states and
  records transition metadata.
- `feature.workflow_transition`: stores actor, timestamp, previous state, next
  state and reason.
- `pkg.audit_events`: stores append-only event records for workflow
  transitions.
- `constraint.audit_before_notify`: notification must wait until the triggering
  workflow event has been audited.
- `pkg.notification_delivery`: sends email/webhook messages for important
  workflow events.
- `feature.scoped_api_token`: delivery workers must use scoped tokens.
- `risk.duplicate_notifications`: retries must not duplicate notifications for
  the same transition.

## Implementation Boundary

Do not implement notification delivery as an isolated package decision. The
feature crosses content workflow, audit events and identity/access.

## Review Gates

- Audit persistence before notification enqueue.
- Scoped token usage for workers.
- Idempotency key or correlation identifier for retry handling.
