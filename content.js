// content.js

// Debugging helper
console.log('Content script loaded');

// Global variables
let settings = null;
let observer = null;
let isMonitoring = false;

// New global variable for notification interval
let notificationInterval = null;

// Helper function to convert hex to RGB with improved debugging
function hexToRgb(hex) {
    if (!hex) {
        console.log('Invalid hex color:', hex);
        return null;
    }
    hex = hex.replace('#', '');

    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        console.log('Failed to parse hex color:', hex);
        return null;
    }

    const rgb = {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    };

    console.log('Converted color:', { hex, rgb });
    return rgb;
}

// Helper function to check if colors are similar with tighter tolerance
function isColorSimilar(color1, color2) {
    if (!color1 || !color2) {
        console.log('Invalid color comparison inputs:', { color1, color2 });
        return false;
    }

    // Calculate Euclidean distance between colors
    const rDiff = color1.r - color2.r;
    const gDiff = color1.g - color2.g;
    const bDiff = color1.b - color2.b;

    const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
    const maxDistance = 50; // Approximately 20% difference

    const isSimilar = distance <= maxDistance;

    console.log('Color comparison:', {
        color1,
        color2,
        distance,
        isSimilar
    });

    return isSimilar;
}

// Convert RGB/RGBA to Hex with improved validation
function convertToHex(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
    if (color.startsWith('#')) return color.toLowerCase();

    try {
        let rgb = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        let rgba = color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)$/);
        let values = rgb || rgba;

        if (!values) {
            console.log('Unparseable color:', color);
            return null;
        }

        const hex = '#' + values.slice(1, 4).map(x => {
            const hexPart = parseInt(x).toString(16);
            return hexPart.length === 1 ? '0' + hexPart : hexPart;
        }).join('').toLowerCase();

        console.log('Color conversion:', { original: color, hex });
        return hex;
    } catch (error) {
        console.error('Color conversion error:', error);
        return null;
    }
}

// Function to check if element contains any of the target texts
function containsTargetText(element, targetTexts) {
    const rawText = element.innerText || element.textContent || '';
    const cleanText = rawText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(' ');

    // Check if any of the target texts are present
    const hasTargetText = targetTexts.some(targetText => cleanText.toLowerCase().includes(targetText.toLowerCase()));

    if (hasTargetText) {
        console.log('One of the target texts found:', cleanText);
    }

    return hasTargetText;
}

// Function to recursively search for target color within element's subtree
function containsTargetColor(element, targetRGB) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, null, false);
    let currentNode = walker.currentNode;

    while (currentNode) {
        const style = window.getComputedStyle(currentNode);
        const colorsToCheck = [
            style.backgroundColor,
            style.color,
            style.borderColor,
            style.fill,
            style.stroke
        ];

        for (const color of colorsToCheck) {
            const convertedHex = convertToHex(color);
            if (convertedHex) {
                const currentRGB = hexToRgb(convertedHex);
                if (isColorSimilar(targetRGB, currentRGB)) {
                    console.log(`Target color found in element:`, currentNode);
                    return true;
                }
            }
        }

        currentNode = walker.nextNode();
    }

    return false;
}

// Function to check if element contains target color
function containsColorInSubtree(element, targetRGB) {
    return containsTargetColor(element, targetRGB);
}

// Function to check a single element for both text and color
const checkSingleElement = (el) => {
    const hasTargetText = containsTargetText(el, settings.targetTexts);
    if (!hasTargetText) {
        return { hasTargetColor: false, hasTargetText: false };
    }

    const targetRGB = hexToRgb(settings.targetColor);
    if (!targetRGB) {
        console.log('Invalid target RGB:', settings.targetColor);
        return { hasTargetColor: false, hasTargetText: false };
    }

    const hasTargetColor = containsColorInSubtree(el, targetRGB);

    return { hasTargetColor, hasTargetText };
};

// Function to send notification
function notifyMatch(element) {
    console.log('Sending notification for match:', {
        tag: element.tagName,
        id: element.id,
        classes: element.className,
        text: element.innerText || element.textContent,
        url: window.location.href,
        timestamp: new Date().toISOString()
    });

    chrome.runtime.sendMessage({
        type: 'notification',
        message: 'Match found!',
        details: {
            element: element.tagName,
            text: element.innerText || element.textContent,
            url: window.location.href,
            timestamp: new Date().toISOString()
        }
    });
}

