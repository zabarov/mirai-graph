# Organization Governance

Status: alpha standard section

## Purpose

Organization governance extends GrowGraph from project-level coordination to
organization-level control. It describes how mission, strategy, portfolios,
departments, policies, decision rights, risks, metrics, feedback and Kaizen can
be connected without turning the graph into an unapproved command system.

## Model

```text
mission
-> strategy
-> portfolio
-> department/program/project
-> policy and decision rights
-> risk controls
-> evidence and metrics
-> feedback
-> kaizen proposal
-> governed update
```

The graph is the coordination surface. It records dependencies, boundaries and
evidence. It does not itself authorize organizational action.

## Core Concepts

- `mission`: durable reason for the organization to exist.
- `strategy`: selected direction for allocating attention and resources.
- `portfolio`: grouped initiatives, products, programs or projects.
- `department`: accountable organizational unit.
- `decision_right`: explicit owner of a decision class.
- `policy`: rule or constraint that governs decisions and actions.
- `risk`: possible organizational failure mode.
- `control`: preventive, detective or corrective measure.
- `metric`: signal used to review progress or risk.
- `feedback`: observed response from operations, users, teams or environment.
- `kaizen_item`: proposed process or governance improvement.

## Required Boundaries

Organization-governance graphs must preserve these boundaries:

- generated context is not canonical organizational state;
- evidence is not authorization;
- feedback is not an automatic policy update;
- readiness is not execution;
- decision rights must be explicit before policy or portfolio changes;
- high-impact changes require evidence and owner approval.

## Minimum Gates

- strategy alignment before portfolio change;
- decision-right review before policy change;
- risk-control review before cross-department action;
- evidence review before governance decision;
- Kaizen review before process promotion.

## Use Cases

- align projects with organization strategy;
- show which department owns which capability or policy;
- make decision rights and escalation paths explicit;
- connect risks to controls and evidence;
- route feedback into reviewed Kaizen items;
- prepare organization-level status or governance context packs.

## Non-Goals

This alpha section is not:

- a legal governance framework;
- a replacement for corporate bylaws, public law or audit requirements;
- proof that GrowGraph can govern a country-scale system;
- an autonomous management system.

## Example

See [Organization Governance Minimal](../examples/organization-governance-minimal/README.md).

