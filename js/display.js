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
        scoreDisplay: document.getElementById('scoreDisplay'),

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
        sidesSwapped: null,
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

        // Update sides swapped state (CSS-based swap on container for all elements)
        if (prevUIState.sidesSwapped !== state.sidesSwapped) {
            if (elements.displayContainer) {
                elements.displayContainer.classList.toggle('sides-swapped', state.sidesSwapped);
            }
            prevUIState.sidesSwapped = state.sidesSwapped;
        }

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
            // Reset sides swapped
            if (elements.displayContainer) {
                elements.displayContainer.classList.remove('sides-swapped');
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
                sidesSwapped: null,
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

        // Auto-hide after 10 seconds
        if (setWonTimeout) clearTimeout(setWonTimeout);
        setWonTimeout = setTimeout(() => {
            elements.setWonOverlayDisplay.classList.remove('active', 'transitioning');
            setWonTimeout = null;
        }, 10000);
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

    // Fireworks burst effect - optimized
    let fireworksInterval = null;
    function startFireworks() {
        let fireworksContainer = document.getElementById('fireworksContainer');
        if (!fireworksContainer) {
            fireworksContainer = document.createElement('div');
            fireworksContainer.id = 'fireworksContainer';
            fireworksContainer.className = 'fireworks-container';
            document.body.appendChild(fireworksContainer);
        }
        fireworksContainer.innerHTML = '';

        // Create initial bursts - reduced count
        const burstPositions = [
            { x: 20, y: 30 }, { x: 80, y: 25 }, { x: 50, y: 20 },
            { x: 30, y: 45 }, { x: 70, y: 40 }
        ];

        burstPositions.forEach((pos, index) => {
            setTimeout(() => {
                if (fireworksContainer) {
                    createFireworkBurst(fireworksContainer, pos.x, pos.y);
                }
            }, index * 500);
        });

        // Continue bursting - reduced rate and stored for cleanup
        let burstCount = 0;
        const maxBursts = 12; // Reduced from 20
        fireworksInterval = setInterval(() => {
            burstCount++;
            if (burstCount >= maxBursts || !fireworksContainer) {
                clearInterval(fireworksInterval);
                fireworksInterval = null;
                return;
            }
            const randomX = Math.random() * 70 + 15;
            const randomY = Math.random() * 35 + 15;
            createFireworkBurst(fireworksContainer, randomX, randomY);
        }, 700);

        // Clean up after 10 seconds
        setTimeout(() => {
            if (fireworksInterval) {
                clearInterval(fireworksInterval);
                fireworksInterval = null;
            }
            if (fireworksContainer) {
                fireworksContainer.innerHTML = '';
            }
        }, 10000);
    }

    function createFireworkBurst(container, x, y) {
        if (!container) return;

        const burst = document.createElement('div');
        burst.className = 'firework-burst';
        burst.style.left = `${x}%`;
        burst.style.top = `${y}%`;

        const colors = ['#f39c12', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#ffd93d'];
        const particleCount = 12; // Reduced from 20

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'firework-particle';
            const angle = (i / particleCount) * 360;
            const color = colors[i % colors.length];
            const distance = 60 + Math.random() * 40;

            particle.style.cssText = `
                --angle: ${angle}deg;
                --distance: ${distance}px;
                --color: ${color};
                will-change: transform, opacity;
            `;
            burst.appendChild(particle);
        }

        container.appendChild(burst);

        // Remove burst after animation
        setTimeout(() => {
            if (burst.parentNode) {
                burst.remove();
            }
        }, 1300);
    }

    // Confetti celebration effect - optimized for performance
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
        const shapes = ['square', 'circle'];
        const particleCount = 80; // Reduced from 150 for better performance

        // Create initial particles
        for (let i = 0; i < particleCount; i++) {
            createConfettiParticle(confettiContainer, colors, shapes, i * 0.02);
        }

        // Continue spawning particles at reduced rate
        let spawnCount = 0;
        const maxSpawns = 15; // Reduced iterations
        confettiInterval = setInterval(() => {
            spawnCount++;
            if (spawnCount >= maxSpawns) {
                clearInterval(confettiInterval);
                confettiInterval = null;
                return;
            }
            for (let i = 0; i < 5; i++) { // Reduced from 10
                createConfettiParticle(confettiContainer, colors, shapes, 0);
            }
        }, 600); // Increased interval

        // Stop after 8 seconds
        setTimeout(() => {
            stopConfetti();
        }, 8000);
    }

    function createConfettiParticle(container, colors, shapes, delay) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';

        const color = colors[Math.floor(Math.random() * colors.length)];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const size = Math.random() * 8 + 4; // Slightly smaller
        const left = Math.random() * 100;
        const animDuration = Math.random() * 2.5 + 2; // Slightly faster

        particle.style.cssText = `
            position: absolute;
            left: ${left}%;
            top: -20px;
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            animation: confettiFall ${animDuration}s ease-out ${delay}s forwards;
            opacity: 0;
            will-change: transform, opacity;
        `;

        if (shape === 'circle') {
            particle.style.borderRadius = '50%';
        }

        container.appendChild(particle);
        confettiParticles.push(particle);

        // Remove particle after animation using single cleanup
        const cleanupTime = (animDuration + delay) * 1000 + 200;
        setTimeout(() => {
            if (particle.parentNode) {
                particle.remove();
            }
        }, cleanupTime);
    }

    function stopConfetti() {
        if (confettiInterval) {
            clearInterval(confettiInterval);
            confettiInterval = null;
        }
        if (fireworksInterval) {
            clearInterval(fireworksInterval);
            fireworksInterval = null;
        }
        // Clean up particles
        confettiParticles.forEach(particle => {
            if (particle.parentNode) {
                particle.remove();
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

    // Cleanup on page unload
    function cleanup() {
        if (setTimerInterval) clearInterval(setTimerInterval);
        if (setWonTimeout) clearTimeout(setWonTimeout);
        if (endsChangedTimeout) clearTimeout(endsChangedTimeout);
        if (team1AnimTimer) clearTimeout(team1AnimTimer);
        if (team2AnimTimer) clearTimeout(team2AnimTimer);
        stopConfetti();
    }

    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('unload', cleanup);

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
