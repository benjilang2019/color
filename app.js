const SEQUENCES = {
  16: [
    [1,0,1,1,0,0,1,1,0,0,1,1,1,1,1,0],
    [1,0,0,1,1,1,0,1,0,1,1,0,0,1,1,1],
    [1,1,0,1,1,0,0,1,1,0,1,1,1,0,1,0]
  ],
  20: [
    [1,1,0,0,1,1,1,0,0,1,0,0,1,0,0,1,1,1,1,1],
    [1,1,1,0,1,1,0,0,0,1,1,1,1,1,0,0,0,0,1,1],
    [1,0,0,1,1,1,1,1,0,0,0,0,0,1,1,0,1,1,1,1]
  ]
};

const page = document.querySelector('#surveyPage');
const progressFill = document.querySelector('#progressFill');

const randomIndex = n => {
  const x = new Uint32Array(1);
  crypto.getRandomValues(x);
  return x[0] % n;
};

const nowISO = () => new Date().toISOString();
const safeId = s => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_');

function idFromUrl() {
  const q = new URLSearchParams(location.search);
  return q.get('PROLIFIC_PID') || q.get('participant_id') || q.get('pid') || '';
}

let state = {
  participant_id: idFromUrl(),
  session_id: crypto.randomUUID(),
  experiment: null,
  sequence: null,
  round: 0,
  score: 0,
  started_at: null,
  completed_at: null,
  selected_choice: null,
  trials: [],
  final_choice: null,
  final_rt_ms: null
};

let responseStart = 0;

function setProgress(pct) {
  progressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function render(html, pct = 0) {
  page.innerHTML = html;
  setProgress(pct);
  window.scrollTo({top: 0, behavior: 'instant'});
}

function nextButton(label = 'Next') {
  return `<button class="next-button" id="nextButton" type="button">${label}<span class="arrow" aria-hidden="true">→</span></button>`;
}

function intro() {
  render(`
    <div class="question-block">
      <h1 class="question-title large">Mind Reading Game</h1>
      <p class="question-copy">Thank you for participating in this research study.</p>
      <p class="question-copy">Please enter the participant ID provided by the study platform. Do not enter your name.</p>
    </div>

    <div class="question-block">
      <label class="field-label" for="participantId">Participant ID</label>
      <input class="text-input" id="participantId" type="text" autocomplete="off" spellcheck="false" value="${escapeHtml(state.participant_id)}">
    </div>

    <div class="nav-row">${nextButton()}</div>
  `, 2);

  const input = document.querySelector('#participantId');
  document.querySelector('#nextButton').addEventListener('click', () => {
    const value = input.value.trim();
    if (!value) {
      input.focus();
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    state.participant_id = value;
    roleIntro();
  });
}

function roleIntro() {
  render(`
    <div class="question-block">
      <h1 class="question-title large">Instructions</h1>
      <p class="question-copy">In this game, two players try to coordinate on a color choice.</p>
      <p class="question-copy">One player is the <strong>Sender</strong>. The Sender chooses a color. The other player is the <strong>Receiver</strong>. The Receiver tries to predict which color the Sender chose.</p>
      <p class="question-copy">You will be assigned a role for this game.</p>
    </div>
    <div class="nav-row">${nextButton('Continue')}</div>
  `, 5);
  document.querySelector('#nextButton').addEventListener('click', roleAssignment);
}

function roleAssignment() {
  render(`
    <div class="question-block">
      <h1 class="question-title large">Your role</h1>
      <p class="question-copy">Your role for this game is:</p>
      <div class="role-card">
        <div class="role-label">You are the</div>
        <div class="role-name">Receiver</div>
      </div>
      <p class="question-copy">Your task is to guess which color your partner, the Sender, wants you to choose on each round.</p>
    </div>
    <div class="nav-row">${nextButton()}</div>
  `, 8);
  document.querySelector('#nextButton').addEventListener('click', scramblerInstructions);
}

function scramblerInstructions() {
  render(`
    <div class="question-block">
      <h1 class="question-title large">Important: the signal may be noisy</h1>
      <p class="question-copy">On some rounds, a random <strong>scrambler</strong> may interfere with the Sender's signal. When that happens, the information you receive may not reflect what the Sender truly intended.</p>
      <p class="question-copy">You will not be told when the scrambler is active or how often it is active.</p>
      <div class="emphasis-box">Try to use the pattern across rounds to work out your partner's underlying color preference.</div>
      <p class="question-copy">After each round, you will learn whether your prediction matched the signal you received.</p>
    </div>
    <div class="nav-row">${nextButton('Begin')}</div>
  `, 11);
  document.querySelector('#nextButton').addEventListener('click', startExperiment);
}

function startExperiment() {
  // Equal-probability assignment to Experiment 16 vs Experiment 20,
  // then equal-probability assignment to one of the three sequences.
  state.experiment = randomIndex(2) === 0 ? 16 : 20;
  state.sequence = randomIndex(3) + 1;
  state.round = 0;
  state.score = 0;
  state.started_at = nowISO();
  state.trials = [];
  saveSession();
  showTrial();
}

function showTrial() {
  const total = state.experiment;
  if (state.round >= total) return finalQuestion();

  state.selected_choice = null;
  const pct = 12 + (74 * state.round / total);

  render(`
    <div class="round-meta">
      <span>Round ${state.round + 1} of ${total}</span>
      <span>Score: ${state.score}</span>
    </div>

    <div class="question-block">
      <h1 class="question-title">What color does your partner want you to click on this round?</h1>
      <div class="choice-list" role="radiogroup" aria-label="Color choice">
        ${choiceRow(0, 'BLUE')}
        ${choiceRow(1, 'RED')}
      </div>
    </div>

    <div class="nav-row">
      <button class="next-button" id="nextButton" type="button" disabled>Next<span class="arrow" aria-hidden="true">→</span></button>
    </div>
  `, pct);

  responseStart = performance.now();

  document.querySelectorAll('.choice-row').forEach(el => {
    el.addEventListener('click', () => selectChoice(Number(el.dataset.value)));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectChoice(Number(el.dataset.value));
      }
    });
  });

  document.querySelector('#nextButton').addEventListener('click', submitTrial);
}

