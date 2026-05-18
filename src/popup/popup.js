const STORAGE_KEY = 'stealthSettings';

const DEFAULT_SETTINGS = {
  stealthEnabled: true,
  stealthTheme: true,
  stealthFavicon: true,
  stealthTitle: true,
  stealthVideo: true,
  stealthList: true,
  stealthPipBar: true
};

let currentSettings = { ...DEFAULT_SETTINGS };

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const saved = result[STORAGE_KEY];
    if (saved && typeof saved === 'object') {
      currentSettings = { ...DEFAULT_SETTINGS, ...saved };
    }
  } catch (error) {
    console.error('[Vento] Error loading settings:', error);
    currentSettings = { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: currentSettings });
  } catch (error) {
    console.error('[Vento] Error saving settings:', error);
  }
}

async function sendSettingsToTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
    const message = { type: 'ventoUpdateSettings', settings: currentSettings };
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Ignore errors for inactive tabs that don't have content script loaded
      });
    });
  } catch (error) {
    console.error('[Vento] Error sending settings to tabs:', error);
  }
}

function updateFeatureToggles() {
  const masterToggle = document.getElementById('master-toggle');
  const featuresSection = document.getElementById('features-section');
  const featureToggles = document.querySelectorAll('.feature-toggle');

  masterToggle.checked = currentSettings.stealthEnabled;

  if (currentSettings.stealthEnabled) {
    featuresSection.classList.remove('disabled');
  } else {
    featuresSection.classList.add('disabled');
  }

  featureToggles.forEach((toggle) => {
    const feature = toggle.dataset.feature;
    toggle.checked = currentSettings[feature] === true;
  });
}

function applyMasterToggle(enabled) {
  currentSettings.stealthEnabled = enabled;

  // When disabling master, save all features as-is but gray them out
  // When enabling master, restore previous states
  updateFeatureToggles();
  saveSettings();
  sendSettingsToTabs();
}

function applyFeatureToggle(feature, enabled) {
  currentSettings[feature] = enabled;
  saveSettings();
  sendSettingsToTabs();
}

async function initPopup() {
  await loadSettings();
  updateFeatureToggles();

  // Master toggle
  document.getElementById('master-toggle').addEventListener('change', (event) => {
    applyMasterToggle(event.target.checked);
  });

  // Feature toggles
  document.querySelectorAll('.feature-toggle').forEach((toggle) => {
    toggle.addEventListener('change', (event) => {
      const feature = event.target.dataset.feature;
      applyFeatureToggle(feature, event.target.checked);
    });
  });
}

document.addEventListener('DOMContentLoaded', initPopup);