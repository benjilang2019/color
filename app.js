// Stimuli are embedded so the experiment works both on GitHub Pages and when
// index.html is opened directly from disk (file://). The matrices are exact
// copies of the supplied CSV files. Participants are randomized first to one
// file and then independently to one of its three columns.
const DATA_FILES = [
  {
    experiment: 16,
    filename: '16_5_8.csv',
    matrix: [
      [1,1,1],[0,0,1],[1,0,0],[1,1,1],
      [0,1,1],[0,1,0],[1,0,0],[1,1,1],
      [0,0,1],[0,1,0],[1,1,1],[1,0,1],
      [1,0,1],[1,1,0],[1,1,1],[0,1,0]
    ]
  },
  {
    experiment: 20,
    filename: '20_6_10.csv',
    matrix: [
      [1,1,1],[1,1,0],[0,1,0],[0,0,1],[1,1,1],
      [1,1,1],[1,0,1],[0,0,1],[0,0,0],[1,1,0],
      [0,1,0],[0,0,0],[1,1,0],[0,1,1],[0,1,1],
      [1,0,0],[1,0,1],[1,0,1],[1,1,1],[1,1,1]
    ]
  }
];

const content = document.querySelector('#surveyContent');
const progressBar = document.querySelector('#progressBar');

function exactRandomIndex(n) {
  const max = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= max);
  return buf[0] % n;
}

function nowISO() { return new Date().toISOString(); }
function safeId(v) { return String(v || '').replace(/[^a-zA-Z0-9_-]/g, '_'); }
function money(cents) { return `$${(cents / 100).toFixed(2)}`; }

function participantIdFromUrl() {
  const p = new URLSearchParams(location.search);
  return p.get('PROLIFIC_PID') || p.get('participant_id') || p.get('pid') || '';
}

function randomParticipantId() {
  const b = new Uint32Array(2);
  crypto.getRandomValues(b);
  return `P-${b[0].toString(36)}${b[1].toString(36)}`.toUpperCase();
}

function makeSessionId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint32Array(4);
  crypto.getRandomValues(b);
  return `S-${Array.from(b, n => n.toString(16).padStart(8, '0')).join('')}`;
}

let state = {
  participant_id: participantIdFromUrl() || randomParticipantId(),
  session_id: makeSessionId(),
  source_csv: null,
  experiment: null,
  sequence_column: null,
  sequence: [],
  round: 0,
  started_at: null,
  completed_at: null,
  trials: [],
  earnings_cents: 0,
  final_choice: null,
  final_rt_ms: null,
  phase: 'intro'
};

let responseStart = 0;
let clickLocked = false;
let waitTimer = null;

