import { dom } from './dom.js';
import { currentTrackState, receiverState, intervals } from './state.js';
import { sendCommand } from './api.js';
import { updateIfChanged } from './utils.js';

/**
 * Configuration for resetting the "Now Playing" UI to its default state.
 */
const UI_RESET_CONFIG = {
    'track-header': 'Now Playing',
    'track-title': 'N/A',
    'track-artist': 'N/A',
    'track-album': 'N/A',
    'track-samplerate': 'N/A',
    'track-buffer': '',
    'station-info': '',
    'track-time': 'N/A',
    'track-percent': '',
};

/**
 * Stops the watchdog timer that prevents the local track counter from running indefinitely.
 */
export function stopTrackTimeWatchdog() {
    if (intervals.trackTimeWatchdog) {
        clearTimeout(intervals.trackTimeWatchdog);
        intervals.trackTimeWatchdog = null;
    }
}

/**
 * Starts a 15-second watchdog timer. If this timer is not reset by a fresh
 * 'play_state_update' event, it will assume playback has stalled or stopped
 * and will kill the local track time counter to prevent it from running away.
 */
export function startTrackTimeWatchdog() {
    stopTrackTimeWatchdog(); // Always clear the old one before starting a new one.
    intervals.trackTimeWatchdog = setTimeout(() => {
        console.warn('Track time watchdog expired. No updates received for 15s. Stopping local counter.');
        stopTrackTimeCounter(); // This will also clear the watchdog itself.
    }, 15000); // 15 seconds
}

/**
 * Resets (or "pets") the watchdog timer, restarting its 15-second countdown.
 * This should be called whenever a fresh 'play_state_update' is received.
 */
export function resetTrackTimeWatchdog() {
    startTrackTimeWatchdog();
}

/**
 * Resets the entire "Now Playing" UI and its underlying state to default values.
 * This is called when switching to a non-playable input source.
 */
export function resetNowPlayingUI() {
    console.log('Resetting "Now Playing" UI to default state.');

    // The internal state must be cleared with falsy values (empty strings)
    // for the visibility logic to work correctly.
    const stateToClear = {
        title: '',
        artist: '',
        album: '',
        stationInfo: '',
        time: '',
        timestamp: 0
    };
    Object.assign(currentTrackState, stateToClear);

    for (const [id, text] of Object.entries(UI_RESET_CONFIG)) {
        updateIfChanged(id, text);
    }
}

/**
 * Starts a local 1-second timer to smoothly increment the track time display
 * between polls from the receiver. This prevents the time from appearing frozen.
 */
export function startTrackTimeCounter() {
    // Clear any existing timer to prevent duplicates
    if (intervals.trackTimeCounter) clearInterval(intervals.trackTimeCounter);

    // NEW: Start the watchdog timer whenever the track counter starts.
    startTrackTimeWatchdog();

    intervals.trackTimeCounter = setInterval(() => {
        // Only run the timer if we have a valid timestamp and time string
        if (currentTrackState.timestamp === 0 || !currentTrackState.time.includes(':')) {
            return;
        }

        // Calculate the seconds elapsed since the last time update from the receiver
        const elapsedSeconds = Math.floor((Date.now() - currentTrackState.timestamp) / 1000);
        
        // Parse the last known time from the receiver
        const [min, sec] = currentTrackState.time.split(':').map(Number);
        const baseSeconds = (min * 60) + sec;

        // Calculate the new time by adding the elapsed seconds
        const newTotalSeconds = baseSeconds + elapsedSeconds;
        const newMin = Math.floor(newTotalSeconds / 60);
        const newSec = newTotalSeconds % 60;
        const newTime = `${newMin}:${newSec.toString().padStart(2, '0')}`;
        
        updateIfChanged('track-time', newTime);
    }, 1000);
}

/**
 * Stops the local track time counter.
 * This is exported so other modules (like the main script) can stop it on events like playback pause.
 */
export function stopTrackTimeCounter() {
    if (intervals.trackTimeCounter) {
        clearInterval(intervals.trackTimeCounter);
        intervals.trackTimeCounter = null;
    }
    // NEW: Also stop the watchdog timer when the counter is explicitly stopped.
    stopTrackTimeWatchdog();
}

/**
 * Starts the "Now Playing" information poller.
 * This should only be called when the UI is on a playable input and the OSD is not active.
 */
export function startNowPlayingPoller() {
    // Only start if the input is playable and a poller isn't already running.
    const isPlayableInput = ['PANDORA', 'IRADIO', 'SIRIUSXM', 'NET', 'FAVORITES', 'BT'].includes(receiverState.main.currentInput);
    if (isPlayableInput && !intervals.nowPlayingPoller) {
        console.log('Starting "Now Playing" poller.');
        // Query immediately on start
        sendCommand('NOW_PLAYING_FORCE_QUERY');
        intervals.nowPlayingPoller = setInterval(() => {
            sendCommand('NOW_PLAYING_FORCE_QUERY');
        }, 5000);
    }
}

/**
 * Stops the "Now Playing" information poller.
 * This should be called when the OSD becomes active or the input changes to a non-playable source.
 */
export function stopNowPlayingPoller() {
    if (intervals.nowPlayingPoller) {
        console.log('Stopping "Now Playing" poller.');
        clearInterval(intervals.nowPlayingPoller);
        intervals.nowPlayingPoller = null;
    }
}

/**
 * Stops all timers and pollers related to the "Now Playing" feature.
 * This is exported to be called on major state changes like WebSocket disconnect.
 */
export function stopAllNowPlayingFeatures() {
    stopTrackTimeCounter(); // This now implicitly stops the watchdog too.
    stopNowPlayingPoller();
}