(() => {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const $ = id => document.getElementById(id);
  let total = 5;
  let gameMode = 'local';
  let aiTimer = null;
  let aiThinking = false;
  let board = Array(9).fill('');
  let turn = 'X';
  let roundStarter = 'X';
  let nextRoundStarter = 'X';
  let scores = {X: 0, O: 0};
  let history = [];
  let finished = false;
  let matchOver = false;
  let names = {X: 'Player X', O: 'Player O'};
  let bothPlayersNamed = false;
  let nextRoundTimer = null;
  let currentMatchSaved = false;
  const storageKey = 'crossed-player-names-v1';
  const matchesStorageKey = 'crossed-saved-matches-v1';
  const boardEl = $('board');

  function loadSavedNames() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && typeof saved.X === 'string' && typeof saved.O === 'string') {
        $('nameX').value = saved.X;
        $('nameO').value = saved.O;
        $('rememberNames').checked = true;
      }
    } catch (_) { /* Storage can be unavailable in private browsing. */ }
  }

  function renderBoard(animateIndex = null) {
    boardEl.innerHTML = '';
    board.forEach((value, index) => {
      const cell = document.createElement('button');
      cell.className = `cell${value ? ` ${value.toLowerCase()}` : ''}${index === animateIndex ? ' just-played' : ''}`;
      cell.type = 'button';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', value ? `Cell ${index + 1}: ${names[value]}` : `Cell ${index + 1}, empty`);
      cell.textContent = value === 'X' ? '×' : value === 'O' ? '○' : '';
      cell.disabled = Boolean(value) || finished || matchOver || aiThinking || (gameMode === 'ai' && turn === 'O');
      cell.addEventListener('click', () => play(index));
      boardEl.appendChild(cell);
    });
    boardEl.classList.toggle('locked', finished || matchOver);
  }

  function getOutcome() {
    for (const line of wins) {
      if (board[line[0]] && board[line[0]] === board[line[1]] && board[line[1]] === board[line[2]]) {
        return {winner: board[line[0]], line};
      }
    }
    return board.every(Boolean) ? {winner: null} : null;
  }

  function play(index, fromAi = false) {
    if (board[index] || finished || matchOver || (aiThinking && !fromAi) || (gameMode === 'ai' && turn === 'O' && !fromAi)) return;
    board[index] = turn;
    const result = getOutcome();
    renderBoard(index);
    if (result) {
      finished = true;
      if (result.winner) {
        scores[result.winner] += 1;
        result.line.forEach(indexInLine => boardEl.children[indexInLine].classList.add('win'));
        $('statusText').textContent = `${names[result.winner]} wins the round!`;
        $('hint').textContent = `Point to ${names[result.winner]}.`;
      } else {
        $('statusText').textContent = 'Round drawn';
        $('hint').textContent = 'No points this round.';
      }
      history.push(result.winner || 'D');
      updateScore(result.winner);
      endOrContinue();
      return;
    }
    turn = turn === 'X' ? 'O' : 'X';
    if (gameMode === 'ai' && turn === 'O') {
      scheduleAiMove();
    } else {
      $('statusText').textContent = `${names[turn]}'s turn`;
      $('hint').textContent = gameMode === 'ai' ? 'Your turn. Choose a square.' : `${names[turn]}, make your move.`;
      syncBoardInteractivity();
    }
  }

  function syncBoardInteractivity() {
    [...boardEl.children].forEach((cell, index) => {
      cell.disabled = Boolean(board[index]) || finished || matchOver || aiThinking || (gameMode === 'ai' && turn === 'O');
    });
  }

  function getPositionOutcome(position) {
    for (const line of wins) {
      if (position[line[0]] && position[line[0]] === position[line[1]] && position[line[1]] === position[line[2]]) {
        return {winner: position[line[0]], line};
      }
    }
    return position.every(Boolean) ? {winner: null} : null;
  }

  function minimax(position, player, depth) {
    const outcome = getPositionOutcome(position);
    if (outcome) {
      if (!outcome.winner) return 0;
      return outcome.winner === 'O' ? 10 - depth : depth - 10;
    }
    const nextPlayer = player === 'O' ? 'X' : 'O';
    const values = [];
    position.forEach((value, index) => {
      if (value) return;
      position[index] = player;
      values.push(minimax(position, nextPlayer, depth + 1));
      position[index] = '';
    });
    return player === 'O' ? Math.max(...values) : Math.min(...values);
  }

  function findAiMove() {
    let bestScore = -Infinity;
    let bestMoves = [];
    board.forEach((value, index) => {
      if (value) return;
      board[index] = 'O';
      const score = minimax(board, 'X', 1);
      board[index] = '';
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [index];
      } else if (score === bestScore) {
        bestMoves.push(index);
      }
    });
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  function scheduleAiMove() {
    if (gameMode !== 'ai' || turn !== 'O' || finished || matchOver) return;
    aiThinking = true;
    $('statusText').textContent = 'Computer is thinking…';
    $('hint').textContent = 'The computer is choosing a move.';
    syncBoardInteractivity();
    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      aiThinking = false;
      const move = findAiMove();
      if (move !== undefined) play(move, true);
    }, 500);
  }

  function endOrContinue() {
    const clinched = scores.X > total / 2 || scores.O > total / 2;
    const allPlayed = history.length >= total;
    if (clinched || allPlayed) {
      saveCompletedMatch();
      matchOver = true;
      $('roundLabel').textContent = `Match complete · ${history.length} round${history.length === 1 ? '' : 's'}`;
      $('statusText').textContent = 'Final score';
      $('hint').textContent = 'Set up another match whenever you are ready.';
      $('matchResult').classList.add('show');
      if (scores.X === scores.O) {
        $('resultName').textContent = 'The match is a tie.';
        $('resultSub').textContent = `${scores.X}–${scores.O} · Nice game, both of you.`;
        $('celebrationTitle').textContent = "It's a draw!";
        $('celebrationMessage').textContent = 'You both finished level. Great match!';
        $('celebrationScore').textContent = `Final score · ${scores.X}–${scores.O}`;
        $('celebration').classList.add('show');
        $('celebrationNewMatch').focus();
      } else {
        const winner = scores.X > scores.O ? 'X' : 'O';
        $('resultName').textContent = `${names[winner]} takes the match!`;
        $('resultSub').textContent = `${scores.X}–${scores.O} · Well played.`;
        $('celebrationTitle').textContent = `Congratulations, ${names[winner]}!`;
        $('celebrationMessage').textContent = gameMode === 'ai' && winner === 'O'
          ? 'The computer won this match. Ready for a rematch?'
          : 'You won the match. Great playing!';
        $('celebrationScore').textContent = `Final score · ${scores.X}–${scores.O}`;
        $('celebration').classList.add('show');
        $('celebrationNewMatch').focus();
      }
    } else {
      $('roundLabel').textContent = `Round ${history.length} complete`;
      $('statusText').textContent = 'Next round starting…';
      $('hint').textContent = 'Get ready. The next round starts in a moment.';
      nextRoundTimer = window.setTimeout(() => {
        if (!matchOver) newRound();
      }, 1400);
    }
    updateScore();
    renderHistory();
    renderBoard();
  }

  function updateScore(scoredPlayer = null) {
    $('scoreX').textContent = scores.X;
    $('scoreO').textContent = scores.O;
    if (scoredPlayer) {
      const score = $(`score${scoredPlayer}`);
      score.classList.remove('score-bump');
      void score.offsetWidth;
      score.classList.add('score-bump');
    }
  }

  function renderHistory() {
    $('playedCount').textContent = history.length;
    $('historyList').innerHTML = history.length
      ? history.map((winner, index) => `<span class="badge ${winner === 'D' ? 'draw' : winner.toLowerCase()}" title="Round ${index + 1}: ${winner === 'D' ? 'draw' : `${names[winner]} wins`}">${winner === 'X' ? '×' : winner === 'O' ? '○' : '–'}</span>`).join('')
      : '<span class="empty-history">Your match starts here.</span>';
  }

  function getSavedMatches() {
    try {
      const saved = JSON.parse(localStorage.getItem(matchesStorageKey) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (_) { return []; }
  }

  function saveCompletedMatch() {
    if (currentMatchSaved || !bothPlayersNamed) return;
    currentMatchSaved = true;
    const winner = scores.X === scores.O ? null : (scores.X > scores.O ? 'X' : 'O');
    const record = {
      xName: names.X,
      oName: names.O,
      xScore: scores.X,
      oScore: scores.O,
      rounds: history.length,
      format: total,
      winner: winner ? names[winner] : 'Tie',
      playedAt: new Date().toISOString()
    };
    try {
      const saved = getSavedMatches();
      localStorage.setItem(matchesStorageKey, JSON.stringify([record, ...saved].slice(0, 50)));
    } catch (_) { /* The match still ends normally if storage is unavailable. */ }
  }

  function renderSavedMatches() {
    const records = getSavedMatches();
    const list = $('savedMatchList');
    list.replaceChildren();
    if (!records.length) {
      const empty = document.createElement('div');
      empty.className = 'saved-empty';
      empty.textContent = 'Completed matches will appear here.';
      list.appendChild(empty);
      return;
    }
    records.forEach(record => {
      const row = document.createElement('article');
      row.className = 'saved-match';
      const title = document.createElement('div');
      title.className = 'saved-match-title';
      title.textContent = record.winner === 'Tie' ? 'Match tied' : `${record.winner} won`;
      const score = document.createElement('div');
      score.className = 'saved-match-score';
      score.textContent = `${record.xScore}–${record.oScore}`;
      const meta = document.createElement('div');
      meta.className = 'saved-match-meta';
      const played = new Date(record.playedAt);
      const date = Number.isNaN(played.getTime()) ? 'Date unavailable' : played.toLocaleString();
      meta.textContent = `${record.xName} vs ${record.oName} · Best of ${record.format} · ${record.rounds} rounds · ${date}`;
      row.append(title, score, meta);
      list.appendChild(row);
    });
  }

  function openSavedScores() {
    renderSavedMatches();
    $('savedScoresView').hidden = false;
    $('closeSavedScores').focus();
  }

  function closeSavedScores() {
    $('savedScoresView').hidden = true;
    $('savedScoresButton').focus();
  }

  function newRound() {
    if (nextRoundTimer) window.clearTimeout(nextRoundTimer);
    nextRoundTimer = null;
    board = Array(9).fill('');
    roundStarter = nextRoundStarter;
    turn = roundStarter;
    nextRoundStarter = roundStarter === 'X' ? 'O' : 'X';
    finished = false;
    $('roundLabel').textContent = `Round ${history.length + 1} of ${total}`;
    $('statusText').textContent = `${names[roundStarter]}'s turn`;
    $('hint').textContent = gameMode === 'ai' ? 'Your turn. Choose a square.' : 'Players share this screen and take turns.';
    $('startSubX').textContent = roundStarter === 'X' ? 'Starts this round' : 'Moves second';
    $('startSubO').textContent = roundStarter === 'O' ? 'Starts this round' : 'Moves second';
    renderBoard();
    const arena = document.querySelector('.arena');
    arena.classList.remove('round-enter');
    void arena.offsetWidth;
    arena.classList.add('round-enter');
    if (gameMode === 'ai' && turn === 'O') scheduleAiMove();
  }

  function openSetup() {
    if (nextRoundTimer) window.clearTimeout(nextRoundTimer);
    if (aiTimer) window.clearTimeout(aiTimer);
    nextRoundTimer = null;
    aiTimer = null;
    aiThinking = false;
    $('nameX').value = names.X;
    $('nameO').value = gameMode === 'ai' ? '' : names.O;
    $('playerSetup').classList.remove('hidden');
    $('game').classList.add('hidden');
    $('celebration').classList.remove('show');
    $('nameX').focus();
  }

  function startMatch(event) {
    event.preventDefault();
    if (aiTimer) window.clearTimeout(aiTimer);
    aiTimer = null;
    aiThinking = false;
    gameMode = document.querySelector('[data-mode].active').dataset.mode;
    const enteredX = $('nameX').value.trim().slice(0, 24);
    const enteredO = $('nameO').value.trim().slice(0, 24);
    bothPlayersNamed = gameMode === 'local' && Boolean(enteredX && enteredO);
    names = {
      X: enteredX || 'Player X',
      O: gameMode === 'ai' ? 'Computer' : enteredO || 'Player O'
    };
    if ($('rememberNames').checked) {
      try { localStorage.setItem(storageKey, JSON.stringify({X: names.X, O: gameMode === 'local' ? names.O : ''})); } catch (_) { /* Names still work for this match. */ }
    } else {
      try { localStorage.removeItem(storageKey); } catch (_) { /* Ignore unavailable storage. */ }
    }
    $('displayNameX').textContent = names.X;
    $('displayNameO').textContent = names.O;
    $('labelX').textContent = names.X;
    $('labelO').textContent = names.O;
    scores = {X: 0, O: 0};
    history = [];
    currentMatchSaved = false;
    finished = false;
    matchOver = false;
    nextRoundStarter = 'X';
    $('matchResult').classList.remove('show');
    $('playerSetup').classList.add('hidden');
    $('game').classList.remove('hidden');
    updateScore();
    renderHistory();
    newRound();
  }

  $('playerForm').addEventListener('submit', startMatch);
  function setMode(mode) {
    document.querySelectorAll('[data-mode]').forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('playerOField').classList.toggle('hidden', mode === 'ai');
    $('playerOField').closest('.name-fields').classList.toggle('ai-mode', mode === 'ai');
    $('aiOpponentNote').classList.toggle('hidden', mode !== 'ai');
    $('modeDescription').textContent = mode === 'ai'
      ? 'You play as X. The computer plays as O and chooses its moves automatically.'
      : 'Take turns on the same device.';
  }
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });
  setMode('local');
  $('resetRound').addEventListener('click', () => {
    if (matchOver) return;
    if (nextRoundTimer) window.clearTimeout(nextRoundTimer);
    if (aiTimer) window.clearTimeout(aiTimer);
    nextRoundTimer = null;
    aiTimer = null;
    aiThinking = false;
    board = Array(9).fill('');
    finished = false;
    turn = roundStarter;
    $('statusText').textContent = `${names[roundStarter]}'s turn`;
    $('hint').textContent = gameMode === 'ai' ? 'Your turn. Choose a square.' : 'Players share this screen and take turns.';
    renderBoard();
    if (gameMode === 'ai' && turn === 'O') scheduleAiMove();
  });
  $('newMatch').addEventListener('click', openSetup);
  $('celebrationNewMatch').addEventListener('click', openSetup);
  $('savedScoresButton').addEventListener('click', openSavedScores);
  $('closeSavedScores').addEventListener('click', closeSavedScores);
  $('savedScoresView').addEventListener('click', event => {
    if (event.target === $('savedScoresView')) closeSavedScores();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('savedScoresView').hidden) closeSavedScores();
  });
  document.querySelectorAll('[data-rounds]').forEach(button => button.addEventListener('click', () => {
    if (history.length && !window.confirm('Changing match format will start a fresh match. Continue?')) return;
    total = Number(button.dataset.rounds);
    document.querySelectorAll('[data-rounds]').forEach(option => option.classList.toggle('active', option === button));
    if (!$('game').classList.contains('hidden')) startMatch(new Event('submit', {cancelable: true}));
  }));

  loadSavedNames();
  renderBoard();
})();
