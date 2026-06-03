# Organization Governance Profile

Status: alpha profile

The organization-governance profile models how an organization coordinates
mission, strategy, departments, portfolios, projects, policies, decision rights,
risks, evidence, feedback and improvement.

It is broader than `project-management`, but it does not replace operational,
legal, financial or domain-specific governance systems. GrowGraph provides the
graph contract and validation surface for connecting them.

## Typical Objects

- `organization`
- `mission`
- `strategy`
- `portfolio`
- `department`
- `program`
- `project`
- `objective`
- `policy`
- `decision_right`
- `governance_gate`
- `risk`
- `control`
- `metric`
- `feedback`
- `kaizen_item`
- `evidence`

## Typical Relations

- `aligns_with`
- `owns`
- `belongs_to`
- `governs`
- `requires_approval`
- `controls`
- `mitigates`
- `measures`
- `supports`
- `escalates_to`
- `produces_feedback`
- `improves`
- `evidences`

## Boundaries

- Readiness is not execution.
- Evidence is not authorization.
- Feedback is not an automatic policy or process update.
- Generated context is not canonical organizational state.
- Country-scale or public-sector governance requires additional law, audit,
  accountability and public legitimacy layers outside this alpha profile.

## Example

See [Organization Governance Minimal](../../examples/organization-governance-minimal/README.md).

