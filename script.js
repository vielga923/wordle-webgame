const USE_EXTERNAL_WORDS = false;
const FALLBACK_WORDS = {
  4: [
    "able",
    "area",
    "bake",
    "ball",
    "blue",
    "bold",
    "calm",
    "care",
    "dark",
    "dawn",
    "easy",
    "echo",
    "fire",
    "game",
    "glow",
    "gold",
    "home",
    "hope",
    "jump",
    "kind",
    "lake",
    "lime",
    "love",
    "lunar",
    "mile",
    "moon",
    "note",
    "open",
    "play",
    "rain",
    "road",
    "rose",
    "star",
    "team",
    "tree",
    "wave",
    "wind",
  ],
  5: [
    "apple",
    "beach",
    "blaze",
    "brave",
    "candy",
    "charm",
    "chess",
    "chime",
    "civic",
    "climb",
    "cloud",
    "coral",
    "crane",
    "crisp",
    "daisy",
    "dream",
    "eager",
    "earth",
    "ember",
    "fable",
    "flame",
    "flora",
    "frame",
    "frost",
    "giant",
    "globe",
    "grain",
    "grape",
    "green",
    "heart",
    "honey",
    "jelly",
    "lemon",
    "light",
    "lunar",
    "magic",
    "maple",
    "metal",
    "model",
    "ocean",
    "olive",
    "orbit",
    "pearl",
    "piano",
    "place",
    "plant",
    "point",
    "prism",
    "quiet",
    "radio",
    "raven",
    "river",
    "robot",
    "royal",
    "rusty",
    "scale",
    "scene",
    "shine",
    "shore",
    "solar",
    "spice",
    "spoon",
    "stack",
    "stair",
    "stone",
    "story",
    "sugar",
    "sweep",
    "swing",
    "table",
    "taste",
    "theme",
    "tiger",
    "toast",
    "torch",
    "trail",
    "train",
    "treat",
    "vivid",
    "vowel",
    "water",
    "whale",
    "widen",
    "worry",
    "zebra",
  ],
  6: [
    "artist",
    "bright",
    "candle",
    "castle",
    "circle",
    "coffee",
    "dreamy",
    "famous",
    "flower",
    "forest",
    "friend",
    "golden",
    "guitar",
    "honest",
    "island",
    "jungle",
    "kitten",
    "listen",
    "little",
    "marble",
    "market",
    "modern",
    "orange",
    "planet",
    "pocket",
    "purple",
    "random",
    "rocket",
    "school",
    "silver",
    "simple",
    "smooth",
    "spring",
    "street",
    "summer",
    "sunset",
    "travel",
    "turtle",
    "velvet",
    "window",
    "winter",
  ],
};
const MAX_ROWS = 6;
const emptyBoard = (length) =>
  Array.from({ length: MAX_ROWS }, () =>
    Array.from({ length }, () => ({ letter: "", state: "empty" })),
  );
const defaultStats = {
  played: 0,
  wins: 0,
  streak: 0,
  best: 0,
  distribution: [0, 0, 0, 0, 0, 0],
};
const $ = (id) => document.getElementById(id);
const gamePage = $("gamePage");
const boardElement = $("board");
let roundTimer = null;
let milestoneTimer = null;

function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem("wordle-remake-stats"));
    return {
      ...defaultStats,
      ...saved,
      distribution: Array.isArray(saved?.distribution)
        ? saved.distribution.slice(0, 6).concat([0, 0, 0, 0, 0, 0]).slice(0, 6)
        : [...defaultStats.distribution],
    };
  } catch {
    return { ...defaultStats, distribution: [...defaultStats.distribution] };
  }
}
function saveStats() {
  localStorage.setItem("wordle-remake-stats", JSON.stringify(state.stats));
}
function savePreferences() {
  localStorage.setItem("wordle-dark-mode", String(state.darkMode));
  localStorage.setItem(
    "wordle-animations-enabled",
    String(state.animationsEnabled),
  );
  localStorage.setItem("wordle-length", String(state.length));
}
function isValidWord(word, length = state.length) {
  return (
    typeof word === "string" && new RegExp(`^[a-z]{${length}}$`).test(word)
  );
}
function randomFallback() {
  const list = FALLBACK_WORDS[state.length].filter((word) => isValidWord(word));
  return list[Math.floor(Math.random() * list.length)];
}

