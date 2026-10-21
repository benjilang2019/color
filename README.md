# Mind Reading Game - GitHub Pages version

This build uses the University of Pennsylvania header and reproduces the requested Sender/Receiver color-choice task. It works both on GitHub Pages and when `index.html` is opened directly from disk.

## Random assignment

At the start of the game, the browser performs two independent random assignments:

1. Equal-probability assignment to one of the two supplied stimulus sets:
   - `16_5_8.csv` -> 16 rounds
   - `20_6_10.csv` -> 20 rounds
2. Equal-probability assignment to column 1, 2, or 3 within the selected stimulus set.

The selected column is read top-to-bottom as the Sender's sequence:

- `1 = red`
- `0 = blue`

The two supplied CSV matrices are embedded directly in `app.js`. There is no `data/` folder and no external CSV file is loaded at runtime, so local testing does not require `fetch()` or a local web server.

## Experimental flow

- Participants are told that matching the partner wins $0.05 and failing to match loses $0.05.
- The running amount is never allowed to fall below $0.00.
- Every participant is assigned the Receiver role.
- Participants receive the scrambler/noisy-signal explanation and a reminder that their total amount can never fall below $0.00.
- Before every training round, the screen displays **"Waiting for your partner to make a selection ...."** for exactly 3 seconds.
- The participant-facing screens do **not** display the round number or total number of rounds while training data are presented.
- The participant then selects BLUE or RED.
- Correct feedback reads: **"Correct! You matched your partner's selection and won $0.05!"**
- Incorrect feedback reads: **"Incorrect! You didn't match your partner's selection and lost $0.05."**
- Every feedback screen displays the current total amount.
- After all 16 or 20 training rounds, participants answer: **"What do you think your partner's true choice was?"** with BLUE and RED as options.
- The participant then downloads the result CSV.

## Output CSV

Each trial records:

- participant ID and session ID
- source CSV filename
- experiment length
- randomly assigned sequence column
- round number
- Sender selection (`1 = red`, `0 = blue`)
- participant selection
- correctness
- response time and timestamp
- amount before and after the round
- final choice and final response time

The **last line** is a `summary` row. It includes:

- `red_selection_percentage`: percentage of all training-round selections made by the participant that were RED (16 rounds in Experiment 16; 20 rounds in Experiment 20)
- `final_selection`: `RED` or `BLUE`
- `total_amount_usd`: final accumulated amount

## Participant IDs

If present, any of these URL parameters are used as the participant ID:

- `PROLIFIC_PID`
- `participant_id`
- `pid`

Otherwise, an anonymous random participant ID is generated.

## Deploy on GitHub Pages

1. Create a GitHub repository.
2. Upload the contents of this folder to the repository root.
3. In GitHub, open **Settings -> Pages**.
4. Choose **Deploy from a branch**.
5. Select `main` and `/ (root)`.
6. Save.

## Local testing

Simply double-click `index.html`. No web server is required.

## Static-hosting limitation

GitHub Pages cannot centrally store participant data by itself. This version creates a downloadable CSV at the end. A server/database endpoint would be needed for automatic central collection.


## Final CSV summary row

The last line of each downloaded CSV is a `summary` row. `red_selection_percentage` is calculated over **all training rounds in the participant's assigned condition** (16 rounds in Experiment 16 or 20 rounds in Experiment 20). The final column, `final_selection`, records the participant's final `RED` or `BLUE` answer to the question about the partner's true choice.
