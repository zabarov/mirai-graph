# Pilot Report: Research Program

Status: public-safe alpha pilot

## Question

Can Mirai Graph model a research-program workflow with evidence, limitations,
publication gates and anti-overclaiming controls?

## Setup

The pilot uses a synthetic research program for evaluating graph-assisted work.
The graph connects:

- research system and goal;
- baseline protocol task;
- synthetic result evidence;
- overclaiming risk;
- claim-limiting decision;
- publication claim review gate;
- preprint readiness milestone.

## Result

The package validates against the public `project_management` profile. The graph
shows how a research workflow can keep evidence, risks, limitations and
publication gates explicit without claiming that synthetic evidence is
peer-reviewed proof.

## Evidence Boundary

This pilot demonstrates public profile applicability and validation shape. It
does not claim scientific effectiveness, external validity, publication
acceptance or peer-reviewed proof.

## Reproducibility

```bash
node packages/cli/validate-mirai-graph.js seed pilots/independent-implementation-004-research-program/graph-seed.json
node packages/cli/validate-mirai-graph.js pilots/independent-implementation-004-research-program
node packages/cli/validate-mirai-graph.js --markdown pilots/independent-implementation-004-research-program
```

## Limitations

- The scenario is synthetic.
- No private research materials are included.
- The example models research-program control, not detailed scientific method.
- Evidence remains bounded and does not authorize broad claims.

