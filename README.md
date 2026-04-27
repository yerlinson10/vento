# Plantilla de extension de navegador (Manifest V3)

Estructura base para empezar una extension en Chrome/Edge con:

- Popup
- Service Worker (background)
- Content Script
- Pagina de opciones
- Persistencia con chrome.storage

## Estructura

- manifest.json
- src/background/background.js
- src/content/content.js
- src/popup/popup.html
- src/popup/popup.css
- src/popup/popup.js
- src/options/options.html
- src/options/options.css
- src/options/options.js

## Como probar en Chrome o Edge

1. Abrir la pagina de extensiones:
   - Chrome: chrome://extensions
   - Edge: edge://extensions
2. Activar "Developer mode".
3. Clic en "Load unpacked".
4. Seleccionar esta carpeta del proyecto.

## Siguiente paso recomendado

- Ajustar permisos en manifest.json para usar solo los necesarios.
- Reemplazar el codigo de ejemplo por la logica real de tu extension.
