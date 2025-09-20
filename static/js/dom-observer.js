/**
 * @module dom-observer
 * @description A powerful diagnostic tool to observe and log changes to a DOM element.
 */

/**
 * Creates a readable selector for a given DOM element for logging purposes.
 * @param {Node} node The DOM node.
 * @returns {string} A string representation like 'div#my-id.my-class'.
 */
function getNodeSelector(node) {
    if (!(node instanceof Element)) {
        return node.nodeName; // e.g., '#text'
    }
    const id = node.id ? `#${node.id}` : '';
    const classes = node.className ? `.${node.className.trim().replace(/\s+/g, '.')}` : '';
    return `${node.tagName.toLowerCase()}${id}${classes}`;
}

/**
 * Attaches a MutationObserver to a target element to log all changes to it and its children.
 * @param {Element} targetNode The DOM element to observe.
 */
export function observeAndLog(targetNode) {
    if (!targetNode) {
        console.error('[DOM Observer] Target node not found.');
        return;
    }

    console.log(`%c[DOM Observer] Now watching for all changes on ${getNodeSelector(targetNode)}`, 'color: #8A2BE2; font-weight: bold;');

    const observerOptions = {
        childList: true,      // Observe direct children being added or removed
        attributes: true,     // Observe attribute changes
        characterData: true,  // Observe text content changes
        subtree: true,        // Observe all descendants, not just direct children
        attributeOldValue: true, // Record the old value of attributes
        characterDataOldValue: true // Record the old value of text content
    };

    const observer = new MutationObserver((mutationsList, obs) => {
        for (const mutation of mutationsList) {
            const targetElementSelector = getNodeSelector(mutation.target);

            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    console.log(`%c[DOM Observer] Node ADDED: ${getNodeSelector(node)} to ${targetElementSelector}`, 'color: #228B22;');
                });
                mutation.removedNodes.forEach(node => {
                    console.log(`%c[DOM Observer] Node REMOVED: ${getNodeSelector(node)} from ${targetElementSelector}`, 'color: #DC143C;');
                });
            } else if (mutation.type === 'attributes') {
                const attributeName = mutation.attributeName;
                const oldValue = mutation.oldValue;
                const newValue = mutation.target.getAttribute(attributeName);
                console.log(
                    `%c[DOM Observer] Attribute '${attributeName}' on ${targetElementSelector} CHANGED from "${oldValue}" to "${newValue}"`,
                    'color: #0000CD;'
                );
            } else if (mutation.type === 'characterData') {
                const oldValue = mutation.oldValue;
                const newValue = mutation.target.textContent;
                console.log(
                    `%c[DOM Observer] Text in ${targetElementSelector} CHANGED from "${oldValue.trim()}" to "${newValue.trim()}"`,
                    'color: #FF8C00;'
                );
            }
        }
    });

    // Start observing the target node for configured mutations
    observer.observe(targetNode, observerOptions);

    // You can disconnect the observer later if needed by calling observer.disconnect();
}