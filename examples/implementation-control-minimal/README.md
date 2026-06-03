# Minimal Implementation Control Example

Status: synthetic public example

## Purpose

This example demonstrates the `implementation_control` profile with a small
public-safe implementation loop.

It shows:

```text
baseline
-> projection view
-> semantic review
-> launch gate
-> workflow batch
-> evidence pack
-> sync proposal
-> approval gate
-> controlled update
-> drift check
-> kaizen item
```

`ready_to_execute` in this example means the batch passed its launch gate. It
does not mean that runtime work has already happened or that canonical state has
already changed.

The example is synthetic. It does not contain private project data, internal
paths, private execution logs or organization-specific policies.

## Validation

Run:

```bash
node packages/cli/validate-growgraph.js examples/implementation-control-minimal
```
