const apiUrlInput = document.getElementById("apiUrl");
const saveBtn = document.getElementById("saveBtn");
const msg = document.getElementById("msg");

async function loadOptions() {
  const { apiUrl = "" } = await chrome.storage.sync.get(["apiUrl"]);
  apiUrlInput.value = apiUrl;
}

saveBtn?.addEventListener("click", async () => {
  const apiUrl = apiUrlInput.value.trim();
  await chrome.storage.sync.set({ apiUrl });
  msg.textContent = "Configuracion guardada.";
});

loadOptions();
