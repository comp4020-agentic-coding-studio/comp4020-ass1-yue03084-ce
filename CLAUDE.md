# COMP4020 prototype

This is your starter repo for a COMP4020 prototype: a static site written in
HTML/CSS/TypeScript that builds to plain HTML/CSS/JS and deploys to GitHub
Pages. The **deployed site is what gets marked** --- not this repo, and not "it
works on my machine". It's marked live in Chrome against the deployed URL at two
viewports --- 1920×1080 (desktop) and 390×844 (phone) --- and both count in
full, so make that artefact good at both and use the checks below to know
whether it is.

What you're building this week — the spec — is published on the course website,
and this repo's name tells you which deliverable it is. Run the course plugin's
**start** skill at the start of each week: it pulls the right spec from the
course API, carries your harness forward from last week, and helps you turn the
spec's checkable lines into tests of your own. Read the spec before you build,
and see `spec/README.md` for how the checks in this repo relate to it.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- build,
  lint, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The evidence check and the secrets scan only run in CI; the
  links check and the deploy itself only run in CI too, but you can reproduce
  the links check locally: this site uses an explicit Astro `base` (see the
  note in `astro.config.mjs`), so linkinator has to crawl a server that
  actually serves under that base path, not the raw `dist/` folder --- run
  `pnpm build`, then `pnpm preview` in one terminal, then in another
  `pnpm dlx linkinator "http://localhost:4321/comp4020-ass1-yue03084-ce/"
  --recurse --silent`. Pointing linkinator at `./dist` directly reports every
  internal link as broken, because it doesn't know about the base prefix.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't.
- **Don't `cd`.** Put the directory in the command instead --- `pnpm -C <repo>`,
  `git -C <repo>` --- and give scripts absolute paths. The shell's working
  directory persists between tool calls, so one `cd` into `/tmp` to poke at a
  probe silently pollutes every command after it. `pnpm` fails loudly when it
  lands somewhere without a `package.json`; `git` in a *different* repo does
  not, and neither does a relative path that happens to resolve.
- **Before trusting a measurement, know which build it read.** This one is
  written from two failures, not from caution. Once `pnpm check` never ran
  (wrong directory, above) while `pnpm preview` kept serving the previous
  `dist/`, so the probe reported a fix hadn't worked when it had. Once a CDP
  probe reused one tab across navigations, Chrome left the rules consuming
  `--tilt` unrecomputed, and the probe reported the exploded view was flat when
  it wasn't. Same shape both times, and it is the worst shape a bug can have:
  **a lying instrument is worse than no instrument, because it argues for
  editing code that is already correct.** So a probe must say what it measured
  --- print the `mtime` of the `dist/index.html` it read --- and must open a
  fresh tab per measurement. If a probe says nothing changed, suspect the probe
  before the code.
- **Anything with a fixed height has to be measured, not looked at.** A slab in
  the cross-section is a percentage of a fixed stack height, so text put into
  one either fits or silently spills under the slab below it. The phone verdict
  overflowed by three pixels: invisible in a screenshot, obvious the moment
  something read `scrollHeight` against `clientHeight`. So when you add text to
  a box whose height the content doesn't get to set, measure that pair before
  you say it fits --- and measure it at 390 as well as 1920, because the box
  shrinks and the sentence doesn't.
- **One fact, one piece of code.** The page says "did this column expose that
  layer?" in two places --- the verdict printed on the slab, and the sentence
  the marker reads out. They started as two calculations of the same thing,
  which is a page that can tell you cyan stalls here while the slab beside it
  says the layer saw nothing. They now share one `share()`. If a fact appears
  twice on screen, it comes from one function; if a piece of geometry appears
  twice, it comes from one constant. Two sources for one fact is not
  duplication you can clean up later --- it is a page that will eventually
  contradict itself in front of a reader.
