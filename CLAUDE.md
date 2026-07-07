# SAP B1 Dashboard — Context for Claude Code / Superpowers

## Proyecto
Dashboard web de Ventas y Stock para SAP Business One.
- **Live:** https://fjhr.github.io/sap-dashboard
- **Repo:** https://github.com/fjhr/sap-dashboard (rama `master`)
- **Owner:** @fjhr | **Colaborador:** @KmiloVargs

## Arquitectura
```
SAP B1 Service Layer (OData v1)
    ↓ cada 6h (trigger) o bajo demanda
Google Apps Script (CodeStock.gs)
    ↓ fetch()
GitHub Pages (index.html) — Tailwind CSS CDN + Chart.js 4.4.3
PWA: manifest.json + sw.js
```

## Archivos clave
| Archivo | Descripción |
|---------|-------------|
| `CodeStock.gs` | Backend activo (24 funciones, ~434 líneas). NUNCA usar `Code.gs` |
| `index.html` | Dashboard completo (~957 líneas) |
| `manifest.json` | PWA manifest |
| `sw.js` | Service Worker (cache-first static, network-first API) |
| `.clasp.json` | Config de clasp para deploy automatizado del Apps Script |

## Apps Script — Endpoints
| Endpoint | Descripción |
|----------|-------------|
| `GET /exec?daysBack=14` | Ventas (caché 6h, retorna `invoices`, `orders`, `deliveries`, `dateFrom`, `dateTo`) |
| `GET /exec?daysBack=N&dateTo=yyyy-mm-dd` | Ventas de rango histórico acotado (`DocDate ge X and le Y`) |
| `GET /exec?company=ID` | Ventas de empresa específica |
| `GET /exec?action=sellers` | Lista vendedores SAP (`SalesEmployeeCode`, `SalesEmployeeName`) |
| `GET /exec?action=companies` | Lista empresas configuradas (sin contraseñas) |
| `GET /exec?action=stock` | Stock por artículo y bodega (caché 6h) |
| `GET /exec?action=stock&refresh=1` | Stock forzando lectura fresca |
| `GET /exec?action=ping` | Diagnóstico: eco de params recibidos (sin credenciales en claro) |
| `GET /exec?sapUrl=...&sapDb=...&sapUser=...&sapPass=...` | Override de credenciales SAP por-request (sin caché) |

Si alguna consulta OData falla (HTTP ≠ 200), la respuesta de ventas incluye un array `warnings`
con `endpoint HTTP código: body(200 chars)` — no falla silenciosamente.

## Script Properties requeridas
```
SAP_BASE_URL     = https://servidor:50000/b1s/v1
SAP_COMPANY_DB   = EMPRESA_DEFAULT
SAP_USER         = usuario
SAP_PASSWORD     = contraseña
SAP_LANGUAGE     = 25
SAP_DAYS_BACK    = 5
SAP_COMPANIES    = [{"id":"ID","name":"Nombre","db":"DB"}]  ← opcional
```

## Auth SAP — Patrón crítico
```javascript
// CORRECTO: usar SessionId del body del login
var sessionId = JSON.parse(loginResp.getContentText()).SessionId;
var headers = { 'Cookie': 'B1SESSION=' + sessionId };

// INCORRECTO: NO usar Set-Cookie del header response
```

## SSL — Patrón crítico
Los servidores SAP usados tienen certificados autofirmados. **TODO** `UrlFetchApp.fetch` que
vaya a SAP (login, ventas, sellers, stock, logout) debe llevar `validateHttpsCertificates: false`.
Si se agrega un fetch nuevo sin ese flag, funcionará en Postman pero fallará desde Apps Script.

## Deploy del Apps Script (clasp)
El deployment de producción es `AKfycby4hbghlmaLSHIolQ11c5cGafG-OJbTlBkKRS4PvRFQO_l3Pr4ocwEnUiedq2R9qkUX`
(mismo ID que aparece en `APPS_SCRIPT_URL`/`STOCK_URL` de index.html — NO crear deployments nuevos).

```bash
clasp push -f
clasp deploy -i AKfycby4hbghlmaLSHIolQ11c5cGafG-OJbTlBkKRS4PvRFQO_l3Pr4ocwEnUiedq2R9qkUX -d "descripcion"
```

