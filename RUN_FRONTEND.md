# Correr Frontend SCANU-UI

El proyecto frontend real esta dentro de la carpeta interna:

```bash
cd /Users/adriancordero/Desktop/SCANU-UI/SCANU-UI
```

Luego ejecuta:

```bash
VITE_LAYER8_API_BASE="http://100.92.1.128:8088" VITE_LAYER8_WS_URL="ws://100.92.1.128:8088/ws/events" npm run devx
```

Nota: en el `package.json` actual existe el script `dev`, pero no `devx`.
Si `npm run devx` falla, usa:

```bash
VITE_LAYER8_API_BASE="http://100.92.1.128:8088" VITE_LAYER8_WS_URL="ws://100.92.1.128:8088/ws/events" npm run dev
```
