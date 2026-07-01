// Game State
let board = Array(9).fill(null);
let gameActive = false;
let currentPlayer = "X"; // "X" always starts
let gameMode = "ai"; // "ai" or "pvp"
let aiDifficulty = "unbeatable"; // "easy" or "unbeatable"
let colorTheme = "neon"; // "neon", "cyber", "aurora", "royal"
let isSoundEnabled = true;

let playerNames = {
  X: "Player 1",
  O: "Computer"
};

let scores = {
  X: 0,
  ties: 0,
  O: 0
};

// History / Time Travel timeline representation
// moveHistory[0] is the starting state (empty board)
// Each moveHistory element: { boardState: Array(9), activePlayer: 'X'|'O', description: String, lastMoveCell: Number }
let moveHistory = [];
let currentTimelineIndex = 0;

// Web Audio API Synthesizer Setup
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Retro synth bloops
function playSynthSound(freqs, durations, type = "sine", delay = 0) {
  if (!isSoundEnabled) return;
  try {
    initAudio();
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    
    let time = audioCtx.currentTime + delay;
    
    freqs.forEach((freq, index) => {
      const dur = durations[index] || 0.1;
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      
      // Smooth frequency decay (bloop effect)
      if (freqs.length === 1 && type === "sine") {
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, time + dur);
      }
      
      gainNode.gain.setValueAtTime(0.12, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + dur);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start(time);
      osc.stop(time + dur);
      
      time += dur - 0.02; // slightly overlap
    });
  } catch (err) {
    console.warn("Audio Context error:", err);
  }
}

function playClickSound(marker) {
  if (marker === "X") {
    playSynthSound([520], [0.08], "sine");
  } else {
    playSynthSound([780], [0.08], "sine");
  }
}

function playWinSound() {
  // Arpeggio: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
  playSynthSound([523, 659, 784, 1046], [0.1, 0.1, 0.1, 0.25], "triangle");
}

function playTieSound() {
  // Melancholic dual note chord: 330Hz (E4) and 311Hz (D#4)
  playSynthSound([330, 311], [0.15, 0.25], "sawtooth");
}

function playSweepSound() {
  if (!isSoundEnabled) return;
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(850, audioCtx.currentTime + 0.18);
    
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.18);
  } catch (e) {}
}

// DOM Elements
const soundToggle = document.getElementById("sound-toggle");
const themeToggle = document.getElementById("theme-toggle");
const startBtn = document.getElementById("start-game-btn");
const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");

// Config inputs
const modeAiBtn = document.getElementById("mode-ai");
const modePvpBtn = document.getElementById("mode-pvp");
const difficultyGroup = document.getElementById("difficulty-group");
const player1NameInput = document.getElementById("player1-name");
const player2NameInput = document.getElementById("player2-name");
const player2Label = document.getElementById("player2-label");
const themeOptions = document.querySelectorAll(".theme-option");

// Game Screen controls
const boardEl = document.getElementById("board");
const cells = document.querySelectorAll(".cell");
const winLineSvg = document.getElementById("win-line-svg");
const winLine = document.getElementById("win-line");

const turnP1 = document.getElementById("turn-p1");
const turnP2 = document.getElementById("turn-p2");
const turnP1Name = document.getElementById("turn-p1-name");
const turnP2Name = document.getElementById("turn-p2-name");

const backBtn = document.getElementById("back-to-setup-btn");
const restartBtn = document.getElementById("restart-btn");
const resetScoresBtn = document.getElementById("reset-scores-btn");

// scoreboard
const scoreP1 = document.getElementById("score-p1");
const scoreP2 = document.getElementById("score-p2");
const scoreTies = document.getElementById("score-ties");
const scoreP1Label = document.getElementById("score-p1-label");
const scoreP2Label = document.getElementById("score-p2-label");

// History elements
const timelineList = document.getElementById("timeline-list");
const timelineStatus = document.getElementById("timeline-status");
const undoBtn = document.getElementById("undo-btn");

// Win Combinations
const WIN_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

