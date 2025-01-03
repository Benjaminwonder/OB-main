// Add Pushbullet configuration
const PUSHBULLET_API_KEY = 'o.I5EP4O5c1Prp43Qb5IvBalV3XFFWf5qS'; // Replace with your access token
const PUSHBULLET_API_URL = 'https://api.pushbullet.com/v2/pushes';

// Handle extension installation or update
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        settings: {
            selector: 'DIV.calander-display-block > DIV > MAT-CALENDAR',
            targetColor: '#14a38b',
            targetText: ''
        },
        monitoringState: false,
        lastNotificationTime: 0
    });
});

// Function to send Pushbullet notification
async function sendPushbulletNotification(title, message) {
    try {
        const response = await fetch(PUSHBULLET_API_URL, {
            method: 'POST',
            headers: {
                'Access-Token': PUSHBULLET_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'note',
                title: title,
                body: message
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Pushbullet notification sent:', data);
        return true;
    } catch (error) {
        console.error('Error sending Pushbullet notification:', error);
        return false;
    }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'notification') {
        // Check if monitoring is active
        chrome.storage.local.get(['monitoringState', 'lastNotificationTime'], async (result) => {
            if (!result.monitoringState) {
                console.log('Monitoring is stopped, not sending notification');
                return;
            }

            // Prevent notification spam
            const now = Date.now();
            const timeSinceLastNotification = now - (result.lastNotificationTime || 0);
            const MIN_NOTIFICATION_INTERVAL = 5000; // 5 seconds

            if (timeSinceLastNotification < MIN_NOTIFICATION_INTERVAL) {
                console.log('Too soon for another notification');
                return;
            }

            // Update last notification time
            chrome.storage.local.set({ lastNotificationTime: now });

            // Send both Chrome and Pushbullet notifications
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon48.png',
                title: 'DATE IS AVAILABLE!',
                message: message.message || 'A matching date has been found!',
                priority: 2
            });

            // Send Pushbullet notification with details
            await sendPushbulletNotification(
                'SUSPECT DETECTED!',
                `Match found!\nText: ${message.details.text}\nURL: ${message.details.url}`
            );
        });
    }
    return true;
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.notifications.clear(notificationId);
});