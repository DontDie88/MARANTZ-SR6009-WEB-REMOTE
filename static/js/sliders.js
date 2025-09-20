import { dom } from './dom.js';
import { sendCommand } from './api.js';
import { uiLocker } from './uiLocker.js';
import { debounce, updateSliderFill, enableSmoothHorizontalSlider, updateSliderUI } from './utils.js';

/**
 * Module-level state for the subwoofer slider, which requires special handling.
 * This allows both the event listener and the change handler to access the same value.
 */
let currentSubLevel = 50; // Default to 0dB (50 on the slider's scale)

/**
 * A factory function to initialize a generic horizontal slider.
 * This encapsulates the common logic for setting up a slider's event listeners.
 * @param {object} config - The configuration for the slider.
 * @param {HTMLInputElement} config.sliderEl - The slider DOM element.
 * @param {HTMLElement} config.labelEl - The label DOM element for the slider.
 * @param {string} config.command - The command to send on change.
 * @param {function(string): string} config.labelFormatter - A function to format the label text from the slider value.
 * @param {function(string): (string|number)} [config.valueTransformer] - An optional function to transform the slider value before sending the command.
 * @param {string} [config.lockId] - An optional ID to use for UI locking.
 */
function initializeGenericSlider({ sliderEl, labelEl, command, labelFormatter, valueTransformer, lockId }) {
    if (!sliderEl) return;

    const debouncedSend = debounce((value) => {
        const finalValue = valueTransformer ? valueTransformer(value) : value;
        sendCommand(command, finalValue);
    }, 250);

    sliderEl.addEventListener('input', () => {
        if (labelEl) {
            labelEl.textContent = labelFormatter(sliderEl.value);
        }
        updateSliderFill(sliderEl);
    });

    sliderEl.addEventListener('change', () => {
        if (lockId) uiLocker.lock(lockId);
        debouncedSend(sliderEl.value);
    });

    if (sliderEl.parentElement) {
        enableSmoothHorizontalSlider(sliderEl, sliderEl.parentElement);
    }
}

/**
 * Initializes the Subwoofer Level slider with custom logic.
 * This slider works by sending a series of UP/DOWN commands to the receiver,
 * as it does not support setting a direct value. This version removes the UI locker
 * to simplify the logic.
 */
function initializeSubwooferSlider() {
    const sliderEl = dom.audio.subLevelAdjustSlider;
    if (!sliderEl) return;

    // This function is called when the slider value is changed by the user.
    const sendAdjustmentCommands = async (targetValue) => {
        const target = parseInt(targetValue, 10);
        // Use a rounded version of the current level for accurate comparison
        const current = Math.round(currentSubLevel);
        const difference = target - current;

        if (difference === 0) return;

        const command = difference > 0 ? 'SUB_LEVEL_ADJUST_UP' : 'SUB_LEVEL_ADJUST_DOWN';
        const count = Math.abs(difference);

        console.log(`Adjusting subwoofer level from ${current} to ${target}. Sending ${command} ${count} times.`);

        // Lock the UI to prevent race conditions during the adjustment.
        uiLocker.lock('subLevelAdjust', count * 100 + 500);

        for (let i = 0; i < count; i++) {
            sendCommand(command);
            // Wait a short moment between each command to not overwhelm the receiver
            await new Promise(resolve => setTimeout(resolve, 80));
        }
    };

    // The 'input' event is for visual feedback only.
    sliderEl.addEventListener('input', () => {
        if (dom.audio.subLevelAdjustLabel) {
            dom.audio.subLevelAdjustLabel.textContent = `Level: ${(parseFloat(sliderEl.value) - 50).toFixed(1)} dB`;
        }
        updateSliderFill(sliderEl);
    });

    // The 'change' event triggers the actual command sending.
    sliderEl.addEventListener('change', () => {
        sendAdjustmentCommands(sliderEl.value);
    });
}

/**
 * Initializes all generic horizontal sliders in the UI by applying the common setup logic.
 */
export function initializeAllSliders() {
    // Dialog Level Slider
    initializeGenericSlider({
        sliderEl: dom.audio.dialogSlider,
        labelEl: dom.audio.dialogSliderLabel,
        command: 'DIALOG_LEVEL_SET',
        labelFormatter: (value) => `Dialog: ${(parseFloat(value) - 50).toFixed(1)} dB`,
        lockId: 'dialogLevel'
    });

    // The subwoofer slider requires special handling due to hardware limitations.
    initializeSubwooferSlider();
    
    // Center Gain Slider
    initializeGenericSlider({
        sliderEl: dom.audio.centerGainSlider,
        labelEl: dom.audio.centerGainLabel,
        command: 'CENTER_GAIN_SET',
        labelFormatter: (value) => `Gain: ${parseFloat(value).toFixed(1)} dB`,
    });

    // Zone 2 Volume Slider
    initializeGenericSlider({
        sliderEl: dom.zone2.volumeSlider,
        labelEl: dom.zone2.volumeSliderLabel,
        command: 'ZONE2_VOLUME_SET',
        labelFormatter: (value) => `Z2 Vol: ${value}`,
    });
}

