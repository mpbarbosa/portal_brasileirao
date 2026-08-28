`src/data/broadcasts.ts`, refreshed from CBF by the weekly **Sync broadcasts**
workflow. It merges into the file rather than replacing it, so past rounds
already recorded stay as they are.

**This pull request carries no automatic checks, and that is a property of the
token rather than a fault.** GitHub does not start a workflow run for an event
raised with the repository's own `GITHUB_TOKEN`, so neither the push to the
branch nor the opening of this pull request triggers `ci.yml`. The gate is
instead **inside the run that produced this commit**: it ran `npm run lint` and
`npm run test:unit` against the written file before committing, and failed the
job rather than committing if either did.

Two consequences worth knowing rather than rediscovering:

- **Push an empty commit, or re-run `ci.yml` against this branch, if you want
  the full suite before merging.** Any event raised by a person carries a
  person's token and does start a run.
- **This blocks on branch protection** (`docs/cicd-plan.md` gap F). Requiring
  `check` and `e2e` as status checks would make this pull request unmergeable,
  because those checks can never appear on it unattended. Whoever does F needs
  either a token that is not `GITHUB_TOKEN` here, or an explicit exemption for
  this branch. E was sequenced before F; this is the coupling that ordering was
  for.
