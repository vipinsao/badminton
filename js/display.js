/**
 * Smasher Badminton Club - Display Panel Controller
 * Real-time spectator view
 */

(function() {
    'use strict';

    // DOM Elements
    const elements = {
        // Screens
        waitingScreen: document.getElementById('waitingScreen'),
        displayContainer: document.getElementById('displayContainer'),

        // Header
        displaySetBadge: document.getElementById('displaySetBadge'),
        displaySetTimer: document.getElementById('displaySetTimer'),
        displayStatusBadge: document.getElementById('displayStatusBadge'),

        // Team 1
        displayTeam1Name: document.getElementById('displayTeam1Name'),
        displayTeam1Players: document.getElementById('displayTeam1Players'),
        displayTeam1Score: document.getElementById('displayTeam1Score'),
        displayTeam1Service: document.getElementById('displayTeam1Service'),
        displayTeam1ServiceSide: document.getElementById('displayTeam1ServiceSide'),
        displayTeam1Sets: document.getElementById('displayTeam1Sets'),
        team1BreakLabel: document.getElementById('team1BreakLabel'),
        team1BreakDot: document.getElementById('team1BreakDot'),

        // Team 2
        displayTeam2Name: document.getElementById('displayTeam2Name'),
        displayTeam2Players: document.getElementById('displayTeam2Players'),
        displayTeam2Score: document.getElementById('displayTeam2Score'),
        displayTeam2Service: document.getElementById('displayTeam2Service'),
        displayTeam2ServiceSide: document.getElementById('displayTeam2ServiceSide'),
        displayTeam2Sets: document.getElementById('displayTeam2Sets'),
        team2BreakLabel: document.getElementById('team2BreakLabel'),
        team2BreakDot: document.getElementById('team2BreakDot'),

        // Point Status
        pointStatusOverlay: document.getElementById('pointStatusOverlay'),
        pointStatusText: document.getElementById('pointStatusText'),

        // Break Overlay
        breakOverlayDisplay: document.getElementById('breakOverlayDisplay'),
        breakTeamDisplay: document.getElementById('breakTeamDisplay'),
        breakTimerDisplay: document.getElementById('breakTimerDisplay'),
        breakProgressBarDisplay: document.getElementById('breakProgressBarDisplay'),

        // Set Won Overlay
        setWonOverlayDisplay: document.getElementById('setWonOverlayDisplay'),
        setWonTitleDisplay: document.getElementById('setWonTitleDisplay'),
        setWonWinnerDisplay: document.getElementById('setWonWinnerDisplay'),
        setWonScoreDisplay: document.getElementById('setWonScoreDisplay'),

        // Match Won Overlay
        matchWonOverlayDisplay: document.getElementById('matchWonOverlayDisplay'),
        matchWonWinnerDisplay: document.getElementById('matchWonWinnerDisplay'),
        matchWonScoreDisplay: document.getElementById('matchWonScoreDisplay'),

        // Ends Changed
        endsChangedNotification: document.getElementById('endsChangedNotification')
    };

    // Timeout for hiding overlays
    let setWonTimeout = null;
    let endsChangedTimeout = null;
    let setTimerInterval = null;
    let confettiInterval = null;
    let confettiParticles = [];

    // Format seconds to mm:ss
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Previous scores for animation
    let prevScores = { team1: 0, team2: 0 };

    // Animation timers to prevent stacking
    let team1AnimTimer = null;
    let team2AnimTimer = null;

    // Cache for previous UI state to minimize DOM operations
    let prevUIState = {
        currentSet: null,
        matchStatus: null,
        serving: null,
        servingSide: null,
        team1SetsWon: null,
        team2SetsWon: null,
        isSetPoint: null,
        isMatchPoint: null,
        breakActive: null,
        teamsSet: false
    };

    // Initialize
    function init() {
        // Initialize state from localStorage (in case page was refreshed)
        const state = GameState.init();

        // Subscribe to state changes
        GameState.subscribe(onStateChange);

        // Request sync from admin panel
        GameState.requestSync();

        // Start set timer display
        startSetTimerDisplay();

        // Update UI with current state
        updateDisplay(state);
    }

    // Start set timer display interval
    function startSetTimerDisplay() {
        if (setTimerInterval) {
            clearInterval(setTimerInterval);
        }

        setTimerInterval = setInterval(() => {
            const state = GameState.getState();
            if (!state.setTimer || !state.setTimer.running || state.breakActive.active) {
                return;
            }

            const elapsed = state.setTimer.startTime
                ? Math.floor((Date.now() - state.setTimer.startTime) / 1000)
                : 0;

            elements.displaySetTimer.textContent = formatTime(elapsed);

            // Check if exceeded max duration
            const maxDuration = state.config ? state.config.setDuration : 25 * 60;
            if (elapsed >= maxDuration) {
                elements.displaySetTimer.classList.add('overtime');
            } else {
                elements.displaySetTimer.classList.remove('overtime');
            }
        }, 1000);
    }

    // State change handler
    function onStateChange(state, action) {
        updateDisplay(state, action);
    }

    // Update display based on state - optimized to minimize DOM operations
    function updateDisplay(state, action = null) {
        // Show/hide waiting screen based on match status
        if (state.matchStatus === 'not_started') {
            elements.waitingScreen.classList.remove('hidden');
            elements.displayContainer.style.display = 'none';
            return;
        } else {
            elements.waitingScreen.classList.add('hidden');
            elements.displayContainer.style.display = 'flex';
        }

        // Update header only if changed
        if (prevUIState.currentSet !== state.currentSet) {
            elements.displaySetBadge.textContent = `Set ${state.currentSet}`;
            prevUIState.currentSet = state.currentSet;
        }

        // Update status badge only if needed
        if (prevUIState.matchStatus !== state.matchStatus || prevUIState.breakActive !== state.breakActive.active) {
            updateStatusBadge(state);
            prevUIState.matchStatus = state.matchStatus;
            prevUIState.breakActive = state.breakActive.active;
        }

        // Update team info only once (doesn't change during match)
        if (!prevUIState.teamsSet) {
            elements.displayTeam1Name.textContent = state.teams.team1.name;
            elements.displayTeam1Players.textContent = state.teams.team1.players.join(' & ');
            elements.displayTeam2Name.textContent = state.teams.team2.name;
            elements.displayTeam2Players.textContent = state.teams.team2.players.join(' & ');
            elements.team1BreakLabel.textContent = state.teams.team1.name;
            elements.team2BreakLabel.textContent = state.teams.team2.name;
            prevUIState.teamsSet = true;
        }

        // Update scores with animation
        const currentSetIndex = state.currentSet - 1;
        const currentSet = state.sets[currentSetIndex];

        updateScoreWithAnimation('team1', currentSet.team1Score);
        updateScoreWithAnimation('team2', currentSet.team2Score);

        // Update sets won only if changed
        if (prevUIState.team1SetsWon !== state.setsWon.team1) {
            elements.displayTeam1Sets.textContent = state.setsWon.team1;
            prevUIState.team1SetsWon = state.setsWon.team1;
        }
        if (prevUIState.team2SetsWon !== state.setsWon.team2) {
            elements.displayTeam2Sets.textContent = state.setsWon.team2;
            prevUIState.team2SetsWon = state.setsWon.team2;
        }

        // Update service indicator only if changed
        if (prevUIState.serving !== state.serving || prevUIState.servingSide !== state.servingSide) {
            elements.displayTeam1Service.classList.toggle('active', state.serving === 'team1');
            elements.displayTeam2Service.classList.toggle('active', state.serving === 'team2');
            const sideText = `(${state.servingSide === 'right' ? 'Right' : 'Left'})`;
            elements.displayTeam1ServiceSide.textContent = sideText;
            elements.displayTeam2ServiceSide.textContent = sideText;
            prevUIState.serving = state.serving;
            prevUIState.servingSide = state.servingSide;
        }

        // Update break indicators
        updateBreakIndicators(state);

        // Update break overlay
        updateBreakOverlay(state);

        // Update point status only if changed
        if (prevUIState.isSetPoint !== state.isSetPoint || prevUIState.isMatchPoint !== state.isMatchPoint) {
            updatePointStatus(state);
            prevUIState.isSetPoint = state.isSetPoint;
            prevUIState.isMatchPoint = state.isMatchPoint;
        }

        // Handle set won display
        if (action === 'SET_WON' && !state.matchWinner) {
            showSetWonOverlay(state);
        }

        // Handle match won display
        if (state.matchStatus === 'match_over' && state.matchWinner) {
            showMatchWonOverlay(state);
        } else {
            elements.matchWonOverlayDisplay.classList.remove('active');
        }

        // Handle ends changed notification
        if (state.endsChanged && action === 'ENDS_CHANGED') {
            showEndsChangedNotification();
        }

        // Hide set won overlay when next set starts
        if (action === 'SET_START') {
            // Clear any pending timeout
            if (setWonTimeout) {
                clearTimeout(setWonTimeout);
                setWonTimeout = null;
            }
            elements.setWonOverlayDisplay.classList.remove('active', 'transitioning');
        }

        // Reset on match reset
        if (action === 'MATCH_RESET') {
            elements.setWonOverlayDisplay.classList.remove('active', 'transitioning');
            elements.matchWonOverlayDisplay.classList.remove('active', 'straight-win');
            elements.breakOverlayDisplay.classList.remove('active');
            elements.pointStatusOverlay.classList.remove('active');
            prevScores = { team1: 0, team2: 0 };
            // Reset set timer display
            elements.displaySetTimer.textContent = '00:00';
            elements.displaySetTimer.classList.remove('overtime');
            // Stop confetti
            stopConfetti();
            // Clear any pending timeouts
            if (setWonTimeout) {
                clearTimeout(setWonTimeout);
                setWonTimeout = null;
            }
            // Reset UI cache
            prevUIState = {
                currentSet: null,
                matchStatus: null,
                serving: null,
                servingSide: null,
                team1SetsWon: null,
                team2SetsWon: null,
                isSetPoint: null,
                isMatchPoint: null,
                breakActive: null,
                teamsSet: false
            };
        }
    }

    // Update score with animation - optimized
    function updateScoreWithAnimation(team, newScore) {
        const element = team === 'team1' ? elements.displayTeam1Score : elements.displayTeam2Score;
        const prevScore = prevScores[team];

        if (newScore !== prevScore) {
            element.textContent = newScore;

            // Clear any pending animation timer to prevent stacking
            if (team === 'team1') {
                if (team1AnimTimer) clearTimeout(team1AnimTimer);
                element.classList.add('animate');
                team1AnimTimer = setTimeout(() => {
                    element.classList.remove('animate');
                    team1AnimTimer = null;
                }, 300); // Reduced from 600ms for snappier feel
            } else {
                if (team2AnimTimer) clearTimeout(team2AnimTimer);
                element.classList.add('animate');
                team2AnimTimer = setTimeout(() => {
                    element.classList.remove('animate');
                    team2AnimTimer = null;
                }, 300);
            }
            prevScores[team] = newScore;
        }
    }

    // Update status badge
    function updateStatusBadge(state) {
        const badge = elements.displayStatusBadge;
        badge.classList.remove('waiting', 'live', 'break', 'finished');

        if (state.breakActive.active) {
            badge.textContent = 'BREAK';
            badge.classList.add('break');
        } else if (state.matchStatus === 'match_over') {
            badge.textContent = 'FINISHED';
            badge.classList.add('finished');
        } else if (state.matchStatus === 'set_won') {
            badge.textContent = 'SET BREAK';
            badge.classList.add('break');
        } else {
            badge.textContent = 'LIVE';
            badge.classList.add('live');
        }
    }

    // Update break indicators in footer
    function updateBreakIndicators(state) {
        const setKey = 'set' + state.currentSet;

        // Team 1
        elements.team1BreakDot.classList.remove('available', 'used');
        if (state.breaks[setKey].team1Used) {
            elements.team1BreakDot.classList.add('used');
        } else {
            elements.team1BreakDot.classList.add('available');
        }

        // Team 2
        elements.team2BreakDot.classList.remove('available', 'used');
        if (state.breaks[setKey].team2Used) {
            elements.team2BreakDot.classList.add('used');
        } else {
            elements.team2BreakDot.classList.add('available');
        }
    }

    // Update break overlay
    function updateBreakOverlay(state) {
        if (state.breakActive.active) {
            elements.breakOverlayDisplay.classList.add('active');
            elements.breakTeamDisplay.textContent = state.breakActive.teamName || state.teams[state.breakActive.team].name;

            // Format time as mm:ss
            elements.breakTimerDisplay.textContent = formatTime(state.breakActive.timeRemaining);

            // Progress bar - use configured break duration
            const breakDuration = state.config ? state.config.breakDuration : 90;
            const progress = (state.breakActive.timeRemaining / breakDuration) * 100;
            elements.breakProgressBarDisplay.style.width = `${progress}%`;

            // Timer color
            elements.breakTimerDisplay.classList.remove('warning', 'danger');
            if (state.breakActive.timeRemaining <= 15) {
                elements.breakTimerDisplay.classList.add('danger');
            } else if (state.breakActive.timeRemaining <= 30) {
                elements.breakTimerDisplay.classList.add('warning');
            }
        } else {
            elements.breakOverlayDisplay.classList.remove('active');
        }
    }

    // Update point status overlay
    function updatePointStatus(state) {
        if (state.isMatchPoint) {
            elements.pointStatusOverlay.classList.add('active', 'match-point');
            elements.pointStatusOverlay.classList.remove('set-point');
            elements.pointStatusText.textContent = 'MATCH POINT';
        } else if (state.isSetPoint) {
            elements.pointStatusOverlay.classList.add('active', 'set-point');
            elements.pointStatusOverlay.classList.remove('match-point');
            elements.pointStatusText.textContent = 'SET POINT';
        } else {
            elements.pointStatusOverlay.classList.remove('active', 'set-point', 'match-point');
        }
    }

    // Show set won overlay
    function showSetWonOverlay(state) {
        const winner = state.setWinner;
        const currentSetIndex = state.currentSet - 1;
        const currentSet = state.sets[currentSetIndex];
        const nextSet = state.currentSet + 1;

        elements.setWonTitleDisplay.textContent = `Set ${state.currentSet} Won!`;
        elements.setWonWinnerDisplay.textContent = state.teams[winner].name;
        elements.setWonScoreDisplay.textContent = `${currentSet.team1Score} - ${currentSet.team2Score}`;

        elements.setWonOverlayDisplay.classList.add('active');

        // Auto-hide after 20 seconds and show "Set X Starts" message
        if (setWonTimeout) clearTimeout(setWonTimeout);
        setWonTimeout = setTimeout(() => {
            const currentState = GameState.getState();
            // Only transition if match is not over and we haven't moved to next set yet
            if (currentState.matchStatus !== 'match_over' && currentState.matchStatus === 'set_won') {
                // Show "Set X Starts" message
                showSetStartsMessage(nextSet);
            }
        }, 20000);
    }

    // Show "Set X Starts" transition message
    function showSetStartsMessage(setNumber) {
        elements.setWonTitleDisplay.textContent = `Set ${setNumber}`;
        elements.setWonWinnerDisplay.textContent = 'Starting Soon...';
        elements.setWonScoreDisplay.textContent = 'Get Ready!';

        // Add transition animation class
        elements.setWonOverlayDisplay.classList.add('transitioning');

        // Hide after 3 seconds
        setTimeout(() => {
            elements.setWonOverlayDisplay.classList.remove('active', 'transitioning');
        }, 3000);
    }

    // Show match won overlay
    function showMatchWonOverlay(state) {
        const winner = state.matchWinner;
        elements.matchWonWinnerDisplay.textContent = state.teams[winner].name;
        elements.matchWonScoreDisplay.textContent = `Sets: ${state.setsWon.team1} - ${state.setsWon.team2}`;
        elements.matchWonOverlayDisplay.classList.add('active');

        // Hide set won overlay
        elements.setWonOverlayDisplay.classList.remove('active');

        // Check for straight win (2-0)
        const isStraightWin = (state.setsWon.team1 === 2 && state.setsWon.team2 === 0) ||
                              (state.setsWon.team2 === 2 && state.setsWon.team1 === 0);

        if (isStraightWin) {
            // Add straight win class for extra celebration
            elements.matchWonOverlayDisplay.classList.add('straight-win');
            startConfetti();
            // Extra fireworks bursts for straight win
            startFireworks();
        } else {
            startConfetti(); // Still show confetti for any match win
            startFireworks(); // Also show fireworks for 3-set match win
        }
    }

    // Fireworks burst effect
    function startFireworks() {
        let fireworksContainer = document.getElementById('fireworksContainer');
        if (!fireworksContainer) {
            fireworksContainer = document.createElement('div');
            fireworksContainer.id = 'fireworksContainer';
            fireworksContainer.className = 'fireworks-container';
            document.body.appendChild(fireworksContainer);
        }

        // Create multiple bursts
        const burstPositions = [
            { x: 20, y: 30 }, { x: 80, y: 25 }, { x: 50, y: 20 },
            { x: 30, y: 40 }, { x: 70, y: 35 }, { x: 15, y: 50 },
            { x: 85, y: 45 }, { x: 40, y: 60 }, { x: 60, y: 55 }
        ];

        burstPositions.forEach((pos, index) => {
            setTimeout(() => {
                createFireworkBurst(fireworksContainer, pos.x, pos.y);
            }, index * 400);
        });

        // Continue bursting
        let burstCount = 0;
        const burstInterval = setInterval(() => {
            const randomX = Math.random() * 80 + 10;
            const randomY = Math.random() * 40 + 10;
            createFireworkBurst(fireworksContainer, randomX, randomY);
            burstCount++;
            if (burstCount > 20) {
                clearInterval(burstInterval);
            }
        }, 600);

        // Clean up after 12 seconds
        setTimeout(() => {
            if (fireworksContainer) {
                fireworksContainer.innerHTML = '';
            }
        }, 12000);
    }

    function createFireworkBurst(container, x, y) {
        const burst = document.createElement('div');
        burst.className = 'firework-burst';
        burst.style.left = `${x}%`;
        burst.style.top = `${y}%`;

        const colors = ['#f39c12', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#ff6b6b', '#ffd93d', '#ffffff'];
        const particleCount = 20;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'firework-particle';
            const angle = (i / particleCount) * 360;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const distance = 80 + Math.random() * 60;

            particle.style.cssText = `
                --angle: ${angle}deg;
                --distance: ${distance}px;
                --color: ${color};
            `;
            burst.appendChild(particle);
        }

        container.appendChild(burst);

        // Remove burst after animation
        setTimeout(() => {
            if (burst.parentNode) {
                burst.parentNode.removeChild(burst);
            }
        }, 1500);
    }

    // Confetti celebration effect
    function startConfetti() {
        // Stop any existing confetti
        stopConfetti();

        // Create confetti container if it doesn't exist
        let confettiContainer = document.getElementById('confettiContainer');
        if (!confettiContainer) {
            confettiContainer = document.createElement('div');
            confettiContainer.id = 'confettiContainer';
            confettiContainer.className = 'confetti-container';
            document.body.appendChild(confettiContainer);
        }
        confettiContainer.innerHTML = '';

        const colors = ['#f39c12', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#ffffff', '#ff6b6b', '#ffd93d'];
        const shapes = ['square', 'circle', 'triangle'];
        const particleCount = 150;

        // Create particles
        for (let i = 0; i < particleCount; i++) {
            createConfettiParticle(confettiContainer, colors, shapes, i);
        }

        // Continue spawning particles
        confettiInterval = setInterval(() => {
            for (let i = 0; i < 10; i++) {
                createConfettiParticle(confettiContainer, colors, shapes, Math.random() * 1000);
            }
        }, 500);

        // Stop after 10 seconds
        setTimeout(() => {
            stopConfetti();
        }, 10000);
    }

    function createConfettiParticle(container, colors, shapes, delay) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';

        const color = colors[Math.floor(Math.random() * colors.length)];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const size = Math.random() * 10 + 5;
        const left = Math.random() * 100;
        const animDuration = Math.random() * 3 + 2;
        const animDelay = (delay % 100) / 100;

        particle.style.cssText = `
            position: absolute;
            left: ${left}%;
            top: -20px;
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            animation: confettiFall ${animDuration}s ease-out ${animDelay}s forwards;
            opacity: 0;
        `;

        if (shape === 'circle') {
            particle.style.borderRadius = '50%';
        } else if (shape === 'triangle') {
            particle.style.width = '0';
            particle.style.height = '0';
            particle.style.backgroundColor = 'transparent';
            particle.style.borderLeft = `${size/2}px solid transparent`;
            particle.style.borderRight = `${size/2}px solid transparent`;
            particle.style.borderBottom = `${size}px solid ${color}`;
        }

        container.appendChild(particle);
        confettiParticles.push(particle);

        // Remove particle after animation
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
            const index = confettiParticles.indexOf(particle);
            if (index > -1) {
                confettiParticles.splice(index, 1);
            }
        }, (animDuration + animDelay) * 1000 + 100);
    }

    function stopConfetti() {
        if (confettiInterval) {
            clearInterval(confettiInterval);
            confettiInterval = null;
        }
        // Clean up particles
        confettiParticles.forEach(particle => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        });
        confettiParticles = [];

        // Also clean up confetti container
        const confettiContainer = document.getElementById('confettiContainer');
        if (confettiContainer) {
            confettiContainer.innerHTML = '';
        }

        // Clean up fireworks container
        const fireworksContainer = document.getElementById('fireworksContainer');
        if (fireworksContainer) {
            fireworksContainer.innerHTML = '';
        }
    }

    // Show ends changed notification
    function showEndsChangedNotification() {
        elements.endsChangedNotification.classList.add('active');

        if (endsChangedTimeout) clearTimeout(endsChangedTimeout);
        endsChangedTimeout = setTimeout(() => {
            elements.endsChangedNotification.classList.remove('active');
            GameState.clearEndsChanged();
        }, 3000);
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
