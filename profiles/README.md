# Mirai Graph Profiles

Profiles adapt Mirai Graph to a domain without changing the core standard.
Use [Profile Boundaries](../standard/profile-boundaries.md) before adding a new
profile: most new ideas should become an extension, validator, example or
proposal before they become another profile.

Current release-candidate profiles:

- [software-specification](software-specification/README.md)
- [project-management](project-management/README.md)
- [ai-employee](ai-employee/README.md)
- [character-layer](character-layer/README.md)
- [skill-runtime](skill-runtime/README.md)
- [implementation-control](implementation-control/README.md)
- [organization-governance](organization-governance/README.md)

Proposal/experimental profile:

- [societal-governance](societal-governance/README.md)

Each release-candidate profile declares allowed object kinds, relation types,
default readiness and governance gates. Proposal/experimental profiles are
public-safe exploration surfaces and are not core `1.0.0-rc.1` conformance
requirements.

Executable profile examples and anti-examples are documented in
[Profile Conformance Fixtures](../docs/adoption/profile-conformance-fixtures.md).