// Winning SVG Line Coordinate mapping (on a 100x100 grid)
const WIN_LINE_COORDS = {
  "0,1,2": { x1: 5, y1: 16.6, x2: 95, y2: 16.6 },
  "3,4,5": { x1: 5, y1: 50, x2: 95, y2: 50 },
  "6,7,8": { x1: 5, y1: 83.3, x2: 95, y2: 83.3 },
  "0,3,6": { x1: 16.6, y1: 5, x2: 16.6, y2: 95 },
  "1,4,7": { x1: 50, y1: 5, x2: 50, y2: 95 },
  "2,5,8": { x1: 83.3, y1: 5, x2: 83.3, y2: 95 },
  "0,4,8": { x1: 5, y1: 5, x2: 95, y2: 95 },
  "2,4,6": { x1: 95, y1: 5, x2: 5, y2: 95 }
};

// Setup Event Listeners on initialization
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  loadScoresFromLocalStorage();
  setupSettingsUI();
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  
  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  });
}

// Sound Management
soundToggle.addEventListener("click", () => {
  isSoundEnabled = !isSoundEnabled;
  soundToggle.querySelector(".volume-on-icon").style.display = isSoundEnabled ? "block" : "none";
  soundToggle.querySelector(".volume-off-icon").style.display = isSoundEnabled ? "none" : "block";
});

// Load persistent scores from localStorage
function loadScoresFromLocalStorage() {
  const savedScores = localStorage.getItem("scores_cache");
  if (savedScores) {
    scores = JSON.parse(savedScores);
  }
}

// Setup Form Interactivity
function setupSettingsUI() {
  // Game Mode Toggle
  modeAiBtn.addEventListener("click", () => {
    gameMode = "ai";
    modeAiBtn.classList.add("active");
    modePvpBtn.classList.remove("active");
    difficultyGroup.classList.remove("hidden");
    
    player2Label.textContent = "Computer AI";
    player2NameInput.value = "Computer";
    player2NameInput.disabled = true;
  });

  modePvpBtn.addEventListener("click", () => {
    gameMode = "pvp";
    modePvpBtn.classList.add("active");
    modeAiBtn.classList.remove("active");
    difficultyGroup.classList.add("hidden");
    
    player2Label.textContent = "Player 2 Name";
    player2NameInput.value = "Player 2";
    player2NameInput.disabled = false;
  });

  // AI Difficulty selector
  const diffButtons = difficultyGroup.querySelectorAll(".btn-toggle");
  diffButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      diffButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      aiDifficulty = btn.dataset.diff;
    });
  });

  // Color Theme selector
  themeOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      themeOptions.forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      colorTheme = opt.dataset.colorTheme;
      document.documentElement.setAttribute("data-color-theme", colorTheme);
    });
  });

  // Start Button click
  startBtn.addEventListener("click", () => {
    playerNames.X = player1NameInput.value.trim() || "Player 1";
    playerNames.O = player2NameInput.value.trim() || (gameMode === "ai" ? "Computer" : "Player 2");
    
    // Clear move scores from localStorage if game setup changes
    const configKey = `${gameMode}_${playerNames.X}_${playerNames.O}_${aiDifficulty}`;
    const lastConfig = localStorage.getItem("last_config");
    if (lastConfig !== configKey) {
      scores = { X: 0, ties: 0, O: 0 };
      localStorage.setItem("last_config", configKey);
      saveScoresToLocalStorage();
    }
    
    playSweepSound();
    initMatch();
    
    // Switch panels
    setupScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
  });

  // Setup grid cell actions
  cells.forEach(cell => {
    cell.addEventListener("click", () => {
      const idx = parseInt(cell.dataset.index);
      handleCellInteraction(idx);
    });
  });

  // Restart Match
  restartBtn.addEventListener("click", () => {
    playSweepSound();
    initMatch();
  });

  // Back to Setup
  backBtn.addEventListener("click", () => {
    setupScreen.classList.remove("hidden");
    gameScreen.classList.add("hidden");
    playSweepSound();
  });

  // Reset Scores
  resetScoresBtn.addEventListener("click", () => {
    scores = { X: 0, ties: 0, O: 0 };
    saveScoresToLocalStorage();
    updateScoreboardDisplay();
    playSweepSound();
  });

  // Undo button action
  undoBtn.addEventListener("click", () => {
    performTimelineUndo();
  });
}

