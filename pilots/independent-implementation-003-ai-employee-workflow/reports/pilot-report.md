# Pilot Report: AI Employee Workflow

Status: public-safe alpha pilot

## Question

Can GrowGraph represent an AI employee workflow as an executable governance
surface rather than a prompt-only agent description?

## Setup

The pilot uses a synthetic customer-support triage assistant. The graph connects:

- AI employee and department;
- role and skill;
- knowledge and reviewed memory;
- tool and capability;
- proposed action and approval gate;
- audited result, feedback and lesson proposal;
- optional federation endpoint.

## Result

The package validates against the public `ai_employee` profile. The graph keeps
the action/runtime boundary explicit: the assistant may prepare a proposed
customer response, but the graph does not treat that proposal as an executed
action.

## Evidence Boundary

This pilot demonstrates public profile applicability and validation shape. It
does not claim production safety, customer-support quality, model accuracy or
peer-reviewed effectiveness.

## Reproducibility

```bash
node packages/cli/validate-growgraph.js seed pilots/independent-implementation-003-ai-employee-workflow/graph-seed.json
node packages/cli/validate-growgraph.js pilots/independent-implementation-003-ai-employee-workflow
node packages/cli/validate-growgraph.js --markdown pilots/independent-implementation-003-ai-employee-workflow
```

## Limitations

- The scenario is synthetic.
- No real customer tickets or runtime traces are included.
- The current CLI checks conformance and boundaries, not runtime behavior.
- Feedback remains a proposal source and does not authorize canonical update.

