import { sendCommand } from './api.js';

// This variable is internal to the polling module and holds the interval ID.
let statusPoller = null;

/**
 * The core polling function. It intelligently skips polling if the page is not visible.
 */
function doPoll() {
    // Don't poll if the tab is hidden to save network resources.
    if (document.hidden) {
        console.log('Tab is hidden, skipping status poll.');
        return;
    }
    console.log('Polling for status sync...');
    // This command triggers the backend to query everything and send updates,
    // which are then handled by the various '..._update' socket listeners.
    // This does NOT trigger the initial loading spinner.
    sendCommand('INITIAL_STATUS_QUERY');
}

/**
 * Starts a periodic poller to request a full status sync from the receiver.
 * This ensures the UI stays in sync even if the receiver is changed by a physical remote.
 * @param {number} [frequency=15000] - The polling frequency in milliseconds.
 */
export function startStatusPolling(frequency = 15000) {
    // Clear any existing poller to prevent duplicates
    if (statusPoller) clearInterval(statusPoller);

    console.log(`Starting status poller. Syncing every ${frequency / 1000} seconds.`);
    statusPoller = setInterval(doPoll, frequency);
}

/**
 * Stops the periodic status poller.
 */
export function stopStatusPolling() {
    if (statusPoller) {
        console.log('Stopping status poller.');
        clearInterval(statusPoller);
        statusPoller = null;
    }
}