function saveScoresToLocalStorage() {
  localStorage.setItem("scores_cache", JSON.stringify(scores));
}

// Initialise new Match
function initMatch() {
  board = Array(9).fill(null);
  currentPlayer = "X";
  gameActive = true;
  
  // Clean UI Board
  cells.forEach(cell => {
    cell.innerHTML = "";
    cell.className = "cell";
    cell.disabled = false;
  });
  
  winLineSvg.style.display = "none";
  winLine.setAttribute("x1", "0");
  winLine.setAttribute("y1", "0");
  winLine.setAttribute("x2", "0");
  winLine.setAttribute("y2", "0");
  
  // Setup History
  moveHistory = [{
    boardState: [...board],
    activePlayer: "X",
    description: "Match started",
    lastMoveCell: null
  }];
  currentTimelineIndex = 0;
  
  updateScoreboardDisplay();
  updateTimelineDisplay();
  updateTurnIndicator();
}

// Update Scoreboard UI elements
function updateScoreboardDisplay() {
  scoreP1.textContent = scores.X;
  scoreP2.textContent = scores.O;
  scoreTies.textContent = scores.ties;
  
  scoreP1Label.textContent = playerNames.X;
  scoreP2Label.textContent = playerNames.O;
}

// Update Turn Indicator panel
function updateTurnIndicator() {
  turnP1Name.textContent = playerNames.X;
  turnP2Name.textContent = playerNames.O;
  
  if (currentPlayer === "X") {
    turnP1.classList.add("active");
    turnP2.classList.remove("active");
  } else {
    turnP2.classList.add("active");
    turnP1.classList.remove("active");
  }
}

// Grid Cell click handler
function handleCellInteraction(index) {
  // Ignore clicks if game is won/drawn or cell is occupied, or if viewing history, or if computer's turn
  if (!gameActive || board[index] !== null || currentTimelineIndex !== moveHistory.length - 1) return;
  if (gameMode === "ai" && currentPlayer === "O") return;
  
  makeMove(index);
}

// Place a marker and evaluate state
function makeMove(index) {
  board[index] = currentPlayer;
  playClickSound(currentPlayer);
  
  // Draw Marker
  drawMarkerInCell(cells[index], currentPlayer);
  
  // Record to history
  const activeName = playerNames[currentPlayer];
  const col = (index % 3) + 1;
  const row = Math.floor(index / 3) + 1;
  const description = `${activeName} placed ${currentPlayer} at Row ${row}, Col ${col}`;
  
  const newHistory = {
    boardState: [...board],
    activePlayer: currentPlayer === "X" ? "O" : "X",
    description: description,
    lastMoveCell: index
  };
  
  // Truncate any forward timeline if we had undoed and then played
  moveHistory = moveHistory.slice(0, currentTimelineIndex + 1);
  moveHistory.push(newHistory);
  currentTimelineIndex = moveHistory.length - 1;
  
  // Check Win/Tie Condition
  const checkState = evaluateBoard(board);
  if (checkState.winner) {
    triggerWin(checkState);
  } else if (checkState.tie) {
    triggerTie();
  } else {
    // Continue game, switch player
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    updateTurnIndicator();
    updateTimelineDisplay();
    
    // AI Move
    if (gameActive && gameMode === "ai" && currentPlayer === "O") {
      setTimeout(handleAiMove, 450); // slight natural lag for AI
    }
  }
}

// Draw X or O SVG dynamically inside elements
function drawMarkerInCell(cellEl, marker) {
  cellEl.innerHTML = "";
  
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "marker-svg");
  svg.setAttribute("viewBox", "0 0 80 80");
  
  if (marker === "X") {
    svg.innerHTML = `
      <line class="x-path" x1="15" y1="15" x2="65" y2="65" />
      <line class="x-path x-path-2" x1="65" y1="15" x2="15" y2="65" />
    `;
  } else {
    svg.innerHTML = `
      <circle class="o-path" cx="40" cy="40" r="28" />
    `;
  }
  cellEl.appendChild(svg);
}