/**
 * Initializes all WebSocket event listeners related to the horizontal sliders.
 * This encapsulates the logic for updating sliders based on feedback from the receiver.
 * @param {object} socket - The active Socket.IO client instance.
 */
export function initializeSliderWebSocketListeners(socket) {
    // Listener for Zone 2 Volume updates
    socket.on('zone2_volume_update', (data) => {
        console.log('Received zone2_volume_update:', data);
        updateSliderUI({
            sliderEl: dom.zone2.volumeSlider,
            labelEl: dom.zone2.volumeSliderLabel,
            value: data.value,
            labelFormatter: (val) => `Z2 Vol: ${val}`
        });
    });

    // Listener for Subwoofer Level Adjust updates
    socket.on('sub_level_adjust_update', (data) => {
        if (uiLocker.isLocked('subLevelAdjust')) {
            console.log('Ignoring sub_level_adjust_update due to UI lock.');
            return;
        }
        console.log('Received sub_level_adjust_update:', data);
        const onButton = document.querySelector('button[data-command="SUB_LEVEL_ADJUST_ON"]');
        const offButton = document.querySelector('button[data-command="SUB_LEVEL_ADJUST_OFF"]');

    // --- State Update (On/Off) ---
    // Only update the on/off state if the 'state' property is explicitly provided.
    if (data.state !== undefined) {
        const isOn = data.state === 'on';
        if (onButton) onButton.classList.toggle('active', isOn);
        if (offButton) offButton.classList.toggle('active', !isOn);
        if (dom.audio.subLevelAdjustSlider) dom.audio.subLevelAdjustSlider.disabled = !isOn;

        if (!isOn) {
            if (dom.audio.subLevelAdjustLabel) dom.audio.subLevelAdjustLabel.textContent = `Level: Bypassed`;
        }
    }

    // --- Value Update (Slider Level) ---
    // Only update the slider's value and label if the 'value' property is provided.
    if (data.value != null) {
            // Update the module-level state for the custom slider handler
            currentSubLevel = data.value + 50;
            const dbValue = data.value;
            updateSliderUI({
                sliderEl: dom.audio.subLevelAdjustSlider,
                labelEl: dom.audio.subLevelAdjustLabel,
                value: dbValue + 50, // Convert dB to slider's native scale
                labelFormatter: () => `Level: ${dbValue.toFixed(1)} dB` // Use original dB value for label
            });
        }
    });

    // Listener for Center Gain updates
    socket.on('center_gain_update', (data) => {
        console.log('Received center_gain_update:', data);
        updateSliderUI({
            sliderEl: dom.audio.centerGainSlider,
            labelEl: dom.audio.centerGainLabel,
            value: data.value,
            labelFormatter: (val) => `Gain: ${parseFloat(val).toFixed(1)} dB`
        });
    });

    // Listener for Dialog Level updates
    socket.on('dialog_level_update', (data) => {
        if (uiLocker.isLocked('dialogLevel')) {
            console.log('Ignoring dialog_level_update due to UI lock.');
            return;
        }
        console.log('Received dialog_level_update:', data);
        const onButton = document.querySelector('button[data-command="DIALOG_LEVEL_ADJUST_ON"]');
        const offButton = document.querySelector('button[data-command="DIALOG_LEVEL_ADJUST_OFF"]');

        // --- State Update (On/Off) ---
        // Only update the on/off state if the 'state' property is explicitly provided.
        if (data.state !== undefined) {
            const isOn = data.state === 'on';
            if (onButton) onButton.classList.toggle('active', isOn);
            if (offButton) offButton.classList.toggle('active', !isOn);
            if (dom.audio.dialogSlider) dom.audio.dialogSlider.disabled = !isOn;

            if (!isOn) {
                if (dom.audio.dialogSliderLabel) dom.audio.dialogSliderLabel.textContent = 'Dialog: Off';
            }
        }

        // --- Value Update (Slider Level) ---
        // Only update the slider's value and label if the 'value' property is provided.
        if (data.value != null) {
            if (dom.audio.dialogSlider) {
                const dbValue = data.value - 50;
                updateSliderUI({
                    sliderEl: dom.audio.dialogSlider,
                    labelEl: dom.audio.dialogSliderLabel,
                    value: data.value,
                    labelFormatter: () => `Dialog: ${dbValue.toFixed(1)} dB`
                });
            }
        }
    });
}