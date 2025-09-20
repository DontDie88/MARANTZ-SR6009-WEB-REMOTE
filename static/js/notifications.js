/**
 * @module notifications
 * @description Manages the creation and display of toast notifications.
 */

// --- REFACTORED: Module-level state for a single, reusable toast element ---
// This ensures only one toast is on screen at a time.
let activeToastElement = null;
let activeToastTimer = null;
let toastDisplayTimestamp = 0; // Tracks when the current toast was made visible.
/**
 * Finds or creates the main notification container element.
 * This is done lazily to ensure it's only created when first needed.
 * @returns {HTMLElement} The notification container element.
 */
function getNotificationContainer() {
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Displays a toast notification with a specified message and options.
 * This function now manages a single toast element, updating it if it's already visible.
 *
 * @param {string} message The text message to display in the toast.
 * @param {object} [options={}] Configuration options for the toast.
 * @param {boolean} [options.isError=false] - If true, styles the toast as an error.
 * @param {boolean} [options.isSuccess=false] If true, applies the 'success' style.
 * @param {number} [options.duration=3000] The time in milliseconds the toast is visible.
 */
export function showToast(message, options = {}) {
    const { isError = false, isSuccess = false, duration = 3000 } = options;
    const container = getNotificationContainer();
    const FADE_DURATION_MS = 400; // Must match the transition duration in CSS.
    const MIN_DURATION_MS = 5000; // Minimum display time for any toast.

    const now = Date.now();
    const elapsedSinceDisplay = now - toastDisplayTimestamp;
    const isToastVisible = activeToastElement && activeToastElement.classList.contains('show');

    // If a toast is currently visible and hasn't met its minimum display time,
    // schedule this new toast to appear after the remaining time has passed.
    if (isToastVisible && elapsedSinceDisplay < MIN_DURATION_MS) {
        const delay = MIN_DURATION_MS - elapsedSinceDisplay;
        setTimeout(() => showToast(message, options), delay);
        return; // Exit, letting the scheduled call handle the display.
    }

    // --- Dynamic Positioning Logic ---
    // Calculate the center of the current viewport relative to the document.
    const viewportCenterY = window.scrollY + (window.innerHeight / 2);
    // Position the container 150px below the center.
    const desiredTop = viewportCenterY + 150;
    container.style.top = `${desiredTop}px`;

    // Clear any pending removal timer for the previous toast.
    if (activeToastTimer) {
        clearTimeout(activeToastTimer);
    }

    // If there's no active toast element, create it.
    if (!activeToastElement) {
        activeToastElement = document.createElement('div');
        activeToastElement.className = 'toast';
        container.appendChild(activeToastElement);
    }

    // Function to update the toast's content and fade it in.
    const updateAndShow = () => {
        activeToastElement.textContent = message;
        // Reset styles before applying new ones.
        activeToastElement.classList.remove('error', 'success');
        if (isError) activeToastElement.classList.add('error');
        if (isSuccess) activeToastElement.classList.add('success');
        // Trigger the fade-in animation.
        activeToastElement.classList.add('show');
        // Record the time this toast became visible.
        toastDisplayTimestamp = Date.now();
    };

    // If the toast is already visible, fade it out first before updating.
    if (activeToastElement.classList.contains('show')) {
        activeToastElement.classList.remove('show');
        // Wait for the fade-out transition to complete.
        setTimeout(updateAndShow, FADE_DURATION_MS);
    } else {
        // If the toast is new or hidden, update and show it immediately.
        updateAndShow();
    }

    // Ensure the toast stays for at least the minimum duration.
    const finalDuration = Math.max(duration, MIN_DURATION_MS);

    // Set a new timer to hide and then remove the toast element.
    activeToastTimer = setTimeout(() => {
        if (activeToastElement) {
            activeToastElement.classList.remove('show');
            // After the fade-out, remove the element from the DOM and clear the reference.
            setTimeout(() => {
                if (activeToastElement) {
                    activeToastElement.remove();
                    activeToastElement = null;
                }
            }, FADE_DURATION_MS);
        }
    }, finalDuration);
}