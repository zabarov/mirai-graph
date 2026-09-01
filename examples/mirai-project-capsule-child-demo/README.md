# Robot Prepares a Child for a Walk

This synthetic Project Capsule explains Mirai in a form suitable for children.
The robot must prepare a child for a walk, but it cannot follow one fixed list:
weather, temperature and adult permission change what is safe.

The graph connects the goal, context, checks, decisions and safety gate. The
weather and permission checks can run in parallel. The final decision is
allowed only when both results are available:

```text
request to go outside
-> check weather || check adult permission
-> choose clothes from the observed context
-> require permission and safe clothing
-> allow the walk or explain why it is blocked
```

This is not an autonomous permission system. The graph describes the governed
decision; the adult remains the authority.

```bash
mirai project validate examples/mirai-project-capsule-child-demo
mirai project inspect examples/mirai-project-capsule-child-demo \
  --for-agent --task "prepare the child for a walk"
```