function choiceRow(value, label) {
  const cls = value === 1 ? 'red' : 'blue';
  return `
    <button type="button" class="choice-row" data-value="${value}" role="radio" aria-checked="false">
      <span class="radio-ring" aria-hidden="true"></span>
      <span class="color-chip ${cls}" aria-hidden="true"></span>
      <span class="choice-label">${label}</span>
    </button>
  `;
}

function selectChoice(value) {
  state.selected_choice = value;
  document.querySelectorAll('.choice-row').forEach(el => {
    const selected = Number(el.dataset.value) === value;
    el.classList.toggle('selected', selected);
    el.setAttribute('aria-checked', selected ? 'true' : 'false');
  });
  document.querySelector('#nextButton').disabled = false;
}

function submitTrial() {
  if (state.selected_choice !== 0 && state.selected_choice !== 1) return;

  const rt = Math.round(performance.now() - responseStart);
  const signal = SEQUENCES[state.experiment][state.sequence - 1][state.round];
  const correct = state.selected_choice === signal;
  state.score = Math.max(0, state.score + (correct ? 1 : -1));

  state.trials.push({
    round: state.round + 1,
    sender_signal: signal,
    participant_choice: state.selected_choice,
    correct: correct ? 1 : 0,
    rt_ms: rt,
    answered_at: nowISO()
  });

  saveSession();
  showFeedback(correct, signal);
}

function showFeedback(correct, signal) {
  const total = state.experiment;
  const pct = 12 + (74 * (state.round + 0.5) / total);
  const signalLabel = signal === 1 ? 'RED' : 'BLUE';
  const signalClass = signal === 1 ? 'red' : 'blue';

  render(`
    <div class="round-meta">
      <span>Round ${state.round + 1} of ${total}</span>
      <span>Score: ${state.score}</span>
    </div>

    <div class="question-block">
      <h1 class="question-title">Round result</h1>
      <div class="feedback-panel">
        <div class="feedback-status ${correct ? 'correct' : 'incorrect'}">${correct ? 'Correct' : 'Incorrect'}</div>
        <div class="feedback-signal">
          <span class="color-chip ${signalClass}" aria-hidden="true"></span>
          <span>The signal received on this round was <strong>${signalLabel}</strong>.</span>
        </div>
      </div>
      <p class="small-copy">Remember: the scrambler may sometimes interfere with the Sender's signal.</p>
    </div>

    <div class="nav-row">${nextButton()}</div>
  `, pct);

  document.querySelector('#nextButton').addEventListener('click', () => {
    state.round += 1;
    saveSession();
    showTrial();
  });
}

