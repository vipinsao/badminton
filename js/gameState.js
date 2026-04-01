/**
 * Smasher Badminton Club - Game State Management
 * Real-time sync using BroadcastChannel API with localStorage backup
 * Optimized for rapid updates
 */

const GameState = (function() {
    // BroadcastChannel for real-time sync between tabs
    const channel = new BroadcastChannel('smasher-scoreboard');

    // State change listeners
    const listeners = [];

    // Performance optimization flags
    let pendingBroadcast = null;
    let pendingSave = null;
    let pendingNotify = null;
    const BROADCAST_DELAY = 16; // ~1 frame
    const SAVE_DELAY = 100; // Debounce localStorage writes
    const NOTIFY_DELAY = 8; // Fast UI updates

    // Configuration
    const CONFIG = {
        BREAK_DURATION: 90, // 1 minute 30 seconds
        SET_DURATION: 25 * 60, // 25 minutes in seconds (configurable)
    };

    // Default initial state
    const getInitialState = () => ({
        matchId: generateMatchId(),
        clubName: 'Smasher Badminton Club',
        teams: {
            team1: { name: 'Team A', players: ['Player 1', 'Player 2'] },
            team2: { name: 'Team B', players: ['Player 3', 'Player 4'] }
        },
        currentSet: 1,
        sets: [
            { team1Score: 0, team2Score: 0, winner: null, startTime: null, endTime: null, duration: 0 },
            { team1Score: 0, team2Score: 0, winner: null, startTime: null, endTime: null, duration: 0 },
            { team1Score: 0, team2Score: 0, winner: null, startTime: null, endTime: null, duration: 0 }
        ],
        setsWon: { team1: 0, team2: 0 },
        breaks: {
            set1: { team1Used: false, team2Used: false },
            set2: { team1Used: false, team2Used: false },
            set3: { team1Used: false, team2Used: false }
        },
        breakActive: {
            active: false,
            team: null,
            teamName: '',
            timeRemaining: CONFIG.BREAK_DURATION,
            setNumber: null
        },
        // Set timer
        setTimer: {
            running: false,
            startTime: null,
            elapsed: 0,
            maxDuration: CONFIG.SET_DURATION
        },
        config: {
            breakDuration: CONFIG.BREAK_DURATION,
            setDuration: CONFIG.SET_DURATION
        },
        serving: 'team1',
        servingSide: 'right', // right or left court
        courtSide: { team1: 'left', team2: 'right' },
        matchStatus: 'not_started', // not_started, in_progress, set_won, match_over
        matchWinner: null,
        setWinner: null,
        isMatchPoint: false,
        isSetPoint: false,
        matchPointTeam: null,
        setPointTeam: null,
        history: [],
        lastAction: null,
        endsChanged: false,
        endsChangedAt11: false
    });

    // Current state
    let state = getInitialState();

    // Generate unique match ID
    function generateMatchId() {
        return 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Fast shallow clone for simple reads (no history)
    function cloneStateShallow(s) {
        return {
            ...s,
            teams: { ...s.teams, team1: { ...s.teams.team1 }, team2: { ...s.teams.team2 } },
            sets: s.sets.map(set => ({ ...set })),
            setsWon: { ...s.setsWon },
            breaks: {
                set1: { ...s.breaks.set1 },
                set2: { ...s.breaks.set2 },
                set3: { ...s.breaks.set3 }
            },
            breakActive: { ...s.breakActive },
            courtSide: { ...s.courtSide }
        };
    }

    // Deep clone state for history (only when needed)
    function cloneState(s) {
        return cloneStateShallow({ ...s, history: [] }); // Don't clone history recursively
    }

    // Debounced save to localStorage
    function saveToStorage() {
        if (pendingSave) return; // Already scheduled
        pendingSave = setTimeout(() => {
            pendingSave = null;
            try {
                localStorage.setItem('smasher_scoreboard_state', JSON.stringify(state));
            } catch (e) {
                console.warn('Failed to save to localStorage:', e);
            }
        }, SAVE_DELAY);
    }

    // Immediate save (for critical operations)
    function saveToStorageImmediate() {
        if (pendingSave) {
            clearTimeout(pendingSave);
            pendingSave = null;
        }
        try {
            localStorage.setItem('smasher_scoreboard_state', JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    }

    // Load state from localStorage
    function loadFromStorage() {
        try {
            const saved = localStorage.getItem('smasher_scoreboard_state');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with initial state to ensure all fields exist
                state = { ...getInitialState(), ...parsed };
                return true;
            }
        } catch (e) {
            console.warn('Failed to load from localStorage:', e);
        }
        return false;
    }

    // Throttled broadcast state to other tabs
    let lastBroadcastAction = 'STATE_UPDATE';
    function broadcastState(action = 'STATE_UPDATE') {
        lastBroadcastAction = action;
        if (pendingBroadcast) return; // Already scheduled
        pendingBroadcast = setTimeout(() => {
            pendingBroadcast = null;
            channel.postMessage({
                type: lastBroadcastAction,
                state: cloneStateShallow(state),
                timestamp: Date.now()
            });
        }, BROADCAST_DELAY);
    }

    // Immediate broadcast (for critical sync)
    function broadcastStateImmediate(action = 'STATE_UPDATE') {
        if (pendingBroadcast) {
            clearTimeout(pendingBroadcast);
            pendingBroadcast = null;
        }
        channel.postMessage({
            type: action,
            state: cloneStateShallow(state),
            timestamp: Date.now()
        });
    }

    // Throttled notify listeners using requestAnimationFrame
    let lastNotifyAction = 'STATE_UPDATE';
    function notifyListeners(action) {
        lastNotifyAction = action;
        if (pendingNotify) return; // Already scheduled
        pendingNotify = requestAnimationFrame(() => {
            pendingNotify = null;
            const clonedState = cloneStateShallow(state);
            for (let i = 0; i < listeners.length; i++) {
                try {
                    listeners[i](clonedState, lastNotifyAction);
                } catch (e) {
                    console.error('Listener error:', e);
                }
            }
        });
    }

    // Immediate notify (for critical updates)
    function notifyListenersImmediate(action) {
        if (pendingNotify) {
            cancelAnimationFrame(pendingNotify);
            pendingNotify = null;
        }
        const clonedState = cloneStateShallow(state);
        for (let i = 0; i < listeners.length; i++) {
            try {
                listeners[i](clonedState, action);
            } catch (e) {
                console.error('Listener error:', e);
            }
        }
    }

    // Batch update mode
    let batchMode = false;
    let batchedUpdates = {};
    let batchAction = 'STATE_UPDATE';

    // Start batch updates (combine multiple updates into one)
    function startBatch() {
        batchMode = true;
        batchedUpdates = {};
        batchAction = 'STATE_UPDATE';
    }

    // End batch and apply all updates at once
    function endBatch(action = 'STATE_UPDATE') {
        if (!batchMode) return;
        batchMode = false;
        if (Object.keys(batchedUpdates).length > 0) {
            Object.assign(state, batchedUpdates);
            state.lastAction = action;
            batchedUpdates = {};
            saveToStorage();
            broadcastState(action);
            notifyListeners(action);
        }
    }

    // Update state and sync
    function updateState(newState, action = 'STATE_UPDATE', addToHistory = true) {
        // If in batch mode, accumulate updates
        if (batchMode) {
            Object.assign(batchedUpdates, newState);
            batchAction = action;
            return;
        }

        if (addToHistory && action !== 'UNDO') {
            // Save current state to history before updating (without cloning history)
            const historyEntry = {
                state: cloneState(state),
                action: action,
                timestamp: Date.now()
            };
            state.history.push(historyEntry);
            // Keep only last 30 actions (reduced for performance)
            if (state.history.length > 30) {
                state.history.shift();
            }
        }

        // Update state
        Object.assign(state, newState);
        state.lastAction = action;

        // Save and broadcast (debounced)
        saveToStorage();
        broadcastState(action);
        notifyListeners(action);
    }

    // Listen for messages from other tabs
    channel.onmessage = (event) => {
        const { type, state: newState, timestamp } = event.data;

        if (newState) {
            state = { ...state, ...newState };
            saveToStorage();
            notifyListeners(type);
        }
    };

    // Public API
    return {
        // Initialize state
        init() {
            loadFromStorage();
            return cloneState(state);
        },

        // Get current state
        getState() {
            return cloneState(state);
        },

        // Subscribe to state changes
        subscribe(callback) {
            listeners.push(callback);
            // Return unsubscribe function
            return () => {
                const index = listeners.indexOf(callback);
                if (index > -1) listeners.splice(index, 1);
            };
        },

        // Update team info
        setTeams(team1Name, team1Players, team2Name, team2Players) {
            updateState({
                teams: {
                    team1: { name: team1Name, players: team1Players },
                    team2: { name: team2Name, players: team2Players }
                }
            }, 'TEAMS_SET');
        },

        // Start match
        startMatch() {
            const now = Date.now();
            const newSets = [...state.sets];
            newSets[0] = { ...newSets[0], startTime: now };

            updateState({
                matchStatus: 'in_progress',
                currentSet: 1,
                serving: 'team1',
                servingSide: 'right',
                sets: newSets,
                setTimer: {
                    running: true,
                    startTime: now,
                    elapsed: 0,
                    maxDuration: state.config.setDuration
                }
            }, 'MATCH_START');
        },

        // Add point to team
        addPoint(team) {
            const currentSetIndex = state.currentSet - 1;
            const scoreKey = team + 'Score';
            const newScore = state.sets[currentSetIndex][scoreKey] + 1;

            const newSets = [...state.sets];
            newSets[currentSetIndex] = {
                ...newSets[currentSetIndex],
                [scoreKey]: newScore
            };

            updateState({
                sets: newSets
            }, 'POINT_SCORED');
        },

        // Deduct penalty points
        deductPenalty(team) {
            const currentSetIndex = state.currentSet - 1;
            const scoreKey = team + 'Score';
            const currentScore = state.sets[currentSetIndex][scoreKey];
            const newScore = Math.max(0, currentScore - 2);

            const newSets = [...state.sets];
            newSets[currentSetIndex] = {
                ...newSets[currentSetIndex],
                [scoreKey]: newScore
            };

            updateState({
                sets: newSets
            }, 'PENALTY_DEDUCTED');
        },

        // Update serving team
        setServing(team, side) {
            updateState({
                serving: team,
                servingSide: side || state.servingSide
            }, 'SERVICE_CHANGE', false);
        },

        // Set set winner
        setSetWinner(winner) {
            const currentSetIndex = state.currentSet - 1;
            const now = Date.now();
            const setStartTime = state.sets[currentSetIndex].startTime || state.setTimer.startTime;
            const setDuration = setStartTime ? Math.floor((now - setStartTime) / 1000) : 0;

            const newSets = [...state.sets];
            newSets[currentSetIndex] = {
                ...newSets[currentSetIndex],
                winner: winner,
                endTime: now,
                duration: setDuration
            };

            const newSetsWon = { ...state.setsWon };
            newSetsWon[winner]++;

            updateState({
                sets: newSets,
                setsWon: newSetsWon,
                setWinner: winner,
                matchStatus: 'set_won',
                setTimer: {
                    ...state.setTimer,
                    running: false,
                    elapsed: setDuration
                }
            }, 'SET_WON');
        },

        // Start next set
        startNextSet() {
            const nextSet = state.currentSet + 1;
            if (nextSet > 3) return;

            const now = Date.now();
            const newSets = [...state.sets];
            newSets[nextSet - 1] = { ...newSets[nextSet - 1], startTime: now };

            updateState({
                currentSet: nextSet,
                matchStatus: 'in_progress',
                setWinner: null,
                isSetPoint: false,
                setPointTeam: null,
                endsChangedAt11: false,
                sets: newSets,
                setTimer: {
                    running: true,
                    startTime: now,
                    elapsed: 0,
                    maxDuration: state.config.setDuration
                }
            }, 'SET_START');
        },

        // Set match winner
        setMatchWinner(winner) {
            updateState({
                matchWinner: winner,
                matchStatus: 'match_over'
            }, 'MATCH_WON');
        },

        // Update match/set point status
        setPointStatus(isMatchPoint, matchPointTeam, isSetPoint, setPointTeam) {
            updateState({
                isMatchPoint,
                matchPointTeam,
                isSetPoint,
                setPointTeam
            }, 'POINT_STATUS', false);
        },

        // Start break
        startBreak(team) {
            const setKey = 'set' + state.currentSet;
            const newBreaks = { ...state.breaks };
            newBreaks[setKey] = {
                ...newBreaks[setKey],
                [team + 'Used']: true
            };

            updateState({
                breaks: newBreaks,
                breakActive: {
                    active: true,
                    team: team,
                    teamName: state.teams[team].name,
                    timeRemaining: state.config.breakDuration,
                    setNumber: state.currentSet
                }
            }, 'BREAK_START');
        },

        // Update break timer
        updateBreakTimer(timeRemaining) {
            updateState({
                breakActive: {
                    ...state.breakActive,
                    timeRemaining: timeRemaining
                }
            }, 'BREAK_TICK', false);
        },

        // End break
        endBreak() {
            updateState({
                breakActive: {
                    active: false,
                    team: null,
                    teamName: '',
                    timeRemaining: state.config.breakDuration,
                    setNumber: null
                }
            }, 'BREAK_END');
        },

        // Check if break available
        canUseBreak(team) {
            const setKey = 'set' + state.currentSet;
            return !state.breaks[setKey][team + 'Used'] && !state.breakActive.active;
        },

        // Change court ends
        changeEnds(at11Points = false) {
            updateState({
                courtSide: {
                    team1: state.courtSide.team1 === 'left' ? 'right' : 'left',
                    team2: state.courtSide.team2 === 'left' ? 'right' : 'left'
                },
                endsChanged: true,
                endsChangedAt11: at11Points
            }, 'ENDS_CHANGED');
        },

        // Clear ends changed flag
        clearEndsChanged() {
            updateState({
                endsChanged: false
            }, 'ENDS_CLEARED', false);
        },

        // Undo last action
        undo() {
            if (state.history.length === 0) return false;

            const lastHistory = state.history.pop();
            const previousState = lastHistory.state;

            // Restore previous state but keep current history
            const currentHistory = [...state.history];
            Object.assign(state, previousState);
            state.history = currentHistory;

            // Use immediate sync for undo (critical operation)
            saveToStorageImmediate();
            broadcastStateImmediate('UNDO');
            notifyListenersImmediate('UNDO');

            return true;
        },

        // Reset match
        resetMatch() {
            const newState = getInitialState();
            state = newState;
            // Use immediate sync for reset (critical operation)
            saveToStorageImmediate();
            broadcastStateImmediate('MATCH_RESET');
            notifyListenersImmediate('MATCH_RESET');
        },

        // Batch update helpers
        startBatch,
        endBatch,

        // Update set timer elapsed time
        updateSetTimer(elapsed) {
            updateState({
                setTimer: {
                    ...state.setTimer,
                    elapsed: elapsed
                }
            }, 'SET_TIMER_TICK', false);
        },

        // Configure settings
        setConfig(newConfig) {
            updateState({
                config: {
                    ...state.config,
                    ...newConfig
                }
            }, 'CONFIG_UPDATE');
        },

        // Get current config
        getConfig() {
            return { ...state.config };
        },

        // Request sync (for display panel on load)
        requestSync() {
            channel.postMessage({
                type: 'SYNC_REQUEST',
                timestamp: Date.now()
            });
        },

        // Force broadcast current state
        forceBroadcast() {
            broadcastState('STATE_UPDATE');
        }
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}