function setProgress(pct) {
  progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function render(html, pct = 0) {
  content.innerHTML = html;
  setProgress(pct);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function navButton(label = 'Next') {
  return `<button type="button" id="nextButton" class="qualtrics-button">${label}</button>`;
}

function intro() {
  state.phase = 'intro';
  render(`
    <section class="qblock">
      <h1 class="qtitle intro-title">Mind Reading Game</h1>
      <p class="copy">In this study, you will play a short coordination game with another player.</p>
      <div class="notice payoff-notice">
        <strong>Payment rule:</strong> If your selection matches your partner's selection, you win <strong>$0.05</strong>. Otherwise, you lose <strong>$0.05</strong>. Your total amount can never be negative.
      </div>
      <p class="copy">Please read the instructions carefully. The task works best if you complete it in one sitting without refreshing the page.</p>
    </section>
    <div class="nav-row">${navButton('Next')}</div>
  `, 4);
  document.querySelector('#nextButton').addEventListener('click', gameInstructions);
}

function gameInstructions() {
  state.phase = 'instructions';
  render(`
    <section class="qblock">
      <h1 class="qtitle">Instructions</h1>
      <p class="copy">The game has two roles: a <strong>Sender</strong> and a <strong>Receiver</strong>.</p>
      <p class="copy">On every round, the Sender selects one of two colors: <strong>blue</strong> or <strong>red</strong>. The Receiver tries to predict which color the Sender selected.</p>
      <p class="copy">If your selection matches your partner's selection, you win <strong>$0.05</strong>. If it does not match, you lose <strong>$0.05</strong>. Your total amount will never be allowed to fall below <strong>$0.00</strong>.</p>
      <p class="copy">The goal is to coordinate with your partner as accurately as possible across the game.</p>
    </section>
    <div class="nav-row">${navButton('Next')}</div>
  `, 8);
  document.querySelector('#nextButton').addEventListener('click', roleAssignment);
}

function roleAssignment() {
  state.phase = 'role';
  render(`
    <section class="qblock">
      <h1 class="qtitle">Your role</h1>
      <p class="copy">You have been assigned to play the following role:</p>
      <div class="role-box">
        <div class="label">Your role is</div>
        <div class="role">Receiver</div>
      </div>
      <p class="copy">On each round, your task is to predict the color selected by your partner, the Sender.</p>
    </section>
    <div class="nav-row">${navButton('Next')}</div>
  `, 12);
  document.querySelector('#nextButton').addEventListener('click', scramblerInstructions);
}

function scramblerInstructions() {
  state.phase = 'scrambler';
  render(`
    <section class="qblock">
      <h1 class="qtitle">Important information about the signal</h1>
      <p class="copy">A random <strong>scrambler</strong> can occasionally interfere with the Sender's signal. On some rounds, the signal you receive may therefore be the wrong signal.</p>
      <p class="copy">You will not be told how often the scrambler operates or on which rounds it is active.</p>

      <div class="scrambler-diagram" aria-label="Sender signal passes through a possible scrambler before reaching the Receiver">
        <div class="diagram-node"><strong>Sender</strong><span>selects a color</span></div>
        <div class="diagram-arrow">→</div>
        <div class="diagram-node"><div class="scrambler-icon">⚄</div><strong>Scrambler</strong><span>may alter the signal</span></div>
        <div class="diagram-arrow">→</div>
        <div class="diagram-node"><strong>You</strong><span>guess as Receiver</span></div>
      </div>

      <div class="notice">Try to infer your partner's underlying color preference from the pattern you observe across rounds, rather than relying on any single round.</div>
      <div class="notice payoff-notice"><strong>Reminder:</strong> A match adds <strong>$0.05</strong>, a mismatch subtracts <strong>$0.05</strong>, and your total amount can never go below <strong>$0.00</strong>.</div>
      <p class="copy">Before each round, you will briefly wait while your partner makes a selection. After you choose a color, you will be told whether you matched your partner and your current total amount.</p>
    </section>
    <div class="nav-row">${navButton('Begin')}</div>
  `, 16);
  document.querySelector('#nextButton').addEventListener('click', assignAndStart);
}

function assignAndStart() {
  render(`<div class="loading">Preparing the game...</div>`, 16);

  try {
    const file = DATA_FILES[exactRandomIndex(DATA_FILES.length)];
    const column = exactRandomIndex(3);
    const matrix = file.matrix;

    if (!Array.isArray(matrix) || matrix.length !== file.experiment) {
      throw new Error(`${file.filename} should have ${file.experiment} rows.`);
    }
    if (matrix.some(row => !Array.isArray(row) || row.length !== 3)) {
      throw new Error(`${file.filename} must contain exactly three stimulus columns.`);
    }

    const sequence = matrix.map(row => row[column]);
    if (sequence.some(v => v !== 0 && v !== 1)) {
      throw new Error(`${file.filename} contains a value other than 0 or 1.`);
    }

    state.source_csv = file.filename;
    state.experiment = file.experiment;
    state.sequence_column = column + 1;
    state.sequence = sequence;
    state.round = 0;
    state.started_at = nowISO();
    state.trials = [];
    state.earnings_cents = 0;
    state.phase = 'waiting';
    saveSession();
    beginNextRound();
  } catch (err) {
    render(`
      <div class="error-box">
        <strong>The experiment could not initialize its stimuli.</strong><br>
        ${escapeHtml(err.message)}
      </div>
    `, 16);
  }
}

function trialProgress() {
  return 18 + (68 * state.round / state.experiment);
}

function beginNextRound() {
  if (waitTimer !== null) {
    clearTimeout(waitTimer);
    waitTimer = null;
  }
  if (state.round >= state.experiment) {
    finalQuestion();
    return;
  }
  showWaiting();
  waitTimer = window.setTimeout(() => {
    waitTimer = null;
    showTrial();
  }, 3000);
}

function showWaiting() {
  state.phase = 'waiting';
  saveSession();
  render(`
    <section class="qblock waiting-wrap" aria-live="polite">
      <div class="waiting-message">Waiting for your partner to make a selection ....</div>
    </section>
  `, trialProgress());
}

function showTrial() {
  if (state.round >= state.experiment) return finalQuestion();
  state.phase = 'trial';
  clickLocked = false;

  render(`
    <section class="qblock color-question">
      <div class="color-prompt">What color does your partner want you to click on this round?</div>
      <div class="color-options" role="radiogroup" aria-label="Choose a color">
        ${colorButton(0, 'BLUE')}
        <div class="or" aria-hidden="true">or</div>
        ${colorButton(1, 'RED')}
      </div>
    </section>
  `, trialProgress());

  responseStart = performance.now();
  document.querySelectorAll('.color-choice').forEach(button => {
    button.addEventListener('click', () => chooseTrialColor(Number(button.dataset.value), button));
  });
}

function colorButton(value, label) {
  const color = value === 1 ? 'red' : 'blue';
  return `
    <button type="button" class="color-choice" data-value="${value}" role="radio" aria-checked="false" aria-label="${label}">
      <span class="color-square ${color}" aria-hidden="true"></span>
      <span class="color-name">${label}</span>
    </button>
  `;
}

function chooseTrialColor(choice, button) {
  if (clickLocked) return;
  clickLocked = true;
  button.classList.add('selected');
  button.setAttribute('aria-checked', 'true');

  const rt = Math.round(performance.now() - responseStart);
  const signal = state.sequence[state.round];
  const correct = choice === signal;
  const amountBefore = state.earnings_cents;
  state.earnings_cents = correct
    ? state.earnings_cents + 5
    : Math.max(0, state.earnings_cents - 5);
  const amountAfter = state.earnings_cents;

  state.trials.push({
    round: state.round + 1,
    sender_signal: signal,
    participant_choice: choice,
    correct: correct ? 1 : 0,
    rt_ms: rt,
    answered_at: nowISO(),
    amount_before_cents: amountBefore,
    amount_after_cents: amountAfter
  });
  state.phase = 'feedback';
  saveSession();

  window.setTimeout(() => showFeedback(correct, choice), 180);
}

function showFeedback(correct, participantChoice) {
  state.phase = 'feedback';
  const color = participantChoice === 1 ? 'red' : 'blue';
  const label = participantChoice === 1 ? 'RED' : 'BLUE';
  const message = correct
    ? `Correct! You matched your partner's selection and won $0.05!`
    : `Incorrect! You didn't match your partner's selection and lost $0.05.`;

  render(`
    <section class="qblock feedback-wrap">
      <h1 class="feedback-heading ${correct ? 'correct' : 'incorrect'}">${message}</h1>
      <div class="feedback-choice">
        <span class="color-square ${color}" aria-hidden="true"></span>
        <span class="color-name">YOUR CHOICE: ${label}</span>
      </div>
      <div class="balance-box">Total amount: <strong>${money(state.earnings_cents)}</strong></div>
    </section>
    <div class="nav-row">${navButton('Next')}</div>
  `, Math.min(86, trialProgress() + (68 / state.experiment) * 0.55));

  document.querySelector('#nextButton').addEventListener('click', () => {
    state.round += 1;
    state.phase = state.round >= state.experiment ? 'final' : 'waiting';
    saveSession();
    beginNextRound();
  });
}

function finalQuestion() {
  state.phase = 'final';
  clickLocked = false;
  render(`
    <section class="qblock">
      <h1 class="qtitle">Final Question</h1>
      <div class="separator"></div>
      <div class="color-question final-choice-block">
        <div class="color-prompt">What do you think your partner's true choice was?</div>
        <div class="color-options" role="radiogroup" aria-label="Final color judgment">
          ${colorButton(0, 'BLUE')}
          <div class="or" aria-hidden="true">or</div>
          ${colorButton(1, 'RED')}
        </div>
      </div>
    </section>
    <div class="nav-row">
      <button type="button" id="submitButton" class="qualtrics-button" disabled>Submit</button>
    </div>
  `, 94);

  let selected = null;
  responseStart = performance.now();
  const submit = document.querySelector('#submitButton');

  document.querySelectorAll('.color-choice').forEach(button => {
    button.addEventListener('click', () => {
      selected = Number(button.dataset.value);
      document.querySelectorAll('.color-choice').forEach(b => {
        const isSelected = b === button;
        b.classList.toggle('selected', isSelected);
        b.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      });
      submit.disabled = false;
    });
  });

  submit.addEventListener('click', () => {
    if (selected !== 0 && selected !== 1) return;
    state.final_choice = selected;
    state.final_rt_ms = Math.round(performance.now() - responseStart);
    state.completed_at = nowISO();
    state.phase = 'complete';
    saveSession();
    completionPage();
  });
}

function completionPage() {
  const csv = buildCsv();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const stamp = state.completed_at.replace(/[:.]/g, '-');
  const filename = `mind_reading_${safeId(state.participant_id)}_${stamp}.csv`;

  render(`
    <section class="qblock">
      <h1 class="qtitle intro-title">Thank you</h1>
      <p class="copy">You have completed the study.</p>
      <p class="copy">Your total amount is <strong>${money(state.earnings_cents)}</strong>.</p>
      <p class="copy">Your participant ID is <strong>${escapeHtml(state.participant_id)}</strong>.</p>
      <div class="warning"><strong>Please download your response file before closing this page.</strong> This GitHub Pages version stores no responses on a server.</div>
    </section>
    <div class="nav-row">
      <a class="qualtrics-button download-button" href="${url}" download="${filename}">Download CSV</a>
    </div>
  `, 100);
}

function buildCsv() {
  const columns = [
    'record_type','participant_id','session_id','source_csv','experiment','sequence_column','round',
    'sender_signal','participant_choice','correct','rt_ms','answered_at',
    'amount_before_usd','amount_after_usd','final_rt_ms',
    'started_at','completed_at','total_amount_usd','final_choice_code',
    'red_selection_percentage','final_selection'
  ];

  const finalSelection = state.final_choice === 1 ? 'RED' : state.final_choice === 0 ? 'BLUE' : '';

  // Trial rows contain only round-level data. The overall RED percentage and
  // final RED/BLUE judgment are written only on the final summary row.
  const rows = state.trials.map(t => [
    'trial', state.participant_id, state.session_id, state.source_csv, state.experiment,
    state.sequence_column, t.round, t.sender_signal, t.participant_choice, t.correct,
    t.rt_ms, t.answered_at, (t.amount_before_cents / 100).toFixed(2), (t.amount_after_cents / 100).toFixed(2),
    '', state.started_at, state.completed_at, (state.earnings_cents / 100).toFixed(2), '', '', ''
  ]);

  // Use every training round in the participant's assigned condition:
  // 16 rounds for Experiment 16, or 20 rounds for Experiment 20.
  const redCountAll = state.trials.reduce((sum, t) => sum + (t.participant_choice === 1 ? 1 : 0), 0);
  const redPctAll = state.trials.length ? (100 * redCountAll / state.trials.length).toFixed(2) : '';

  // The final CSV line reports the percentage of training selections that were
  // RED, followed by the participant's final RED/BLUE choice.
  const summary = [
    'summary', state.participant_id, state.session_id, state.source_csv,
    state.experiment, state.sequence_column, 'SUMMARY', '', '', '', '', '',
    '', '', state.final_rt_ms, state.started_at, state.completed_at,
    (state.earnings_cents / 100).toFixed(2), state.final_choice, redPctAll, finalSelection
  ];

  return [columns, ...rows, summary]
    .map(row => row.map(csvEscape).join(','))
    .join('\n');
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function escapeHtml(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function saveSession() {
  sessionStorage.setItem('mindReadingStateV7', JSON.stringify(state));
}

window.addEventListener('beforeunload', event => {
  if (state.started_at && !state.completed_at) {
    event.preventDefault();
    event.returnValue = '';
  }
});

intro();
