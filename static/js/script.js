// c:/Users/SC/Desktop/Marantz SR6009 Remote/static/js/script.js
import {
    currentTrackState,
    receiverState,
    optimisticState,
    initialSyncState,
    intervals,
    resetInitialSyncState,
    CHANNEL_NAME_MAP,
    CHANNEL_SCALE_MAP,
    WIDE_SCALE_CHANNELS,
    SOUND_MODE_GROUPS
} from './state.js';
import { dom } from './dom.js';
import { sendCommand, requestInitialStatus } from './api.js';
import {
    updateIfChanged,
    preventScrollOnSlider,
    triggerAnimation,
    updateMarqueeAnimation,
    enableSmoothVerticalSlider,
    enableSmoothHorizontalSlider,
    updateSliderFill,
    debounce
} from './utils.js';
import {
    resetNowPlayingUI,
    startTrackTimeCounter,
    stopTrackTimeCounter,
    stopAllNowPlayingFeatures,
    resetTrackTimeWatchdog,
    startNowPlayingPoller,
    stopNowPlayingPoller
} from './now-playing.js';
import { initializeOsd, handleOsdNavCommand } from './osd.js';
import { checkInitialSyncComplete } from './loading.js';
import { startStatusPolling, stopStatusPolling } from './polling.js';
import { initializeChannelEditor } from './channel-editor.js';
import { initializeSoundModes } from './sound-mode.js';
import { initializeAllSliders, initializeSliderWebSocketListeners } from './sliders.js';
import { initializeMainVolume } from './main-volume.js';
import {
    initializeEventListeners,
    createMultiStateButtonHandler,
    createOnOffButtonHandler,
    handlePower,
    handleMainMute
} from './ui.js';
import { uiLocker } from './uiLocker.js';
import { showToast } from './notifications.js';

/**
 * Tracks the last known active state of the dynamic display container to prevent redundant animation triggers.
 */
let lastDynamicDisplayActiveState = false;

/**
 * The master controller for the dynamic display area.
 * This function decides whether to show the "Now Playing" view or the "OSD" view.
 */
function updateDynamicDisplay() {
    // --- NEW: Master Power Check ---
    // If the receiver is off, the dynamic display should always be hidden.
    // This is the master control that overrides all other display logic.
    if (!receiverState.main.isPowerOn) {
        if (dom.dynamicDisplay.container) {
            dom.dynamicDisplay.container.classList.remove('is-active');
        }
        // Also ensure sub-views are explicitly hidden to prevent layout issues.
        if (dom.dynamicDisplay.nowPlayingView) {
            dom.dynamicDisplay.nowPlayingView.classList.remove('is-visible');
        }
        if (dom.dynamicDisplay.osdView) {
            dom.dynamicDisplay.osdView.classList.remove('is-visible');
        }
        return; // Exit early.
    }

    const isOsdActive = receiverState.ui.osd.isVisible;
    const hasTrackInfo = currentTrackState.title || currentTrackState.artist;

    const shouldShowNowPlaying = !isOsdActive && hasTrackInfo;
    const shouldShowOsd = isOsdActive;

    // --- NEW: Smart Poller Logic ---
    // Stop the "Now Playing" poller when the OSD is active to prevent conflicts.
    // Restart it when the OSD is hidden.
    if (isOsdActive) {
        stopNowPlayingPoller();
    } else {
        startNowPlayingPoller();
    }

    // --- REFACTORED: Animation Orchestration ---
    // This logic orchestrates the "fade-only" animation strategy based on the CSS changes.
    // It sets the state, and CSS transitions handle the actual animation.
    const isAnyViewActive = shouldShowNowPlaying || shouldShowOsd;

    // 1. Toggle the main container's active state. This triggers the fade/scale animation.
    // Only toggle if the active state has actually changed to prevent re-triggering animations.
    if (dom.dynamicDisplay.container && lastDynamicDisplayActiveState !== isAnyViewActive) {
        dom.dynamicDisplay.container.classList.toggle('is-active', isAnyViewActive);
        lastDynamicDisplayActiveState = isAnyViewActive; // Update the stored state
    }
    // 2. Toggle the specific view's visibility. This uses display: block/none to ensure
    //    only one view is in the document flow at a time, preventing layout conflicts.
    if (dom.dynamicDisplay.nowPlayingView) {
        dom.dynamicDisplay.nowPlayingView.classList.toggle('is-visible', shouldShowNowPlaying);
    }
    if (dom.dynamicDisplay.osdView) {
        dom.dynamicDisplay.osdView.classList.toggle('is-visible', shouldShowOsd);
    }
}