function finalQuestion() {
  render(`
    <div class="question-block">
      <h1 class="question-title">Which color do you think was your partner's preferred choice all along?</h1>
      <p class="question-copy">Think about the entire sequence of rounds before answering.</p>
      <div class="choice-list" role="radiogroup" aria-label="Final color judgment">
        ${choiceRow(0, 'BLUE')}
        ${choiceRow(1, 'RED')}
      </div>
    </div>

    <div class="nav-row">
      <button class="next-button" id="nextButton" type="button" disabled>Submit<span class="arrow" aria-hidden="true">→</span></button>
    </div>
  `, 92);

  state.selected_choice = null;
  responseStart = performance.now();

  document.querySelectorAll('.choice-row').forEach(el => {
    el.addEventListener('click', () => selectChoice(Number(el.dataset.value)));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectChoice(Number(el.dataset.value));
      }
    });
  });

  document.querySelector('#nextButton').addEventListener('click', finishExperiment);
}

function finishExperiment() {
  if (state.selected_choice !== 0 && state.selected_choice !== 1) return;
  state.final_choice = state.selected_choice;
  state.final_rt_ms = Math.round(performance.now() - responseStart);
  state.completed_at = nowISO();
  saveSession();

  const csv = buildCsv();
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const filename = `mind_reading_${safeId(state.participant_id)}_${state.completed_at.replace(/[:.]/g, '-')}.csv`;

  render(`
    <div class="question-block">
      <h1 class="question-title large">Thank you</h1>
      <p class="question-copy">You have completed the Mind Reading Game.</p>
      <p class="question-copy">Please download your response file before closing this page.</p>
      <div class="warning"><strong>Important:</strong> This GitHub Pages version does not send your responses to a server automatically.</div>
    </div>

    <div class="nav-row">
      <a class="download-button" href="${url}" download="${filename}">Download responses (CSV)</a>
    </div>
  `, 100);

  sessionStorage.removeItem('mindReadingState');
}

function buildCsv() {
  const cols = [
    'record_type','participant_id','session_id','experiment','sequence','round',
    'sender_signal','participant_choice','correct','rt_ms','answered_at',
    'final_choice','final_rt_ms','final_score','started_at','completed_at',
    'red_guess_percentage_first_16'
  ];

  const rows = state.trials.map(t => [
    'trial',
    state.participant_id,
    state.session_id,
    state.experiment,
    state.sequence,
    t.round,
    t.sender_signal,
    t.participant_choice,
    t.correct,
    t.rt_ms,
    t.answered_at,
    state.final_choice,
    state.final_rt_ms,
    state.score,
    state.started_at,
    state.completed_at,
    ''
  ]);

  // Final summary line: percentage of RED guesses across the first 16 training trials.
  // For Experiment 16 this is the full training sequence; for Experiment 20 it is
  // deliberately restricted to rounds 1-16 so the statistic is comparable.
  const first16 = state.trials.slice(0, 16);
  const redCountFirst16 = first16.reduce((sum, t) => sum + (t.participant_choice === 1 ? 1 : 0), 0);
  const redPctFirst16 = first16.length ? (100 * redCountFirst16 / first16.length) : '';

  const summaryRow = [
    'summary_first_16',
    state.participant_id,
    state.session_id,
    state.experiment,
    state.sequence,
    'FIRST_16_SUMMARY',
    '',
    '',
    '',
    '',
    '',
    state.final_choice,
    state.final_rt_ms,
    state.score,
    state.started_at,
    state.completed_at,
    redPctFirst16 === '' ? '' : redPctFirst16.toFixed(2)
  ];

  return [cols, ...rows, summaryRow].map(row => row.map(csvEscape).join(',')).join('\n');
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function saveSession() {
  sessionStorage.setItem('mindReadingState', JSON.stringify(state));
}

window.addEventListener('beforeunload', event => {
  if (state.started_at && !state.completed_at) {
    event.preventDefault();
    event.returnValue = '';
  }
});

intro();
