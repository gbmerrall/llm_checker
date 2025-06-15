// background.js

const checkedDomainsSession = new Set();

async function checkAndNotify(tab, forceCheck = false) {
    if (!tab.url || !(new URL(tab.url).protocol.startsWith('http'))) {
        return;
    }

    try {
        const url = new URL(tab.url);
        const rootDomain = url.hostname;
        const storageKey = `checkedDomain_${rootDomain}`;

        if (!forceCheck && (checkedDomainsSession.has(rootDomain) || (await chrome.storage.local.get(storageKey))[storageKey])) {
            console.log(`Domain ${rootDomain} already checked. Skipping.`);
            return;
        }

        const llmsTxtUrl = `${url.protocol}//${rootDomain}/llms.txt`;
        console.log(`Attempting to check: ${llmsTxtUrl}`);

        try {
            const response = await fetch(llmsTxtUrl, { method: 'HEAD' });
            if (response.ok) { // Status codes 200-299
                const contentType = response.headers.get('Content-Type');
                if (contentType && contentType.startsWith('text/plain')) {
                    console.log(`llms.txt found on ${rootDomain} (Content-Type: ${contentType})!`);
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icons/icon_48.png',
                        title: 'llms.txt Found!',
                        message: `The file /llms.txt exists on ${rootDomain}.`
                    });

                    checkedDomainsSession.add(rootDomain);
                    await chrome.storage.local.set({ [storageKey]: true });
                } else {
                    console.log(`Found a resource at ${llmsTxtUrl} but Content-Type is not text/plain (it's: ${contentType}).`);
                    checkedDomainsSession.add(rootDomain);
                    await chrome.storage.local.set({ [storageKey]: true });
                    // Optionally, you might choose not to notify in this case.
                }

            } else if (response.status === 404 || response.status === 403) {
                console.log(`llms.txt not found (${response.status}) on ${rootDomain}.`);
                checkedDomainsSession.add(rootDomain);
                await chrome.storage.local.set({ [storageKey]: true });
            } else {
                console.log(`Unexpected status ${response.status} when checking ${llmsTxtUrl}`);
                checkedDomainsSession.add(rootDomain);
                await chrome.storage.local.set({ [storageKey]: true });
            }
        } catch (fetchError) {
            console.error(`Workspace error for ${llmsTxtUrl}:`, fetchError);
            checkedDomainsSession.add(rootDomain);
            await chrome.storage.local.set({ [storageKey]: true });
        }

    } catch (e) {
        console.error("Error processing URL:", e);
    }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        checkAndNotify(tab);
    }
});

// Listen for tab activation (switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab) {
            checkAndNotify(tab);
        }
    });
});

// Create context menu items when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "clearData",
        title: "Clear Checked Domains",
        contexts: ["action"]
    });
    chrome.contextMenus.create({ // New context menu item
        id: "forceCheck",
        title: "Force Check Current Site",
        contexts: ["action"]
    });
});

// Handle clicks on context menu items
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "clearData") {
        chrome.storage.local.clear(() => {
            console.log("Persistent data cleared.");
            checkedDomainsSession.clear();
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon_48.png',
                title: 'Data Cleared',
                message: 'The list of checked domains has been cleared.'
            });
        });
    } else if (info.menuItemId === "forceCheck") { // Handle the force check
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0) {
                checkAndNotify(tabs[0], true); // Call checkAndNotify with forceCheck set to true
            }
        });
    }
});