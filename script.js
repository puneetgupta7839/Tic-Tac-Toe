(() => {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const $ = id => document.getElementById(id);
  let total = 5;
  let board = Array(9).fill('');
  let turn = 'X';
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

  function renderBoard() {
    boardEl.innerHTML = '';
    board.forEach((value, index) => {
      const cell = document.createElement('button');
      cell.className = `cell${value ? ` ${value.toLowerCase()}` : ''}`;
      cell.type = 'button';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', value ? `Cell ${index + 1}: ${names[value]}` : `Cell ${index + 1}, empty`);
      cell.textContent = value === 'X' ? '×' : value === 'O' ? '○' : '';
      cell.disabled = Boolean(value) || finished || matchOver;
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

  function play(index) {
    if (board[index] || finished || matchOver) return;
    board[index] = turn;
    const result = getOutcome();
    renderBoard();
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
      updateScore();
      endOrContinue();
      return;
    }
    turn = turn === 'X' ? 'O' : 'X';
    $('statusText').textContent = `${names[turn]}'s turn`;
    $('hint').textContent = `${names[turn]}, make your move.`;
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
      } else {
        const winner = scores.X > scores.O ? 'X' : 'O';
        $('resultName').textContent = `${names[winner]} takes the match!`;
        $('resultSub').textContent = `${scores.X}–${scores.O} · Well played.`;
        $('celebrationTitle').textContent = `Congratulations, ${names[winner]}!`;
        $('celebrationMessage').textContent = 'You won the match. Great playing!';
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

  function updateScore() {
    $('scoreX').textContent = scores.X;
    $('scoreO').textContent = scores.O;
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
    turn = 'X';
    finished = false;
    $('roundLabel').textContent = `Round ${history.length + 1} of ${total}`;
    $('statusText').textContent = `${names.X}'s turn`;
    $('hint').textContent = 'Players share this screen and take turns.';
    renderBoard();
  }

  function openSetup() {
    if (nextRoundTimer) window.clearTimeout(nextRoundTimer);
    nextRoundTimer = null;
    $('nameX').value = names.X;
    $('nameO').value = names.O;
    $('playerSetup').classList.remove('hidden');
    $('game').classList.add('hidden');
    $('celebration').classList.remove('show');
    $('nameX').focus();
  }

  function startMatch(event) {
    event.preventDefault();
    const enteredX = $('nameX').value.trim().slice(0, 24);
    const enteredO = $('nameO').value.trim().slice(0, 24);
    bothPlayersNamed = Boolean(enteredX && enteredO);
    names = {
      X: enteredX || 'Player X',
      O: enteredO || 'Player O'
    };
    if ($('rememberNames').checked) {
      try { localStorage.setItem(storageKey, JSON.stringify(names)); } catch (_) { /* Names still work for this match. */ }
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
    $('matchResult').classList.remove('show');
    $('playerSetup').classList.add('hidden');
    $('game').classList.remove('hidden');
    updateScore();
    renderHistory();
    newRound();
  }

  $('playerForm').addEventListener('submit', startMatch);
  $('resetRound').addEventListener('click', () => {
    if (matchOver) return;
    if (nextRoundTimer) window.clearTimeout(nextRoundTimer);
    nextRoundTimer = null;
    board = Array(9).fill('');
    finished = false;
    turn = 'X';
    $('statusText').textContent = `${names.X}'s turn`;
    $('hint').textContent = 'Players share this screen and take turns.';
    renderBoard();
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
