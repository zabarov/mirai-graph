# Audit Events Package

The audit package stores append-only events for security-relevant actions and
workflow transitions. Events must include actor identity, action type, target
object and correlation identifier.

Open issue: audit records should be queryable by administrators without
exposing private draft content.
