# GridBricks // WindForecast OS: Design Summary

This document describes the two prototypes built so far and what every control does. Both prototypes run on generated sample data, not a live feed.

- **Onboarding prototype:** first-run setup flow (Phase 1).
- **App prototype:** the main application, covering the shell, the Decision Desk and the Risk & Evaluation view (Phases 2 to 5).

---

## 1. Product and visual direction

- **Purpose:** a day-ahead decision tool for UK wind power. It compares the wind forecast with metered generation for each settlement period, so traders and dispatch optimisers can see where they are exposed before bids close.
- **Users:** UK wholesale power traders, utility dispatch optimisers and quantitative energy risk analysts.
- **Look:** a monochrome, high-contrast design. Black text and rules sit on a white background, with greys for secondary text. Numbers use a monospace face so columns line up. There are no gradients, shadows or decorative colour.
- **Chart encoding (black and grey only):**
  - Actual wind: solid black line.
  - Forecast wind: dashed dark grey line.
  - Over-forecast (forecast above actual): black diagonal hatching.
  - Under-forecast (actual above forecast): mid grey solid fill (#8F8F8F).
- **Time convention:** all times are GMT. Delivery days are January 2026 and bidding cutoffs fall on the day before.

---

## 2. Onboarding prototype

Seven steps, shown with a progress counter ("01 / 07") and a thin progress bar. The footer holds the actions.

| Step | What the user sees | Controls and behaviour |
|---|---|---|
| 1. Welcome | Product name, a one-line promise, three facts (GB DAM, 48 × 30 min, default cutoff 11:00 GMT). | **Get started** moves to step 2. |
| 2. Role | Three role cards: Wholesale Power Trader, Dispatch Optimizer, Quantitative Risk Analyst. Each shows where it lands. | Select a card (radio). The landing view is Decision Desk for traders and dispatch, and Risk & Evaluation for analysts. **Skip for now** sets the role to Trader. |
| 3. Market | The GB DAM pill (locked, one market only). A gate-closure slider with five positions. | Drag the slider between 07:00, 09:00, 11:00 (standard), 14:00 and 18:00. The cutoff text updates as you move it. The tooltip explains that later forecasts are filtered out to avoid look-ahead bias. |
| 4. Data | Two options: sample data, or a live feed with an API key field. | Select **Use sample data** or **Connect live feed**. The key field only appears for the live feed. The status line changes to match. In this prototype the key is not checked or sent anywhere. **Skip for now** resets to sample data and clears any key. |
| 5. Display | Units (MW or GW), resolution (settlement periods or hourly), time display (GMT or BST). | Segmented buttons. Each choice appears in the summary at step 7. **Skip for now** moves on without changing the defaults. |
| 6. Colour | Four marks with their meanings: actual, forecast, over-forecast, under-forecast. | "Do not show this primer again" checkbox. In this prototype the checkbox only records the choice; it doesn't hide anything elsewhere. **Skip for now** leaves it unchecked. |
| 7. Orientation | A summary of all choices, three coach tips (date picker, gate slider, insights panel). | **Open Decision Desk** shows a confirmation box with the delivery day (Thu 15 Jan 2026) and the bidding cutoff. The same button becomes **Restart setup**, which returns to step 1. **Back** is available on every step after step 1. |

Footer behaviour: **Back** is disabled on step 1. **Skip for now** only appears on steps 2, 4 and 6, which are optional. The Enter key is not wired to the buttons.

---

## 3. App prototype: shell

The page has a fixed structure that stays the same on every view.

### Top navigation
- **GridBricks // WindForecast OS:** product name.
- **Decision Desk / Risk & Evaluation tabs:** switch views. The active tab is shown in inverse colours. The address changes to `#desk` or `#risk`, so each view has its own link. Unknown addresses open the Decision Desk.
- **Latency 3 ms | DB SQLite WAL:** a static label showing the backend status in the spec. It's a placeholder, not a live reading, and it hides on narrow screens.

### Status strip
- **UK EPEX SPOT GB DAM pill:** the market in use. The dot blinks slowly.
- **Delivery:** the selected delivery day, with a SAMPLE tag to show it's sample data.
- **Bidding cutoff:** the day before delivery at the selected gate time, in GMT.
- **Settlement clock (GMT):** the live GMT time, updated every second.

On narrow screens the strip stacks into two rows.

### Keyboard shortcuts (shown at the top of the Decision Desk)
| Key | Action |
|---|---|
| ← / → | Previous or next delivery day (Decision Desk only). |
| T | Switch to the Decision Desk. |
| E | Copy the current table as CSV (Decision Desk only). |
| Esc | Exit the gate-closure preview. |

Shortcuts are ignored while a text field, date field, or dropdown has focus.

---

## 4. App prototype: Decision Desk

The main operational view for choosing bids on a single delivery day.

### Control ribbon
- **Delivery day:**
  - **← Prev / Next →:** move one day. Prev is disabled on 1 January and Next on 31 January.
  - **Date field:** pick any day in January 2026.
  - **Today:** jumps to the default day, 15 January 2026. Disabled while already on that day.
  - Changing the day shows loading skeletons for about a quarter of a second.
- **Gate closure cutoff (D-1):** a slider with five positions (07:00, 09:00, 11:00, 14:00, 18:00). The forecast is recalculated at each position: earlier cutoffs are less accurate, so the errors are larger. The default is 11:00.
- **Resolution:**
  - **48 SP · 30 min:** settlement periods, the default.
  - **24 hr:** hourly averages of each pair of periods.
- **Units:** MW or GW. GW values are shown to two decimal places. Changing units affects every figure, including the export.
- **Export:**
  - **Copy CSV:** copies the current table to the clipboard.
  - **Copy JSON:** copies the same rows as JSON.
  - If the clipboard isn't available in the viewer, the text appears in a box below the ribbon, selected, for copying by hand. A status line under the buttons confirms the copy or explains the fallback.

### Key metrics (four cards)
These are calculated over all 48 settlement periods for the selected day and gate, regardless of the resolution toggle.
- **MAE (mean absolute error):** the average size of the miss per period. Shown in MW or GW.
- **RMSE (root mean square error):** like MAE but larger errors count more.
- **Mean bias error:** the average of forecast minus actual. The sign shows direction: positive means over-forecast, negative means under-forecast. A tag below gives the action:
  - Over-forecast: "Hedge: procure +X thermal reserve", rounded to 10 MW.
  - Under-forecast: "Hedge: sell back about X", rounded to 10 MW.
  - The tag turns solid black when the bias is larger than 500 MW.
- **Max imbalance exposure:** the period with the largest miss, its sign, and the time it occurs (for example "SP 34 @ 16:30 GMT").

### Actual vs forecast chart (hero)
- **Legend:** explains the four marks.
- **Hover or tap:** a crosshair with two markers appears on the nearest period, and a tooltip shows the period number, time, actual, forecast, error and the forecast publication time (D-1, 30 minutes before the cutoff). The tooltip flips to the left near the right edge.
- **Morning ramp 07:00 and Evening peak 18:00:** dashed reference lines.
- **Shaded area between the curves:** hatched where the forecast is above actual, grey where it's below.

### Gate-closure simulator (above the chart)
- **▶ Simulate gate closure / ❚❚ Pause:** plays through four cutoffs in order, 06:00, 09:00, 11:00 and 15:00, about 1.4 seconds each. The chart, error bars, KPIs and insights all update at each step. It stops at the last step.
- **Scrubber:** a slider with four positions. Drag it to preview one cutoff. Moving the scrubber pauses playback.
- **Preview text:** shows "Live gate" in normal use, or "Previewing cutoff..." with the forecast publication time during a preview.
- **Exit preview:** returns to the live gate from the ribbon.
- The preview has its own forecast quality for each cutoff. It doesn't change the gate slider.

### Insights panel
Rule-based notes for the traders. Each note has a flag (OK, Watch or Risk):
1. **Evening peak over-forecast:** if the average error from SP 32 to SP 38 (15:30 to 19:00 GMT) is more than 500 MW, the note suggests a hedge of that amount, rounded to 100 MW, in thermal or interconnector capacity. Otherwise it says the window is within tolerance.
2. **Major imbalance periods:** how many of the 48 periods have an error beyond ±1,000 MW.
3. **Largest single miss:** shown only when the biggest miss is above 2,000 MW. It names the period and suggests checking the publication time.

On screens narrower than 1440px the panel has a **Hide / Show** button. On wider screens it is always open.

### Settlement period error chart
- Bars show forecast minus actual for each period.
- Black bars are over-forecast. Grey bars are under-forecast.
- Dashed lines mark ±1,000 MW.

### Layout by screen width
- **1440px and wider:** chart on the left (65%), insights on the right (35%).
- **Below 1440px:** the chart and insights stack, and the insights panel can be hidden.
- **Below 760px:** the status strip stacks, the health text hides, and the export buttons move to their own row.

---

## 5. App prototype: Risk & Evaluation

For reviewing forecast accuracy over a range of days, rather than making a single day's decision.

### Ribbon
- **Date range:** a start and end date in January 2026. The end date can't be earlier than the start; if it is, the two are swapped.
- **Granularity dropdown:**
  - **Full month:** all 31 days.
  - **Week 1 to Week 4:** sets the range to 1–7, 8–14, 15–21 or 22–28 January.
  - **Custom range:** selected automatically when you change the dates by hand.
- **Hours:**
  - **All:** every period.
  - **Peak 07–19:** settlement periods 15 to 38, i.e. 07:00 to 19:00 GMT.
  - **Off-peak 19–07:** the remaining periods.
  - The hours filter applies to the scorecard and histogram. It does not apply to the box plot.
- **Gate closure dropdown:** the cutoff used for all calculations on this view. It is separate from the Decision Desk slider.
- **Units:** the MW/GW setting is shared with the Decision Desk.

### Scorecard (four cards)
- **WAPE (weighted absolute percentage error):** total absolute error divided by total actual generation, as a percentage. A lower figure is better.
- **Correlation R²:** how closely forecast follows actual, from 0 to 1. A higher figure is better.
- **Systematic bias ratio:** the share of periods where the forecast is above actual ("% over") and below actual ("% under").
- **Net volumetric imbalance (GWh):** the sum of all errors, converted to energy (each period is half an hour). A positive figure means net over-forecast, so more thermal may be needed. A negative figure means net under-forecast, so excess wind may need selling.

### Error distribution histogram
- Bars count the errors in 250 MW buckets from −4,000 to +4,000 MW.
- A black curve shows what a normal distribution with the same average and spread would give.
- The text below gives the mean, the standard deviation (σ), excess kurtosis, and the share of periods beyond 2σ. A normal distribution has about 4.6% beyond 2σ. More than that suggests fat tails, meaning extreme misses are more common than a normal model would predict.

### Hourly error box plot
- One box for each hour of the day, across the selected range.
- The line across the middle is the median. The box covers the middle 50% of errors (the interquartile range). Whiskers reach to the furthest error within 1.5 times the box height. Dots beyond the whiskers are outliers.
- Labels appear every three hours.

---

## 6. How the sample data is built

- Each day's data is generated from a fixed seed, so the same day always produces the same numbers. Nothing is random between visits.
- **Actual wind:** a daily level, a smooth daily cycle, and smoothed random variation.
- **Forecast:** the actual value plus an evening bias between periods 32 and 38, plus random noise. The gate closure then scales this error (1.35 at 07:00 down to 0.85 at 18:00).
- **Preview cutoffs:** 1.4 (06:00), 1.2 (09:00), 1.0 (11:00) and 0.9 (15:00).
- The figures are illustrative. They are not real market data and should not be used for trading decisions.

## 7. Thresholds and assumptions to confirm

These values are my defaults, not your trading rules:
- Hedge flag on the evening window: 500 MW.
- Imbalance threshold for "major": ±1,000 MW.
- "Largest single miss" note: above 2,000 MW.
- Hedge amounts rounded to 10 MW (tags) and 100 MW (insight text).
- Forecast quality factors per gate and the preview factors.
- The evening window (SP 32 to SP 38) and the peak hours (07:00 to 19:00).

## 8. Known limitations

- **Sample data only.** No connection to the real generation or forecast feed. The live-feed option in onboarding is not connected.
- **No sign-in or saved settings.** Onboarding choices are not kept after the page is reloaded.
- **Keyboard access to the chart.** The tooltip works with a pointer but can't be reached by keyboard.
- **Export downloads are blocked** in this viewer, so export uses the clipboard or a copy box. A real file download needs the production app.
- **Latency badge and loading delay** are fixed placeholders, not live measurements.
- **Single model.** The spec's model selector is not included, since there is only one forecast.
- **Not tested on real devices.** Layouts follow the spec's breakpoints, but the first look on a real screen is still needed.

## 9. Open items

- Phases 7 and 8 were not in the original plan. Their scope is still to be decided.
- Thresholds in section 7 need confirming against your desk's rules.
- Decide whether the rendering needs a keyboard-accessible way to read chart values.