// Function to check an element and its children
function checkElement(element) {
    if (!settings || !settings.targetColor || !settings.targetTexts || !isMonitoring) {
        return false;
    }

    try {
        console.log('\nChecking element:', {
            tag: element.tagName,
            id: element.id,
            classes: element.className
        });

        const result = checkSingleElement(element);

        if (result.hasTargetColor && result.hasTargetText) {
            if (!notificationInterval) { // Prevent multiple intervals
                console.log('Match found with both conditions! Starting notification loop.');
                notifyMatch(element); // Send initial notification immediately

                // Start the notification loop every 4 seconds
                notificationInterval = setInterval(() => {
                    notifyMatch(element);
                }, 4000); // 4000 milliseconds = 4 seconds
            } else {
                console.log('Notification loop is already active.');
            }
        } else {
            console.log('Conditions not met. hasTargetColor:', result.hasTargetColor, 'hasTargetText:', result.hasTargetText);
        }

        // Check children if no match found
        for (const child of element.children) {
            if (checkElement(child)) {
                return true;
            }
        }

        return false;

    } catch (error) {
        console.error('Error checking element:', error);
        return false;
    }
}

// Set up the observer to monitor the entire document body
function setupObserver() {
    if (observer) {
        observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
        if (!isMonitoring) return;

        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node;
                    if (element.matches(settings.selector)) {
                        console.log('Target element added:', element);
                        checkElement(element);
                    }
                    const nestedElements = element.querySelectorAll(settings.selector);
                    nestedElements.forEach(nestedEl => {
                        console.log('Nested target element added:', nestedEl);
                        checkElement(nestedEl);
                    });
                }
            });
        });
    });

    // Observe the entire document body for additions
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('MutationObserver is now observing the document body for target elements.');
}

// Initialize settings and monitoring state
chrome.storage.local.get(['settings', 'monitoringState'], (result) => {
    settings = result.settings;
    isMonitoring = result.monitoringState;
    if (settings) {
        // Validate targetColor format
        if (!/^#([0-9A-F]{3}){1,2}$/i.test(settings.targetColor)) {
            console.error('Invalid targetColor format. Expected HEX format (#RRGGBB). Found:', settings.targetColor);
            return;
        }

        // Ensure targetTexts is an array with up to three texts
        if (!Array.isArray(settings.targetTexts)) {
            console.error('Invalid targetTexts format. Expected an array of texts.');
            settings.targetTexts = [];
        } else if (settings.targetTexts.length === 0) {
            console.error('No target texts provided.');
        } else if (settings.targetTexts.length > 3) {
            console.warn('More than three target texts provided. Only the first three will be used.');
            settings.targetTexts = settings.targetTexts.slice(0, 3);
        }

        console.log('Settings loaded:', settings);
        setupObserver();
    } else {
        console.log('No settings found.');
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'settingsUpdated') {
        settings = message.settings;
        isMonitoring = true;

        // Validate targetColor format
        if (!/^#([0-9A-F]{3}){1,2}$/i.test(settings.targetColor)) {
            console.error('Invalid targetColor format in settingsUpdated. Expected HEX format (#RRGGBB). Found:', settings.targetColor);
            sendResponse({ status: 'Invalid targetColor format' });
            return;
        }

        // Ensure targetTexts is an array with up to three texts
        if (!Array.isArray(settings.targetTexts)) {
            console.error('Invalid targetTexts format. Expected an array of texts.');
            settings.targetTexts = [];
        } else if (settings.targetTexts.length === 0) {
            console.error('No target texts provided.');
        } else if (settings.targetTexts.length > 3) {
            console.warn('More than three target texts provided. Only the first three will be used.');
            settings.targetTexts = settings.targetTexts.slice(0, 3);
        }

        console.log('Settings updated:', settings);
        setupObserver();
        sendResponse({ status: 'Settings updated' });
    } else if (message.type === 'stopMonitoring') {
        isMonitoring = false;
        if (observer) {
            observer.disconnect();
            observer = null;
            console.log('MutationObserver disconnected.');
        }
        if (notificationInterval) {
            clearInterval(notificationInterval);
            notificationInterval = null;
            console.log('Notification loop stopped.');
        }
        sendResponse({ status: 'Monitoring stopped' });
    }
    return true;
});

// Remove or comment out the periodic check as it's now handled by MutationObserver
/*
setInterval(() => {
    if (!isMonitoring || !settings?.selector) return;
    
    const elements = document.querySelectorAll(settings.selector);
    if (elements.length > 0) {
        elements.forEach(checkElement);
    }
}, 1000);
*/

console.log('Content script initialization complete');