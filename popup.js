// Stored settings key
const SETTINGS_KEY = 'settings';
const MONITORING_STATE_KEY = 'monitoringState';

// Load saved settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
    loadSavedSettings();
    updateMonitoringStatus();
});

// Save button click handler
document.getElementById('saveButton').addEventListener('click', saveSettings);

// Stop button click handler
document.getElementById('stopButton').addEventListener('click', stopMonitoring);

// Function to load saved settings
function loadSavedSettings() {
    chrome.storage.local.get([SETTINGS_KEY, MONITORING_STATE_KEY], (result) => {
        const settings = result[SETTINGS_KEY] || {
            selector: 'DIV.calendar-display-block > DIV > MAT-CALENDAR',
            targetColor: '#14a38b',
            targetTexts: []
        };
        
        document.getElementById('selector').value = settings.selector;
        document.getElementById('targetColor').value = settings.targetColor;
        document.getElementById('targetText').value = settings.targetTexts.join(', ');
    });
}

// Function to save settings
function saveSettings() {
    const selector = document.getElementById('selector').value.trim();
    const targetColor = document.getElementById('targetColor').value.trim();
    const targetTextInput = document.getElementById('targetText').value.trim();
    
    // Split the input by commas to handle multiple texts
    const targetTextsArray = targetTextInput.split(',').map(text => text.trim()).filter(text => text.length > 0).slice(0, 3); // Limit to 3 texts
    
    const settings = {
        selector: selector,
        targetColor: targetColor,
        targetTexts: targetTextsArray // Changed from targetText to targetTexts
    };

    // Validate settings
    if (!selector || !targetColor || targetTextsArray.length === 0) {
        showStatus('Please fill in all fields with valid values.', false);
        return;
    }

    // Save settings and monitoring state
    chrome.storage.local.set({
        [SETTINGS_KEY]: settings,
        [MONITORING_STATE_KEY]: true
    }, () => {
        // Notify content script
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'settingsUpdated',
                    settings: settings,
                    isMonitoring: true
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending message:', chrome.runtime.lastError.message);
                        showStatus('Failed to communicate with the content script. Make sure you are on a valid page.', false);
                        return;
                    }
                    console.log('Content script responded:', response.status);
                });
            } else {
                console.error('No active tab found.');
                showStatus('No active tab found to send settings.', false);
            }
        });
        
        showStatus('Settings saved successfully!', true);
        updateMonitoringStatus();
    });
}

// Function to stop monitoring
function stopMonitoring() {
    chrome.storage.local.set({
        [MONITORING_STATE_KEY]: false
    }, () => {
        // Notify content script
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'stopMonitoring'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending message:', chrome.runtime.lastError.message);
                        showStatus('Failed to communicate with the content script. Make sure you are on a valid page.', false);
                        return;
                    }
                    console.log('Content script responded:', response.status);
                });
            }
        });
        
        showStatus('Monitoring stopped.', true);
        updateMonitoringStatus();
    });
}

// Function to show status message
function showStatus(message, isSuccess) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + (isSuccess ? 'success' : 'error');
    setTimeout(() => {
        statusDiv.className = 'status';
        statusDiv.textContent = '';
    }, 4000); // Keep the message visible for 4 seconds
}

// Function to update monitoring status display
function updateMonitoringStatus() {
    chrome.storage.local.get(MONITORING_STATE_KEY, (result) => {
        const isMonitoring = result[MONITORING_STATE_KEY];
        const statusDiv = document.getElementById('monitoringStatus');
        if (isMonitoring) {
            statusDiv.textContent = '● Monitoring Active';
            statusDiv.className = 'monitoring-status monitoring-active';
        } else {
            statusDiv.textContent = '● Monitoring Stopped';
            statusDiv.className = 'monitoring-status monitoring-stopped';
        }
    });
}