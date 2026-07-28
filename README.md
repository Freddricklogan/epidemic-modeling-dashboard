<h1 align="center">Epidemic Modeling Dashboard</h1>

<p align="center">
  <em>An interactive compartmental-disease simulator — model outbreaks, test interventions, and see the curve flatten in real time.</em>
</p>

<p align="center">
  <a href="https://freddricklogan.github.io/epidemic-modeling-dashboard/"><img src="https://img.shields.io/badge/Live_Demo-Open_App-e17055?style=for-the-badge&logo=github" alt="Live Demo"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-Vanilla_ES6-f7df1e?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Charts-Chart.js-ff6384?logo=chartdotjs&logoColor=white" alt="Chart.js">
  <img src="https://img.shields.io/badge/Solver-Runge–Kutta_(RK4)-00b894" alt="RK4">
  <img src="https://img.shields.io/badge/License-MIT-lightgrey" alt="License">
</p>

---

## Overview

**Epidemic Modeling Dashboard** is an interactive epidemiology tool that simulates how infectious
diseases spread through a population using the classic family of **compartmental models** — SIR,
SEIR, SIRD, and SIRV. These models describe the flow of individuals between states (Susceptible,
Exposed, Infected, Recovered, Deceased, Vaccinated) with a system of coupled differential equations,
integrated here with a **fourth-order Runge–Kutta (RK4) solver** for numerical accuracy.

Adjust transmission and recovery rates, incubation periods, vaccination and mortality parameters, and
watch the epidemic curves respond instantly. It is a hands-on way to build intuition for concepts
like R₀, herd immunity, and “flattening the curve.”

> **▶ [Launch the live demo](https://freddricklogan.github.io/epidemic-modeling-dashboard/)**

---

## Models included

| Model | Compartments | Captures |
|:--|:--|:--|
| **SIR** | Susceptible → Infected → Recovered | The canonical outbreak model |
| **SEIR** | + Exposed (latent) | Diseases with an incubation period |
| **SIRD** | + Deceased | Outbreaks where mortality matters |
| **SIRV** | + Vaccinated | Intervention and herd-immunity scenarios |

---

## Why this project

| Skill demonstrated | Where it shows up |
|:--|:--|
| **Mathematical modeling** | Systems of coupled ODEs for four epidemic models |
| **Numerical methods** | RK4 integration for stable, accurate simulation |
| **Sensitivity analysis** | Parameter sweeps that reveal how outcomes depend on inputs |
| **Data visualization** | Real-time, multi-series Chart.js curves |
| **Data export** | Download simulation results for further analysis |
| **Zero-dependency delivery** | Runs as a static page — no backend, no build step |

---

## Features

- Four compartmental models (SIR / SEIR / SIRD / SIRV) with a shared, consistent control surface
- Real-time simulation with adjustable parameters (transmission, recovery, incubation, vaccination, mortality)
- Parameter **sensitivity analysis** to compare scenarios
- **Data export** for downstream analysis
- Fully responsive, client-side dashboard

---

## Tech stack

- **Language:** Vanilla JavaScript (ES6+)
- **Numerics:** Custom RK4 differential-equation solver
- **Charting:** Chart.js
- **Runtime:** 100% client-side — no backend, no install

---

## Run locally

```bash
git clone https://github.com/Freddricklogan/epidemic-modeling-dashboard.git
cd epidemic-modeling-dashboard
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## Author

**Freddrick Logan** — Educational Technologist & Technology Leader
[GitHub](https://github.com/Freddricklogan) · [LinkedIn](https://www.linkedin.com/in/freddricklogan/)

## License

Released under the [MIT License](LICENSE).
