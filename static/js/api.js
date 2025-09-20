import { optimisticState, resetInitialSyncState } from './state.js';
import { showToast } from './notifications.js';
import { showLoadingSpinner } from './loading.js';

/**
 * Configuration for updating the UI optimistically for certain commands.
 * This makes the logic data-driven and easier to extend.
 */
const OPTIMISTIC_UPDATE_CONFIG = [
    { prefix: 'POWER_', stateKey: 'power', onCommand: 'POWER_ON' },
    { prefix: 'MUTE_', stateKey: 'mute', onCommand: 'MUTE_ON' },
    { prefix: 'ZONE2_MUTE_', stateKey: 'zone2Mute', onCommand: 'ZONE2_MUTE_ON' },
    // Zone2 Power is a special case as the on/off commands don't share a prefix.
    // We define them separately but map them to the same state key.
    { prefix: 'ZONE2_ON', stateKey: 'zone2Power', onCommand: 'ZONE2_ON' },
    { prefix: 'ZONE2_OFF', stateKey: 'zone2Power', onCommand: 'ZONE2_ON' },
];

/**
 * Sends a command to the backend API.
 * @param {string} commandName - The name from COMMAND_MAP (e.g., 'POWER_ON').
 * @param {string|number} [value] - Optional value for 'setter' commands.
 * @param {HTMLElement|null} [buttonEl=null] - The button element that triggered the command, for visual feedback.
 */
export async function sendCommand(commandName, value = null, buttonEl = null) {
    // Update optimistic state to provide immediate UI feedback.
    const config = OPTIMISTIC_UPDATE_CONFIG.find(c => commandName.startsWith(c.prefix));
    if (config) {
        const stateSlice = optimisticState[config.stateKey];
        stateSlice.active = true;
        stateSlice.value = (commandName === config.onCommand);
        stateSlice.timestamp = Date.now();
    }

    let url = `/api/command/${commandName}`;
    if (value !== null) {
        url += `/${value}`;
    }
    console.log(`--> SEND: ${url}`);
    try {
        const response = await fetch(url, { method: 'POST' });
        // Gracefully handle non-JSON responses, e.g., from a gateway error.
        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errorMessage = responseData.message || `HTTP error! Status: ${response.status}`;
            console.error(`Command '${commandName}' failed:`, errorMessage);
            // Provide visual feedback on the button that was clicked
            if (buttonEl) {
                buttonEl.classList.add('command-failed');
                setTimeout(() => {
                    buttonEl.classList.remove('command-failed');
                }, 600); // Duration should match the CSS animation
            }
            // NEW: Use the toast notification for errors.
            showToast(`Error: ${errorMessage}`, { isError: true, duration: 5000 });
            // NEW: If a command fails, the optimistic UI might be out of sync.
            // Trigger a full re-sync to correct the UI to the receiver's actual state.
            // This creates a "self-healing" mechanism.
            console.log('Command failed. Requesting full status re-sync to correct UI.');
            requestInitialStatus();
        } else {
            // NEW: Provide visual feedback for successful commands
            if (buttonEl) {
                buttonEl.classList.add('command-success');
                setTimeout(() => {
                    buttonEl.classList.remove('command-success');
                }, 600); // Duration should match the CSS animation
            }
            // NEW: Show a success toast for certain command types like macros.
            if (commandName.includes('MACRO')) {
                showToast(responseData.message || 'Macro executed!', { duration: 2000 });
            }
        }
    } catch (error) {
        console.error('Network error sending command:', error);
        // NEW: Use the toast notification for network errors.
        showToast(`Network Error: ${error.message}. Is the server running?`, { isError: true, duration: 5000 });
    }
}

/**
 * Sends a batch of query commands to the receiver to synchronize the UI on load.
 */
export async function requestInitialStatus() {
    console.log('Requesting initial status with a single, efficient query group...');
    showLoadingSpinner();
    resetInitialSyncState();

    // This one command replaces the entire "request storm" by using the
    // 'query_group' defined in the backend. The backend will now send
    // all the necessary queries to the receiver, and the responses will
    // be handled by the standard WebSocket listeners as they arrive.
    // This is much more efficient and avoids connection timeouts.
    await sendCommand('INITIAL_STATUS_QUERY');
}