- **Default to incremental.** Unless the request says otherwise: don't
  restructure the page, don't rewrite copy that is already there, don't break an
  interaction that already works. Attach the new thing to what exists. And for
  each new feature, say back two things before building it --- **when it
  updates** and **what must not change**. The exploded view's beams are painted
  from `resample()` rather than `show()` entirely because answering "when does
  this update?" first made it obvious that exposure happens once, in the camera,
  and is the one thing on the page that is not a function of the clock.
- **stylelint here is mostly about where a rule sits, not what it says.** Three
  of its rules have cost a build-and-retry more than once: a less specific
  selector may not come after a more specific one matching the same element
  (`no-descending-specificity` --- this is why the exploded-view `.layer__note`
  rule lives down beside `.layer--reagent` and not next to `.layer__verdict`); a
  blank line before a declaration that follows another declaration is an error
  unless a comment sits between them (`declaration-empty-line-before`); and a
  comment needs a blank line before it (`comment-empty-line-before`). None of
  these show up until `pnpm check` reaches lint, which is after the build, so
  getting them right while writing costs nothing and getting them wrong costs a
  whole round.
- Two CSS facts that fail *silently*, which is why they are written down rather
  than remembered. An `opacity` below 1 forces `transform-style: flat` on that
  element's subtree, so a fade put on a 3-D container flattens the thing it was
  meant to fade --- put it on the leaf. And `calc(a + -0.5 * b)` is a parse most
  of the way to nonsense: emit the sign explicitly. A gradient that fails to
  parse doesn't warn, it just doesn't paint, and an element that never appears
  looks exactly like an element you forgot to write.
- When a check fails, read its output before changing anything. Each check below
  names what it measures, and the failure message is the instruction: it tells
  you the file, the line, or the contract. Treat a red check as authoritative
  --- the page is wrong until the check is green, not until you decide it should
  be.
- Commit when the checks pass. Never commit a red state.

## The checks (your sensors)

