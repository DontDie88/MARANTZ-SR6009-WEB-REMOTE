import { dom } from './dom.js';
import { receiverState } from './state.js';
import { debounce } from './utils.js';

let updateDynamicDisplayCallback = () => {};

/**
 * A set of commands that constitute OSD navigation.
 * Defined once at the module level for efficiency.
 */
const OSD_NAV_COMMANDS = new Set([
    'OSD_UP', 'OSD_DOWN', 'OSD_LEFT', 'OSD_RIGHT', 'OSD_ENTER', 'OSD_RETURN', 'OSD_MENU_TOGGLE'
]);

/**
 * Dynamically adjusts the height of the OSD frame to perfectly fit its content.
 * This is called after the OSD content (title, list, pagination) has been updated.
 */
function updateOsdFrameSize() {
    // This function is currently not implemented as the frame is causing rendering issues.
}

/**
 * Hides the Virtual OSD, clears its content, and resets its state.
 * This is now the single source of truth for tearing down the OSD.
 */
function hideOsd() {
    if (receiverState.ui.osd.isVisible) {
        console.log('OSD hide requested. Updating state and triggering animation.');

        // 1. Clear the auto-hide timer to prevent it from firing again.
        if (receiverState.ui.osd.autoHideTimeout) {
            clearTimeout(receiverState.ui.osd.autoHideTimeout);
            receiverState.ui.osd.autoHideTimeout = null;
        }

        // 2. Update state and tell the master controller to handle the fade-out.
        // The content is now cleared only when a new menu is built.
        receiverState.ui.osd.isVisible = false;
        updateDynamicDisplayCallback();
    }
}

/**
 * Resets the auto-hide timer for the OSD. Call this whenever there's OSD-related activity.
 */
function resetOsdAutoHideTimer() {
    // Clear any existing timer
    if (receiverState.ui.osd.autoHideTimeout) {
        clearTimeout(receiverState.ui.osd.autoHideTimeout);
    }
    // Set a new timer to hide the OSD after 10 seconds of inactivity
    receiverState.ui.osd.autoHideTimeout = setTimeout(hideOsd, 10000);
}

/**
 * Sets up all WebSocket event listeners related to the Virtual OSD.
 * @param {object} socket - The active Socket.IO client instance.
 */
export function initializeOsd(socket, callback) {
    updateDynamicDisplayCallback = callback;

    socket.on('osd_title_update', (data) => {
        console.log('Received osd_title_update:', data);
        if (!dom.osd.title) return;
 
        const newTitle = data.text.trim();
        if (!newTitle) return; // Ignore empty titles
 
        if (newTitle === 'Now Playing') {
            console.log('Ignoring "Now Playing" title update to prevent OSD race condition.');
            if (receiverState.ui.osd.isVisible) hideOsd();
            return;
        }
 
        // If the title has changed, it's a new menu screen.
        // This is the ONLY place we should clear the menu list.
        if (newTitle !== receiverState.ui.osd.currentTitle) {
            console.log(`OSD screen changed to "${newTitle}". Clearing list.`);

            // If the OSD is not visible, this is the first event for a new screen.
            if (!receiverState.ui.osd.isVisible) {
                receiverState.ui.osd.isVisible = true;
                updateDynamicDisplayCallback(); // Make the container visible.
            }
            if (dom.osd.menuList) dom.osd.menuList.innerHTML = '';
            dom.osd.title.textContent = newTitle;
            receiverState.ui.osd.currentTitle = newTitle;
        }
 
        resetOsdAutoHideTimer();
    });
 
    socket.on('osd_menu_item_update', (data) => {
        console.log('Received osd_menu_item_update:', data);
        if (!dom.osd.menuList) return;
 
        // If the OSD is not visible, this is the first event. Show it.
        if (!receiverState.ui.osd.isVisible) {
            receiverState.ui.osd.isVisible = true;
            updateDynamicDisplayCallback();
        }

        // Find if an item for this line already exists to update it, or create it.
        let li = dom.osd.menuList.querySelector(`li[data-line="${data.line}"]`);
        if (!li) {
            li = document.createElement('li');
            li.dataset.line = data.line;

            // --- FLICKER FIX: Smart Insertion ---
            // Instead of re-sorting the whole list, insert the new item in the correct position.
            const allItems = dom.osd.menuList.querySelectorAll('li');
            let nextSibling = null;
            for (const item of allItems) {
                if (parseInt(item.dataset.line) > data.line) {
                    nextSibling = item;
                    break;
                }
            }
            if (nextSibling) {
                dom.osd.menuList.insertBefore(li, nextSibling);
            } else {
                dom.osd.menuList.appendChild(li);
            }
        }
 
        // Check if the text content has actually changed to avoid unnecessary DOM updates.
        const currentText = li.querySelector('span')?.textContent || li.textContent;
        const hasTextChanged = currentText !== data.text;

        if (hasTextChanged) {
            // Set the initial, single text content to measure it.
            li.innerHTML = `<span>${data.text}</span>`;
        }

        li.classList.toggle('is-selected', data.is_selected);
 
        if (hasTextChanged) {
            li.classList.remove('animate-fade-in');
            void li.offsetWidth; // Trigger reflow to restart animation
            li.classList.add('animate-fade-in');
        }
 
        // Check for marquee text after a brief delay to allow rendering.
        const span = li.querySelector('span');
        if (span) {
            setTimeout(() => {
                const isOverflowing = span.scrollWidth > li.clientWidth;
                li.classList.toggle('is-scrolling', isOverflowing);
                if (isOverflowing) {
                    // Duplicate the content for the seamless loop, adding a visual gap.
                    span.innerHTML = `${data.text}&nbsp;&nbsp;&nbsp;${data.text}`;
                }
            }, 50);
        }

        resetOsdAutoHideTimer();
    });

    socket.on('station_info_update', (data) => {
        console.log('Received station_info_update:', data);
        if (dom.osd.stationInfo) {
            dom.osd.stationInfo.textContent = data.text;
            resetOsdAutoHideTimer();
        }
    });
}

/**
 * Handles OSD-related navigation commands to keep the display active.
 * @param {string} command - The command name sent from a button click.
 */
export function handleOsdNavCommand(command) {
    // This set must match the OSD_NAV_COMMANDS set in ui.js to correctly identify
    // navigation events and reset the auto-hide timer.
    if (OSD_NAV_COMMANDS.has(command) && receiverState.ui.osd.isVisible) {
        resetOsdAutoHideTimer();
    }
}