const savedLength = Number(localStorage.getItem("wordle-length"));
const state = {
  length: [4, 5, 6].includes(savedLength) ? savedLength : 5,
  answer: "",
  board: [],
  guess: "",
  row: 0,
  result: "playing",
  notice: "Make your first guess",
  revealingRow: null,
  celebratingRow: null,
  answerReveal: null,
  milestone: null,
  loadingWord: false,
  stats: loadStats(),
  darkMode: localStorage.getItem("wordle-dark-mode") === "true",
  animationsEnabled:
    localStorage.getItem("wordle-animations-enabled") !== "false",
};
state.board = emptyBoard(state.length);

async function fetchExternalWord() {
  if (!USE_EXTERNAL_WORDS) return randomFallback();
  try {
    const response = await fetch(
      `https://random-word-api.herokuapp.com/word?number=1&length=${state.length}`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error("word source unavailable");
    const words = await response.json();
    const word = Array.isArray(words)
      ? String(words[0] || "")
          .toLowerCase()
          .trim()
      : "";
    if (isValidWord(word)) return word;
  } catch {
    console.warn("External word source unavailable; using curated fallback.");
  }
  return randomFallback();
}
async function refreshWord(message = "Make your first guess") {
  state.loadingWord = true;
  state.notice = "Finding a fresh word...";
  render();
  state.answer = await fetchExternalWord();
  state.loadingWord = false;
  state.notice = message;
  render();
}

function evaluate(guess, answer) {
  const result = guess.split("").map((letter) => ({ letter, state: "absent" }));
  const remaining = answer.split("");
  result.forEach((tile, index) => {
    if (tile.letter === answer[index]) {
      tile.state = "correct";
      remaining[index] = "_";
    }
  });
  result.forEach((tile) => {
    if (tile.state !== "absent") return;
    const index = remaining.indexOf(tile.letter);
    if (index >= 0) {
      tile.state = "present";
      remaining[index] = "_";
    }
  });
  return result;
}
function percentage() {
  return state.stats.played
    ? Math.round((state.stats.wins / state.stats.played) * 100)
    : 0;
}

function renderStats() {
  $("modalPlayed").textContent = state.stats.played;
  $("modalWins").textContent = state.stats.wins;
  $("modalBest").textContent = state.stats.best;
  $("modalStreak").textContent = state.stats.streak;
  $("modalWinRate").textContent = `${percentage()}%`;
  $("distributionTotal").textContent = `${state.stats.wins} SOLVED`;
  const distribution = $("guessDistribution");
  const max = Math.max(1, ...state.stats.distribution);
  distribution.innerHTML = state.stats.distribution
    .map(
      (count, index) =>
        `<div class="distribution-row"><span>${index + 1}</span><div class="distribution-bar" style="width:${Math.max(4, (count / max) * 100)}%">${count}</div><span>${count}</span></div>`,
    )
    .join("");
}
function render() {
  gamePage.className = `game-page ${state.darkMode ? "dark-mode" : ""} ${state.animationsEnabled ? "" : "motion-off"}`;
  $("roundNumber").textContent = String(state.stats.played + 1).padStart(
    2,
    "0",
  );
  $("streakNumber").textContent = state.stats.streak;
  $("playedCount").textContent = state.stats.played;
  $("winsCount").textContent = state.stats.wins;
  $("bestCount").textContent = state.stats.best;
  $("lengthKicker").textContent = `${state.length} LETTERS / SIX TRIES`;
  $("notice").textContent = state.notice;
  $("status").className = `status ${state.result}`;
  $("answerReveal").classList.toggle("hidden", !state.answerReveal);
  $("revealedWord").textContent = state.answerReveal
    ? state.answerReveal.toUpperCase()
    : "";
  $("darkModeToggle").checked = state.darkMode;
  $("animationsToggle").checked = state.animationsEnabled;
  document
    .querySelectorAll("[data-length]")
    .forEach((button) =>
      button.classList.toggle(
        "active",
        Number(button.dataset.length) === state.length,
      ),
    );
  renderStats();
  boardElement.className = `board length-${state.length}`;
  boardElement.innerHTML = "";
  state.board.forEach((line, rowIndex) => {
    const rowElement = document.createElement("div");
    rowElement.className = `row ${rowIndex === state.celebratingRow ? "celebration-row" : ""}`;
    line.forEach((tile, columnIndex) => {
      const tileElement = document.createElement("div");
      const currentLetter =
        rowIndex === state.row && columnIndex < state.guess.length
          ? state.guess[columnIndex]
          : "";
      const cursor =
        rowIndex === state.row &&
        columnIndex === state.guess.length &&
        state.result === "playing" &&
        state.revealingRow === null &&
        !state.loadingWord;
      tileElement.className = `tile ${tile.state} ${cursor ? "cursor" : ""}`;
      if (rowIndex === state.revealingRow)
        tileElement.classList.add("reveal-tile", `reveal-${columnIndex}`);
      if (rowIndex === state.celebratingRow)
        tileElement.classList.add("dance-tile", `dance-${columnIndex}`);
      tileElement.textContent = tile.letter || currentLetter;
      rowElement.appendChild(tileElement);
    });
    boardElement.appendChild(rowElement);
  });
}

function setDarkMode(value) {
  state.darkMode = value;
  savePreferences();
  render();
}
function setAnimations(value) {
  state.animationsEnabled = value;
  savePreferences();
  render();
}
function celebrateConfetti() {
  if (!state.animationsEnabled) return;
  const canvas = $("confettiCanvas");
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  const colors = [
    "#50fa7b",
    "#8be9fd",
    "#ff79c6",
    "#f1fa8c",
    "#bd93f9",
    "#ffb86c",
  ];
  const pieces = Array.from({ length: 240 }, (_, index) => ({
    x: Math.random() * width,
    y: -20 - Math.random() * height * 0.2,
    vx: (Math.random() - 0.5) * 5,
    vy: 2 + Math.random() * 5,
    gravity: 0.12 + Math.random() * 0.12,
    size: 5 + Math.random() * 9,
    color: colors[index % colors.length],
    rotation: Math.random() * 6,
    spin: (Math.random() - 0.5) * 0.28,
  }));
  const start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    context.clearRect(0, 0, width, height);
    pieces.forEach((piece) => {
      piece.x += piece.vx;
      piece.vy += piece.gravity;
      piece.y += piece.vy;
      piece.rotation += piece.spin;
      if (piece.x < -20) piece.x = width + 20;
      if (piece.x > width + 20) piece.x = -20;
      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.fillStyle = piece.color;
      context.fillRect(
        -piece.size / 2,
        -piece.size / 2,
        piece.size,
        piece.size * 0.58,
      );
      context.restore();
    });
    if (elapsed < 2800) requestAnimationFrame(frame);
    else context.clearRect(0, 0, width, height);
  }
  requestAnimationFrame(frame);
}
function showMilestone(streak) {
  if (![3, 5, 10].includes(streak)) return;
  $("milestonePop").className = `milestone-pop milestone-${streak}`;
  $("milestoneBurst").textContent =
    streak === 10 ? "★" : streak === 5 ? "✦" : "•";
  $("milestoneLabel").textContent =
    streak === 10
      ? "LEGENDARY STREAK"
      : streak === 5
        ? "HOT STREAK"
        : "STREAK MILESTONE";
  $("milestoneTitle").textContent = `${streak} IN A ROW`;
  $("milestoneCopy").textContent =
    streak === 10
      ? "The whole lab is lit up."
      : streak === 5
        ? "You are on a serious run."
        : "The signal is getting stronger.";
  clearTimeout(milestoneTimer);
  milestoneTimer = setTimeout(
    () => $("milestonePop").classList.add("hidden"),
    2800,
  );
}

