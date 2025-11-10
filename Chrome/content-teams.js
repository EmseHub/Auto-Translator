// Injects a translate button into Teams, reads draft text, opens DeepL via background, and inserts the returned translation by simulated typing.

// Selectors (may change with Teams updates)
const INPUT_CHAT_SELECTOR = '[contenteditable="true"][aria-label="Nachricht eingeben"]';
const BTN_SEND_SELECTOR = '[data-tid="newMessageCommands-send"], [data-track-action-outcome="submit"]';
const BTN_INJECTED_ID = 'auto-translator-injected-btn';

let debounceTimer = null

// Create and inject button
function injectButton() {

    // Avoid duplicates
    if (document.getElementById(BTN_INJECTED_ID)) {
        console.log('### Button bereits vorhanden ###');
        return;
    }

    // Find a stable container near the input toolbar
    let toolbar = document.querySelector(BTN_SEND_SELECTOR)?.parentElement;
    if (!toolbar) {
        console.log('### Toolbar nicht gefunden ###');
        return;
        // alert('Toolbar nicht gefunden');
        toolbar = document.body;
    }

    const btn = document.createElement('button');
    btn.id = BTN_INJECTED_ID;
    // btn.textContent = 'Übersetzen';
    btn.style.cssText = `
    margin: 0 0 0 2px;
    padding: .6rem;
    width: 32px;
    height: 32px;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #f5f5f5;
    cursor: pointer;
  `;
    //     btn.style.cssText = `
    //     position: relative;
    //     margin-left: 8px;
    //     padding: 6px 10px;
    //     border-radius: 6px;
    //     border: 1px solid #ccc;
    //     background: #f5f5f5;
    //     color: #111;
    //     font-size: 12px;
    //     cursor: pointer;
    //     background: transparent;
    //   `;

    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('icons/icon_24.png');
    // img.src = 'https://file-examples.com/storage/fe23d83950691220297787e/2017/10/file_example_JPG_100kB.jpg';
    img.alt = 'Übersetzen';
    img.style.cssText = `   
    display: block;
    width: 100%;
    height: auto;
    object-fit: contain;
    max-height: 100%;
  `;
    //     img.style.cssText = `
    //     width: 24px;
    //     height: 24px;
    //     display: block;
    //   `;
    btn.appendChild(img);

    btn.addEventListener('click', onTranslateClick);
    toolbar.appendChild(btn);
}

async function onTranslateClick() {
    const inputChat = document.querySelector(INPUT_CHAT_SELECTOR);
    if (!inputChat) {
        console.log('### Chat-Eingabefeld nicht gefunden ###');
        return;
    }

    const text = getPlainText(inputChat).trim();
    if (!text) {
        console.log('### Kein Text zum Übersetzen gefunden ###');
        return;
    }

    // Detect language heuristically (optional). Here we set source=auto and target=en for example.
    const sourceLang = 'auto';
    const targetLang = 'de'; // Change target language as needed

    // Ask background to open DeepL tab and translate
    chrome.runtime.sendMessage(
        {
            type: 'OPEN_DEEPL_AND_TRANSLATE',
            text,
            sourceLang,
            targetLang,
        },
        (res) => {
            if (chrome.runtime.lastError) {
                alert('Fehler beim Öffnen von DeepL.');
                console.log('### Fehler beim Öffnen von DeepL ###');
                console.error(chrome.runtime.lastError);
                return;
            }

            if (!res?.ok) {
                console.log('### Konnte DeepL nicht öffnen ###');
                alert('Konnte DeepL nicht öffnen.');
            }
        }
    );
}

// Extract plain text from contenteditable
function getPlainText(el) {
    // Use innerText to preserve line breaks
    return el.innerText || el.textContent || '';
}

function clearContentEditable(el) {
    el.focus();
    // Select all content
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    // Delete
    document.execCommand('delete', false);
    el.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' })
    );
}

// Listen for translation result from background
chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'INSERT_TRANSLATION_IN_TEAMS') {
        const { translation } = msg.payload || {};

        console.log(`### Translation: "${translation}" ###`);
        if (!translation) {
            console.log('### Keine Übersetzung ###');
            return;
        }

        const input = document.querySelector(INPUT_CHAT_SELECTOR);
        if (!input) {
            console.log('### Chat-Input nicht gefunden ###');
            return;
        }

        // Clear existing content
        clearContentEditable(input);

        // Simulate typing translated text
        simulatePaste(input, translation).then(() => { });
        return;

        // Simulate typing translated text
        simulateTypingIntoContentEditable(input, translation);
    }
});

// Observe DOM and inject when compose box appears
const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { injectButton(); }, 1000); // 1 Sekunde Ruhezeit
});

// Attempt immediate injection
setTimeout(() => {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    injectButton();
}, 5000);

