import { dom } from './dom.js';
import { receiverState } from './state.js';
import { sendCommand } from './api.js';
import { enableSmoothVerticalSlider } from './utils.js';

/**
 * Sets the main volume, with a gradual ramp-up for increases.
 * This protects speakers by avoiding sudden, large volume jumps.
 * @param {number|string} targetVolume - The desired final volume level.
 */
function setVolumeWithRampUp(targetVolume) {
    // Clear any existing ramp-up process to handle rapid user changes.
    receiverState.main.isVolumeRamping = false;
    receiverState.main.volumeRampTarget = null;

    // Always remove any lingering animation class at the start.
    if (dom.mainControls.volumeSliderLabel) {
        dom.mainControls.volumeSliderLabel.classList.remove('volume-ramping');
    }

    const currentVolume = receiverState.main.currentVolume;
    const finalVolume = parseFloat(targetVolume);

    console.log(`Setting volume. Current: ${currentVolume}, Target: ${finalVolume}`);

    // If target is lower or equal, set it immediately.
    if (finalVolume <= currentVolume) {
        console.log('Target volume is lower. Setting immediately.');
        sendCommand('VOLUME_SET', finalVolume);
        return;
    }

    // If target is higher, start the "closed-loop" ramp-up process.
    console.log(`Target volume is higher. Starting ramp-up to ${finalVolume}.`);
    receiverState.main.isVolumeRamping = true;
    receiverState.main.volumeRampTarget = finalVolume;
    if (dom.mainControls.volumeSliderLabel) {
        dom.mainControls.volumeSliderLabel.classList.add('volume-ramping');
    }

    // Send the command for the *first* step only. The 'volume_update' handler will do the rest.
    const firstStepVolume = currentVolume + 0.5;
    const initialStep = Math.min(firstStepVolume, finalVolume);
    
    sendCommand('VOLUME_SET', initialStep);
}

/**
 * Initializes the main volume slider with its custom ramp-up logic and smooth dragging.
 */
export function initializeMainVolume() {
    if (dom.mainControls.volumeSlider && dom.mainControls.volumeSliderWrapper) {
        dom.mainControls.volumeSlider.addEventListener('input', () => {
            if (dom.mainControls.volumeSliderLabel) {
                dom.mainControls.volumeSliderLabel.textContent = `Vol: ${parseFloat(dom.mainControls.volumeSlider.value).toFixed(1)}`;
            }
        });

        dom.mainControls.volumeSlider.addEventListener('change', () => {
            setVolumeWithRampUp(dom.mainControls.volumeSlider.value);
        });

        enableSmoothVerticalSlider(dom.mainControls.volumeSlider, dom.mainControls.volumeSliderWrapper);
    }
}