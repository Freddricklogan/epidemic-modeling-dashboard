# Case Study — Epidemic Modeling Dashboard

**Repository:** [epidemic-modeling-dashboard](https://github.com/Freddricklogan/epidemic-modeling-dashboard) · **Live demo:** [freddricklogan.github.io/epidemic-modeling-dashboard](https://freddricklogan.github.io/epidemic-modeling-dashboard/) · **Author:** Freddrick Logan

---

## 1. Who has this problem

Anyone who has to teach, or be taught, what an intervention does to an outbreak curve: a public-health instructor, a campus emergency-planning committee, a county health department briefing its board. All of them can find the SIR equations in a textbook. None can see from the equations what closing a campus on day thirty does to the peak.

## 2. The problem, as a scenario

A university's emergency-planning committee meets to update its infectious-disease protocol. The chief medical officer explains that the trigger for moving classes online depends on the effective reproduction number. A dean asks what that number is and how much a two-week closure would change it. The answer is a paragraph of caveats and a promised paper. The committee approves a threshold nobody in the room understands, and next time it meets — during an outbreak — it will argue about the threshold instead of acting on it.

## 3. What it costs to leave it alone

Decisions made on intuition about exponential processes are reliably wrong in the same direction: too late. In a real outbreak that lateness is measured in cases, and I will not attach a number because it depends entirely on the pathogen and the population. The recurring institutional cost is smaller and certain: committees that cannot reason about the curve either over-react, which is expensive and erodes trust, or under-react, which is worse. A modelling course whose students leave with equations and no intuition has not taught the thing that matters.

## 4. The approach, and the alternative I rejected

I built four compartmental models — SIR, SEIR, SIRD and SIRV — on a fourth-order Runge–Kutta solver in the browser, every parameter on a live control. Switch on a lockdown from day thirty and the peak flattens and the effective reproduction number crosses below one in the same frame. Four preset pathogens load textbook parameters in one click, and a comparison panel runs all four models on identical inputs so their structural differences are visible rather than described.

The alternative was to fit real case data. It is more impressive and the wrong tool for the audience: a fitted model invites arguments about the data and the fit, and hides the mechanism under both. This is a teaching instrument; the parameters are illustrative, the data synthetic, and the interface says so in both places a reader looks. Keeping the mathematics honest — mass conserved, R0 defined correctly, Re computed from the intervention-adjusted transmission rate — is where the effort went.

## 5. What the code does today

Real: the RK4 integrator, the four models, basic and effective reproduction numbers, the herd-immunity threshold, peak and attack-rate metrics, the lockdown intervention, the phase portrait, the four-model comparison, and CSV export of the daily series. The engine is pure logic separated from the rendering layer, and every model is tested for mass conservation.

Simulated: everything on screen. Populations are synthetic, preset parameters are textbook illustrations rather than fitted estimates, and the hospital-bed metric uses a stated, adjustable assumption rather than a measured ratio.

Worth knowing: rebuilding this exposed that the published dashboard could not run — the simulation function and its click handler shared one name, so the handler called itself and overflowed the stack on the first click. Beneath that, the SIRV model leaked population every step, reported an effective reproduction number as R0, and the Re chart ignored the lockdown it was meant to demonstrate. Seven defects in all, each fixed and tested; the full list is in the audit file.

## 6. Evidence

Measured in continuous integration on the current main branch: 73 unit tests passing across four files, 100% statement coverage over the engine, lint and HTML validation clean, CodeQL and dependency scanning enabled. The tests check the integrator's fourth-order convergence against a closed-form solution, assert every model's derivatives sum to within 1e-9 of zero, and hold the population within 0.1% over a hundred-day run. Headless-browser smoke test: zero console errors, zero failed requests; SIRD reports 1.88% deaths on its defaults, the measles preset gives R0 7.20, and playback advanced to day 49. Security posture: Content Security Policy with `default-src 'none'`, the one chart library pinned by Subresource Integrity with a vendored fallback.

## 7. What it would take to run this in production

For a committee or a classroom the static page is already the product. As decision support for a health department it would need: ingestion of the department's own case series with a documented fitting procedure and confidence intervals; a scenario library the committee can save, name and compare; parameter provenance, so every number on screen links to its source; and a report export the board can read. That is a few months of careful work, most of it about fitting and uncertainty rather than the interface, with an epidemiologist reviewing every default. Hosting stays static until scenarios must be shared; then a small authenticated API suffices.

## 8. Limits and next steps

Deterministic models only: no stochasticity, age structure, spatial mixing or waning immunity, and a fixed-step integrator. Next: an adaptive-step RK45 solver, parameter sweeps in a Web Worker so a committee can ask "what if the reduction were 40% instead of 60%" across a range at once, and scenario export for comparison over time.

## 9. Who should look at this

**Hiring manager:** evidence that I check the mathematics, not just the interface — I found a demo that had never run and a model that lost people every step.
**Consulting client:** a shared artefact for a planning committee to build intuition on before an outbreak forces the conversation.
**Engineer:** read `src/solver.js` and `src/models.js`, then `tests/models.test.js` for the conservation assertions; the audit file shows how a plausible-looking simulation can be wrong in several separate ways.
