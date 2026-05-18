# Vento — Stealth Mode para YouTube (Manifest V3)

**Vento** es una extensión de navegador para Chrome y Edge que aplica un **modo sigiloso** en YouTube: oculta la interfaz visual del video, el reproductor, miniaturas y otros elementos, mientras mantiene la reproducción de audio en segundo plano. Ideal para escuchar música, podcasts o conferencias de YouTube sin distracciones visuales.

---

## ✨ Características

| Característica | Descripción |
|---|---|
| **Ocultar video** | El reproductor se vuelve invisible (1px), pero el audio sigue sonando. |
| **Tema claro forzado** | YouTube se muestra siempre con fondo blanco, sin modo oscuro. |
| **Título falso** | La pestaña muestra `System Debugger - Node.js (Active)` en lugar del título del video. |
| **Favicon falso** | El ícono de la pestaña se reemplaza por uno que parece de desarrollo/terminal. |
| **Lista de títulos** | Reemplaza la página de YouTube por una lista limpia de enlaces con los títulos de los videos detectados. |
| **Barra de control (PiP)** | Barra superior con controles de reproducción: Play/Pausa, retroceder/avanzar 10s, y Picture-in-Picture. |
| **Atajos de teclado** | `Alt+Shift+L` para exportar logs, `Alt+Shift+C` para limpiar logs, `/` para enfocar la búsqueda. |
| **Logs persistentes** | Registro de actividad guardado en `chrome.storage.local` (máx. 400 entradas). |
| **Interfaz de popup** | Menú flotante para activar/desactivar funciones individualmente. |
| **Detección de CAPTCHA** | Si YouTube muestra un CAPTCHA, el modo stealth se suspende automáticamente. |

---

## 📦 Instalación

### En Chrome

1. Abre Chrome y ve a `chrome://extensions`.
2. Activa el **Modo desarrollador** (interruptor en la esquina superior derecha).
3. Haz clic en **"Cargar extensión sin empaquetar"** (Load unpacked).
4. Selecciona la carpeta del proyecto (la que contiene `manifest.json`).
5. La extensión **Vento** aparecerá en tu barra de extensiones.

### En Edge

1. Abre Edge y ve a `edge://extensions`.
2. Activa el **Modo desarrollador** (interruptor en la esquina inferior izquierda).
3. Haz clic en **"Cargar descomprimida"** (Load unpacked).
4. Selecciona la carpeta del proyecto.
5. La extensión **Vento** aparecerá en tu barra de extensiones.

### Verificar la instalación

1. Ve a [youtube.com](https://youtube.com).
2. La página debería verse como una lista blanca con títulos de videos (sin reproductor ni interfaz de YouTube).
3. El título de la pestaña debe mostrar `System Debugger - Node.js (Active)`.
4. Haz clic en el ícono de Vento en la barra de extensiones para abrir el popup y personalizar las funciones.

---

## 🎮 Cómo usar

### Popup (menú flotante)

Haz clic en el ícono de **Vento** (⚡) en la barra de extensiones para abrir el popup con los siguientes controles:

- **Activado** — Interruptor maestro. Desactiva todo el modo stealth.
- **Tema claro** — Fuerza el tema claro en YouTube.
- **Favicon** — Reemplaza el ícono de la pestaña.
- **Título falso** — Cambia el título de la pestaña.
- **Ocultar video** — Hace invisible el reproductor de video.
- **Lista de títulos** — Muestra la lista de títulos de videos en lugar de la interfaz de YouTube.
- **Barra de control** — Muestra la barra superior con controles de reproducción.

### Atajos de teclado (en YouTube)

| Tecla | Acción |
|---|---|
| `Alt + Shift + L` | Exportar logs a un archivo JSON |
| `Alt + Shift + C` | Limpiar todos los logs guardados |
| `/` | Enfocar el campo de búsqueda en la lista de títulos |

### Barra de control (PiP)

Cuando estás viendo un video (`/watch`), aparece una barra oscura en la parte superior con:

- **Título del video** actual (o "Audio en segundo plano").
- **-10s** — Retrocede 10 segundos.
- **Play/Pausa** — Reproducir o pausar.
- **+10s** — Avanza 10 segundos.
- **PiP** — Activa/desactiva Picture-in-Picture (ventana flotante).
- **Tiempo** — Tiempo actual / duración total.

### Búsqueda

En la lista de títulos, hay un campo de búsqueda en la parte superior:
- Escribe un término y presiona **Enter** o haz clic en **Ir** para buscar en YouTube.
- Haz clic en **Inicio** para volver a la página principal de YouTube.

---

## 🗂️ Estructura del proyecto

```
vento/
├── manifest.json          # Configuración de la extensión (Manifest V3)
├── content.js             # Lógica principal inyectada en YouTube
├── stealth.css            # Estilos CSS para ocultar elementos de YouTube
├── README.md              # Este archivo
├── .gitignore
└── src/
    ├── popup/
    │   ├── popup.html     # Interfaz del popup
    │   ├── popup.css      # Estilos del popup
    │   └── popup.js       # Lógica del popup
    ├── background/        # Scripts de fondo (reservado)
    ├── content/           # Módulos de contenido (reservado)
    └── options/           # Página de opciones (reservado)
```

---

## ⚙️ Comportamiento técnico

- **Ámbito**: Solo se activa en `*://*.youtube.com/*`.
- **Mecanismo**: Inyecta `content.js` y `stealth.css` en las páginas de YouTube.
- **Persistencia**: La configuración y los logs se guardan en `chrome.storage.local`.
- **Detección de navegación**: Escucha eventos `yt-navigate-finish` y `yt-page-data-updated` de YouTube para reaplicar el stealth sin recargar la página.
- **CAPTCHA**: Si detecta un desafío de CAPTCHA, desactiva temporalmente el stealth hasta que desaparezca.

---

## 🧪 Pruebas recomendadas

1. Abre DevTools en YouTube (`F12`) y revisa la consola. Deberías ver logs con prefijo `[DevTube Stealth]`.
2. Navega entre videos sin recargar la página y verifica que el stealth se siga aplicando.
3. Exporta logs con `Alt+Shift+L` y revisa el JSON descargado (motivo de aplicación, cantidad de videos detectados y URL).
4. Desactiva funciones individualmente desde el popup para verificar su comportamiento.

---

## 📝 Notas

- Esta extensión usa **Manifest V3**, el formato más reciente de extensiones de Chrome.
- No requiere permisos de lectura/escritura en sitios web arbitrarios, solo en YouTube.
- No recopila datos personales ni envía información a servidores externos.
- El nombre "Vento" significa "viento" en italiano y portugués, evocando velocidad y ligereza.

---

## 📄 Licencia

Uso personal y educativo.