// Evaluate board states
function evaluateBoard(boardState) {
  for (let i = 0; i < WIN_COMBOS.length; i++) {
    const [a, b, c] = WIN_COMBOS[i];
    if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
      return { winner: boardState[a], combo: WIN_COMBOS[i] };
    }
  }
  
  const isTie = boardState.every(cell => cell !== null);
  return { winner: null, tie: isTie };
}

// Handle wins
function triggerWin(result) {
  gameActive = false;
  scores[result.winner]++;
  saveScoresToLocalStorage();
  updateScoreboardDisplay();
  playWinSound();
  
  // Highlight winning cells
  result.combo.forEach(idx => {
    cells[idx].classList.add("winning-cell");
  });
  
  // Draw win line SVG overlay
  const comboKey = result.combo.join(",");
  const coords = WIN_LINE_COORDS[comboKey];
  if (coords) {
    winLine.setAttribute("x1", coords.x1);
    winLine.setAttribute("y1", coords.y1);
    winLine.setAttribute("x2", coords.x2);
    winLine.setAttribute("y2", coords.y2);
    winLineSvg.style.display = "block";
  }
  
  timelineStatus.textContent = `${playerNames[result.winner]} wins!`;
  timelineStatus.style.borderLeftColor = result.winner === "X" ? "var(--color-p1)" : "var(--color-p2)";
  
  updateTimelineDisplay();
}

// Handle ties
function triggerTie() {
  gameActive = false;
  scores.ties++;
  saveScoresToLocalStorage();
  updateScoreboardDisplay();
  playTieSound();
  
  timelineStatus.textContent = "It's a tie!";
  timelineStatus.style.borderLeftColor = "var(--text-muted)";
  
  updateTimelineDisplay();
}

// AI Core move triggering
function handleAiMove() {
  if (!gameActive) return;
  
  let bestIndex;
  
  if (aiDifficulty === "easy") {
    // Easy mode: Pick random available cells
    const emptyIndices = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
    bestIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  } else {
    // Unbeatable mode: Minimax
    bestIndex = findBestMoveMinimax(board);
  }
  
  if (bestIndex !== undefined && bestIndex >= 0) {
    makeMove(bestIndex);
  }
}

