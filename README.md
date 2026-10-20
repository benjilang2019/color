# Mind Reading Game - GitHub Pages replication

This is a static GitHub Pages implementation of the color / mind-reading experiment described in Guilbeault, Caplan & Yang (2026), restricted to the two conditions requested for this replication:

- **Experiment 16**: 16 rounds, 5/8 red overall (10 red, 6 blue)
- **Experiment 20**: 20 rounds, 6/10 red overall (12 red, 8 blue)

Within each condition, the participant is assigned with equal probability to one of the **three supplied sender sequences**. `1 = red`, `0 = blue`.

## Design revision

The interface is intentionally styled to resemble a Stanford Qualtrics survey more closely than the first version:

- Stanford-cardinal header treatment
- narrow white survey page
- Qualtrics-like typography and question spacing
- radio-style answer rows
- right-aligned red Next / Submit controls
- one-question-per-page interaction pattern
- separate round feedback pages
- responsive layout for desktop and mobile

The original linked Qualtrics survey is JavaScript-rendered and cannot be programmatically inspected from this build environment, so the visual treatment is based on Stanford's current Qualtrics theme conventions and the experiment flow described in the paper / supplement. The study logic remains faithful to the requested 16- and 20-round conditions.

## Experimental flow

1. Participant ID entry.
2. Sender / Receiver task explanation.
3. Participant is told they have been assigned the **Receiver** role (as in the original experiment, all participants actually play Receiver).
4. Scrambler / noisy-signal instructions.
5. Random assignment to Experiment 16 or Experiment 20 (50/50).
6. Random assignment to Sequence 1, 2, or 3 (1/3 each).
7. Round-by-round red / blue prediction with feedback.
8. Final question: which color was the partner's preferred choice all along?
9. Download of a trial-level CSV response file.

## Data fields

The CSV contains:

- participant_id
- session_id
- experiment
- sequence
- round
- sender_signal
- participant_choice
- correct
- rt_ms
- answered_at
- final_choice
- final_rt_ms
- final_score
- started_at
- completed_at

## GitHub Pages deployment

1. Create a GitHub repository.
2. Upload the contents of this directory to the repository root.
3. Open **Settings -> Pages**.
4. Choose **Deploy from a branch**.
5. Select `main` and `/ (root)`.
6. Save.

The resulting GitHub Pages URL can be used as the experiment link.

## Participant IDs from a recruitment platform

The page automatically reads participant IDs from any of these URL parameters if present:

- `PROLIFIC_PID`
- `participant_id`
- `pid`

Example:

`https://YOURNAME.github.io/YOURREPO/?PROLIFIC_PID=abc123`

## Important: static hosting

GitHub Pages cannot store participants' responses on its own. This version therefore requires each participant to download the CSV at the end. For unattended online data collection, connect the page to a backend, database, or data-collection service.

## Files

- `index.html` - page shell
- `style.css` - Stanford / Qualtrics-like theme
- `app.js` - randomization, experiment flow, logging, CSV export
- `data/16_5_8.csv` - supplied 16-round sender sequences
- `data/20_6_10.csv` - supplied 20-round sender sequences


## CSV summary row

The final CSV line is `summary_first_16` and reports `red_guess_percentage_first_16`, the percentage of RED responses across rounds 1-16. For Experiment 16 this covers all training rounds; for Experiment 20 it uses rounds 1-16 only.