CI runs these on every push once your repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy` --- not one status per sensor below --- and
within `check` the steps run in sequence (`pnpm check` chains typecheck, build,
lint, and the spec with `&&`), so an early failure like a broken build stops the
later sensors from running for that push; fix it and push again to see the rest.
While the repo is private (all week, until you ship) the CI jobs stay skipped
--- `pnpm check` is the same roster on your machine, and it's the faster loop
anyway. They aren't hoops. Each is a different way of finding out something true
about the site that you can't reliably see by looking at it.

They also carry a mark at a crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `tsc --noEmit` runs first in `pnpm check`, so a type error
  stops the roster before the build even starts. The types are extra
  backpressure: a red here is the compiler telling you a claim in the code is
  false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect. An asset that 404s on the deployed URL counts as broken even
  if it loads locally.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website, whatever the week's brief asks; the tests you write for the week's
  own spec run alongside it (any `spec/*.test.ts`). A failure names the contract
  you haven't met yet.
- **lint** --- `stylelint` for CSS, `oxlint` for TypeScript. Flags code that's
  wrong, fragile, or non-idiomatic. Read the rule it names.
- **tests** --- any other tests you write, wherever you put them (co-located
  with your source is fine, not just `spec/`), must pass. Vitest picks up both
  this and the spec suite in one `vitest run`, the last step of `pnpm check`. A
  failing test is a claim about the site that's no longer true.
- **evidence** (`pnpm check:evidence`) --- checks your process evidence:
  `PROCESS.md`'s citations resolve to real commits, the current deliverable's
  exact reflection is in `reflections/` (worked out from this repo's name
  against the public course API), and your `CLAUDE.md` is present. Evidence
  gates the deploy --- `deploy` needs `check` to pass, so failing evidence
  blocks the deploy alongside everything else. See
  [Your process is part of the mark](#your-process-is-part-of-the-mark) below,
  and the course website's
  [assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
  for what counts as evidence.
- **links** --- internal links must resolve. A broken link is a dead end you
  didn't mean to ship.
- **secrets** --- the repo is scanned for committed credentials. Never put a
  key, token, or password in a tracked file. If one leaks, rotate it. A local
  pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) also
  blocks any commit containing something shaped like an API key --- by the time
  CI sees a key it's already pushed, so the hook is the sensor that matters.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors (`axe-core`, Lighthouse, or whatever you choose) is your work, and later
in the course the spec will ask you to show how you tested both. When you do,
read a green performance result honestly: it's a lab estimate from one run on a
CI machine, not proof the site is fast for real users.

## The stack is swappable

Out of the box this is plain HTML/CSS/TypeScript on Vite, and every `.html` file
in the repo is a page: add pages, link them, and the build picks them up with no
config. That's a default, not a rule (unless the week's spec says otherwise).
You can swap in Astro or any other static generator, because nothing in CI names
a tool --- the whole contract is:

- `pnpm build` emits the complete site into `dist/`
- the `package.json` scripts (`check`, `check:evidence`, `build`) keep working
- whatever lands in `dist/` still passes the invariants in `spec/`

Two things bite in a swap. The deployed site lives under a path
(`…github.io/<repo>/`), so configure your generator's base path --- this
template's Vite config uses relative asset URLs to sidestep that, but most
generators (Astro included) need `base` set explicitly, and getting it wrong
looks fine locally while every asset 404s on the live URL. And commit the
updated `pnpm-lock.yaml`: CI installs with `--frozen-lockfile`.

## Your process is part of the mark

The deployed page is only half of it. How you got there is marked too: your
commit history, your agent files, and the decisions visible across them. The
checks above can't see any of that, so a person reads it directly --- which
means building legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of your process; a single
  dump the night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what you built, the moments that mattered --- each pointing at a
  commit, a `CLAUDE.md` change, or a prompt and the commit it produced --- and
  where to look in the history. It points a marker at the evidence; it doesn't
  stand in for it, and claims the history doesn't back don't count. The
  `PROCESS.md` in this repo is a template showing the shape and the citation
  format (link text the commit hash or range, target the commit or compare URL);
  `pnpm check:evidence` verifies your citations resolve to real commits before
  you ship. Markers follow those citations and don't trawl the repo for evidence
  you didn't cite.
- **Write your reflection in `reflections/`** --- a short markdown file in this
  repo, named for the deliverable it answers, so the number in the filename is
  the number in this repo's name (`crit-1.md` in `comp4020-crit1-<you>`,
  `assignment-1.md` in `comp4020-ass1-<you>`); `reflections/README.md` has the
  full rule. `pnpm check:evidence` checks the exact current name against the
  course API, not merely the presence of any well-named file. It answers the two
  standing prompts: the breakthrough that moved the work forward, and what this
  work changed about the developer you want to be. It stays out of the deployed
  site. It's due at the cutoff, and if it isn't in the repo by then the week
  doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness you build to direct the agent,
  this `CLAUDE.md` and any `AGENTS.md`, is itself read as part of how you
  worked. Keep it honest and current (see below).
- **Don't draft `PROCESS.md`'s cited moments or `reflections/*.md` for the
  student, even to get `pnpm check:evidence` green.** These are graded as the
  student's own first-person account; if the agent writes the substance, they
  stop being evidence and become the exact "false account" risk the course's
  integrity policy calls out. When these are due, ask specific questions
  (which commit was the actual turning point and why, what would they do
  differently next time) and drop the student's own words in verbatim, or
  leave a skeleton with headings for them to fill in themselves. A rushed,
  generic reflection the student wrote is worth more than a polished one the
  agent wrote — don't optimize for the check going green over the account
  being real.

You don't need a name, a student number, or any identity file in the repo: we
know whose repo it is. Spend the effort on the work.

## This file is yours

This CLAUDE.md is a starting point, not a fixed rulebook. As you learn what your
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching you out, a fact about the stack the agent keeps getting wrong --- write
it down here. Growing this file is the work of harness engineering, and the gap
between this boilerplate and your own version is part of what your prototype
says about the developer you're becoming.