**Lección aprendida:** editar `CodeStock.gs` local SIN redesplegar deja producción sirviendo código
viejo — el bug más engañoso del proyecto. Tras desplegar, verificar la versión viva (tarda ~1 min
en propagar):
```bash
curl -sL "https://script.google.com/macros/s/AKfycby4.../exec?action=ping&_t=123"
```

## Frontend — Variables globales clave en index.html
```javascript
const APPS_SCRIPT_URL = '...';  // URL del Web App (ventas/sellers/companies)
const STOCK_URL       = '...';  // URL del Web App con ?action=stock
const DAYS_BACK = 14;           // días por defecto a pedir (7 actuales + 7 anteriores)
const PERIOD    = 7;            // días de cada período para comparativa
// Rango dinámico (rango histórico)
let currentDaysBack = DAYS_BACK; // daysBack efectivamente pedido al backend
let currentDateTo   = '';        // límite superior pedido ('' = hoy)
// Presentación
let presentationActive = false; // true cuando modo TV está activo
let presentationTimer  = null;  // ID del setInterval del slideshow
```

## Rango histórico dinámico (ventas)
- El filtro Desde/Hasta filtra localmente **mientras el rango esté cubierto** por lo descargado.
- Si excede la cobertura (`rawData.dateFrom` / `rawData.dateTo`), `expandRangeIfNeeded(desde,hasta)`
  recalcula `currentDaysBack` (+PERIOD días extra para la comparativa) y dispara `loadData()`.
- Guard anti-loop: si el rango pedido no cambió respecto al anterior, no reintenta.
- Backend: `fetchAll` pagina con `$top`/`$skip` explícitos y tope `SALES_MAX_PAGINAS = 10`
  (máx ~1000 docs por tipo, los más recientes del rango, `$orderby=DocDate desc`).
- El `cache.put` de ventas va en try/catch: rangos grandes pueden superar los 100KB por clave.

## Paginación SAP — Patrón crítico
**NO confiar** en `Prefer: odata.maxpagesize` ni en `odata.nextLink`: hay servidores SAP (el del
modal ⚙️ de Fernando) que los ignoran y devuelven TODO en una sola respuesta. UrlFetchApp trunca
en ~50MB y el `JSON.parse` revienta con "Unterminated string in JSON at position 52427762".
Siempre paginar con `$top=100&$skip=N` + `$orderby` estable, cortando cuando la página llega
incompleta (`recibidos < pageSize`) o al tope de páginas (`SALES_MAX_PAGINAS`/`STOCK_MAX_PAGINAS`).

## Credenciales custom (modal ⚙️)
- Botón ⚙️ en header abre un modal para configurar: SAP URL, CompanyDB, Usuario, Contraseña
- Se guardan en `localStorage` bajo la key `sap_credentials` (JSON: `{sapUrl, sapDb, sapUser, sapPass}`)
- `getCredParams()` → retorna `{}` si no hay creds, o el objeto con solo los campos no vacíos
- Todos los builders de URL (`getSalesUrl`, `getSellersUrl`, `getStockUrl`) hacen spread de `getCredParams()`
- En Apps Script: `currentCredOverride_` (var módulo) se setea en `doGet` con los params recibidos
- Si hay override: **caché deshabilitada** (key `null`) — cada request va directo a SAP
- Punto naranja en el botón ⚙️ indica que hay credenciales custom activas
- `saveSettings()` → guarda + recarga datos automáticamente
- `clearSettings()` → borra localStorage + vuelve a Script Properties

## CSS Theme System
Variables CSS (no Tailwind dark mode):
```css
:root { --bg, --card, --border, --text, --text2, --text3, --inp, --inp-b }
body.light { /* valores claros */ }
```
Clases: `.card`, `.t2`, `.t3`, `.inp`, `.tab-a`, `.tab-i`, `.kv`, `.alert-card`, `.badge-low`, `.up`, `.dn`, `.ne`

