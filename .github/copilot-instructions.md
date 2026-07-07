# GitHub Copilot Instructions — SAP B1 Dashboard

## Proyecto
Dashboard SAP Business One: GitHub Pages (Tailwind + Chart.js) + Google Apps Script → SAP Service Layer.
- **Live:** https://fjhr.github.io/sap-dashboard
- **Local:** `C:\Users\ferna\Projects\sap-dashboard`
- **Rama:** `master`

## Archivos activos
- `CodeStock.gs` → backend Apps Script (el activo; `Code.gs` está deprecado)
- `index.html` → dashboard completo con todas las features
- `manifest.json` + `sw.js` → PWA

## Patrón de auth SAP (crítico)
Usar siempre `SessionId` del **body** del login como `Cookie: B1SESSION=<id>`.
Nunca parsear el header `Set-Cookie` para esto.

## Convenciones
- Credenciales SAP en **Script Properties** o en el modal ⚙️ (localStorage, solo uso interno/dev)
- Cache keys incluyen company ID: `buildCacheKey_(base, companyId, suffix)`. Con credOverride → caché desactivada
- CSS theming con variables CSS (`--bg`, `--card`, etc.), no Tailwind dark mode
- `currentCredOverride_` var módulo en `CodeStock.gs`, se setea en `doGet` (NO se pasa como param)
- Tras modificar `CodeStock.gs`: crear nueva versión del deploy en Apps Script
- Commits incluyen trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`

## Features ya implementadas (no duplicar)
**Ventas:** KPIs comparativa, filtros (fecha/cliente/vendedor/meta), drill-down charts,
tendencia 14 días, mapa de calor estilo GitHub (rango dinámico por filtros de fecha), top clientes,
acordeón facturas/pedidos/entregas (facturas inicia expandido), exportar CSV, imprimir PDF.
**Stock:** KPIs, filtro bodega/búsqueda/stock-mínimo, gráfica, tabla, alertas, exportar CSV.
**General:** dark/light mode, multi-empresa (?company=ID), refresh visual, modal ⚙️ credenciales SAP (localStorage, punto naranja indicador), modo presentación/TV (📺 requestFullscreen slider 10-60s), PWA.

## Endpoints Apps Script
`?daysBack=N` · `?company=ID` · `?action=sellers` · `?action=companies` · `?action=stock` · `?action=stock&refresh=1` · `?sapUrl=...&sapDb=...&sapUser=...&sapPass=...` (override credenciales)

## Roadmap pendiente
Email automático · Persistencia en Sheets · Push notifications · Google OAuth · Filtro por familia artículos
