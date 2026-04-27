# DevTube Stealth Mode (Manifest V3)

Extension minima para YouTube con enfoque stealth:

- Inyecta estilos y logica solo en youtube.com
- Oculta superficies visuales del video
- Mantiene reproduccion de audio
- Reemplaza el titulo de la pestana con texto tecnico
- Captura logs persistentes en chrome.storage.local

## Estructura

- manifest.json
- content.js
- stealth.css

## Como probar en Chrome o Edge

1. Abrir la pagina de extensiones:
   - Chrome: chrome://extensions
   - Edge: edge://extensions
2. Activar "Developer mode".
3. Clic en "Load unpacked".
4. Seleccionar esta carpeta del proyecto.
5. Abrir youtube.com y revisar que se aplique el modo stealth.
6. En YouTube usa atajos para logs:
   - Alt+Shift+L: exporta logs a JSON.
   - Alt+Shift+C: limpia logs guardados.

## Comportamiento esperado

- Home, busqueda y watch pages se muestran como lista con fondo blanco.
- El titulo de la pestana se cambia a "Localhost:8080/debug/logs".
- En paginas de video, la superficie visual se oculta y el audio se mantiene.

## Verificacion recomendada

1. Abre DevTools en YouTube y confirma logs con prefijo [DevTube Stealth].
2. Navega entre videos sin recargar la pagina y valida que el stealth se siga aplicando.
3. Exporta logs con Alt+Shift+L y revisa el JSON descargado (motivo de aplicacion, cantidad de videos detectados y URL).