function submit() {
  if (
    state.result !== "playing" ||
    state.revealingRow !== null ||
    state.loadingWord
  )
    return;
  if (state.guess.length !== state.length) {
    state.notice = `Your guess needs ${state.length} letters`;
    render();
    return;
  }
  const submittedRow = state.row;
  state.board[submittedRow] = evaluate(state.guess, state.answer);
  state.revealingRow = submittedRow;
  const submittedGuess = state.guess;
  render();
  setTimeout(
    () => finishGuess(submittedGuess, submittedRow),
    state.animationsEnabled ? 720 : 30,
  );
}
function finishGuess(guess, submittedRow) {
  state.revealingRow = null;
  if (guess === state.answer) {
    state.stats.played += 1;
    state.stats.wins += 1;
    state.stats.streak += 1;
    state.stats.best = Math.max(state.stats.best, state.stats.streak);
    state.stats.distribution[submittedRow] += 1;
    saveStats();
    state.result = "won";
    state.celebratingRow = submittedRow;
    state.notice = "You found it — nice work!";
    render();
    celebrateConfetti();
    showMilestone(state.stats.streak);
    return;
  }
  if (submittedRow === MAX_ROWS - 1) {
    state.stats.played += 1;
    state.stats.streak = 0;
    saveStats();
    state.result = "lost";
    state.answerReveal = state.answer;
    state.notice = "Answer revealed — next round loading";
    render();
    clearTimeout(roundTimer);
    roundTimer = setTimeout(newRound, 1700);
    return;
  }
  state.row = submittedRow + 1;
  state.guess = "";
  state.notice = "Guess locked — check the colors and try the next row";
  render();
}
async function newRound() {
  clearTimeout(roundTimer);
  state.board = emptyBoard(state.length);
  state.guess = "";
  state.row = 0;
  state.result = "playing";
  state.notice = "Make your first guess";
  state.revealingRow = null;
  state.celebratingRow = null;
  state.answerReveal = null;
  await refreshWord("Make your first guess");
}
async function chooseLength(length) {
  if (length === state.length) return;
  state.length = length;
  savePreferences();
  await newRound();
}
function openModal(id) {
  $(id).classList.remove("hidden");
}
function closeModal(id) {
  $(id).classList.add("hidden");
}

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === "Enter") return submit();
  if (event.key === "Backspace") {
    if (
      state.result === "playing" &&
      state.revealingRow === null &&
      !state.loadingWord
    ) {
      state.guess = state.guess.slice(0, -1);
      render();
    }
    return;
  }
  if (
    /^[a-zA-Z]$/.test(event.key) &&
    state.result === "playing" &&
    state.revealingRow === null &&
    !state.loadingWord &&
    state.guess.length < state.length
  ) {
    state.guess += event.key.toLowerCase();
    render();
  }
});
$("darkModeToggle").addEventListener("change", (event) =>
  setDarkMode(event.target.checked),
);
$("animationsToggle").addEventListener("change", (event) =>
  setAnimations(event.target.checked),
);
$("statsButton").addEventListener("click", () => openModal("statsModal"));
$("settingsButton").addEventListener("click", () => openModal("settingsModal"));
$("helpButton").addEventListener("click", () => openModal("helpModal"));
$("newRoundButton").addEventListener("click", newRound);
document
  .querySelectorAll("[data-length]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      chooseLength(Number(button.dataset.length)),
    ),
  );
document
  .querySelectorAll("[data-close]")
  .forEach((button) =>
    button.addEventListener("click", () => closeModal(button.dataset.close)),
  );
document.querySelectorAll(".overlay").forEach((overlay) =>
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal(overlay.id);
  }),
);
render();
refreshWord("Make your first guess");
