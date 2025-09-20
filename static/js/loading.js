import { dom } from './dom.js';
import { initialSyncState } from './state.js';

let hideSpinnerTimeout = null;

/**
 * Shows the loading spinner and sets a safety timeout to hide it.
 */
export function showLoadingSpinner() {
    if (dom.loading.overlay) {
        console.log('Showing loading spinner.');
        dom.loading.overlay.classList.add('is-loading');
    }
    // Safety timeout to hide the spinner after a few seconds if a response is missed.
    if (hideSpinnerTimeout) clearTimeout(hideSpinnerTimeout);
    hideSpinnerTimeout = setTimeout(() => {
        console.log('Hiding spinner due to safety timeout.');
        hideLoadingSpinner();
    }, 5000); // 5-second timeout
}

/**
 * Hides the loading spinner and clears any pending safety timeout.
 */
export function hideLoadingSpinner() {
    if (hideSpinnerTimeout) clearTimeout(hideSpinnerTimeout);
    if (dom.loading.overlay) {
        dom.loading.overlay.classList.remove('is-loading');
    }
}

/**
 * Checks if all critical initial statuses have been received and hides the spinner if so.
 */
export function checkInitialSyncComplete() {
    // The spinner should hide only when the set of required states is empty.
    if (initialSyncState.size === 0) {
        console.log('Initial sync complete. Hiding loading spinner.');
        hideLoadingSpinner();
    }
}