/**
 * Updates all UI elements with custom input names received from the server.
 * @param {Object.<string, string>} names - A map of input codes to their display names.
 */
function handleInputNamesUpdate(names) {
    console.log("Received input_names_update:", names);
    receiverState.ui.inputNames = names;

    // Update all elements that display input names
    document.querySelectorAll('[data-input-code]').forEach(element => {
        const code = element.dataset.inputCode;
        // BUGFIX: Check for key existence, not truthiness, to allow renaming to an empty string.
        if (code in names) {
            element.textContent = names[code];
        }
    });

    // Special handling for the status display, which might be showing the current input
    if (receiverState.main.currentInput && names[receiverState.main.currentInput]) {
        if (dom.status.input) {
            dom.status.input.textContent = names[receiverState.main.currentInput];
        }
    }

    // Repopulate the rename dropdown to ensure it's also up-to-date
    const renameSelect = document.getElementById('input-rename-select');
    if (renameSelect) {
        const selectedValue = renameSelect.value; // Preserve selection
        renameSelect.innerHTML = '<option value="">-- Select Input --</option>'; // Clear and add placeholder
        for (const [code, name] of Object.entries(names)) {
            renameSelect.add(new Option(name, code));
        }
        renameSelect.value = selectedValue; // Restore selection if possible
    }
}

/**
 * Registers all WebSocket event handlers for the application.
 * @param {SocketIOClient.Socket} socket The main socket.io client instance.
 */
