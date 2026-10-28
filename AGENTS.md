# Repository instructions

## Repository overview

AI Coding Playbook is a small React and TypeScript demo for comparing the effects
of repository instructions and structured task prompts on generated code. Its
current feature is a Notification Center backed by a mock asynchronous service.

Use Node.js 24 and npm. Vite serves and builds the application. ESLint checks code;
TypeScript checks types; Vitest and React Testing Library run tests in jsdom.

## Architecture boundaries

- Organize application files by responsibility: `src/app/` for the shell,
  `src/experiments/pages/` for Lab pages, `src/experiments/components/` for
  comparison UI, and `src/experiments/data/` for definitions, runs, types,
  catalog, validation, and derived summaries. Within `data/`, use `definitions/`,
  `runs/`, `types/`, `catalog/`, `validation/`, and `summaries/` respectively;
  keep tests beside the corresponding modules.
- `src/main.tsx` mounts `App` inside `StrictMode` and imports the stylesheet.
  Keep feature state and service calls out of this entry point.
- `src/app/App.tsx` owns hash navigation and the application shell.
- `src/demos/notifications/NotificationCenterDemo.tsx` owns the preserved demo's
  rendering, local state, and event handlers. Its `notifications.ts` service
  owns the Notification type and loading; keep it independent of React and DOM.
- Keep translation hooks in `src/i18n/` and dictionaries together in
  `src/i18n/languages/`.
- Keep shared styles in `src/styles/styles.scss` and tests beside the modules
  they verify. Add components for concrete responsibilities, not forwarding wrappers.
- Keep Vite and Vitest configuration together in `vite.config.ts`.
- Do not introduce global state management or UI libraries. Do not add routing,
  persistence, real network services, or dependencies unless the task explicitly
  requires them. Notification read changes currently reset on reload.

## Coding conventions

- Use TypeScript for application code: `.tsx` for JSX and `.ts` for other code.
- Use PascalCase for components and types, camelCase for functions and variables,
  and lowercase hyphenated CSS class names such as `read-status`.
- Match existing two-space indentation, single-quoted JavaScript strings,
  semicolons, and `import type` declarations for type-only imports.
- Use function components and hooks. Preserve `StrictMode` and the missing-root
  check in `main.tsx`.
- Represent asynchronous UI states with a discriminated union. Preserve loading,
  error, and success states, with an explicit empty view for a successful empty
  result. Do not use overlapping booleans that permit contradictory states.
- Use functional state updates when the next value depends on the previous value.
  Update arrays and objects immutably; use stable notification IDs as list keys.
- Services must accept an `AbortSignal` for cancellable loading. Check already
  aborted signals before starting work. Cancel timers and remove abort listeners
  on cancellation; remove listeners on normal completion as well.
- Effects must abort their requests on cleanup. Guard both success and failure
  handlers against aborted requests so stale results cannot update the screen.
- Show a user-facing failure message and Retry action for failed loads. Retry
  must enter loading before displaying its result. Cancellation must not display
  a request-failure message.

## Testing requirements

- Use Vitest and React Testing Library with the existing jsdom environment.
  Name colocated tests `*.test.ts` or `*.test.tsx`.
- Add or update tests for changed user-visible behavior. Preserve coverage for
  loading, empty results, success, read/unread labels, marking only the selected
  notification as read, and failure followed by retry.
- Mock the service boundary in component tests. Prefer role and accessible-name
  queries; use text queries for visible copy. Assert observable behavior rather
  than internal hook state or CSS implementation details.
- Control pending requests with deferred promises and use `act` when resolving
  them directly. Use async queries to wait for rendered results, not arbitrary
  sleeps.
- Test stale responses under `StrictMode` and cancellation on unmount when
  changing loading behavior. Keep service tests for completion, cancellation,
  already-aborted requests, timer removal, and listener removal.
- Use fake timers for mock-service timing tests and restore real timers afterward.
  Reset mocked service implementations before tests and clean up rendered
  components afterward. Hook callbacks must not accidentally return a mock
  function that the runner could execute as cleanup.
- Do not delete assertions, skip tests, suppress errors, or weaken lint or
  TypeScript configuration to make a failing change pass.

## Accessibility requirements

- Preserve a main landmark, a level-one screen heading, notification list
  semantics, and native buttons with `type="button"`.
- Give each mark-as-read button an accessible name identifying its notification.
- Show explicit `Read` or `Unread` text; color alone must not convey read state.
- Use `role="status"` for loading, empty, and read-status messages and
  `role="alert"` for loading failures.
- Keep Retry keyboard-operable and preserve visible `:focus-visible` styling.
  Do not replace buttons with clickable noninteractive elements.

