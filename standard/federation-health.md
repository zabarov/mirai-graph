# Federation Health

Status: alpha standard section

## Purpose

Federation health summarizes whether a graph-managed federation is routable,
explainable and safe to use as a context/control layer.

## Health Signals

A health dashboard should include:

- skill or capability count;
- runtime-ready count;
- stale graph count;
- watch conflict count;
- unresolved conflict count;
- failed fixture count;
- high-risk routes without explanation;
- fallback-required route count;
- blocked route count;
- route regression status;
- pending learning proposals;
- conflict details with severity and next action.

## Conflict Details

Counts are not enough. A useful dashboard should identify:

- conflict family id;
- affected capabilities;
- failed fixture ids;
- latest route explanation references;
- required owner review;
- next action;
- severity.

## Boundary

Health dashboards are evidence and control surfaces. They do not grant runtime
authorization or canonical write permission.
