import { dom } from './dom.js';
import { receiverState, channelUpdateBuffer, CHANNEL_NAME_MAP, CHANNEL_SCALE_MAP, WIDE_SCALE_CHANNELS, initialSyncState } from './state.js';
import { sendCommand } from './api.js';
import { debounce, updateSliderFill, enableSmoothHorizontalSlider } from './utils.js';
import { showToast } from './notifications.js';

/**
 * A set of sound modes where the subwoofer is considered optional and can be turned off by the user.
 * In other modes (e.g., surround sound), the receiver may force the subwoofer to be on.
 */
const SUBWOOFER_OPTIONAL_MODES = new Set(['STEREO', 'DIRECT', 'PURE DIRECT', 'MCH STEREO']);

/**
 * Hides the channel editor and deselects any selected channel item.
 */
function hideChannelEditor() {
    const currentlySelected = dom.channelLevels.grid.querySelector('.selected');
    if (currentlySelected) {
        currentlySelected.classList.remove('selected');
    }
    if (dom.channelLevels.section) {
        dom.channelLevels.section.classList.remove('is-editing');
    }
    receiverState.ui.selectedChannel = null;
    console.log('Channel editor hidden.');
}

/**
 * Handles the display of the channel level editor when a channel is clicked.
 * @param {HTMLElement} clickedItem - The channel item element that was clicked.
 */
function showChannelEditor(clickedItem) {
    const channelCode = clickedItem.dataset.channelCode;
    if (!channelCode) return;
 
    // Remove 'selected' from any previously selected item
    const currentlySelected = dom.channelLevels.grid.querySelector('.selected');
    if (currentlySelected) currentlySelected.classList.remove('selected');

    // Add 'selected' to the clicked item
    clickedItem.classList.add('selected');

    if (dom.channelLevels.editor) dom.channelLevels.editor.classList.toggle('is-editing-subwoofer', channelCode === 'SW');

    // Update the application state with the selected channel's info
    const valueText = clickedItem.querySelector('.channel-value').textContent;
    const currentValue = parseFloat(valueText); // e.g., "0.0 dB" -> 0.0
    receiverState.ui.selectedChannel = {
        code: channelCode,
        name: CHANNEL_NAME_MAP[channelCode] || channelCode,
        value: currentValue
    };
    console.log('Selected channel for editing:', receiverState.ui.selectedChannel);

    // Update the editor UI title and make the editor visible
    if (dom.channelLevels.editorTitle) {
        dom.channelLevels.editorTitle.textContent = `Editing: ${receiverState.ui.selectedChannel.name}`;
    }
    if (dom.channelLevels.section) {
        dom.channelLevels.section.classList.add('is-editing');
    }

    // Configure the slider based on the selected channel's scale
    if (dom.channelLevels.editorSlider) {
        const scaleType = WIDE_SCALE_CHANNELS.includes(channelCode) ? 'height_wide' : 'default';
        const scale = CHANNEL_SCALE_MAP[scaleType];
        dom.channelLevels.editorSlider.min = scale.min;
        dom.channelLevels.editorSlider.max = scale.max;
        dom.channelLevels.editorSlider.step = scale.step;
        dom.channelLevels.editorSlider.value = currentValue;
        updateSliderFill(dom.channelLevels.editorSlider); // Update fill on show
        // Update the label as well
        dom.channelLevels.editorSliderLabel.textContent = `Level: ${currentValue.toFixed(1)} dB`;
    }

    // If the selected channel is the subwoofer, show its specific power controls
    if (channelCode === 'SW') {
        if (dom.channelLevels.subwooferEditorToggleBtn) {
            // EDITED: Use the correct state for the master on/off status.
            dom.channelLevels.subwooferEditorToggleBtn.textContent = receiverState.audio.isSubwooferOn ? 'Subwoofer ON' : 'Subwoofer OFF';
            dom.channelLevels.subwooferEditorToggleBtn.classList.toggle('active', receiverState.audio.isSubwooferOn);
        }
    }
}

/**
 * Sets up all event listeners related to the Channel Level Editor.
 * @param {object} socket - The active Socket.IO client instance.
 */
