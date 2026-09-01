# Knowledge Assimilation

Status: Mirai 2.1 development contract.

Knowledge assimilation converts bounded sources into a graph proposal. It never copies all source content into the canonical graph and never chooses a source of truth silently.

```text
scan -> fingerprint -> extract candidates -> resolve identities
-> classify duplicates/conflicts -> assess quality -> proposal -> owner review
```

Reference 2.1 supports files and Git metadata. Secret-like paths, symlinks, oversized files and unsupported formats produce explicit diagnostics. Exact duplicates may be grouped automatically. Conflicting versions require owner review.

Every candidate assertion must retain source identity and fingerprint. Generated assertions, confidence scores and quality reports are evidence for review, not authority for canonical merge.
