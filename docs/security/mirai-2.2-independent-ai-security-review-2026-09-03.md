# Mirai 2.2 Independent Source-Security Review

Status: security subgate passed with nonblocking findings; release gates remain.

The [structured result](mirai-2.2-independent-ai-security-review-2026-09-03.json)
records an isolated AI-assisted review, not an external human audit. At exact
revision `eeb048121da54123566bc73f9024f37f8ddd688e`, the final reviewer found no
unresolved Critical/High finding. The earlier source review ran 26 focused
tests and 10 independent probes; the final delta ran both review profiles,
five self-tests per profile, 19 pilot negatives and six technology tests.

The final review independently established that the source implementations and
schemas were unchanged from the earlier source review. The reviewed 2.1 core
trees are unchanged from `c946d7306099ae03f71cc46f72bcba981e8da03a`.

## Nonblocking Findings

- Medium SEC-204: separate post-open path and inode checks cannot prove atomic
  confinement against repeated concurrent ancestor changes. Use access-controlled
  source trees or immutable snapshots.
- Low SEC-205: the direct compiler does not interpret one discovery-specific
  qualification diagnostic; existing qualification/effect guards still block
  the probed unprepared draft. No authority bypass was reproduced.

The [review-method decision](mirai-2.2-independent-review-method-decision-2026-09-03.json)
records the owner's accepted AI-assisted review method, not deployment or
publication authority. The [2.1 core review](mirai-independent-ai-security-review-2026-09-02.json)
remains historical evidence for the unchanged inherited core.

The full release is still blocked until public conformance, cross-platform CI
and publication gates pass. No production-write permission is conveyed.
