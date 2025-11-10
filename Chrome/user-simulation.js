// Utility: simulate typing into a contenteditable by inserting characters with proper events.

function simulateTypingIntoContentEditable(el, text) {
    if (!el || !text) return;
    el.focus();

    // Place caret at end
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    // Type character-by-character to mimic real input
    for (const ch of text) {
        // Try execCommand insertText (deprecated but widely supported in contenteditable)
        const ok = document.execCommand('insertText', false, ch);
        if (!ok) {
            // Fallback: manual insertion
            const node = document.createTextNode(ch);
            const r = window.getSelection().getRangeAt(0);
            r.insertNode(node);
            // Move caret after inserted node
            r.setStartAfter(node);
            r.setEndAfter(node);
            sel.removeAllRanges();
            sel.addRange(r);
        }
        // Emit input event so frameworks react
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
    }
    // Final change event for good measure
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function simulatePaste(el, text) {
    // Select element
    const range = document.createRange();
    range.selectNodeContents(el);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Delay
    await new Promise(resolve => { setTimeout(resolve, 500); });

    // Create a fake clipboardData object
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);

    // Construct the paste event
    const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboardData
    });

    // Dispatch the event
    el.dispatchEvent(pasteEvent);
}

// Damit andere Content Scripts die Funktion nutzen können:
window.simulateTypingIntoContentEditable = simulateTypingIntoContentEditable;
window.simulatePaste = simulatePaste;
