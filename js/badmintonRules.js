/**
 * Smasher Badminton Club - Badminton Rules Engine
 * BWF Official Rules Implementation
 */

const BadmintonRules = (function() {
    // Constants
    const POINTS_TO_WIN = 21;
    const MIN_LEAD_TO_WIN = 2;
    const MAX_POINTS = 30;
    const SETS_TO_WIN_MATCH = 2;
    const TOTAL_SETS = 3;
    const BREAK_DURATION = 60; // seconds

    /**
     * Check if a set is won
     * Rules:
     * - First to 21 points wins
     * - Must lead by 2 points (deuce rule)
     * - At 29-29, first to 30 wins (no 2-point lead required)
     */
    function checkSetWin(team1Score, team2Score) {
        // Check if either team has reached winning conditions

        // Case 1: 30-29 or 29-30 - first to 30 wins
        if (team1Score === MAX_POINTS) return 'team1';
        if (team2Score === MAX_POINTS) return 'team2';

        // Case 2: Score >= 21 with 2-point lead
        if (team1Score >= POINTS_TO_WIN && team1Score - team2Score >= MIN_LEAD_TO_WIN) {
            return 'team1';
        }
        if (team2Score >= POINTS_TO_WIN && team2Score - team1Score >= MIN_LEAD_TO_WIN) {
            return 'team2';
        }

        return null; // No winner yet
    }

    /**
     * Check if match is won
     * Best of 3 sets - first to win 2 sets
     */
    function checkMatchWin(team1SetsWon, team2SetsWon) {
        if (team1SetsWon >= SETS_TO_WIN_MATCH) return 'team1';
        if (team2SetsWon >= SETS_TO_WIN_MATCH) return 'team2';
        return null;
    }

    /**
     * Check for set point situation
     * Returns the team that has set point, or null
     */
    function checkSetPoint(team1Score, team2Score) {
        // Team 1 set point conditions
        if (team1Score >= POINTS_TO_WIN - 1 && team1Score > team2Score) {
            // At 20+ and leading
            if (team1Score - team2Score >= 1 && team1Score < MAX_POINTS) {
                return 'team1';
            }
        }
        // At 29-29, both have set point (but we return team1 for simplicity)
        if (team1Score === MAX_POINTS - 1 && team2Score === MAX_POINTS - 1) {
            return 'both';
        }

        // Team 2 set point conditions
        if (team2Score >= POINTS_TO_WIN - 1 && team2Score > team1Score) {
            if (team2Score - team1Score >= 1 && team2Score < MAX_POINTS) {
                return 'team2';
            }
        }

        return null;
    }

    /**
     * Check for match point situation
     * Team needs to be one set away from winning AND have set point
     */
    function checkMatchPoint(team1Score, team2Score, team1SetsWon, team2SetsWon) {
        const setPointTeam = checkSetPoint(team1Score, team2Score);

        if (setPointTeam === 'team1' && team1SetsWon === SETS_TO_WIN_MATCH - 1) {
            return 'team1';
        }
        if (setPointTeam === 'team2' && team2SetsWon === SETS_TO_WIN_MATCH - 1) {
            return 'team2';
        }
        if (setPointTeam === 'both') {
            if (team1SetsWon === SETS_TO_WIN_MATCH - 1 && team2SetsWon === SETS_TO_WIN_MATCH - 1) {
                return 'both';
            }
            if (team1SetsWon === SETS_TO_WIN_MATCH - 1) return 'team1';
            if (team2SetsWon === SETS_TO_WIN_MATCH - 1) return 'team2';
        }

        return null;
    }

    /**
     * Determine serving side based on score
     * Even total score = serve from right
     * Odd total score = serve from left
     */
    function getServingSide(serverScore) {
        return serverScore % 2 === 0 ? 'right' : 'left';
    }

    /**
     * Determine who serves after a point
     * In doubles: server changes when serving team wins point
     * Receiving team wins point = they become servers
     */
    function getNextServer(scoringTeam, currentServer) {
        // If scoring team was receiving, they now serve
        if (scoringTeam !== currentServer) {
            return scoringTeam;
        }
        // If server scored, they continue serving
        return currentServer;
    }

    /**
     * Check if ends should be changed (3rd set at 11 points)
     * Uses >= 11 to handle edge cases where 11 might be skipped
     */
    function shouldChangeEnds(currentSet, team1Score, team2Score, alreadyChanged) {
        if (currentSet === 3 && !alreadyChanged) {
            const leadingScore = Math.max(team1Score, team2Score);
            // Check >= 11 to handle any edge cases
            if (leadingScore >= 11) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if deuce (20-20 or higher tie)
     */
    function isDeuce(team1Score, team2Score) {
        return team1Score >= 20 && team2Score >= 20 && team1Score === team2Score;
    }

    /**
     * Get score description for announcements
     */
    function getScoreDescription(team1Score, team2Score, servingTeam, team1Name, team2Name) {
        const serverScore = servingTeam === 'team1' ? team1Score : team2Score;
        const receiverScore = servingTeam === 'team1' ? team2Score : team1Score;
        const serverName = servingTeam === 'team1' ? team1Name : team2Name;

        if (team1Score === team2Score) {
            if (team1Score >= 20) {
                return `Deuce - ${team1Score} all`;
            }
            return `${team1Score} all`;
        }

        return `${serverScore} - ${receiverScore}, ${serverName} serving`;
    }

    /**
     * Validate if a score is possible/legal
     */
    function isValidScore(team1Score, team2Score) {
        if (team1Score < 0 || team2Score < 0) return false;
        if (team1Score > MAX_POINTS || team2Score > MAX_POINTS) return false;

        // Can't have both teams at 30
        if (team1Score === MAX_POINTS && team2Score === MAX_POINTS) return false;

        // If one team has 30, other must have 29
        if (team1Score === MAX_POINTS && team2Score !== MAX_POINTS - 1) return false;
        if (team2Score === MAX_POINTS && team1Score !== MAX_POINTS - 1) return false;

        // If score is above 21, difference must be <= 2 (except 30-29)
        if (team1Score > POINTS_TO_WIN && team2Score > POINTS_TO_WIN) {
            if (Math.abs(team1Score - team2Score) > 2) return false;
        }

        return true;
    }

    /**
     * Calculate interval between sets (BWF: 2 minutes)
     */
    function getSetInterval() {
        return 120; // 2 minutes in seconds
    }

    /**
     * Get game status text
     */
    function getGameStatus(state) {
        if (state.matchStatus === 'not_started') {
            return 'Match Not Started';
        }
        if (state.matchStatus === 'match_over') {
            const winnerName = state.teams[state.matchWinner].name;
            return `Match Won by ${winnerName}`;
        }
        if (state.matchStatus === 'set_won') {
            const winnerName = state.teams[state.setWinner].name;
            return `Set ${state.currentSet} Won by ${winnerName}`;
        }
        if (state.breakActive.active) {
            const teamName = state.teams[state.breakActive.team].name;
            return `Break - ${teamName}`;
        }
        if (state.isMatchPoint) {
            return 'MATCH POINT';
        }
        if (state.isSetPoint) {
            return 'SET POINT';
        }

        return `Set ${state.currentSet} in Progress`;
    }

    // Public API
    return {
        // Constants
        POINTS_TO_WIN,
        MIN_LEAD_TO_WIN,
        MAX_POINTS,
        SETS_TO_WIN_MATCH,
        TOTAL_SETS,
        BREAK_DURATION,

        // Functions
        checkSetWin,
        checkMatchWin,
        checkSetPoint,
        checkMatchPoint,
        getServingSide,
        getNextServer,
        shouldChangeEnds,
        isDeuce,
        getScoreDescription,
        isValidScore,
        getSetInterval,
        getGameStatus,

        /**
         * Process a point decrement and recalculate serving side
         * Used for score corrections
         */
        processDecrement(state, team) {
            const currentSetIndex = state.currentSet - 1;
            const currentSet = state.sets[currentSetIndex];

            const newScores = {
                team1Score: Math.max(0, currentSet.team1Score - (team === 'team1' ? 1 : 0)),
                team2Score: Math.max(0, currentSet.team2Score - (team === 'team2' ? 1 : 0))
            };

            // Recalculate serving side based on current server's new score
            const currentServer = state.serving;
            const serverScore = currentServer === 'team1' ? newScores.team1Score : newScores.team2Score;

            return {
                newScores,
                newServingSide: getServingSide(serverScore),
                // Re-check set/match point status
                isSetPoint: checkSetPoint(newScores.team1Score, newScores.team2Score) !== null,
                setPointTeam: checkSetPoint(newScores.team1Score, newScores.team2Score),
                isMatchPoint: checkMatchPoint(
                    newScores.team1Score,
                    newScores.team2Score,
                    state.setsWon.team1,
                    state.setsWon.team2
                ) !== null,
                matchPointTeam: checkMatchPoint(
                    newScores.team1Score,
                    newScores.team2Score,
                    state.setsWon.team1,
                    state.setsWon.team2
                )
            };
        },

        /**
         * Process a point scored and return all updates needed
         */
        processPoint(state, scoringTeam) {
            const currentSetIndex = state.currentSet - 1;
            const currentSet = state.sets[currentSetIndex];

            const newScores = {
                team1Score: currentSet.team1Score + (scoringTeam === 'team1' ? 1 : 0),
                team2Score: currentSet.team2Score + (scoringTeam === 'team2' ? 1 : 0)
            };

            const result = {
                newScores,
                setWinner: null,
                matchWinner: null,
                isSetPoint: false,
                setPointTeam: null,
                isMatchPoint: false,
                matchPointTeam: null,
                shouldChangeEnds: false,
                newServer: scoringTeam,
                newServingSide: getServingSide(
                    scoringTeam === 'team1' ? newScores.team1Score : newScores.team2Score
                )
            };

            // Check for set win
            result.setWinner = checkSetWin(newScores.team1Score, newScores.team2Score);

            if (result.setWinner) {
                // Check for match win
                const newSetsWon = {
                    team1: state.setsWon.team1 + (result.setWinner === 'team1' ? 1 : 0),
                    team2: state.setsWon.team2 + (result.setWinner === 'team2' ? 1 : 0)
                };
                result.matchWinner = checkMatchWin(newSetsWon.team1, newSetsWon.team2);
            } else {
                // Check for set/match point
                result.setPointTeam = checkSetPoint(newScores.team1Score, newScores.team2Score);
                result.isSetPoint = result.setPointTeam !== null;

                const setsWonIfSetWon = {
                    team1: state.setsWon.team1,
                    team2: state.setsWon.team2
                };
                result.matchPointTeam = checkMatchPoint(
                    newScores.team1Score,
                    newScores.team2Score,
                    setsWonIfSetWon.team1,
                    setsWonIfSetWon.team2
                );
                result.isMatchPoint = result.matchPointTeam !== null;

                // Check for ends change in 3rd set
                if (state.currentSet === 3 && !state.endsChangedAt11) {
                    result.shouldChangeEnds = shouldChangeEnds(
                        state.currentSet,
                        newScores.team1Score,
                        newScores.team2Score,
                        state.endsChangedAt11
                    );
                }
            }

            return result;
        }
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BadmintonRules;
}
