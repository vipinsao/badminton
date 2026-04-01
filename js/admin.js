/**
 * Smasher Badminton Club - Admin Panel Controller
 * Optimized for rapid button clicks
 */

(function() {
    'use strict';

    // Click debouncing - prevent glitches from rapid clicks
    const CLICK_COOLDOWN = 80; // ms between clicks
    let lastClickTime = 0;
    let isProcessingClick = false;

    function canProcessClick() {
        const now = Date.now();
        if (isProcessingClick || now - lastClickTime < CLICK_COOLDOWN) {
            return false;
        }
        lastClickTime = now;
        isProcessingClick = true;
        // Reset flag after a short delay
        requestAnimationFrame(() => {
            isProcessingClick = false;
        });
        return true;
    }

    // DOM Elements
    const elements = {
        // Setup Section
        setupSection: document.getElementById('setupSection'),
        scoreSection: document.getElementById('scoreSection'),
        team1Name: document.getElementById('team1Name'),
        team1Player1: document.getElementById('team1Player1'),
        team1Player2: document.getElementById('team1Player2'),
        team2Name: document.getElementById('team2Name'),
        team2Player1: document.getElementById('team2Player1'),
        team2Player2: document.getElementById('team2Player2'),
        startMatchBtn: document.getElementById('startMatchBtn'),

        // Header
        setIndicator: document.getElementById('setIndicator'),
        setTimer: document.getElementById('setTimer'),
        matchStatusBadge: document.getElementById('matchStatusBadge'),

        // Settings
        setDurationInput: document.getElementById('setDuration'),
        breakDurationInput: document.getElementById('breakDuration'),

        // Score Display
        team1DisplayName: document.getElementById('team1DisplayName'),
        team1DisplayPlayers: document.getElementById('team1DisplayPlayers'),
        team2DisplayName: document.getElementById('team2DisplayName'),
        team2DisplayPlayers: document.getElementById('team2DisplayPlayers'),
        team1Score: document.getElementById('team1Score'),
        team2Score: document.getElementById('team2Score'),
        team1Service: document.getElementById('team1Service'),
        team2Service: document.getElementById('team2Service'),
        team1ServiceSide: document.getElementById('team1ServiceSide'),
        team2ServiceSide: document.getElementById('team2ServiceSide'),

        // Score Buttons
        team1ScoreBtn: document.getElementById('team1ScoreBtn'),
        team2ScoreBtn: document.getElementById('team2ScoreBtn'),
        team1PenaltyBtn: document.getElementById('team1PenaltyBtn'),
        team2PenaltyBtn: document.getElementById('team2PenaltyBtn'),
        team1BreakBtn: document.getElementById('team1BreakBtn'),
        team2BreakBtn: document.getElementById('team2BreakBtn'),
        team1BreakInfo: document.getElementById('team1BreakInfo'),
        team2BreakInfo: document.getElementById('team2BreakInfo'),

        // Match Control
        team1SetsWon: document.getElementById('team1SetsWon'),
        team2SetsWon: document.getElementById('team2SetsWon'),
        setPointAlert: document.getElementById('setPointAlert'),
        matchPointAlert: document.getElementById('matchPointAlert'),
        undoBtn: document.getElementById('undoBtn'),
        nextSetBtn: document.getElementById('nextSetBtn'),
        resetMatchBtn: document.getElementById('resetMatchBtn'),

        // History
        historyList: document.getElementById('historyList'),

        // Break Overlay
        breakOverlay: document.getElementById('breakOverlay'),
        breakTeamName: document.getElementById('breakTeamName'),
        breakTimer: document.getElementById('breakTimer'),
        breakProgressBar: document.getElementById('breakProgressBar'),
        endBreakBtn: document.getElementById('endBreakBtn'),

        // Set Won Overlay
        setWonOverlay: document.getElementById('setWonOverlay'),
        setWonNumber: document.getElementById('setWonNumber'),
        setWinnerName: document.getElementById('setWinnerName'),
        setFinalScore: document.getElementById('setFinalScore'),
        continueMatchBtn: document.getElementById('continueMatchBtn'),

        // Match Over Overlay
        matchOverOverlay: document.getElementById('matchOverOverlay'),
        matchWinnerName: document.getElementById('matchWinnerName'),
        matchFinalScore: document.getElementById('matchFinalScore'),
        newMatchBtn: document.getElementById('newMatchBtn')
    };

    // Break timer interval
    let breakTimerInterval = null;

    // Set timer interval
    let setTimerInterval = null;

    // History entries
    const historyEntries = [];

    // Format seconds to mm:ss
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Initialize
    function init() {
        // Initialize state
        const state = GameState.init();

        // Check if match is already in progress
        if (state.matchStatus !== 'not_started') {
            showScoreSection();
        }

        // Subscribe to state changes
        GameState.subscribe(onStateChange);

        // Setup event listeners
        setupEventListeners();

        // Update UI with current state
        updateUI(state);
    }

    // Setup event listeners
    function setupEventListeners() {
        // Start match
        elements.startMatchBtn.addEventListener('click', startMatch);

        // Score buttons
        elements.team1ScoreBtn.addEventListener('click', () => addPoint('team1'));
        elements.team2ScoreBtn.addEventListener('click', () => addPoint('team2'));

        // Penalty buttons
        elements.team1PenaltyBtn.addEventListener('click', () => deductPenalty('team1'));
        elements.team2PenaltyBtn.addEventListener('click', () => deductPenalty('team2'));

        // Break buttons
        elements.team1BreakBtn.addEventListener('click', () => startBreak('team1'));
        elements.team2BreakBtn.addEventListener('click', () => startBreak('team2'));

        // End break
        elements.endBreakBtn.addEventListener('click', endBreak);

        // Match control
        elements.undoBtn.addEventListener('click', undoAction);
        elements.nextSetBtn.addEventListener('click', () => {
            elements.setWonOverlay.classList.remove('active');
            startNextSet();
        });
        elements.resetMatchBtn.addEventListener('click', confirmResetMatch);
        elements.continueMatchBtn.addEventListener('click', () => {
            elements.setWonOverlay.classList.remove('active');
            startNextSet();
        });
        elements.newMatchBtn.addEventListener('click', () => {
            elements.matchOverOverlay.classList.remove('active');
            resetMatch();
        });
    }

    // State change handler
    function onStateChange(state, action) {
        updateUI(state);

        // Handle specific actions
        if (action === 'BREAK_TICK') {
            updateBreakDisplay(state);
        }
    }

    // Cache for previous values to avoid unnecessary DOM updates
    let prevUIState = {
        currentSet: null,
        team1Score: null,
        team2Score: null,
        serving: null,
        servingSide: null,
        team1SetsWon: null,
        team2SetsWon: null,
        isSetPoint: null,
        isMatchPoint: null,
        matchStatus: null,
        breakActive: null
    };

    // Animation timers to prevent stacking
    let team1AnimTimer = null;
    let team2AnimTimer = null;

    // Update UI based on state - optimized to minimize DOM operations
    function updateUI(state) {
        const currentSetIndex = state.currentSet - 1;
        const currentSet = state.sets[currentSetIndex];

        // Only update DOM elements that changed
        if (prevUIState.currentSet !== state.currentSet) {
            elements.setIndicator.textContent = `Set ${state.currentSet}`;
            prevUIState.currentSet = state.currentSet;
        }

        // Update match status badge only if changed
        if (prevUIState.matchStatus !== state.matchStatus) {
            updateMatchStatusBadge(state);
            prevUIState.matchStatus = state.matchStatus;
        }

        // Update team displays only once (they don't change during match)
        if (!prevUIState.teamsSet) {
            elements.team1DisplayName.textContent = state.teams.team1.name;
            elements.team1DisplayPlayers.textContent = state.teams.team1.players.join(' & ');
            elements.team2DisplayName.textContent = state.teams.team2.name;
            elements.team2DisplayPlayers.textContent = state.teams.team2.players.join(' & ');
            prevUIState.teamsSet = true;
        }

        // Update scores only if changed
        if (prevUIState.team1Score !== currentSet.team1Score) {
            elements.team1Score.textContent = currentSet.team1Score;
            // Clear any pending animation timer
            if (team1AnimTimer) {
                clearTimeout(team1AnimTimer);
            }
            elements.team1Score.classList.add('animate');
            team1AnimTimer = setTimeout(() => {
                elements.team1Score.classList.remove('animate');
                team1AnimTimer = null;
            }, 300); // Reduced from 500ms for snappier feel
            prevUIState.team1Score = currentSet.team1Score;
        }

        if (prevUIState.team2Score !== currentSet.team2Score) {
            elements.team2Score.textContent = currentSet.team2Score;
            if (team2AnimTimer) {
                clearTimeout(team2AnimTimer);
            }
            elements.team2Score.classList.add('animate');
            team2AnimTimer = setTimeout(() => {
                elements.team2Score.classList.remove('animate');
                team2AnimTimer = null;
            }, 300);
            prevUIState.team2Score = currentSet.team2Score;
        }

        // Update service indicator only if changed
        if (prevUIState.serving !== state.serving || prevUIState.servingSide !== state.servingSide) {
            elements.team1Service.classList.toggle('active', state.serving === 'team1');
            elements.team2Service.classList.toggle('active', state.serving === 'team2');
            const sideText = `(${state.servingSide === 'right' ? 'Right' : 'Left'})`;
            elements.team1ServiceSide.textContent = sideText;
            elements.team2ServiceSide.textContent = sideText;
            prevUIState.serving = state.serving;
            prevUIState.servingSide = state.servingSide;
        }

        // Update sets won only if changed
        if (prevUIState.team1SetsWon !== state.setsWon.team1) {
            elements.team1SetsWon.textContent = state.setsWon.team1;
            prevUIState.team1SetsWon = state.setsWon.team1;
        }
        if (prevUIState.team2SetsWon !== state.setsWon.team2) {
            elements.team2SetsWon.textContent = state.setsWon.team2;
            prevUIState.team2SetsWon = state.setsWon.team2;
        }

        // Update point status alerts only if changed
        if (prevUIState.isSetPoint !== state.isSetPoint || prevUIState.isMatchPoint !== state.isMatchPoint) {
            elements.setPointAlert.classList.toggle('active', state.isSetPoint && !state.isMatchPoint);
            elements.matchPointAlert.classList.toggle('active', state.isMatchPoint);
            prevUIState.isSetPoint = state.isSetPoint;
            prevUIState.isMatchPoint = state.isMatchPoint;
        }

        // Update break buttons
        updateBreakButtons(state);

        // Update break display only if break state changed
        const breakActiveKey = state.breakActive.active + '-' + state.breakActive.timeRemaining;
        if (prevUIState.breakActive !== breakActiveKey) {
            updateBreakDisplay(state);
            prevUIState.breakActive = breakActiveKey;
        }

        // Show/hide next set button
        elements.nextSetBtn.classList.toggle('hidden', state.matchStatus !== 'set_won');

        // Handle overlays
        if (state.matchStatus === 'set_won' && !state.matchWinner) {
            showSetWonOverlay(state);
        }

        if (state.matchStatus === 'match_over' && state.matchWinner) {
            showMatchOverOverlay(state);
        }

        // Disable controls during break or match over
        const controlsDisabled = state.breakActive.active || state.matchStatus === 'match_over';
        elements.team1ScoreBtn.disabled = controlsDisabled;
        elements.team2ScoreBtn.disabled = controlsDisabled;
        elements.team1PenaltyBtn.disabled = controlsDisabled;
        elements.team2PenaltyBtn.disabled = controlsDisabled;
    }

    // Reset UI cache when match resets
    function resetUICache() {
        prevUIState = {
            currentSet: null,
            team1Score: null,
            team2Score: null,
            serving: null,
            servingSide: null,
            team1SetsWon: null,
            team2SetsWon: null,
            isSetPoint: null,
            isMatchPoint: null,
            matchStatus: null,
            breakActive: null,
            teamsSet: false
        };
    }

    // Update match status badge
    function updateMatchStatusBadge(state) {
        const badge = elements.matchStatusBadge;
        badge.classList.remove('not-started', 'in-progress', 'set-won', 'match-over');

        switch (state.matchStatus) {
            case 'not_started':
                badge.textContent = 'Not Started';
                badge.classList.add('not-started');
                break;
            case 'in_progress':
                badge.textContent = 'In Progress';
                badge.classList.add('in-progress');
                break;
            case 'set_won':
                badge.textContent = 'Set Break';
                badge.classList.add('set-won');
                break;
            case 'match_over':
                badge.textContent = 'Match Over';
                badge.classList.add('match-over');
                break;
        }
    }

    // Update break buttons
    function updateBreakButtons(state) {
        const setKey = 'set' + state.currentSet;
        const team1CanBreak = !state.breaks[setKey].team1Used && !state.breakActive.active && state.matchStatus === 'in_progress';
        const team2CanBreak = !state.breaks[setKey].team2Used && !state.breakActive.active && state.matchStatus === 'in_progress';

        elements.team1BreakBtn.disabled = !team1CanBreak;
        elements.team2BreakBtn.disabled = !team2CanBreak;

        elements.team1BreakInfo.textContent = state.breaks[setKey].team1Used
            ? 'Break used this set'
            : '1 break available this set';
        elements.team2BreakInfo.textContent = state.breaks[setKey].team2Used
            ? 'Break used this set'
            : '1 break available this set';
    }

    // Update break display
    function updateBreakDisplay(state) {
        if (state.breakActive.active) {
            elements.breakOverlay.classList.add('active');
            elements.breakTeamName.textContent = state.breakActive.teamName || state.teams[state.breakActive.team].name;

            // Format time as mm:ss
            elements.breakTimer.textContent = formatTime(state.breakActive.timeRemaining);

            // Progress bar - use configured break duration
            const breakDuration = state.config ? state.config.breakDuration : 90;
            const progress = (state.breakActive.timeRemaining / breakDuration) * 100;
            elements.breakProgressBar.style.width = `${progress}%`;

            // Timer color
            elements.breakTimer.classList.remove('warning', 'danger');
            if (state.breakActive.timeRemaining <= 15) {
                elements.breakTimer.classList.add('danger');
            } else if (state.breakActive.timeRemaining <= 30) {
                elements.breakTimer.classList.add('warning');
            }
        } else {
            elements.breakOverlay.classList.remove('active');
        }
    }

    // Show score section
    function showScoreSection() {
        elements.setupSection.style.display = 'none';
        elements.scoreSection.classList.add('active');
    }

    // Start match
    function startMatch() {
        const team1Name = elements.team1Name.value.trim() || 'Team Alpha';
        const team1Players = [
            elements.team1Player1.value.trim() || 'Player 1',
            elements.team1Player2.value.trim() || 'Player 2'
        ];
        const team2Name = elements.team2Name.value.trim() || 'Team Beta';
        const team2Players = [
            elements.team2Player1.value.trim() || 'Player 3',
            elements.team2Player2.value.trim() || 'Player 4'
        ];

        // Apply settings before starting
        const setDuration = parseInt(elements.setDurationInput.value) || 25;
        const breakDuration = parseInt(elements.breakDurationInput.value) || 90;
        GameState.setConfig({
            setDuration: setDuration * 60, // Convert minutes to seconds
            breakDuration: breakDuration
        });

        GameState.setTeams(team1Name, team1Players, team2Name, team2Players);
        GameState.startMatch();

        // Start set timer
        startSetTimer();

        showScoreSection();
        addHistoryEntry('Match started');
    }

    // Start set timer
    function startSetTimer() {
        if (setTimerInterval) {
            clearInterval(setTimerInterval);
        }

        setTimerInterval = setInterval(() => {
            const state = GameState.getState();
            if (!state.setTimer.running || state.breakActive.active) {
                return; // Don't tick if not running or on break
            }

            const elapsed = state.setTimer.startTime
                ? Math.floor((Date.now() - state.setTimer.startTime) / 1000)
                : 0;

            // Update timer display directly for performance
            elements.setTimer.textContent = formatTime(elapsed);

            // Check if exceeded max duration (optional warning)
            if (elapsed >= state.config.setDuration) {
                elements.setTimer.classList.add('overtime');
            }
        }, 1000);
    }

    // Stop set timer
    function stopSetTimer() {
        if (setTimerInterval) {
            clearInterval(setTimerInterval);
            setTimerInterval = null;
        }
    }

    // Add point - optimized with debouncing and batch updates
    function addPoint(team) {
        // Debounce rapid clicks
        if (!canProcessClick()) return;

        const state = GameState.getState();
        if (state.matchStatus !== 'in_progress') return;

        // Process point with rules engine
        const result = BadmintonRules.processPoint(state, team);

        // Start batch update for better performance
        GameState.startBatch();

        // Add the point
        GameState.addPoint(team);

        // Update service
        GameState.setServing(result.newServer, result.newServingSide);

        // Check for set/match point
        if (!result.setWinner) {
            GameState.setPointStatus(
                result.isMatchPoint,
                result.matchPointTeam,
                result.isSetPoint,
                result.setPointTeam
            );
        }

        // Handle ends change in 3rd set
        if (result.shouldChangeEnds) {
            GameState.changeEnds(true);
            addHistoryEntry('Ends changed at 11 points');
        }

        // End batch - applies all updates at once
        GameState.endBatch('POINT_SCORED');

        // Check for set win (after batch to get updated state)
        if (result.setWinner) {
            GameState.setSetWinner(result.setWinner);
            const winnerName = state.teams[result.setWinner].name;
            addHistoryEntry(`Set ${state.currentSet} won by ${winnerName}`);

            // Check for match win
            if (result.matchWinner) {
                GameState.setMatchWinner(result.matchWinner);
                addHistoryEntry(`Match won by ${state.teams[result.matchWinner].name}`);
            }
        }

        // Add to history
        const teamName = state.teams[team].name;
        const newState = GameState.getState();
        const currentSetIndex = newState.currentSet - 1;
        addHistoryEntry(`${teamName} scored (${newState.sets[currentSetIndex].team1Score}-${newState.sets[currentSetIndex].team2Score})`);
    }

    // Deduct penalty
    function deductPenalty(team) {
        const state = GameState.getState();
        if (state.matchStatus !== 'in_progress') return;

        GameState.deductPenalty(team);

        const teamName = state.teams[team].name;
        addHistoryEntry(`Penalty: ${teamName} -2 points (argument)`);
    }

    // Start break
    function startBreak(team) {
        const state = GameState.getState();
        if (!GameState.canUseBreak(team)) return;

        GameState.startBreak(team);

        const teamName = state.teams[team].name;
        addHistoryEntry(`Break started: ${teamName}`);

        // Start countdown
        startBreakTimer();
    }

    // Start break timer
    function startBreakTimer() {
        if (breakTimerInterval) {
            clearInterval(breakTimerInterval);
        }

        breakTimerInterval = setInterval(() => {
            const state = GameState.getState();
            if (!state.breakActive.active) {
                clearInterval(breakTimerInterval);
                breakTimerInterval = null;
                return;
            }

            const newTime = state.breakActive.timeRemaining - 1;

            if (newTime <= 0) {
                endBreak();
            } else {
                GameState.updateBreakTimer(newTime);
            }
        }, 1000);
    }

    // End break
    function endBreak() {
        if (breakTimerInterval) {
            clearInterval(breakTimerInterval);
            breakTimerInterval = null;
        }

        GameState.endBreak();
        addHistoryEntry('Break ended');
    }

    // Start next set
    function startNextSet() {
        GameState.startNextSet();
        GameState.changeEnds(false);

        // Restart set timer
        startSetTimer();
        elements.setTimer.classList.remove('overtime');
        elements.setTimer.textContent = '00:00';

        addHistoryEntry(`Set ${GameState.getState().currentSet} started`);
    }

    // Undo action
    function undoAction() {
        if (GameState.undo()) {
            addHistoryEntry('Action undone');
        }
    }

    // Confirm reset match
    function confirmResetMatch() {
        if (confirm('Are you sure you want to reset the match? All progress will be lost.')) {
            resetMatch();
        }
    }

    // Reset match
    function resetMatch() {
        if (breakTimerInterval) {
            clearInterval(breakTimerInterval);
            breakTimerInterval = null;
        }

        // Stop set timer
        stopSetTimer();

        GameState.resetMatch();

        // Reset UI cache
        resetUICache();

        // Reset set timer display
        elements.setTimer.textContent = '00:00';
        elements.setTimer.classList.remove('overtime');

        // Reset UI
        elements.setupSection.style.display = 'block';
        elements.scoreSection.classList.remove('active');
        elements.setWonOverlay.classList.remove('active');
        elements.matchOverOverlay.classList.remove('active');
        elements.breakOverlay.classList.remove('active');

        // Clear history
        historyEntries.length = 0;
        elements.historyList.innerHTML = '<li class="history-item"><span class="history-action">Ready for new match</span><span class="history-time">--:--</span></li>';
    }

    // Debounced history render
    let historyRenderPending = null;

    // Add history entry - optimized with debounced rendering
    function addHistoryEntry(action) {
        const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const entry = { action, time };
        historyEntries.unshift(entry);

        // Keep only last 30 entries (reduced for performance)
        if (historyEntries.length > 30) {
            historyEntries.pop();
        }

        // Debounce history rendering
        if (historyRenderPending) return;
        historyRenderPending = requestAnimationFrame(() => {
            historyRenderPending = null;
            renderHistory();
        });
    }

    // Render history - optimized with DocumentFragment
    function renderHistory() {
        const fragment = document.createDocumentFragment();
        const len = historyEntries.length;
        for (let i = 0; i < len; i++) {
            const entry = historyEntries[i];
            const li = document.createElement('li');
            li.className = 'history-item';
            li.innerHTML = `<span class="history-action">${entry.action}</span><span class="history-time">${entry.time}</span>`;
            fragment.appendChild(li);
        }
        elements.historyList.innerHTML = '';
        elements.historyList.appendChild(fragment);
    }

    // Show set won overlay
    function showSetWonOverlay(state) {
        const winner = state.setWinner;
        const currentSetIndex = state.currentSet - 1;
        const currentSet = state.sets[currentSetIndex];

        elements.setWonNumber.textContent = state.currentSet;
        elements.setWinnerName.textContent = state.teams[winner].name;
        elements.setFinalScore.textContent = `${currentSet.team1Score} - ${currentSet.team2Score}`;

        // Check if match is over
        if (state.setsWon[winner] >= 2) {
            // Don't show set won overlay, match over will show
            return;
        }

        elements.setWonOverlay.classList.add('active');
    }

    // Show match over overlay
    function showMatchOverOverlay(state) {
        const winner = state.matchWinner;
        elements.matchWinnerName.textContent = `${state.teams[winner].name} Wins!`;
        elements.matchFinalScore.textContent = `Sets: ${state.setsWon.team1} - ${state.setsWon.team2}`;
        elements.matchOverOverlay.classList.add('active');
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
