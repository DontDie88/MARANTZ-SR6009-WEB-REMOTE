import { dom } from './dom.js';
import { receiverState, SOUND_MODE_GROUPS } from './state.js';
import { sendCommand } from './api.js';

/**
 * Creates and populates the sound mode sub-menu content.
 * @param {string} menuType - The type of menu to build ('surround' or 'pure').
 * @returns {HTMLElement|null} The populated content wrapper element, or null if invalid.
 */
function _createSubMenuContent(menuType) {
    const buttonsToShow = SOUND_MODE_GROUPS[menuType];
    if (!buttonsToShow) return null;

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'sound-mode-submenu-content';

    buttonsToShow.forEach(btnInfo => {
        const btn = document.createElement('button');
        btn.textContent = btnInfo.label;
        btn.dataset.command = btnInfo.command;
        btn.dataset.responseCode = btnInfo.responseCode;
        // Check if this button corresponds to the currently active sound mode.
        if (btnInfo.responseCode === receiverState.audio.currentSoundMode) {
            btn.classList.add('active');
        }
        contentWrapper.appendChild(btn);
    });

    return contentWrapper;
}

/**
 * Toggles the visibility and content of the sound mode sub-menu.
 * @param {string} menuType - The type of menu to open ('surround' or 'pure').
 * @param {HTMLElement} clickedButton - The main category button that was clicked.
 */
function toggleSoundModeSubMenu(menuType, clickedButton) {
    const isAlreadyOpen = receiverState.ui.activeSoundMenu === menuType;

    // First, clear any existing sub-menu content and active states.
    if (dom.soundMode.subMenuContainer) dom.soundMode.subMenuContainer.innerHTML = '';
    if (dom.soundMode.grid) {
        dom.soundMode.grid.querySelectorAll('button').forEach(btn => btn.classList.remove('active-category'));
    }

    if (isAlreadyOpen) {
        // If the same menu was clicked again, just close it.
        receiverState.ui.activeSoundMenu = null;
        if (dom.soundMode.subMenuContainer) dom.soundMode.subMenuContainer.classList.remove('is-open');
    } else {
        // If a new menu is being opened (or switching from another).
        // FIX: The state property was being set on the wrong object level.
        receiverState.ui.activeSoundMenu = menuType;
        clickedButton.classList.add('active-category');

        const contentWrapper = _createSubMenuContent(menuType);
        if (!contentWrapper || !dom.soundMode.subMenuContainer) return;

        dom.soundMode.subMenuContainer.appendChild(contentWrapper);

        // Use a tiny timeout to allow the DOM to update before adding the class
        // that triggers the CSS transition. This ensures the animation plays correctly.
        setTimeout(() => {
            if (dom.soundMode.subMenuContainer) dom.soundMode.subMenuContainer.classList.add('is-open');
            // Query the receiver for the current state to highlight the correct button.
            sendCommand('SOUND_MODE_QUERY');
        }, 10);
    }
}

/**
 * Sets up all event listeners related to the Sound Mode controls.
 * @param {object} socket - The active Socket.IO client instance.
 */
export function initializeSoundModes(socket) {
    socket.on('sound_mode_update', (data) => {
        console.log('Received sound_mode_update:', data);
        const newMode = data.mode;
        receiverState.audio.currentSoundMode = newMode;
        if (dom.status.soundMode) dom.status.soundMode.textContent = newMode;

        if (receiverState.ui.activeSoundMenu && dom.soundMode.subMenuContainer) {
            const subMenuButtons = dom.soundMode.subMenuContainer.querySelectorAll('button');
            subMenuButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.responseCode === newMode);
            });
        }
    });

    if (dom.soundMode.grid) {
        dom.soundMode.grid.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-menu-type]');
            if (button) {
                toggleSoundModeSubMenu(button.dataset.menuType, button);
            }
        });
    }

    if (dom.soundMode.subMenuContainer) {
        dom.soundMode.subMenuContainer.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-command]');
            if (button) {
                event.stopPropagation();
                sendCommand(button.dataset.command, null, button);
                setTimeout(() => sendCommand('SOUND_MODE_QUERY'), 250);
            }
        });
    }
}