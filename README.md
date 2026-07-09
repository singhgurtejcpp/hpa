# DevOps Change Velocity Demo

A minimal Node.js repo + GitHub Actions pipeline used to test **ServiceNow
DevOps Change Velocity** pipeline visibility.

## Integration model: pull, not push

This repo assumes ServiceNow is configured to **pull** data from GitHub —
i.e. you have a GitHub tool set up in ServiceNow, authenticated with a
classic Personal Access Token, and ServiceNow polls GitHub's API on its own
schedule discover repos, branches, commits, and workflow runs.

Because of that, **this workflow has no ServiceNow-facing steps and needs no
GitHub secrets.** It's a plain CI pipeline. ServiceNow does the work of
noticing it exists and pulling in its run history.

This is different from the **push** model, where GitHub Actions actively
calls into ServiceNow (via the `ServiceNow/servicenow-devops-*` custom
Actions) to create change records or attach security/Sonar results in real
time. That model needs its own GitHub secrets
(`SN_DEVOPS_INTEGRATION_TOKEN`, `SN_INSTANCE_URL`,
`SN_ORCHESTRATION_TOOL_ID`) that authenticate GitHub *to* ServiceNow — the
reverse direction of the PAT you already set up. This repo intentionally
does not use that model yet.

## What the pipeline does

```
build ──▶ security-scan ──┐
       └──▶ sonar-scan ────┼──▶ deploy
```

| Job              | Purpose                                                        |
|------------------|-----------------------------------------------------------------|
| `build`          | npm install, lint, unit tests + coverage                        |
| `security-scan`  | Mock SAST scan (swap for a real tool later)                     |
| `sonar-scan`     | Real SonarCloud/SonarQube scanner if `SONAR_TOKEN` is set, otherwise a mock result |
| `deploy`         | Simulated deploy step                                            |

## Required GitHub secrets

**None**, by design — see above. If you later set up SonarCloud, add:

- `SONAR_TOKEN`
- `SONAR_HOST_URL` (e.g. `https://sonarcloud.io`)

## Local setup

```bash
npm install
npm test       # unit tests + coverage
npm run lint   # eslint
npm start      # runs the app on :3000
```

## Checklist for confirming pipeline visibility in ServiceNow

Since correlation here depends entirely on ServiceNow's discovery/polling
of GitHub, these are the things most likely to trip up a "why isn't
anything showing up" moment:

1. **Repo is actually added under the GitHub tool in ServiceNow.** Having
   the PAT configured at the tool level doesn't automatically discover
   every repo the PAT has access to — check whether there's an explicit
   "discover" or "import repository" step you still need to run.
2. **Polling interval.** Pull-based discovery is not instant. Don't expect
   a push to `main` to show up within seconds — check what interval
   ServiceNow is configured to poll on.
3. **Scope of what's pulled.** Confirm your plugin version surfaces GitHub
   *Actions workflow runs* specifically, not just commits and pull
   requests — this varies by ServiceNow DevOps Change Velocity plugin
   version.
4. **PAT scope/expiry.** Classic PATs need `repo` and `workflow` scopes at
   minimum to see Actions runs; also check the PAT hasn't hit its expiry
   date.
5. **Branch coverage.** Confirm ServiceNow is configured to track the
   branches you're pushing to (`main`, `develop`, `feature/*`) — some tool
   configs restrict discovery to specific branches.
6. **Multiple concurrent runs.** Push to two branches close together and
   confirm ServiceNow's pipeline view correctly distinguishes each run
   rather than merging or dropping one.

## If you later want to add security checks / change records as real ServiceNow records

That requires switching on the push model described above. At a high
level: add `SN_DEVOPS_INTEGRATION_TOKEN`, `SN_INSTANCE_URL`, and
`SN_ORCHESTRATION_TOOL_ID` as GitHub secrets (values come from the
ServiceNow-side DevOps tool config, not your PAT), then add
`ServiceNow/servicenow-devops-security-result`,
`ServiceNow/servicenow-devops-sonar`, and `ServiceNow/servicenow-devops-change`
steps to the relevant jobs. Happy to build that out when you're ready —
it's a bigger change than this pull-only setup.

## Notes

- No cloud provider (AWS/Azure/GCP) is used anywhere — `deploy` is a shell
  echo you can replace with whatever you actually want to test against.
- The security scan and (until `SONAR_TOKEN` is set) the Sonar scan are
  mocked, purely to exercise the pipeline shape. Nothing here is sent to
  ServiceNow directly; it's all discovered via polling.