export function initializeChannelEditor(socket) {
    // WebSocket listener for individual channel level updates
    socket.on('channel_level_update', (data) => {
        console.log('Received channel_level_update:', data);
        const channelCode = data.channel;
        const value = data.value;
        const channelName = CHANNEL_NAME_MAP[channelCode] || channelCode;

        channelUpdateBuffer.add(channelCode);

        if (!dom.channelLevels.grid) return;

        let channelItem = document.getElementById(`channel-item-${channelCode}`);
        if (!channelItem) {
            channelItem = document.createElement('div');
            channelItem.className = 'channel-level-item';
            channelItem.id = `channel-item-${channelCode}`;
            channelItem.dataset.channelCode = channelCode;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'channel-name';
            nameSpan.textContent = channelName;

            const valueSpan = document.createElement('span');
            valueSpan.className = 'channel-value';
            valueSpan.id = `channel-value-${channelCode}`;

            channelItem.appendChild(nameSpan);
            channelItem.appendChild(valueSpan);
            dom.channelLevels.grid.appendChild(channelItem);
        }

        const valueSpan = document.getElementById(`channel-value-${channelCode}`);
        if (valueSpan) {
            valueSpan.textContent = `${value.toFixed(1)} dB`;
        }

        if (receiverState.ui.selectedChannel && receiverState.ui.selectedChannel.code === channelCode) {
            if (dom.channelLevels.editorSlider) {
                dom.channelLevels.editorSlider.value = value;
                updateSliderFill(dom.channelLevels.editorSlider);
                dom.channelLevels.editorSliderLabel.textContent = `Level: ${value.toFixed(1)} dB`;
            }
            receiverState.ui.selectedChannel.value = value;
        }
    });

    // WebSocket listener for the end of the channel list stream
    socket.on('channel_level_list_end', () => {
        console.log('End of channel list received. Syncing grid.');
        if (!dom.channelLevels.grid) return;
        const gridItems = dom.channelLevels.grid.querySelectorAll('.channel-level-item');
        
        gridItems.forEach(item => {
            const code = item.dataset.channelCode;
            if (!channelUpdateBuffer.has(code)) {
                console.log(`Removing stale channel item: ${code}`);
                item.remove();
                if (receiverState.ui.selectedChannel && receiverState.ui.selectedChannel.code === code) {
                    dom.channelLevels.section.classList.remove('is-editing');
                    dom.channelLevels.editor.classList.remove('is-editing-subwoofer');
                    receiverState.ui.selectedChannel = null;
                }
            }
        });

        receiverState.audio.isSubwooferConfigOn = channelUpdateBuffer.has('SW');
        channelUpdateBuffer.clear();
    });

    // NEW: Listener for the master subwoofer on/off status.
    socket.on('subwoofer_status_update', (data) => {
        console.log('Received subwoofer_status_update:', data);
        const isOn = data.state === 'on';
        receiverState.audio.isSubwooferOn = isOn;

        if (dom.channelLevels.subwooferEditorToggleBtn) {
            dom.channelLevels.subwooferEditorToggleBtn.textContent = isOn ? 'Subwoofer ON' : 'Subwoofer OFF';
            dom.channelLevels.subwooferEditorToggleBtn.classList.toggle('active', isOn);
        }

        initialSyncState.delete('subwoofer');
    });

    // Event delegation for clicking on a channel in the grid
    if (dom.channelLevels.grid) {
        dom.channelLevels.grid.addEventListener('click', (event) => {
            const clickedItem = event.target.closest('.channel-level-item');
            if (clickedItem) {
                const isAlreadySelected = clickedItem.classList.contains('selected');
                // If the clicked item is already selected, hide the editor. Otherwise, show it.
                if (isAlreadySelected) {
                    hideChannelEditor();
                } else {
                    showChannelEditor(clickedItem);
                }
            }
        });
    }

    // Listener for the channel editor slider
    if (dom.channelLevels.editorSlider) {
        const debouncedSend = debounce((value) => {
            if (!receiverState.ui.selectedChannel) return;
            const channelCode = receiverState.ui.selectedChannel.code;
            const commandName = `SET_LEVEL_${channelCode}`;
            const receiverValue = parseFloat(value) + 50;
            const formattedValue = (receiverValue * 10 % 10 === 5)
                ? Math.round(receiverValue * 10)
                : Math.round(receiverValue);
            sendCommand(commandName, formattedValue);
        }, 250); // Debounce to prevent command flooding

        dom.channelLevels.editorSlider.addEventListener('input', () => {
            if (dom.channelLevels.editorSliderLabel) {
                dom.channelLevels.editorSliderLabel.textContent = `Level: ${parseFloat(dom.channelLevels.editorSlider.value).toFixed(1)} dB`;
            }
            updateSliderFill(dom.channelLevels.editorSlider);
        });
        dom.channelLevels.editorSlider.addEventListener('change', () => debouncedSend(dom.channelLevels.editorSlider.value));

        if (dom.channelLevels.editorSlider.parentElement) {
            enableSmoothHorizontalSlider(dom.channelLevels.editorSlider, dom.channelLevels.editorSlider.parentElement);
        }
    }

    // Listener for the subwoofer on/off toggle button inside the editor
    if (dom.channelLevels.subwooferEditorToggleBtn) {
        dom.channelLevels.subwooferEditorToggleBtn.addEventListener('click', (event) => {
            const isTurningOff = receiverState.audio.isSubwooferOn;
            const currentSoundMode = receiverState.audio.currentSoundMode;

            // If trying to turn the subwoofer OFF, check if the sound mode allows it.
            if (isTurningOff && !SUBWOOFER_OPTIONAL_MODES.has(currentSoundMode)) {
                showToast(
                    `Cannot turn off subwoofer in "${currentSoundMode}" mode. Switch to a Stereo or Direct mode first.`,
                    { isError: true, duration: 6000 }
                );
                // Also flash the button to indicate an invalid action
                event.target.classList.add('command-failed');
                setTimeout(() => event.target.classList.remove('command-failed'), 600);
                return; // Stop further execution
            }
            const command = isTurningOff ? 'SUBWOOFER_OFF' : 'SUBWOOFER_ON';
            sendCommand(command, null, event.target); // No need to re-query, the status update will handle it.
        });
    }
}