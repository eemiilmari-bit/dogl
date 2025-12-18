const quizData = [
  {
    id: 'q1',
    question: 'Ooks dedaxii koiran Kaa',
    correctAnswer: 'Joo',
    type: 'choice'
  },
  {
    id: 'q2',
    question: 'Miksi Eemi sanoo moii',
    correctAnswer: 'se haus',
    type: 'text'
  },
  {
    id: 'q3',
    question: 'Kuka pidättää crashoutdogen tekijänoikeudet?',
    correctAnswer: 'Eemi',
    type: 'text'
  },
  {
    id: 'q4',
    question: 'Hoah!!',
    correctAnswer: 'se on sarkastinen nauru',
    type: 'choice'
  }
];

const verdictMap = {
  perfect: 'kylpmast',
  imperfect: 'clown'
};

const form = document.getElementById('quiz-form');
const feedbackEl = document.getElementById('feedback');
const reviewEl = document.getElementById('review');
const reviewToggle = document.getElementById('review-toggle');
let lastResults = null;

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const answers = collectAnswers();
  const results = evaluate(answers);
  lastResults = results;
  renderFeedback(results);
  renderReview(results);
  reviewToggle.disabled = false;
  pulseButton(reviewToggle);
  sendWebhook(results);
  playTone(results.score === results.total ? 'good' : 'bad');
});

reviewToggle.addEventListener('click', () => {
  if (!lastResults) return;
  reviewEl.classList.toggle('hidden');
  pulseButton(reviewToggle);
});

function collectAnswers() {
  const data = {};
  quizData.forEach((item) => {
    const field = form.elements[item.id];
    if (!field) return;

    if (item.type === 'choice') {
      const chosen = [...form.querySelectorAll(`input[name="${item.id}"]`)].find((input) => input.checked);
      data[item.id] = chosen ? chosen.value : '';
    } else {
      data[item.id] = field.value.trim();
    }
  });
  return data;
}

function evaluate(answers) {
  let score = 0;
  const detail = quizData.map((item) => {
    const userAnswer = (answers[item.id] || '').trim();
    const correctAnswer = item.correctAnswer;
    const correct = normalize(userAnswer) === normalize(correctAnswer);
    if (correct) score += 1;
    return { ...item, userAnswer, correct, correctAnswer };
  });

  const total = quizData.length;
  const verdict = score === total ? verdictMap.perfect : verdictMap.imperfect;
  return { score, total, verdict, detail };
}

function renderFeedback(results) {
  feedbackEl.innerHTML = '';
  feedbackEl.classList.remove('hidden');

  const verdictEl = document.createElement('div');
  verdictEl.className = `verdict ${results.verdict === verdictMap.perfect ? 'good' : 'bad'}`;
  verdictEl.textContent = results.verdict === verdictMap.perfect ? 'kylpmast' : 'clown';

  const summary = document.createElement('p');
  summary.textContent = `${results.score} / ${results.total} correct`;
  summary.className = 'muted';

  const feedbackTitle = document.createElement('h3');
  feedbackTitle.textContent = 'Feedback';

  const note = document.createElement('p');
  note.textContent = results.verdict === verdictMap.perfect
    ? 'All green. You vibed with every prompt.'
    : 'Missed something. Review and try again.';

  feedbackEl.append(feedbackTitle, verdictEl, summary, note);
}

function renderReview(results) {
  reviewEl.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = 'Your answers';
  reviewEl.appendChild(title);

  results.detail.forEach((item, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'review-item';

    const heading = document.createElement('p');
    heading.innerHTML = `<span class="number">${index + 1}</span> ${item.question}`;

    const badge = document.createElement('span');
    badge.className = `badge ${item.correct ? 'good' : 'bad'}`;
    badge.textContent = item.correct ? 'correct' : 'wrong';

    const answered = document.createElement('p');
    answered.innerHTML = `<strong>You:</strong> ${escapeHtml(item.userAnswer) || '<em>empty</em>'}`;

    const expected = document.createElement('p');
    expected.innerHTML = `<strong>Correct:</strong> ${item.correctAnswer}`;

    wrapper.append(heading, badge, answered, expected);
    reviewEl.appendChild(wrapper);
  });
}

function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, '').trim();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pulseButton(button) {
  button.classList.remove('pop');
  void button.offsetWidth;
  button.classList.add('pop');
  setTimeout(() => button.classList.remove('pop'), 220);
}

function playTone(type) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  const isGood = type === 'good';
  osc.frequency.value = isGood ? 720 : 260;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.45);
}

async function sendWebhook(results) {
  const payload = {
    username: 'Quiz Reporter',
    content: `Result: ${results.verdict} | ${results.score}/${results.total} correct`,
    embeds: [
      {
        title: 'Answer sheet',
        color: results.verdict === verdictMap.perfect ? 0x10b981 : 0xef4444,
        fields: results.detail.map((item, idx) => ({
          name: `${idx + 1}. ${item.question}`,
          value: `You: ${item.userAnswer || 'empty'}\nCorrect: ${item.correctAnswer}\nStatus: ${item.correct ? 'correct' : 'wrong'}`,
          inline: false
        }))
      }
    ]
  };

  try {
    await fetch('https://discord.com/api/webhooks/1436017056104316938/lJEKNoaT37qgm4WeWao_gRBS5bdnnKkI7WOOMznnC5JBudgUtGWzCbcp5EqYz9t56ko6', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.warn('Webhook failed', error);
  }
}
