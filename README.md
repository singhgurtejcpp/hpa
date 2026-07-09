# DevOps Change Velocity Demo

A minimal Node.js repo + GitHub Actions pipeline built to exercise **ServiceNow
DevOps Change Velocity**: pipeline visibility, security scan results,
SonarQube results, and automated vs. manually-approved change records.

## What the pipeline does

```
build ──┬──▶ security-scan ──┐
         └──▶ sonar-scan ─────┼──▶ change-auto (non-main branches)  ──▶ deploy
                              └──▶ change-manual (main branch, needs approval) ──▶ deploy
```

| Job              | Purpose                                                        |
|------------------|-----------------------------------------------------------------|
| `build`          | npm install, lint, unit tests + coverage, registers artifact in ServiceNow |
| `security-scan`  | Mock SAST scan today (swap for a real tool later), sends results to ServiceNow |
| `sonar-scan`     | Real SonarCloud/SonarQube scanner if `SONAR_TOKEN` is set, otherwise a mock result — either way sends results to ServiceNow |
| `change-auto`    | Runs on `develop`/`feature/*` — creates a **standard change**, auto-closed, no approval needed |
| `change-manual`  | Runs on `main` — creates a **normal change** and the workflow **pauses until it's approved** in ServiceNow |
| `deploy`         | Simulated deploy step, runs once the relevant change gate passes |

## Required GitHub secrets

You said your `sn_devops` integration (token, tool ID, instance URL) is already
configured. Confirm these secret names match what your workflow expects
(Settings → Secrets and variables → Actions):

- `SN_DEVOPS_INTEGRATION_TOKEN`
- `SN_INSTANCE_URL`
- `SN_ORCHESTRATION_TOOL_ID`

Optional, for real SonarQube/SonarCloud scanning (leave unset to keep using
the mock path):

- `SONAR_TOKEN`
- `SONAR_HOST_URL` (e.g. `https://sonarcloud.io`)

## Branch strategy used by this pipeline

- `feature/**`, `develop` → **standard change**, auto-created and auto-closed.
  Good for testing that ServiceNow ingests pipeline runs and creates change
  records without any human in the loop.
- `main` → **normal change**, created but left in a state requiring approval.
  The `servicenow-devops-change` action polls and the GitHub Actions job will
  sit "in progress" until someone approves (or rejects) the change in
  ServiceNow. This is what you'd use to test change gating / approval
  workflows.

## Local setup

```bash
npm install
npm test       # unit tests + coverage
npm run lint   # eslint
npm start      # runs the app on :3000
```

## Things worth testing once this is running

Beyond the 3 you listed (pipelines visible, security checks, change
records), a few things that are easy to break and worth checking on the
ServiceNow side:

1. **Pipeline job/stage names match `job-name` in the workflow** — ServiceNow
   correlates by this string, so renaming a job in YAML without updating
   ServiceNow config silently breaks correlation.
2. **Change gating / policies** — try setting a change policy in ServiceNow
   that blocks deploy if the security scan has any "high" or "critical"
   findings, then intentionally push a build where the mock scan reports a
   high finding, and confirm the pipeline is actually blocked.
3. **Rejected change path** — reject a normal change on `main` once and
   confirm the GitHub Actions job fails/stops rather than silently
   continuing to deploy.
4. **Multiple concurrent runs** — push to two branches close together and
   confirm ServiceNow correlates each pipeline execution to the right change
   record (build number / run number based correlation is where this
   usually goes wrong).
5. **Artifact + package registration → change record linkage** — confirm the
   registered artifact actually shows up as related to the change record,
   not just floating independently.
6. **Freeze windows** — if you use change freeze/blackout windows in
   ServiceNow, test a deploy attempt during one and confirm it's blocked.
7. **Re-run/retry semantics** — re-run a failed GitHub Actions job and check
   whether ServiceNow creates a duplicate change or correctly reuses/updates
   the existing one (`attempt_number` in `get-change` is meant for this).
8. **DORA-style metrics** — Change Velocity surfaces lead time / deployment
   frequency; run a handful of pushes over a day or two so you have enough
   data points to sanity check those numbers, not just single runs.

## Notes

- The security scan and, until you set `SONAR_TOKEN`/`SONAR_HOST_URL`, the
  Sonar scan are **mocked**. The ServiceNow-facing steps that send results
  (`servicenow-devops-security-result`, `servicenow-devops-sonar`) are real
  and wired up correctly — only the upstream scan producing the data is
  fake. Swapping in a real scanner later shouldn't require changing the
  ServiceNow-facing steps.
- Action versions pinned (`@v6.1.0` etc.) reflect current major versions as
  of writing — check the [ServiceNow GitHub org](https://github.com/ServiceNow)
  for newer releases if something doesn't work as expected.
- No cloud provider (AWS/Azure/GCP) is used anywhere — `deploy` is a shell
  echo you can replace with whatever you actually want to test against.