function registerSocketEventHandlers(socket) {
    socket.on('volume_update', (data) => {
        console.log('Received volume_update:', data);
        const volumeLevel = data.value;
        if (!isNaN(volumeLevel)) {
            receiverState.main.currentVolume = volumeLevel; // Store the current volume
            const displayVolume = volumeLevel.toFixed(1);
            if (dom.status.volume) dom.status.volume.textContent = displayVolume;

            // Only update the slider's visual position if a ramp-up is NOT in progress.
            if (!receiverState.main.isVolumeRamping) {
                if (dom.mainControls.volumeSlider) {
                    dom.mainControls.volumeSlider.value = volumeLevel;
                }
            }

            // The label, however, should ALWAYS reflect the true, current volume from the receiver.
            if (dom.mainControls.volumeSliderLabel) dom.mainControls.volumeSliderLabel.textContent = `Vol: ${displayVolume}`;

            // --- NEW: Closed-loop ramp-up logic ---
            if (receiverState.main.isVolumeRamping && receiverState.main.volumeRampTarget !== null) {
                if (volumeLevel >= receiverState.main.volumeRampTarget) {
                    console.log('Volume ramp target reached. Stopping ramp.');
                    receiverState.main.isVolumeRamping = false;
                    receiverState.main.volumeRampTarget = null;
                    if (dom.mainControls.volumeSliderLabel) {
                        dom.mainControls.volumeSliderLabel.classList.remove('volume-ramping');
                    }
                } else {
                    const nextStepVolume = Math.min(volumeLevel + 0.5, receiverState.main.volumeRampTarget);
                    console.log(`Ramping... Next step: ${nextStepVolume}`);
                    sendCommand('VOLUME_SET', nextStepVolume);
                }
            }
        }
        if (initialSyncState.has('volume')) {
            initialSyncState.delete('volume');
            checkInitialSyncComplete();
        }
    });

    socket.on('max_volume_update', (data) => {
        console.log('Received max_volume_update:', data);
        if (dom.mainControls.volumeSlider) {
            dom.mainControls.volumeSlider.max = data.value;
            console.log(`Volume slider max range set to ${data.value}`);
        }
    });

    socket.on('mute_update', (data) => {
        console.log('Received mute_update:', data);
        const isMuted = data.state === 'on';
        if (optimisticState.mute.active) {
            const timeSinceClick = Date.now() - optimisticState.mute.timestamp;
            if (timeSinceClick < 2000) {
                if (isMuted !== optimisticState.mute.value) {
                    console.log(`Ignoring stale 'mute_update' (isMuted=${isMuted}) due to recent user action.`);
                    return;
                }
            } else {
                optimisticState.mute.active = false;
            }
        }
        handleMainMute(isMuted);
    });

    socket.on('power_update', (data) => {
        console.log('Received power_update:', data);
        const isPowerOn = data.state === 'on';
        if (optimisticState.power.active) {
            const timeSinceClick = Date.now() - optimisticState.power.timestamp;
            if (timeSinceClick < 2000) {
                if (isPowerOn !== optimisticState.power.value) {
                    console.log(`Ignoring stale 'power_update' (isPowerOn=${isPowerOn}) due to recent user action.`);
                    return;
                }
            } else {
                optimisticState.power.active = false;
            }
        }
        handlePower(isPowerOn);

        // NEW: Re-evaluate the dynamic display based on the new power state.
        updateDynamicDisplay();
        if (initialSyncState.has('power')) {
            initialSyncState.delete('power');
            checkInitialSyncComplete();
        }
    });

    socket.on('input_source_update', (data) => {
        const inputName = data.source;
        if (inputName === receiverState.main.currentInput) {
            console.log(`Received redundant input_source_update for ${inputName}. Ignoring.`);
            return;
        }
        console.log('Input source changed to:', { inputName });
        receiverState.main.currentInput = inputName;
        // EDITED: Use the custom name from our state map for the status display.
        if (dom.status.input) {
            dom.status.input.textContent = receiverState.ui.inputNames[inputName] || inputName;
        }
        document.querySelectorAll('#input-buttons-grid button').forEach(btn => btn.classList.remove('active'));
        const activeButton = document.querySelector(`button[data-response-code="SI${inputName}"]`);
        if (activeButton) activeButton.classList.add('active');
        if (dom.playback.favoritesContainer) {
            if (inputName === 'PANDORA') {
                dom.playback.favoritesContainer.classList.add('is-visible');
            } else {
                dom.playback.favoritesContainer.classList.remove('is-visible');
            }
        }
        const isPlayableInput = ['PANDORA', 'IRADIO', 'SIRIUSXM', 'NET', 'FAVORITES', 'BT'].includes(inputName);
        if (!isPlayableInput) {
            resetNowPlayingUI();
            updateDynamicDisplay();
        }
        stopNowPlayingPoller();
        startNowPlayingPoller();
        if (initialSyncState.has('input')) {
            initialSyncState.delete('input');
            checkInitialSyncComplete();
        }
    });

    const MDAX_COMMAND_MAP = { off: 'MDAX_OFF', low: 'MDAX_LOW', medium: 'MDAX_MEDIUM', high: 'MDAX_HIGH' };
    socket.on('mdax_update', createMultiStateButtonHandler('audio.mdax', MDAX_COMMAND_MAP));
    socket.on('cinema_eq_update', createOnOffButtonHandler('audio.cinemaEq', 'CINEMA_EQ_ON', 'CINEMA_EQ_OFF'));
    socket.on('dynamic_eq_update', createOnOffButtonHandler('audio.dynamicEq', 'DYNAMIC_EQ_ON', 'DYNAMIC_EQ_OFF'));
    socket.on('graphic_eq_update', createOnOffButtonHandler('audio.graphicEq', 'GRAPHIC_EQ_ON', 'GRAPHIC_EQ_OFF'));
    const ECO_MODE_COMMAND_MAP = { on: 'ECO_MODE_ON', auto: 'ECO_MODE_AUTO', off: 'ECO_MODE_OFF' };
    socket.on('eco_mode_update', createMultiStateButtonHandler('main.ecoMode', ECO_MODE_COMMAND_MAP));

    socket.on('remote_lock_update', (data) => {
        console.log('Received remote_lock_update:', data);
        const isOn = (data.state === 'on');
        const onButton = document.querySelector('button[data-command="SYSTEM_REMOTE_LOCK_ON"]');
        const offButton = document.querySelector('button[data-command="SYSTEM_REMOTE_LOCK_OFF"]');
        if (onButton) onButton.classList.toggle('active', isOn);
        if (offButton) offButton.classList.toggle('active', !isOn);
    });

    socket.on('panel_lock_update', (data) => {
        console.log('Received panel_lock_update:', data);
        const isOn = (data.state === 'on');
        const onButton = document.querySelector('button[data-command="SYSTEM_PANEL_LOCK_ON"]');
        const offButton = document.querySelector('button[data-command="SYSTEM_PANEL_LOCK_OFF"]');
        if (onButton) onButton.classList.toggle('active', isOn);
        if (offButton) offButton.classList.toggle('active', !isOn);
    });

    socket.on('tone_control_update', createOnOffButtonHandler('audio.toneControl', 'TONE_CONTROL_ON', 'TONE_CONTROL_OFF'));
    const DRC_COMMAND_MAP = { off: 'DYNAMIC_RANGE_COMPRESSION_OFF', low: 'DYNAMIC_RANGE_COMPRESSION_LOW', medium: 'DYNAMIC_RANGE_COMPRESSION_MEDIUM', high: 'DYNAMIC_RANGE_COMPRESSION_HIGH' };
    socket.on('drc_update', createMultiStateButtonHandler('audio.drc', DRC_COMMAND_MAP));

    socket.on('surround_parameter_update', (data) => {
        console.log('Received surround_parameter_update:', data);
        const isOn = (data.state === 'on');
        const onButton = document.querySelector('button[data-command="SURROUND_PARAMETER_ON"]');
        const offButton = document.querySelector('button[data-command="SURROUND_PARAMETER_OFF"]');
        if (onButton) onButton.classList.toggle('active', isOn);
        if (offButton) offButton.classList.toggle('active', !isOn);
    });

    socket.on('audyssey_dyn_comp_update', (data) => {
        console.log('Received audyssey_dyn_comp_update:', data);
        const isAuto = (data.state === 'auto');
        const autoButton = document.querySelector('button[data-command="AUDYSSEY_DYN_COMP_AUTO"]');
        const offButton = document.querySelector('button[data-command="AUDYSSEY_DYN_COMP_OFF"]');
        if (autoButton) autoButton.classList.toggle('active', isAuto);
        if (offButton) offButton.classList.toggle('active', !isAuto);
    });

    socket.on('sleep_timer_update', (data) => {
        console.log('Received sleep_timer_update:', data);
        if (intervals.sleepCountdown) clearInterval(intervals.sleepCountdown);
        intervals.sleepCountdown = null;

        if (data.state === 'off') {
            receiverState.main.sleepMinutes = 0;
            if (dom.mainControls.sleepBtn) dom.mainControls.sleepBtn.textContent = 'SLEEP';
            if (dom.inputs.sleepTimer) dom.inputs.sleepTimer.value = '';
        } else if (data.state === 'on' && data.minutes > 0) {
            receiverState.main.sleepMinutes = data.minutes;
            if (dom.inputs.sleepTimer) dom.inputs.sleepTimer.value = data.minutes;
            // RESTORED: The second-by-second countdown timer for the main sleep button.
            const endTime = Date.now() + data.minutes * 60 * 1000;
            intervals.sleepCountdown = setInterval(() => {
                const remainingMs = endTime - Date.now();
                if (remainingMs <= 0) {
                    clearInterval(intervals.sleepCountdown);
                    intervals.sleepCountdown = null;
                    if (dom.mainControls.sleepBtn) dom.mainControls.sleepBtn.textContent = 'SLEEP';
                    return;
                }
                const totalSeconds = Math.floor(remainingMs / 1000);
                const displayMinutes = Math.floor(totalSeconds / 60);
                const displaySeconds = (totalSeconds % 60).toString().padStart(2, '0');
                if (dom.mainControls.sleepBtn) {
                    dom.mainControls.sleepBtn.textContent = `SLEEP (${displayMinutes}:${displaySeconds})`;
                }
            }, 1000);
        }
    });

    socket.on('tuner_mode_update', (data) => {
        console.log('Received tuner_mode_update:', data);
        const mode = data.mode;
        const tunerGrid = document.querySelector('.tuner-mode-group');
        if (tunerGrid) {
            tunerGrid.querySelectorAll('button').forEach(btn => {
                const expectedResponseCode = `TMAN${mode}`;
                btn.classList.toggle('active', btn.dataset.responseCode === expectedResponseCode);
            });
        }
    });

    socket.on('tuner_frequency_update', (data) => {
        console.log('Received tuner_frequency_update:', data);
        if (dom.status.tunerFreq) dom.status.tunerFreq.textContent = `Freq: ${data.frequency}`;
    });

    socket.on('tuner_preset_update', (data) => {
        console.log('Received tuner_preset_update:', data);
        if (dom.status.tunerPreset) dom.status.tunerPreset.textContent = `Preset: ${data.preset}`;
    });

    socket.on('now_playing_header_update', (data) => {
        if (data.text !== currentTrackState.header) {
            updateIfChanged('track-header', data.text);
            currentTrackState.header = data.text;
        }
    });

    socket.on('now_playing_title_update', (data) => {
        if (data.text !== currentTrackState.title) {
            updateIfChanged('track-title', data.text);
            triggerAnimation('track-title', 'animate-text-update');
            currentTrackState.title = data.text;
            setTimeout(() => updateMarqueeAnimation(dom.nowPlaying.title), 50);
            updateDynamicDisplay();
        }
    });

    socket.on('now_playing_artist_update', (data) => {
        if (data.text !== currentTrackState.artist) {
            updateIfChanged('track-artist', data.text);
            triggerAnimation('track-artist', 'animate-text-update');
            currentTrackState.artist = data.text;
            setTimeout(() => updateMarqueeAnimation(dom.nowPlaying.artist), 50);
            updateDynamicDisplay();
        }
    });

    socket.on('now_playing_album_update', (data) => {
        if (data.text !== currentTrackState.album) {
            updateIfChanged('track-album', data.text);
            triggerAnimation('track-album', 'animate-text-update');
            currentTrackState.album = data.text;
            setTimeout(() => updateMarqueeAnimation(dom.nowPlaying.album), 50);
        }
    });

    socket.on('now_playing_samplerate_update', (data) => {
        if (data.text !== currentTrackState.samplerate) {
            updateIfChanged('track-samplerate', data.text);
            currentTrackState.samplerate = data.text;
        }
    });

    socket.on('station_info_update', (data) => {
        console.log('Received station_info_update:', data);
        updateIfChanged('station-info', data.text);
        updateIfChanged('osd-station-info', data.text);
    });

    socket.on('play_progress_update', (data) => {
        console.log('Received play_progress_update:', data);

        // FIX: Reset the watchdog on ANY sign of progress to prevent it from
        // expiring incorrectly during long tracks. This is the key to the "stop mechanism".
        resetTrackTimeWatchdog();

        // If we get a progress update, it implies playback is active.
        // This handles cases where the receiver is already playing on connect
        // and doesn't send an explicit 'CRPLYSTS PLAY' event. We also check
        // the optimistic state to prevent a race condition where a poll
        // immediately after a user-initiated pause incorrectly restarts the timer.
        if (!receiverState.playback.isPlaying && !optimisticState.playback.active || receiverState.playback.isPlaying) {
            console.log('Inferred PLAY state from progress update. Starting timer.');
            receiverState.playback.isPlaying = true;
            if (dom.playback.playPauseToggleBtn) {
                dom.playback.playPauseToggleBtn.classList.add('is-playing');
            }
            startTrackTimeCounter();
        }
        // This was the original logic, which is now part of the combined condition above.
        // The `else if` prevented the timer from restarting if playback was already active.
        else if (optimisticState.playback.active) {
            // If an optimistic state is active, we ignore the inference logic
            // to prevent the race condition.
            console.log('Ignoring progress update for inference due to active optimistic state.');
        }

        // This is the core of the "correction mechanism". It resets the local
        // timer's base time and timestamp with fresh data from the receiver.
        if (data.time && data.time !== currentTrackState.time) {
            updateIfChanged('track-time', data.time);
            currentTrackState.time = data.time;
            currentTrackState.timestamp = Date.now() - 500; // Lag compensation
        }

        if (data.percent !== null && data.percent !== currentTrackState.percent) {
            const text = `${data.percent}%`;
            updateIfChanged('track-percent', text);
            currentTrackState.percent = data.percent;
        }
    });

    socket.on('play_state_update', (data) => {
        resetTrackTimeWatchdog();
        const playState = data.state;
        const isNowPlaying = (playState === 'PLAY');

        // Check against optimistic state to prevent UI flicker
        if (optimisticState.playback.active) {
            const timeSinceClick = Date.now() - optimisticState.playback.timestamp;
            if (timeSinceClick < 2000 && isNowPlaying === optimisticState.playback.value) {
                console.log('Confirmed optimistic playback state. Clearing flag.');
                optimisticState.playback.active = false;
            } else if (timeSinceClick >= 2000) {
                optimisticState.playback.active = false;
            }
        }

        receiverState.playback.isPlaying = isNowPlaying;
        if (dom.playback.playPauseToggleBtn) {
            dom.playback.playPauseToggleBtn.classList.toggle('is-playing', receiverState.playback.isPlaying);
        }
        // Start or stop the local track time counter based on the new play state.
        if (receiverState.playback.isPlaying) {
            startTrackTimeCounter();
        } else {
            console.log('Playback paused/stopped. Stopping local track timer.');
            stopTrackTimeCounter();
        }
    });

    socket.on('smart_select_update', (data) => {
        console.log('Received smart_select_update:', data);
        const selection = data.selection;
        document.querySelectorAll('#smart-select-grid button').forEach(btn => btn.classList.remove('active'));
        const activeButton = document.querySelector(`button[data-response-code="${selection}"]`);
        if (activeButton) activeButton.classList.add('active');
    });

    socket.on('zone2_power_update', (data) => {
        console.log('Received zone2_power_update:', data);
        const isNowOn = (data.state === 'on');
        if (optimisticState.zone2Power.active) {
            const timeSinceClick = Date.now() - optimisticState.zone2Power.timestamp;
            if (timeSinceClick < 2000) {
                if (isNowOn !== optimisticState.zone2Power.value) {
                    console.log(`Ignoring stale 'zone2_power_update' (isNowOn=${isNowOn}) due to recent user action.`);
                    return;
                }
            } else {
                optimisticState.zone2Power.active = false;
            }
        }
        receiverState.zone2.isOn = isNowOn;
        if (dom.zone2.powerBtn) dom.zone2.powerBtn.classList.toggle('active', isNowOn);
    });

    socket.on('zone2_mute_update', (data) => {
        console.log('Received zone2_mute_update:', data);
        const isMuted = data.state === 'on';
        if (optimisticState.zone2Mute.active) {
            const timeSinceClick = Date.now() - optimisticState.zone2Mute.timestamp;
            if (timeSinceClick < 2000) {
                if (isMuted !== optimisticState.zone2Mute.value) {
                    console.log(`Ignoring stale 'zone2_mute_update' (isMuted=${isMuted}) due to recent user action.`);
                    return;
                }
            } else {
                optimisticState.zone2Mute.active = false;
            }
        }
        receiverState.zone2.isMuted = isMuted;
        if (dom.zone2.muteBtn) dom.zone2.muteBtn.classList.toggle('mute-on', receiverState.zone2.isMuted);
    });

    socket.on('zone2_input_source_update', (data) => {
        console.log('Received zone2_input_source_update:', data);
        const source = `Z2${data.source}`;
        receiverState.zone2.currentInput = source;
        if (dom.zone2.inputGrid) {
            dom.zone2.inputGrid.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            const activeButton = dom.zone2.inputGrid.querySelector(`button[data-response-code="${source}"]`);
            if (activeButton) activeButton.classList.add('active');
        }
    });

    socket.on('reference_level_update', (data) => {
        console.log('Received reference_level_update:', data);
        receiverState.audio.referenceLevel = data.value;
        if (dom.audio.refLevelCycleBtn) dom.audio.refLevelCycleBtn.textContent = `Offset: ${data.value} dB`;
    });

    socket.on('connection_error', (data) => {
        showToast(data.message, { isError: true, duration: 5000 });
    });

    // --- NEW: Handlers for receiver connection status ---
    socket.on('receiver_disconnected', (data) => {
        console.warn('Receiver disconnected:', data.message);
        stopStatusPolling(); // Stop spamming status requests
        showToast(data.message, { isError: true, duration: 10000 });
        document.body.classList.add('receiver-disconnected');
    });

    socket.on('receiver_connected', (data) => {
        console.info('Receiver connected:', data.message);
        showToast(data.message, { duration: 3000 });
        document.body.classList.remove('receiver-disconnected');
        // Perform an immediate sync and then restart polling
        requestInitialStatus();
        startStatusPolling();
    });

    // --- NEW: Handler for custom input names ---
    socket.on('input_names_update', handleInputNamesUpdate);

}

