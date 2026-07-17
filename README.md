# DevOps Change Velocity Demo

A Node.js repo + two GitHub Actions workflows used to test **ServiceNow
DevOps Change Velocity**: pipeline visibility, security/quality scan
results, test result registration, artifact registration, and change
record creation with a realistic approval/scheduling gate before deploy.

## Architecture

Two separate workflows, deliberately decoupled:

### `ci-cd.yml` — validate + request change
Triggers on:
- **PR opened/updated targeting `main`** → validates, then creates a
  **Normal change** (pending approval) in ServiceNow. Pipeline ends here —
  it does **not** deploy.
- **push to `develop` or `feature/**`** → validates, then creates a
  **Standard change** (auto-closed) in ServiceNow. Pipeline ends here too.

```
build ──┬──▶ security-scan ──┐
         └──▶ sonar-scan ─────┼──▶ change-auto (push)         [ends here]
                              └──▶ change-manual (pull_request) [ends here]
```

### `deploy.yml` — deploy only once scheduled
Triggers on **PR merge to `main`**. Does not deploy blindly:

```
get-change ──▶ check-scheduled ──▶ deploy ──▶ close-change
```

1. **get-change** — looks up the change request tied to this build via
   `servicenow-devops-get-change`.
2. **check-scheduled** — queries the change request's actual `state` field
   directly via ServiceNow's Table API, and only proceeds if it's
   **Scheduled**. This is the real gate: an *approved* change isn't
   necessarily authorized to deploy yet — it also needs to have reached its
   scheduled change window.
3. **deploy** — simulated deploy step, only runs if step 2 passed.
4. **close-change** — updates and closes the change request via
   `servicenow-devops-update-change` once deploy succeeds.

This mirrors real change management: requesting/approving a change and
actually implementing it are separate events, deliberately not collapsed
into one pipeline run.

## Why this shape, not "create CR → wait inline → deploy"

An earlier version of this pipeline had the change-creation step poll
inline and deploy immediately on approval. That's unrealistic: approval
timing and change-window timing are different things in real change
management (a change can be approved Tuesday but scheduled for Thursday's
maintenance window), and tying a live GitHub Actions runner to an
indefinite human-approval wait is operationally fragile. Splitting into two
workflows, gated on PR events, fixes both problems.

## What each job does

| Workflow | Job | Purpose |
|---|---|---|
| ci-cd.yml | `build` | npm install, lint, unit tests + coverage, registers build artifact + test results in ServiceNow |
| ci-cd.yml | `security-scan` | Mock SAST scan (swap for a real tool later) |
| ci-cd.yml | `sonar-scan` | Real SonarCloud scan, registers quality gate/metrics in ServiceNow |
| ci-cd.yml | `change-auto` | Standard change, auto-closed — develop/feature branches |
| ci-cd.yml | `change-manual` | Normal change, pending approval — PRs to main |
| deploy.yml | `get-change` | Finds the change request tied to this build |
| deploy.yml | `check-scheduled` | Confirms change request state is Scheduled before allowing deploy |
| deploy.yml | `deploy` | Simulated deploy, gated on the above |
| deploy.yml | `close-change` | Closes the change request post-deploy |

## Required GitHub secrets

- `SN_DEVOPS_INTEGRATION_TOKEN` — REST API Key token (System Web Services >
  API Access Policies > REST API Key in ServiceNow). Token-based auth is
  used rather than username/password because SSO-enforced instances block
  basic-auth login for any user, including dedicated integration accounts.
- `SN_INSTANCE_URL` — e.g. `https://cppinvqa.service-now.com`
- `SN_ORCHESTRATION_TOOL_ID` — sys_id of the GitHub tool in DevOps > Tools
- `SONAR_TOKEN` — SonarCloud token
- `SONAR_HOST_URL` — `https://sonarcloud.io`

## Integration model notes

Pipeline/repo visibility (branches, commits, workflow runs showing up in
ServiceNow at all) comes from a **separate, pull-based mechanism**: a
classic PAT on a GitHub tool configured in DevOps > Tools, plus a GitHub
webhook pointed at ServiceNow. Nothing in these workflow files is required
for that — it's independent of everything below.

Change records, artifact registration, test results, and Sonar results all
use the **push model** instead: these workflows call directly into
ServiceNow via the `ServiceNow/servicenow-devops-*` GitHub Actions,
authenticating with the REST API Key token above.

## Known open items / things to verify

- **Change model / type compatibility**: creating a change request may fail
  with `"type compatibility property is disabled"` if your instance
  doesn't have a Change Model associated with this pipeline's step record
  in ServiceNow, or the `com.snc.change_management.change_model.type_compatibility`
  system property is off. This needs to be resolved on the ServiceNow side
  (either enable that property, or associate a Change Model with the
  pipeline step in DCV) — no field in these actions' payload can set the
  model directly based on their documented inputs.
- **"Scheduled" state value**: `check-scheduled` in deploy.yml currently
  checks for `state == "-1"`, which is a common OOTB ServiceNow default for
  Scheduled, but this is **not verified against your instance**. Confirm by
  opening an existing Scheduled change request and checking its real
  `state` field value before relying on this gate.
- **Sonar/test results linkage to the CR**: these are registered against
  the pipeline/job (via `job-name` matching), before the change request
  exists yet in the `sonar-scan`/`build` jobs. Whether ServiceNow correctly
  back-links this data onto the CR once it's created afterward hasn't been
  confirmed end-to-end — worth checking directly on a real CR record after
  a full run.
- **`servicenow-devops-change@v6.1.0`** — used because it's the version
  shown working in ServiceNow's own documentation examples; the repo's
  actual latest tag may be newer. If GitHub reports "version not found,"
  check the repo's releases page for the current tag.

## Local setup

```bash
npm install
npm test       # unit tests + coverage, also writes test-results/junit.xml
npm run lint   # eslint
npm start      # runs the app on :3000
```
