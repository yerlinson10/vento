const btnPing = document.getElementById("btnPing");
const status = document.getElementById("status");

btnPing?.addEventListener("click", async () => {
  status.textContent = "Probando...";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    status.textContent = "No se encontro una pestana activa.";
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      console.log("[Mi Extension] mensaje desde popup");
    }
  });

  status.textContent = "Listo. Revisa la consola de la pagina.";
});
