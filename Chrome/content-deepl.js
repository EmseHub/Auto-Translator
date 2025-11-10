// Interacts with deepl.com to insert source text, wait for translation, and send it back.
// Note: DeepL's DOM can change; selectors here are written defensively.

// Signal readiness to background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'PING') {
        sendResponse({ ok: true });
        return true;
    }

    if (msg?.type === 'DEEPL_TRANSLATE') {
        const { text, sourceLang = 'auto', targetLang = 'de', teamsTabId } = msg.payload || {};
        translateText(text, sourceLang, targetLang, teamsTabId);
    }
});

async function translateText(text, sourceLang, targetLang, teamsTabId) {
    // Try to locate source input (DeepL has used textareas and contenteditable divs over time)
    const sourceEl = await findSourceInput();
    const targetEl = await findTargetOutput();

    if (!sourceEl) {
        console.warn('### DeepL Quelleingabe nicht gefunden ###');
        return;
    }

    // Focus and clear source
    clearField(sourceEl);

    // Type the text into source
    simulateTypingIntoContentEditable(sourceEl, text);

    // Trigger language selection via URL hash if present; otherwise rely on auto-detect
    // DeepL usually auto-translates after typing; we just wait for target to fill.
    const translation = await waitForTranslation(targetEl);

    chrome.runtime.sendMessage({
        type: 'DEEPL_TRANSLATION_RESULT',
        payload: { translation, teamsTabId }
    });
}

async function attemptDomQuery(selector, options = {}) {
    const { maxAttempts = 10, interval = 300 } = options;

    let attempt = 0;
    while (attempt < maxAttempts) {
        const el = document.querySelector(selector);
        if (el) return el;
        attempt++;
        await new Promise(resolve => { setTimeout(resolve, interval); });
    }
    return null;
}


async function findSourceInput() {

    const sourceInputElement = await attemptDomQuery('[contenteditable="true"][aria-labelledby="translation-source-heading"]');
    return sourceInputElement;

    // Heuristics: try known selectors and fallbacks
    // Older: textarea.lmt__source_textarea
    let el =
        document.querySelector('textarea.lmt__source_textarea') ||
        document.querySelector('[data-testid="translator-source-input"]') ||
        document.querySelector('[data-qa="translator-source-input"]') ||
        document.querySelector('[aria-label*="Source"]') ||
        document.querySelector('[aria-label*="Textquelle"]');

    // If not textarea, ensure contenteditable role
    if (!el) {
        el = document.querySelector('[contenteditable="true"]');
    }
    return el || null;
}

async function findTargetOutput() {

    const targetOutputElement = await attemptDomQuery('[data-testid="translator-target-input"]');
    return targetOutputElement;

    // Older: textarea.lmt__target_textarea
    let el =
        document.querySelector('textarea.lmt__target_textarea') ||
        document.querySelector('[data-testid="translator-target-input"]') ||
        document.querySelector('[data-qa="translator-target-input"]') ||
        document.querySelector('[aria-label*="Translation"]') ||
        document.querySelector('[aria-label*="Übersetzung"]');

    // Newer DeepL uses contenteditable outputs
    if (!el) {
        // DeepL often renders segments inside divs; pick the main target container
        el = document.querySelector('[data-testid="translator-target"]') || document.querySelector('[data-qa="translator-target"]');
    }
    return el || null;
}

function clearField(el) {
    el.focus();

    // Select all and delete
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('delete', false);

    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
}

// Wait for translation: poll target element text until non-empty and stable
function waitForTranslation(targetEl, timeoutMs = 15000) {
    return new Promise((resolve) => {
        const start = Date.now();
        let last = '';

        const tick = () => {
            const now = Date.now();
            const text = readTargetText(targetEl).trim();

            if (text && text === last) {
                // Stable for one cycle → accept
                return resolve(text);
            }

            last = text;

            if (now - start > timeoutMs) {
                // Timeout → return whatever we have (might be empty)
                return resolve(text || '');
            }

            setTimeout(tick, 400);
        };

        tick();
    });
}

function readTargetText(el) {
    if (!el) return '';
    // Prefer innerText to keep line breaks
    return el.innerText || el.textContent || '';
}