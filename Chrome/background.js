let deeplTabId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'OPEN_DEEPL_AND_TRANSLATE') {
        const teamsTabId = sender.tab?.id;
        console.log('teamsTabId: ' + teamsTabId);

        const { text, sourceLang = 'auto', targetLang = 'de' } = msg;

        const deeplUrl = 'https://www.deepl.com/de/translator/l/' + sourceLang + '/' + targetLang;

        chrome.tabs.create({ url: deeplUrl, active: true }).then((tab) => {
            deeplTabId = tab.id;

            // Wait for the DeepL content script to be ready, then send the text
            const waitForDeepL = async () => {
                try {
                    await chrome.tabs.sendMessage(deeplTabId, { type: 'PING' });
                    // Ready – send translate command
                    await chrome.tabs.sendMessage(deeplTabId, {
                        type: 'DEEPL_TRANSLATE',
                        payload: { text, sourceLang, targetLang, teamsTabId }
                    });
                } catch {
                    setTimeout(waitForDeepL, 500);
                }
            };
            waitForDeepL();

            sendResponse({ ok: true });
        });
        return true;
    }

    if (msg?.type === 'DEEPL_TRANSLATION_RESULT') {
        // Relay translation back to Teams tab (sender could be DeepL)
        const { translation, teamsTabId } = msg.payload || {};
        if (!translation || !teamsTabId) return;

        // Send to Teams content script
        chrome.tabs.sendMessage(teamsTabId, {
            type: 'INSERT_TRANSLATION_IN_TEAMS',
            payload: { translation }
        }).then(() => {
            // Close DeepL tab if we opened it
            if (deeplTabId !== null) {
                chrome.tabs.remove(deeplTabId).then(() => { deeplTabId = null; });
            }
        }).catch((err) => {
            // Silently ignore; Teams might have navigated
        });
        return true;
    }
});