## Change-scope restrictions

- Inspect the relevant files and working-tree status before editing. Preserve
  unrelated existing changes, including untracked files.
- Change only files needed for the requested behavior, its tests, and associated
  documentation. Do not perform unrelated renames, formatting sweeps, dependency
  upgrades, or architecture rewrites.
- Use npm and preserve `package-lock.json`. Update the lockfile when a requested
  dependency change modifies `package.json`; do not add another package manager's
  lockfile.
- Do not hand-edit or commit `node_modules/`, `dist/`, or `coverage/`.
- Update README when setup commands or documented behavior change, unless the
  task explicitly limits edits to other files; report that limitation instead.

## Commands Codex must run before completion

For application, test, dependency, or configuration changes, run all three:

```sh
npm run lint
npm run typecheck
npm test
```

Run `npm ci` first if dependencies are missing or the lockfile changed. For changes
to entry points, dependencies, or build configuration, also run `npm run build`.
For development-server or initialization changes, run `npm run dev`, verify the
printed local URL serves the application, and stop the server started for the
check. Do not stop unrelated processes to free a port.

For every task that edits files, run:

```sh
git diff --check
git status --short
```

For documentation-only changes, these two checks and a review of the edited
document are sufficient; application tests are not required. Inspect newly
created files directly because plain `git diff` does not include untracked files.
For read-only tasks, do not install dependencies or run commands that generate
files.

Other available commands: `npm run test:watch` for interactive testing and
`npm run preview` to serve a previously generated production build locally.
Watch mode does not replace the required single-run `npm test` check.

## Definition of done

- The requested behavior and each stated acceptance criterion are implemented.
- Changed behavior has corresponding tests, including applicable error, empty,
  cancellation, and accessibility cases described above.
- Required commands pass. If a command cannot run or fails, report the command
  and reason; do not claim validation passed or silently omit the check.
- Review the final changes for unintended files, dependency changes, and edits
  outside the task scope. Include newly created files in that review.
- The final response states what changed, which checks ran and their outcomes,
  and any unresolved limitations.

## Examples of acceptable and unacceptable changes

| Task | Acceptable change | Unacceptable change |
| --- | --- | --- |
| Add a notification action | Add a local handler, an accessible button, and a behavior test. | Install a global store or UI kit for the action. |
| Adjust mock results | Change service fixtures and update affected tests. | Add a real endpoint or local-storage persistence without a request. |
| Fix retry behavior | Enter loading, start a fresh request, and test recovery. | Hide the error, remove Retry, or let stale results overwrite new data. |
| Fix cleanup | Abort the request, clear its timer, remove its listener, and test cancellation. | Remove StrictMode to conceal duplicate-effect problems. |
| Restyle unread items | Preserve the Unread label and keyboard focus while changing CSS. | Use only a different color to identify unread items. |
| Fix a failing check | Correct the implementation or an invalid test expectation. | Disable the rule, remove the assertion, or skip the test to obtain a pass. |
| Update repository instructions | Edit the requested documentation and review it. | Refactor application code during a documentation-only task. |

## Token-efficient workflow

- Read only files relevant to the current task.
- Use targeted search before opening files; do not scan the whole repository
  unless explicitly requested.
- Reuse established types, patterns and decisions instead of re-explaining them.
- For straightforward tasks, implement directly without a long written plan.
- Ask questions only when ambiguity materially changes the implementation.
- Keep progress and final reports concise.
- Do not paste full files, large diffs, logs or unchanged code into chat.
- Summarize changed files instead of reproducing their contents.
- Limit investigation output to findings required for the next decision.
- Run targeted tests first; run the full suite only when required by the task
  or before release.
- Do not repeatedly inspect files already read unless they changed or new
  evidence requires it.
- Do not create extra documentation unless requested.
- Do not add optional abstractions, features or dependencies.
- Stop after completing the requested task; do not continue into the next task.

## Default task execution

Unless the task explicitly requests investigation only:

1. Inspect only the relevant files.
2. Follow existing repository patterns.
3. Implement the smallest valid change.
4. Run targeted validation.
5. Review the final diff internally.
6. Report only:
   - outcome;
   - changed files;
   - validation result;
   - blockers or unverified items.

Keep the final report within 8 concise lines unless a serious issue requires
more detail.

## Context limits

- Prefer `rg` and file-specific inspection over directory-wide reads.
- Do not read generated files, build output, coverage, dependencies or lockfiles
  unless directly relevant.
- Do not inspect all experiment data when changing one experiment.
- When working on one experiment, load only:
  - its definition;
  - its associated runs;
  - shared types or validators it directly uses.
- Treat AGENTS.md as persistent context; do not restate its contents.