// Minimax algorithm to find absolute best move for O
function findBestMoveMinimax(currentBoard) {
  let bestScore = -Infinity;
  let move;
  
  for (let i = 0; i < 9; i++) {
    if (currentBoard[i] === null) {
      currentBoard[i] = "O"; // Try move
      const score = minimax(currentBoard, 0, false);
      currentBoard[i] = null; // Revert move
      
      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
  }
  return move;
}

function minimax(tempBoard, depth, isMaximizing) {
  const result = evaluateBoard(tempBoard);
  if (result.winner === "O") return 10 - depth;
  if (result.winner === "X") return depth - 10;
  if (result.tie) return 0;
  
  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (tempBoard[i] === null) {
        tempBoard[i] = "O";
        const score = minimax(tempBoard, depth + 1, false);
        tempBoard[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (tempBoard[i] === null) {
        tempBoard[i] = "X";
        const score = minimax(tempBoard, depth + 1, true);
        tempBoard[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

// Time Travel Timeline rendering
function updateTimelineDisplay() {
  timelineList.innerHTML = "";
  
  // Show / Hide Undo button
  const isViewingPast = currentTimelineIndex < moveHistory.length - 1;
  if (isViewingPast && gameActive) {
    undoBtn.classList.remove("hidden");
  } else {
    undoBtn.classList.add("hidden");
  }
  
  if (gameActive) {
    timelineStatus.textContent = `${playerNames[currentPlayer]}'s turn`;
    timelineStatus.style.borderLeftColor = currentPlayer === "X" ? "var(--color-p1)" : "var(--color-p2)";
  }
  
  moveHistory.forEach((step, idx) => {
    const li = document.createElement("li");
    li.className = `timeline-item ${idx === currentTimelineIndex ? 'active' : ''}`;
    
    // Determine details
    let markerHtml = "";
    if (idx > 0) {
      // Find what marker was placed in this step by comparing with past step
      const prevBoard = moveHistory[idx - 1].boardState;
      const currentBoard = step.boardState;
      let diffIdx = -1;
      for (let cell = 0; cell < 9; cell++) {
        if (prevBoard[cell] !== currentBoard[cell]) {
          diffIdx = cell;
          break;
        }
      }
      if (diffIdx !== -1) {
        const markerPlayed = currentBoard[diffIdx];
        markerHtml = `<span class="timeline-marker ${markerPlayed === 'X' ? 'p1' : 'p2'}">${markerPlayed}</span>`;
      }
    } else {
      markerHtml = `<span class="timeline-marker"><i data-lucide="play" style="width:12px;height:12px;"></i></span>`;
    }
    
    const countLabel = idx === 0 ? "Start" : `Move #${idx}`;
    
    li.innerHTML = `
      <div class="timeline-item-title">
        ${markerHtml}
        <span>${countLabel}</span>
      </div>
      <span class="timeline-details">${step.description}</span>
    `;
    
    // Render click handlers to view past board layouts
    li.addEventListener("click", () => {
      scrubToTimelineIndex(idx);
    });
    
    timelineList.appendChild(li);
  });
  
  lucide.createIcons();
  
  // Auto scroll to bottom of moves log on new move
  if (!isViewingPast) {
    timelineList.scrollTop = timelineList.scrollHeight;
  }
}

// Display past board configurations (scrubbing)
function scrubToTimelineIndex(index) {
  currentTimelineIndex = index;
  const step = moveHistory[index];
  
  // Update board representation visually (without modifying game state permanently until undone)
  cells.forEach((cell, idx) => {
    cell.innerHTML = "";
    cell.className = "cell";
    
    const val = step.boardState[idx];
    if (val !== null) {
      drawMarkerInCell(cell, val);
    }
    
    // Disable boards cells if viewing history to prevent placing markers in history mode
    const isAtPresent = currentTimelineIndex === moveHistory.length - 1;
    cell.disabled = !isAtPresent || !gameActive;
  });
  
  // Remove winning indicators/lines since we are scrubbing past
  winLineSvg.style.display = "none";
  
  // If scrubbing lands on a win state in present, show details
  if (currentTimelineIndex === moveHistory.length - 1) {
    const checkState = evaluateBoard(step.boardState);
    if (checkState.winner) {
      checkState.combo.forEach(idx => {
        cells[idx].classList.add("winning-cell");
      });
      const coords = WIN_LINE_COORDS[checkState.combo.join(",")];
      if (coords) {
        winLine.setAttribute("x1", coords.x1);
        winLine.setAttribute("y1", coords.y1);
        winLine.setAttribute("x2", coords.x2);
        winLine.setAttribute("y2", coords.y2);
        winLineSvg.style.display = "block";
      }
    }
  }
  
  // Set current visual turn to what it was in history
  currentPlayer = step.activePlayer;
  updateTurnIndicator();
  updateTimelineDisplay();
}

// Perform timeline rollback (Undo to visual state)
function performTimelineUndo() {
  playSweepSound();
  
  // Rollback active game variables
  moveHistory = moveHistory.slice(0, currentTimelineIndex + 1);
  board = [...moveHistory[currentTimelineIndex].boardState];
  currentPlayer = moveHistory[currentTimelineIndex].activePlayer;
  gameActive = true; // game active again if we roll back
  
  // Redraw present layout
  scrubToTimelineIndex(currentTimelineIndex);
  
  // Trigger AI move if it is the Computer's turn in PvAI mode after rollback
  if (gameMode === "ai" && currentPlayer === "O") {
    setTimeout(handleAiMove, 450);
  }
}
