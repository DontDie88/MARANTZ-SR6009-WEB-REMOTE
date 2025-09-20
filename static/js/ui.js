import { dom } from './dom.js';
import { receiverState, optimisticState } from './state.js';
import { sendCommand } from './api.js';
import { handleOsdNavCommand } from './osd.js';
import { debounce, updateMarqueeAnimation, preventScrollOnSlider, updateSliderFill } from './utils.js';

/**
 * Safely retrieves a nested property from an object using a dot-notation string.
 * @param {object} obj - The object to traverse.
 * @param {string} keyPath - The path to the property (e.g., 'main.isPowerOn').
 * @returns {any} The value of the property, or undefined if not found.
 */
function _getNestedState(obj, keyPath) {
    return keyPath.split('.').reduce((cur, key) => cur && cur[key], obj);
}

/**
 * A generic helper to set up a stateful toggle button.
 * @param {HTMLElement} button - The button element.
 * @param {string} stateKey - The key in `receiverState` that holds the button's state (e.g., 'isPowerOn').
 * @param {{on: string, off: string}} commands - An object with the 'on' and 'off' command names.
 */
export function setupStatefulButton(button, stateKey, commands) {
    if (!button) return;
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        const currentState = _getNestedState(receiverState, stateKey);
        if (currentState === null) return; // Don't act if state is unknown
        const command = currentState ? commands.off : commands.on;
        sendCommand(command, null, button);
    });
}

/**
 * Factory to create a generic event handler for button groups where only one state is active.
 * @param {string} eventName - The name of the event for logging purposes (e.g., 'mdax_update').
 * @param {Object.<string, string>} commandMap - A map of state names to their corresponding 'data-command' values.
 * @returns {function(object): void} A function suitable for a socket.on() listener.
 */
export function createMultiStateButtonHandler(eventName, commandMap) {
    const buttonElements = {};
    for (const state in commandMap) {
        buttonElements[state] = document.querySelector(`button[data-command="${commandMap[state]}"]`);
    }

    return function(data) {
        console.log(`Received ${eventName}:`, data);
        const activeState = data.state;
        for (const state in buttonElements) {
            const button = buttonElements[state];
            if (button) button.classList.toggle('active', state === activeState);
        }
    };
}

/**
 * Factory to create a generic event handler for a pair of on/off buttons.
 * @param {string} eventName - The name of the event for logging.
 * @param {string} onCommand - The 'data-command' for the 'on' button.
 * @param {string} offCommand - The 'data-command' for the 'off' button.
 * @returns {function(object): void} A function suitable for a socket.on() listener.
 */
export function createOnOffButtonHandler(eventName, onCommand, offCommand) {
    const onButton = document.querySelector(`button[data-command="${onCommand}"]`);
    const offButton = document.querySelector(`button[data-command="${offCommand}"]`);

    return function(data) {
        console.log(`Received ${eventName}:`, data);
        const isOn = (data.state === 'on');
        if (onButton) onButton.classList.toggle('active', isOn);
        if (offButton) offButton.classList.toggle('active', !isOn);
    };
}

/**
 * Handles UI updates for power state changes.
 * @param {boolean} isPowerOn - The new power state.
 */
export function handlePower(isPowerOn) {
    receiverState.main.isPowerOn = isPowerOn;
    if (dom.status.power) dom.status.power.textContent = receiverState.main.isPowerOn ? 'ON' : 'STANDBY';
    if (dom.mainControls.powerBtn) dom.mainControls.powerBtn.classList.toggle('power-on', receiverState.main.isPowerOn);
    // NEW: Add a global class to the body to disable controls when power is off.
    document.body.classList.toggle('receiver-standby', !isPowerOn);
}

/**
 * Handles UI updates for main mute state changes.
 * @param {boolean} isMuted - The new mute state.
 */
export function handleMainMute(isMuted) {
    receiverState.main.isMuted = isMuted;
    if (dom.mainControls.muteBtn) dom.mainControls.muteBtn.classList.toggle('mute-on', receiverState.main.isMuted);
}

/**
 * Initializes all the main UI event listeners for the application.
 */
