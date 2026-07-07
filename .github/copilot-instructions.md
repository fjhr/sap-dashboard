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

## SSL (crítico)
Los servidores SAP usan certificados autofirmados: **todo** `UrlFetchApp.fetch` hacia SAP
(login, ventas, sellers, stock, logout) lleva `validateHttpsCertificates: false`.

## Paginación SAP (crítico)
No confiar en `Prefer: odata.maxpagesize` ni `odata.nextLink` (hay servidores que los ignoran y
UrlFetchApp trunca a ~50MB → JSON inválido). Paginar siempre con `$top=100&$skip=N` + `$orderby`
estable, cortando en página incompleta o al tope de páginas.

## Convenciones
- Credenciales SAP en **Script Properties** o en el modal ⚙️ (localStorage, solo uso interno/dev)
- Cache keys incluyen company ID: `buildCacheKey_(base, companyId, suffix)`. Con credOverride → caché desactivada. Suffix de ventas incluye `daysBack` y `dateTo`
- CSS theming con variables CSS (`--bg`, `--card`, etc.), no Tailwind dark mode
- `currentCredOverride_` var módulo en `CodeStock.gs`, se setea en `doGet` (NO se pasa como param)
- Errores de fetch OData no fatales → acumular en `fetchWarnings_` y devolver como `warnings` en la respuesta (no tragarlos con solo `Logger.log`)
- Tras modificar `CodeStock.gs`: `clasp push -f` + `clasp deploy -i <deployment-id de la URL>` — sin esto producción sigue con código viejo. Verificar con `?action=ping`
- Tras publicar `index.html`: el Service Worker cachea la versión vieja (probar con Ctrl+Shift+R)
- Commits incluyen trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`

## Features ya implementadas (no duplicar)
**Ventas:** KPIs comparativa, filtros (fecha/cliente/vendedor/meta), rango histórico dinámico
(filtros de fecha fuera de la ventana descargada recargan desde SAP vía `expandRangeIfNeeded` +
`dateTo`), drill-down charts, tendencia 14 días, mapa de calor estilo GitHub (rango dinámico por
filtros de fecha), top clientes, acordeón facturas/pedidos/entregas (facturas inicia expandido),
exportar CSV, imprimir PDF.
**Stock:** KPIs, filtro bodega/búsqueda/stock-mínimo, gráfica, tabla, alertas, exportar CSV.
**General:** dark/light mode, multi-empresa (?company=ID), refresh visual, modal ⚙️ credenciales SAP (localStorage, punto naranja indicador), modo presentación/TV (📺 requestFullscreen slider 10-60s), PWA.

## Endpoints Apps Script
`?daysBack=N` · `?daysBack=N&dateTo=yyyy-mm-dd` (rango histórico) · `?company=ID` · `?action=sellers` · `?action=companies` · `?action=stock` · `?action=stock&refresh=1` · `?action=ping` (diagnóstico) · `?sapUrl=...&sapDb=...&sapUser=...&sapPass=...` (override credenciales)
La respuesta de ventas incluye `dateFrom`, `dateTo` y, si alguna consulta OData falló, un array `warnings`.

## Roadmap pendiente
Email automático · Persistencia en Sheets · Push notifications · Google OAuth · Filtro por familia artículos
