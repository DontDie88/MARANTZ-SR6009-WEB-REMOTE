/**
 * A generic utility to update a DOM element's text content only if it has changed.
 * This is the core of the flicker-free update logic.
 * @param {string} id - The ID of the DOM element to update.
 * @param {string} newValue - The new text content for the element.
 */
export function updateIfChanged(id, newValue) {
    const el = document.getElementById(id);
    if (el && el.textContent.trim() !== newValue.trim()) {
        el.textContent = newValue;
    }
}

/**
 * Prevents page scrolling/zooming on mobile when a slider is being used.
 * @param {HTMLElement} sliderElement The slider input element.
 */
export function preventScrollOnSlider(sliderElement) {
    if (!sliderElement) return;
    // The { passive: false } option is crucial to allow preventDefault() to work on touch events.
    sliderElement.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
}

/**
 * Applies a temporary CSS animation class to an element to provide visual feedback on update.
 * @param {string} elementId The ID of the element to animate.
 * @param {string} animationClass The CSS class that contains the animation keyframes.
 */
export function triggerAnimation(elementId, animationClass) {
    const el = document.getElementById(elementId);
    if (el) {
        // Add the class to trigger the animation.
        el.classList.add(animationClass);
        // Set a listener to remove the class once the animation finishes.
        // This makes the animation re-triggerable on subsequent updates.
        el.addEventListener('animationend', () => el.classList.remove(animationClass), { once: true });
    }
}

/**
 * Conditionally applies a scrolling animation to a text element
 * only if its content overflows its container.
 * @param {HTMLElement | null} textElement The <span> element containing the text.
 */
export function updateMarqueeAnimation(textElement) {
    if (!textElement) return;
    const container = textElement.parentElement; // The .marquee-container
    if (!container) return;

    // The text content is set by `updateIfChanged` right before this is called.
    // So, `textContent` will always be the single, non-duplicated version.
    const originalText = textElement.textContent;

    // Check if the text's actual width is greater than the container's visible width
    const isOverflowing = textElement.scrollWidth > container.clientWidth;
    
    // Use a class on the container to control the animation state.
    container.classList.toggle('is-marquee-active', isOverflowing);

    if (isOverflowing) {
        // Duplicate the content for the seamless loop effect.
        textElement.innerHTML = `${originalText}&nbsp;&nbsp;&nbsp;${originalText}`;
    }
}

/**
 * Updates the visual fill of a slider's track based on its current value.
 * This is the core of the "glowing track" effect.
 * @param {HTMLInputElement} slider The slider element to update.
 */
export function updateSliderFill(slider) {
    if (!slider) return;
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const clampedVal = Math.max(min, Math.min(val, max));
    const percentage = ((clampedVal - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(90deg, var(--slider-glow-color) ${percentage}%, rgba(var(--button-color-rgb), 0.2) ${percentage}%)`;
}

/**
 * A reusable utility to update a slider's UI components in one call.
 * Sets the slider's value, updates its visual fill, and formats its label.
 * @param {object} config - The configuration object.
 * @param {HTMLInputElement} config.sliderEl - The slider DOM element.
 * @param {HTMLElement} [config.labelEl] - The optional label DOM element.
 * @param {string|number} config.value - The new value to set on the slider.
 * @param {function(string): string} [config.labelFormatter] - An optional function to format the label text.
 */
export function updateSliderUI({ sliderEl, labelEl, value, labelFormatter }) {
    if (!sliderEl) return;

    sliderEl.value = value;
    updateSliderFill(sliderEl);

    if (labelEl && labelFormatter) {
        labelEl.textContent = labelFormatter(value);
    }
}

/**
 * A classic debounce function.
 * @param {Function} func The function to debounce.
 * @param {number} delay The debounce delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * A generic, orientation-aware function to enable smooth dragging on sliders.
 * This internal function is the core logic for both vertical and horizontal sliders.
 * @param {object} config - The configuration object.
 * @param {HTMLElement} config.slider - The <input type="range"> element.
 * @param {HTMLElement} config.wrapper - The container element for the slider.
 * @param {'vertical'|'horizontal'} config.orientation - The slider's orientation.
 */
function _enableSmoothSlider({ slider, wrapper, orientation }) {
    if (!slider || !wrapper) return;

    const isVertical = orientation === 'vertical';

    const updateSliderFromEvent = (e) => {
        e.preventDefault();

        const rect = wrapper.getBoundingClientRect();
        const clientCoord = isVertical ? (e.touches ? e.touches[0].clientY : e.clientY) : (e.touches ? e.touches[0].clientX : e.clientX);

        let percentage;
        if (isVertical) {
            percentage = (rect.height - (clientCoord - rect.top)) / rect.height;
        } else {
            percentage = (clientCoord - rect.left) / rect.width;
        }
        percentage = Math.max(0, Math.min(1, percentage));

        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const step = parseFloat(slider.step);

        const rawValue = min + percentage * (max - min);
        const roundedValue = Math.round(rawValue / step) * step;

        if (slider.value != roundedValue) {
            slider.value = roundedValue;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    const stopDrag = () => {
        slider.dispatchEvent(new Event('change', { bubbles: true }));
        window.removeEventListener('mousemove', updateSliderFromEvent);
        window.removeEventListener('touchmove', updateSliderFromEvent);
        window.removeEventListener('mouseup', stopDrag);
        window.removeEventListener('touchend', stopDrag);
    };

    const startDrag = (e) => {
        // If the event target is the slider input itself, do nothing.
        // FIX: This check should only apply to mouse events ('mousedown'). For touch events,
        // we always want to initiate a drag, as the target is consistently the thumb.
        if (e.type === 'mousedown' && e.target === slider) {
            return;
        }

        // If we are here, the user clicked the track (the wrapper).
        // We want to jump the thumb to the click position and then initiate a drag.
        updateSliderFromEvent(e);
        window.addEventListener('mousemove', updateSliderFromEvent);
        window.addEventListener('touchmove', updateSliderFromEvent, { passive: false });
        window.addEventListener('mouseup', stopDrag);
        window.addEventListener('touchend', stopDrag);
    };

    wrapper.addEventListener('mousedown', startDrag);
    wrapper.addEventListener('touchstart', startDrag, { passive: false });
}

/**
 * Enhances a vertical slider for smooth touch and mouse dragging.
 * Allows users to click or drag anywhere on the slider track to set the value.
 * @param {HTMLElement} slider - The <input type="range"> element.
 * @param {HTMLElement} wrapper - The container element for the slider.
 */
export function enableSmoothVerticalSlider(slider, wrapper) {
    _enableSmoothSlider({ slider, wrapper, orientation: 'vertical' });
}

/**
 * Enhances a horizontal slider for smooth touch and mouse dragging.
 * @param {HTMLElement} slider - The <input type="range"> element.
 * @param {HTMLElement} wrapper - The container element for the slider.
 */
export function enableSmoothHorizontalSlider(slider, wrapper) {
    _enableSmoothSlider({ slider, wrapper, orientation: 'horizontal' });
}