export function initializeEventListeners() {
    const OSD_NAV_COMMANDS = new Set([
        'OSD_UP', 'OSD_DOWN', 'OSD_LEFT', 'OSD_RIGHT',
        'OSD_ENTER', 'OSD_RETURN', 'OSD_MENU_TOGGLE'
    ]);

    // Event Delegation for all `data-command` buttons
    document.body.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-command]');
        if (button) {
            const command = button.dataset.command;
            sendCommand(command, null, button);
            // Only call the OSD handler if the command is relevant.
            if (OSD_NAV_COMMANDS.has(command)) {
                handleOsdNavCommand(command);
            }
        }

        // Event Delegation for collapsible section headers
        const header = event.target.closest('.section-header');
        if (header) {
            const section = header.closest('.collapsible-section');
            if (section) {
                section.classList.toggle('is-open');
                if (section.id === 'channel-levels-section' && !section.classList.contains('is-open')) {
                    section.classList.remove('is-editing');
                    receiverState.selectedChannel = null;
                }
            }
        }
    });

    // Context-Aware Stateful Button Listeners
    setupStatefulButton(dom.mainControls.powerBtn, 'main.isPowerOn', { on: 'POWER_ON', off: 'POWER_STANDBY' });
    setupStatefulButton(dom.zone2.powerBtn, 'zone2.isOn', { on: 'ZONE2_ON', off: 'ZONE2_OFF' });
    setupStatefulButton(dom.mainControls.muteBtn, 'main.isMuted', { on: 'MUTE_ON', off: 'MUTE_OFF' });
    setupStatefulButton(dom.zone2.muteBtn, 'zone2.isMuted', { on: 'ZONE2_MUTE_ON', off: 'ZONE2_MUTE_OFF' });

    if (dom.playback.playPauseToggleBtn) {
        dom.playback.playPauseToggleBtn.addEventListener('click', () => {
            // Set optimistic state to prevent race conditions. This tells the app
            // that a user-initiated change is in progress.
            const isNowPlaying = !receiverState.playback.isPlaying;
            optimisticState.playback.active = true;
            optimisticState.playback.value = isNowPlaying;
            optimisticState.playback.timestamp = Date.now();

            const command = (receiverState.main.currentInput === 'PANDORA') ? 'PANDORA_PLAY_PAUSE_TOGGLE' : 'PLAY_PAUSE_TOGGLE';
            
            sendCommand(command, null, dom.playback.playPauseToggleBtn);
        });
    }
    if (dom.playback.playNextBtn) {
        dom.playback.playNextBtn.addEventListener('click', () => {
            // PANDORA_SKIP_PLUS was removed as it duplicated PLAY_NEXT.
            sendCommand('PLAY_NEXT', null, dom.playback.playNextBtn);
        });
    }
    if (dom.playback.playPreviousBtn) {
        dom.playback.playPreviousBtn.addEventListener('click', () => {
            if (receiverState.main.currentInput !== 'PANDORA') sendCommand('PLAY_PREVIOUS', null, dom.playback.playPreviousBtn);
        });
    }

    // Stateful Cycling Button Listener
    if (dom.audio.refLevelCycleBtn) {
        dom.audio.refLevelCycleBtn.addEventListener('click', () => {
            const levels = [0, 5, 10, 15];
            const currentValue = receiverState.audio.referenceLevel;
            const currentIndex = levels.indexOf(currentValue);
            const nextIndex = (currentIndex === -1 || currentIndex >= levels.length - 1) ? 0 : currentIndex + 1;
            const nextValue = levels[nextIndex];
            sendCommand('REF_LVL_SET', nextValue, dom.audio.refLevelCycleBtn);
        });
    }

    if (dom.inputs.setAnalogFreqBtn) {
        dom.inputs.setAnalogFreqBtn.addEventListener('click', () => {
            const freq = dom.inputs.analogFreq.value.trim();
            if (freq) {
                sendCommand('TUNER_FREQ_SET_ANALOG', freq, dom.inputs.setAnalogFreqBtn);
                dom.inputs.analogFreq.value = '';
            }
        });
    }
    if (dom.inputs.setHdFreqBtn) {
        dom.inputs.setHdFreqBtn.addEventListener('click', () => {
            const freq = dom.inputs.hdFreq.value.trim();
            if (freq) {
                sendCommand('TUNER_FREQ_SET_HD', freq, dom.inputs.setHdFreqBtn);
                dom.inputs.hdFreq.value = '';
            }
        });
    }

    // Window Resize Listener
    const debouncedResizeHandler = debounce(() => {
        console.log('Window resized, re-checking marquee overflows.');
        updateMarqueeAnimation(dom.nowPlaying.title);
        updateMarqueeAnimation(dom.nowPlaying.artist);
        updateMarqueeAnimation(dom.nowPlaying.album);
    }, 250);
    window.addEventListener('resize', debouncedResizeHandler);

    // Final UI Initializations
    preventScrollOnSlider(dom.mainControls.volumeSlider);
    preventScrollOnSlider(dom.zone2.volumeSlider);
    preventScrollOnSlider(dom.audio.dialogSlider);
    preventScrollOnSlider(dom.audio.subLevelAdjustSlider);
    preventScrollOnSlider(dom.audio.centerGainSlider);
    preventScrollOnSlider(dom.channelLevels.editorSlider);

    // update slider fills on page load
    document.querySelectorAll('.slider-container input[type="range"], .slider-group input[type="range"]').forEach(updateSliderFill);
}