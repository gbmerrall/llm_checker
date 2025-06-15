// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const messageDiv = document.getElementById('message');

    // Function to update the popup message
    function updateMessage(type, domain = '') {
        messageDiv.classList.remove('found', 'not-found', 'default');
        if (type === "LLMS_FOUND") {
            messageDiv.textContent = `LLMs.txt was found on ${domain}!`;
            messageDiv.classList.add('found');
        } else if (type === "NO_CHECK_PERFORMED") {
            messageDiv.textContent = "No check was performed on this domain yet, or LLMs.txt was not found.";
            messageDiv.classList.add('not-found');
        } else { // Default or initial state
            messageDiv.textContent = "Click on a tab to check for LLMs.txt...";
            messageDiv.classList.add('default');
        }
    }

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "LLMS_FOUND") {
            updateMessage(message.type, message.domain);
        }
    });

    // When the popup is opened, try to get the status of the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0] && tabs[0].url) {
            try {
                const url = new URL(tabs[0].url);
                const rootDomain = url.hostname;
                const storageKey = `checkedDomain_${rootDomain}`;
                const storedData = await chrome.storage.local.get(storageKey);

                if (storedData[storageKey]) {
                    // If we've checked it before, let's assume it was found if LLMS_FOUND message was received recently.
                    // This is a bit tricky with just the popup. A better approach might be to store the *result* in storage.
                    // For now, if it was checked, we'll show a generic message unless a "found" message just came in.
                    updateMessage("NO_CHECK_PERFORMED"); // Default for now
                } else {
                    updateMessage("NO_CHECK_PERFORMED"); // Haven't checked this domain yet
                }
            } catch (e) {
                updateMessage("NO_CHECK_PERFORMED"); // Invalid URL or other error
            }
        }
    });

    // Improvement: We can ask the background script directly for the status of the current tab
    // when the popup is opened. This is more robust than relying on the message listener alone.
    // For now, the existing message listener will update it when LLMs.txt is found.
    // A more advanced popup might actively query the background script for the last known status.
});