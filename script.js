(() => {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const $ = id => document.getElementById(id);
  let total = 5;
  let gameMode = 'local';
  let firebaseApi = null;
  let firebaseUser = null;
  let firebaseLoadError = null;
  let onlineRole = null;
  let onlineRoomId = null;
  let onlineRoomState = null;
  let onlineUnsubscribe = null;
  let onlineAdvanceTimer = null;
  let onlineSavedRoomId = null;
  let setupPlayerName = '';
  let lastSyncedUserId = null;
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
      cell.disabled = Boolean(value) || finished || matchOver || aiThinking || (gameMode === 'ai' && turn === 'O') || (gameMode === 'online' && (!onlineRoomState || onlineRoomState.status !== 'playing' || turn !== onlineRole));
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
    if (gameMode === 'online') {
      if (!onlineRoomState || onlineRoomState.status !== 'playing' || onlineRoomState.turn !== onlineRole) return;
      submitOnlineMove(index);
      return;
    }
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
      cell.disabled = Boolean(board[index]) || finished || matchOver || aiThinking || (gameMode === 'ai' && turn === 'O') || (gameMode === 'online' && (!onlineRoomState || onlineRoomState.status !== 'playing' || turn !== onlineRole));
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

  async function getFirebaseApi() {
    if (firebaseApi) {
      if (!firebaseApi.isConfigured()) throw new Error('Firebase setup is not finished. Add your Firebase web app settings first.');
      return firebaseApi;
    }
    if (firebaseLoadError) throw new Error(firebaseLoadError);
    try {
      firebaseApi = await import('./firebase-client.js');
      if (!firebaseApi.isConfigured()) throw new Error('Firebase setup is not finished. Add your Firebase web app settings first.');
      firebaseApi.watchAuth(user => {
        firebaseUser = user;
        updateAccountUi(user);
        if (onlineRoomState?.status === 'complete') saveOnlineMatchIfSignedIn(onlineRoomState);
      }, error => setAccountMessage(error.message, true));
      return firebaseApi;
    } catch (error) {
      firebaseLoadError = error.message || 'Firebase could not load. Open the hosted HTTPS version and check the Firebase setup.';
      throw new Error(firebaseLoadError);
    }
  }

  function updateAccountUi(user) {
    const signedIn = Boolean(user && !user.isAnonymous);
    $('accountButton').textContent = signedIn ? 'Account' : 'Sign in';
    $('signedOutPanel').classList.toggle('hidden', signedIn);
    $('signedInPanel').classList.toggle('hidden', !signedIn);
    if (signedIn) {
      $('signedInEmail').textContent = user.email || 'Signed in';
      if (lastSyncedUserId !== user.uid) syncLocalMatchesToCloud(user);
    }
  }

  async function syncLocalMatchesToCloud(user) {
    if (!firebaseApi || !user || user.isAnonymous) return;
    lastSyncedUserId = user.uid;
    const records = getSavedMatches();
    let changed = false;
    for (const record of records) {
      try {
        if (!record.matchId) { record.matchId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; changed = true; }
        await firebaseApi.saveCloudMatch(record);
      }
      catch (error) { setAccountMessage(`Signed in, but a saved score could not sync: ${error.message}`, true); break; }
    }
    if (changed) {
      try { localStorage.setItem(matchesStorageKey, JSON.stringify(records)); } catch (_) { /* Keep the local list even if storage is unavailable. */ }
    }
  }

  function setOnlineMessage(message, isError = false) {
    const element = $('onlineMessage');
    element.textContent = message;
    element.classList.toggle('error', isError);
  }

  function setAccountMessage(message, isError = false) {
    const element = $('accountMessage');
    element.textContent = message;
    element.classList.toggle('error', isError);
  }

  function setAuthMode(mode) {
    document.querySelectorAll('[data-auth-mode]').forEach(button => {
      const active = button.dataset.authMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('accountTitle').textContent = mode === 'signup' ? 'Create your account' : 'Sign in';
    $('accountSubmit').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
    $('accountPassword').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('resetPassword').classList.toggle('hidden', mode === 'signup');
    $('accountMessage').textContent = '';
    $('accountMessage').classList.remove('error');
  }

  function openAccount() {
    $('accountView').hidden = false;
    if (firebaseUser && !firebaseUser.isAnonymous) updateAccountUi(firebaseUser);
    setAccountMessage('');
    $('closeAccount').focus();
    getFirebaseApi().catch(error => setAccountMessage(`${error.message} You can still play without an account.`, true));
  }

  function closeAccount() {
    $('accountView').hidden = true;
    $('accountButton').focus();
  }

  async function enterOnlineMatch(code, role) {
    if (onlineUnsubscribe) onlineUnsubscribe();
    onlineRoomId = code;
    onlineRole = role;
    onlineRoomState = null;
    onlineSavedRoomId = null;
    gameMode = 'online';
    $('accountButton').disabled = true;
    $('playerSetup').classList.add('hidden');
    $('game').classList.remove('hidden');
    $('onlineRoomBar').classList.remove('hidden');
    $('onlineRoomCode').textContent = code;
    $('roundLabel').textContent = 'Connecting to room…';
    $('statusText').textContent = 'Joining the match…';
    $('hint').textContent = 'Waiting for the game board.';
    $('celebration').classList.remove('show');
    $('matchResult').classList.remove('show');
    const api = await getFirebaseApi();
    onlineUnsubscribe = api.watchRoom(code, syncOnlineRoom, error => {
      $('statusText').textContent = 'Room connection lost';
      $('hint').textContent = error.message;
    });
  }

  async function createOnlineRoom() {
    const name = $('nameX').value.trim().slice(0, 24) || 'Player X';
    setupPlayerName = name;
    $('createRoomButton').disabled = true;
    setOnlineMessage('Creating a room…');
    try {
      const api = await getFirebaseApi();
      const code = await api.createRoom(name, total);
      await enterOnlineMatch(code, 'X');
    } catch (error) {
      setOnlineMessage(error.message || 'Could not create the room.', true);
    } finally {
      $('createRoomButton').disabled = false;
    }
  }

  async function joinOnlineRoom() {
    const code = $('joinRoomCode').value.trim();
    const name = $('nameX').value.trim().slice(0, 24) || 'Player O';
    if (code.length !== 7) {
      setOnlineMessage('Enter the 7-character room code.', true);
      return;
    }
    setupPlayerName = name;
    $('joinRoomButton').disabled = true;
    setOnlineMessage('Joining room…');
    try {
      const api = await getFirebaseApi();
      const joinedCode = await api.joinRoom(code, name);
      await enterOnlineMatch(joinedCode, 'O');
    } catch (error) {
      setOnlineMessage(error.message || 'Could not join the room.', true);
    } finally {
      $('joinRoomButton').disabled = false;
    }
  }

  function syncOnlineRoom(room) {
    onlineRoomState = room;
    total = room.total;
    names = {
      X: room.players.X?.name || 'Player X',
      O: room.players.O?.name || 'Player O'
    };
    board = [...room.board];
    turn = room.turn;
    roundStarter = room.starter;
    nextRoundStarter = room.nextStarter;
    scores = {...room.scores};
    history = [...room.history];
    finished = room.status !== 'playing';
    matchOver = room.status === 'complete';
    $('displayNameX').textContent = names.X;
    $('displayNameO').textContent = room.players.O?.name || 'Waiting for player…';
    $('labelX').textContent = names.X;
    $('labelO').textContent = room.players.O?.name || 'Player O';
    $('startSubX').textContent = room.starter === 'X' ? 'Starts this round' : 'Moves second';
    $('startSubO').textContent = room.starter === 'O' ? 'Starts this round' : 'Moves second';
    $('onlineRoomBar').classList.remove('hidden');
    $('onlineRoomCode').textContent = room.code;
    $('onlineRoomStatus').textContent = room.status === 'waiting' ? 'Share this code with your opponent' : 'Online match';
    if (room.status === 'waiting') {
      $('roundLabel').textContent = `Waiting · best of ${total}`;
      $('statusText').textContent = 'Waiting for Player O to join…';
      $('hint').textContent = 'Share the room code above with your opponent.';
    } else if (room.status === 'round-over') {
      $('roundLabel').textContent = `Round ${history.length} complete`;
      $('statusText').textContent = 'Next round starting…';
      $('hint').textContent = 'The next round will begin automatically.';
    } else if (room.status === 'complete') {
      $('roundLabel').textContent = `Match complete · ${history.length} rounds`;
      $('statusText').textContent = 'Final score';
      $('hint').textContent = 'Set up another match whenever you are ready.';
      showOnlineMatchResult(room);
      saveOnlineMatchIfSignedIn(room);
    } else {
      $('roundLabel').textContent = `Round ${history.length + 1} of ${total}`;
      $('statusText').textContent = turn === onlineRole ? 'Your turn' : `${names[turn]}'s turn`;
      $('hint').textContent = turn === onlineRole ? 'Your move. Choose a square.' : `Waiting for ${names[turn]} to move.`;
    }
    if (room.status === 'round-over' && onlineRole === 'X' && !onlineAdvanceTimer) {
      onlineAdvanceTimer = window.setTimeout(async () => {
        onlineAdvanceTimer = null;
        try { await firebaseApi.advanceRoomRound(room.code); }
        catch (error) { $('hint').textContent = error.message || 'Could not start the next round.'; }
      }, 1300);
    } else if (room.status !== 'round-over' && onlineAdvanceTimer) {
      window.clearTimeout(onlineAdvanceTimer);
      onlineAdvanceTimer = null;
    }
    updateScore();
    renderHistory();
    renderBoard();
  }

  function showOnlineMatchResult(room) {
    $('matchResult').classList.add('show');
    const tie = room.scores.X === room.scores.O;
    const winner = tie ? null : (room.scores.X > room.scores.O ? 'X' : 'O');
    $('resultName').textContent = tie ? 'The match is a tie.' : `${names[winner]} takes the match!`;
    $('resultSub').textContent = `${room.scores.X}–${room.scores.O} · ${tie ? 'Nice game, both of you.' : 'Well played.'}`;
    $('celebrationTitle').textContent = tie ? "It's a draw!" : `Congratulations, ${names[winner]}!`;
    $('celebrationMessage').textContent = tie ? 'You both finished level. Great match!' : 'You won the match. Great playing!';
    $('celebrationScore').textContent = `Final score · ${room.scores.X}–${room.scores.O}`;
    $('celebration').classList.add('show');
  }

  async function saveOnlineMatchIfSignedIn(room) {
    if (onlineSavedRoomId === room.code || !firebaseUser || firebaseUser.isAnonymous) return;
    onlineSavedRoomId = room.code;
    const record = {
      matchId: room.code,
      xName: room.players.X.name,
      oName: room.players.O?.name || 'Player O',
      xScore: room.scores.X,
      oScore: room.scores.O,
      rounds: room.history.length,
      format: room.total,
      winner: room.winner ? names[room.winner] : (room.scores.X === room.scores.O ? 'Tie' : 'Unknown'),
      playedAt: new Date().toISOString(),
      mode: 'online'
    };
    try { await firebaseApi.saveCloudMatch(record); }
    catch (error) { setOnlineMessage(`Match ended, but score sync failed: ${error.message}`, true); }
  }

  async function submitOnlineMove(index) {
    try { await firebaseApi.submitRoomMove(onlineRoomId, onlineRole, index); }
    catch (error) { $('hint').textContent = error.message || 'That move could not be sent. Try again.'; }
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
      matchId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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
    if (firebaseUser && !firebaseUser.isAnonymous && firebaseApi) {
      firebaseApi.saveCloudMatch(record).catch(error => setAccountMessage(`Match saved on this device, but cloud sync failed: ${error.message}`, true));
    }
  }

  async function renderSavedMatches() {
    let records = getSavedMatches();
    if (firebaseUser && !firebaseUser.isAnonymous && firebaseApi) {
      try {
        const cloudRecords = await firebaseApi.loadCloudMatches();
        const byId = new Map();
        [...cloudRecords, ...records].forEach(record => byId.set(record.matchId || `${record.playedAt}-${record.xName}-${record.oName}`, record));
        records = [...byId.values()].sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt)).slice(0, 50);
      } catch (error) {
        setAccountMessage(`Cloud scores could not load: ${error.message}`, true);
      }
    }
    const list = $('savedMatchList');
    list.replaceChildren();
    if (!records.length) {
      const empty = document.createElement('div');
      empty.className = 'saved-empty';
      empty.textContent = firebaseUser && !firebaseUser.isAnonymous
        ? 'Completed named matches will appear here.'
        : 'Completed matches stay on this device. Sign in to sync named scores across devices.';
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

  async function openSavedScores() {
    $('savedScoresView').hidden = false;
    $('closeSavedScores').focus();
    await renderSavedMatches();
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
    if (onlineAdvanceTimer) window.clearTimeout(onlineAdvanceTimer);
    if (onlineUnsubscribe) onlineUnsubscribe();
    nextRoundTimer = null;
    aiTimer = null;
    onlineAdvanceTimer = null;
    onlineUnsubscribe = null;
    aiThinking = false;
    onlineRoomState = null;
    onlineRoomId = null;
    onlineRole = null;
    $('onlineRoomBar').classList.add('hidden');
    $('accountButton').disabled = false;
    $('nameX').value = gameMode === 'online' ? setupPlayerName : names.X;
    $('nameO').value = gameMode === 'ai' || gameMode === 'online' ? '' : names.O;
    $('playerSetup').classList.remove('hidden');
    $('game').classList.add('hidden');
    $('celebration').classList.remove('show');
    $('nameX').focus();
  }

  function startMatch(event) {
    event.preventDefault();
    if (document.querySelector('[data-mode].active').dataset.mode === 'online') return;
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
    $('playerOField').classList.toggle('hidden', mode !== 'local');
    $('playerOField').closest('.name-fields').classList.toggle('ai-mode', mode !== 'local');
    $('aiOpponentNote').classList.toggle('hidden', mode !== 'ai');
    $('onlineControls').classList.toggle('hidden', mode !== 'online');
    $('localSetupActions').classList.toggle('hidden', mode === 'online');
    $('playerXLabel').textContent = mode === 'local' ? 'Player X' : 'Your name';
    $('modeDescription').textContent = mode === 'ai'
      ? 'You play as X. The computer plays as O and chooses its moves automatically.'
      : mode === 'online'
        ? 'Create a room and share its code, or join a friend’s room.'
        : 'Take turns on the same device.';
  }
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });
  setMode('local');
  $('createRoomButton').addEventListener('click', createOnlineRoom);
  $('joinRoomButton').addEventListener('click', joinOnlineRoom);
  $('joinRoomCode').addEventListener('input', event => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7); });
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
  $('accountButton').addEventListener('click', openAccount);
  $('closeAccount').addEventListener('click', closeAccount);
  $('accountView').addEventListener('click', event => {
    if (event.target === $('accountView')) closeAccount();
  });
  document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
  $('accountForm').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('accountSubmit');
    submit.disabled = true;
    setAccountMessage('');
    try {
      const api = await getFirebaseApi();
      const email = $('accountEmail').value.trim();
      const password = $('accountPassword').value;
      const mode = document.querySelector('[data-auth-mode].active').dataset.authMode;
      if (mode === 'signup') await api.createAccount(email, password);
      else await api.signIn(email, password);
      setAccountMessage(mode === 'signup' ? 'Account created. Your named scores will sync here.' : 'Signed in. Your named scores will sync here.');
    } catch (error) {
      setAccountMessage(error.message || 'Could not sign in. Please try again.', true);
    } finally {
      submit.disabled = false;
    }
  });
  $('resetPassword').addEventListener('click', async () => {
    const email = $('accountEmail').value.trim();
    if (!email) { setAccountMessage('Enter your email address first.', true); $('accountEmail').focus(); return; }
    try {
      const api = await getFirebaseApi();
      await api.resetPassword(email);
      setAccountMessage('If that email is registered, a password reset link has been sent.');
    } catch (error) { setAccountMessage(error.message || 'Could not send a reset email.', true); }
  });
  $('signOutButton').addEventListener('click', async () => {
    try { await firebaseApi.signOutUser(); setAccountMessage('Signed out. Your local scores remain on this device.'); }
    catch (error) { setAccountMessage(error.message || 'Could not sign out.', true); }
  });
  $('copyRoomCode').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(onlineRoomId || ''); $('copyRoomCode').textContent = 'Copied'; }
    catch (_) { setOnlineMessage('Copy failed. Select the room code and copy it.'); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('savedScoresView').hidden) closeSavedScores();
    if (event.key === 'Escape' && !$('accountView').hidden) closeAccount();
  });
  document.querySelectorAll('[data-rounds]').forEach(button => button.addEventListener('click', () => {
    if (history.length && !window.confirm('Changing match format will start a fresh match. Continue?')) return;
    total = Number(button.dataset.rounds);
    document.querySelectorAll('[data-rounds]').forEach(option => option.classList.toggle('active', option === button));
    if (!$('game').classList.contains('hidden')) startMatch(new Event('submit', {cancelable: true}));
  }));

  loadSavedNames();
  renderBoard();
  setAuthMode('signin');
})();