/**
 * Initializes the specific event listeners for the sleep timer controls.
 * This includes the main cycling sleep button and the manual input field.
 * This custom handler prevents the generic command listener from firing.
 */
function initializeSleepTimerControls() {
    const sleepBtn = dom.mainControls.sleepBtn;
    const setSleepBtn = dom.inputs.setSleepTimerBtn;
    const sleepInput = dom.inputs.sleepTimer;

    // Logic for the main cycling sleep button
    if (sleepBtn) {
        const sleepIntervals = [0, 10, 20, 30, 60, 90, 120];

        sleepBtn.addEventListener('click', (event) => {
            // Prevent any other click listeners on this element or its parents from firing.
            event.stopImmediatePropagation();

            const currentMinutes = receiverState.main.sleepMinutes || 0;
            const currentIndex = sleepIntervals.indexOf(currentMinutes);
            
            // Find the next interval in the cycle.
            // If current value isn't in our list, or is the last, cycle to the first non-zero value (10).
            const nextIndex = (currentIndex === -1 || currentIndex >= sleepIntervals.length - 1) ? 1 : currentIndex + 1;
            const nextMinutes = sleepIntervals[nextIndex];

            if (nextMinutes === 0) {
                sendCommand('SLEEP_OFF');
            } else {
                // The receiver expects a 3-digit value (e.g., 010, 060, 120).
                sendCommand('SLEEP_SET', String(nextMinutes).padStart(3, '0'));
            }
        });
    }

    // Logic for the manual sleep timer input in the System Utilities section
    if (setSleepBtn && sleepInput) {
        setSleepBtn.addEventListener('click', (event) => {
            // Prevent any other click listeners on this element or its parents from firing.
            event.stopImmediatePropagation();

            const minutes = parseInt(sleepInput.value, 10);
            if (!isNaN(minutes) && minutes >= 1 && minutes <= 120) {
                sendCommand('SLEEP_SET', String(minutes).padStart(3, '0'));
                sleepInput.value = ''; // Clear input after setting
            } else {
                showToast('Invalid sleep time. Use 1-120.', { isError: true });
                sleepInput.value = ''; // Clear invalid input
            }
        });
    }
}

