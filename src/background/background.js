chrome.runtime.onInstalled.addListener(() => {
  console.log("[Mi Extension] instalada");
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      console.log("[Mi Extension] click en icono");
    }
  });
});
