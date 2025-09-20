/**
 * uiLocker.js
 * A simple state manager to prevent UI race conditions.
 * When a user performs an action, we can "lock" the corresponding UI element
 * from receiving WebSocket updates for a short period, preventing the user's
 * optimistic UI update from being immediately overwritten by a polled status
 * that is already in-flight.
 */
class UiLocker {
    constructor() {
        this.lockedControls = new Set();
    }

    /**
     * Locks a control from updates for a specified duration.
     * @param {string} controlId - A unique identifier for the UI control (e.g., 'subLevelAdjust').
     * @param {number} [duration=1500] - The lock duration in milliseconds.
     */
    lock(controlId, duration = 1500) {
        this.lockedControls.add(controlId);
        setTimeout(() => {
            this.lockedControls.delete(controlId);
        }, duration);
    }

    /**
     * Checks if a control is currently locked.
     * @param {string} controlId - The identifier for the UI control.
     * @returns {boolean} - True if the control is locked, false otherwise.
     */
    isLocked(controlId) {
        return this.lockedControls.has(controlId);
    }
}

// Export a singleton instance for the entire application to use.
export const uiLocker = new UiLocker();