/**
 * Initializes the event listeners for the Input Rename UI.
 * @param {SocketIOClient.Socket} socket The main socket.io client instance.
 */
function initializeInputRenameControls(socket) {
    const renameSelect = document.getElementById('input-rename-select');
    const renameText = document.getElementById('input-rename-text');
    const applyBtn = document.getElementById('input-rename-apply-btn');
    const resetBtn = document.getElementById('input-rename-reset-btn');

    if (!renameSelect || !renameText || !applyBtn || !resetBtn) return;

    // When an input is selected from the dropdown, populate the text box with its current name.
    renameSelect.addEventListener('change', () => {
        const selectedCode = renameSelect.value;
        if (selectedCode && receiverState.ui.inputNames[selectedCode]) {
            renameText.value = receiverState.ui.inputNames[selectedCode];
        } else {
            renameText.value = '';
        }
    });

    // When the "Apply" button is clicked, send the new name to the server.
    applyBtn.addEventListener('click', () => {
        const input_code = renameSelect.value;
        const new_name = renameText.value.trim();
        // BUGFIX: Allow empty strings as a valid name. The backend handles validation.
        if (input_code) {
            socket.emit('rename_input', { input_code, new_name });
            showToast(`Renamed to '${new_name}'`, { isSuccess: true });
            renameText.value = '';
            renameSelect.value = '';
        } else {
            showToast('Please select an input and enter a name.', { isError: true });
        }
    });

    // When the "Reset" button is clicked, send a reset request to the server.
    resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all input names to their defaults?')) {
            socket.emit('reset_input_names');
            showToast('Input names reset to default.', { isSuccess: true });
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    // Establish WebSocket connection
    const socket = io();

    initializeOsd(socket, updateDynamicDisplay);
    initializeChannelEditor(socket);
    initializeSoundModes(socket);
    initializeAllSliders();
    initializeSliderWebSocketListeners(socket);
    initializeMainVolume();
    initializeEventListeners();
    initializeSleepTimerControls();
    initializeInputRenameControls(socket);

    // --- WebSocket Handlers ---
    socket.on('connect', () => {
        // EDITED: Merged the two 'connect' handlers into one to fix a bug
        // where the second handler was overwriting the first.
        console.log('[WebSocket] Connected to server.');
        // NEW: Use toast notifications for connection status.
        showToast('Connected to server. Waiting for receiver...', { duration: 2000 });
    });

    socket.on('disconnect', () => {
        console.error('[WebSocket] Disconnected from server.');
        // NEW: Stop all polling when disconnected to prevent errors and save resources.
        stopAllNowPlayingFeatures();
        stopStatusPolling();
        // NEW: Use toast notifications for connection status.
        showToast('Disconnected. Please refresh the page.', { isError: true, duration: 10000 });
        // NEW: Also apply the visual disconnected state
        document.body.classList.add('receiver-disconnected');
    });

    registerSocketEventHandlers(socket);
});