## Features implementadas (no reimplementar)
- ✅ KPIs con comparativa ▲▼% vs período anterior
- ✅ Filtros: fecha, cliente, vendedor, bodega, meta diaria, stock mínimo
- ✅ Drill-down: click en barra del chart → filtra tabla a ese día
- ✅ Gráficas: barras (período), línea tendencia 14 días, donut comparativo
- ✅ **Mapa de calor de ventas**: calendario dinámico estilo GitHub, 4 niveles intensidad, tooltip CLP, dark/light, rango por filtros de fecha
- ✅ Top 5 clientes
- ✅ Acordeón Pedidos, Entregas y Facturas (colapsable, facturas inicia expandido)
- ✅ Exportar CSV (facturas, pedidos, entregas, stock)
- ✅ Imprimir / PDF (`@media print`)
- ✅ Dark/Light mode (`localStorage`)
- ✅ Multi-empresa (dropdown en header, `?company=ID`)
- ✅ Refresh visual (spinner en botón ↻)
- ✅ **Modo presentación / TV**: botón 📺, `requestFullscreen`, slider 10-60s, cicla tabs auto, oculta UI, Escape cancela
- ✅ PWA (manifest.json + sw.js)
- ✅ Stock: KPIs, gráfica, tabla dinámica, alertas stock bajo
- ✅ **Modal ⚙️ credenciales SAP**: configura URL/DB/user/pass en localStorage, punto naranja indicador, recarga al guardar
- ✅ **Rango histórico dinámico**: filtros de fecha fuera de la ventana descargada recargan desde SAP (`dateTo` + paginación)
- ✅ **Diagnóstico**: endpoint `?action=ping` + array `warnings` en respuesta de ventas cuando falla alguna consulta OData

## Roadmap pendiente
- [ ] Reporte automático por email (Apps Script trigger diario)
- [ ] Persistencia histórica en Google Sheets
- [ ] Notificaciones push de stock bajo (PWA PushManager)
- [ ] Autenticación Google OAuth
- [ ] Filtro por familia de artículos (`ItemsGroupCode`)

## Reglas del proyecto
1. **NUNCA hardcodear credenciales** en `index.html` — usar Script Properties o modal ⚙️ (localStorage)
2. **NUNCA modificar `Code.gs`** — está deprecado
3. **Tras cambiar `CodeStock.gs`**: `clasp push -f` + `clasp deploy -i <deployment-id>` (ver sección Deploy). Sin esto, producción sigue con el código viejo
4. **Al hacer push**: incluir trailer `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
5. **Cache keys**: incluyen company ID → `buildCacheKey_(base, companyId, suffix)`; el suffix de ventas incluye `daysBack` y `dateTo`
6. **No reimplementar** funciones que ya existen
7. **Con credOverride**: `currentCredOverride_` se setea en `doGet`, NO se pasa como parámetro entre funciones
8. **Todo fetch a SAP** lleva `validateHttpsCertificates: false` (certificados autofirmados)
9. **Errores de fetch no fatales** se acumulan en `fetchWarnings_` (se resetea en `fetchSAPData`) y salen como `warnings` en la respuesta — no tragarse errores solo con `Logger.log`
10. **Tras publicar index.html**: el Service Worker cachea la versión vieja — probar con Ctrl+Shift+R

## Comandos útiles
```bash
# Clonar
git clone https://github.com/fjhr/sap-dashboard

# Trabajo diario
cd C:\Users\ferna\Projects\sap-dashboard
git pull
git add -A
git commit -m "feat: ..."
git push

# Desplegar backend a Apps Script (tras editar CodeStock.gs)
clasp push -f
clasp deploy -i AKfycby4hbghlmaLSHIolQ11c5cGafG-OJbTlBkKRS4PvRFQO_l3Pr4ocwEnUiedq2R9qkUX -d "descripcion"
clasp deployments   # ver deployments y versiones

# Probar el backend desplegado (sin credenciales reales)
curl -sL "https://script.google.com/macros/s/AKfycby4hbghlmaLSHIolQ11c5cGafG-OJbTlBkKRS4PvRFQO_l3Pr4ocwEnUiedq2R9qkUX/exec?action=ping&_t=123"

# Agregar colaborador
gh api repos/fjhr/sap-dashboard/collaborators/USUARIO --method PUT --field permission=push
```

## Debugging — historia de guerra (jul 2026)
Síntoma: credenciales del modal ⚙️ fallaban con "SAP Login failed" pero funcionaban en Postman.
Causas encadenadas encontradas:
1. Producción servía una versión vieja del script (el fix SSL existía local pero sin desplegar).
2. `validateHttpsCertificates: false` estaba solo en el `/Login`, no en los demás fetch.
3. `fetchAll` tragaba errores OData devolviendo `[]` (solo `Logger.log`).
4. Los datos de la DB eran de 2021 y el filtro de fecha solo filtraba localmente los últimos 14 días.
Moraleja: verificar SIEMPRE qué versión está desplegada antes de debuggear el código local, y
hacer visibles los errores en la respuesta JSON (no solo en el Logger).
