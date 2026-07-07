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
| `CodeStock.gs` | Backend activo (24 funciones, 420 líneas). NUNCA usar `Code.gs` |
| `index.html` | Dashboard completo (709 líneas, 51 funciones JS) |
| `manifest.json` | PWA manifest |
| `sw.js` | Service Worker (cache-first static, network-first API) |

## Apps Script — Endpoints
| Endpoint | Descripción |
|----------|-------------|
| `GET /exec?daysBack=14` | Ventas (caché 6h, retorna `invoices`, `orders`, `deliveries`) |
| `GET /exec?company=ID` | Ventas de empresa específica |
| `GET /exec?action=sellers` | Lista vendedores SAP (`SalesEmployeeCode`, `SalesEmployeeName`) |
| `GET /exec?action=companies` | Lista empresas configuradas (sin contraseñas) |
| `GET /exec?action=stock` | Stock por artículo y bodega (caché 6h) |
| `GET /exec?action=stock&refresh=1` | Stock forzando lectura fresca |

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

## Frontend — Variables globales clave en index.html
```javascript
const APPS_SCRIPT_URL = '...';  // URL del Web App (ventas/sellers/companies)
const STOCK_URL       = '...';  // URL del Web App con ?action=stock
const DAYS_BACK = 14;           // días totales a pedir (7 actuales + 7 anteriores)
const PERIOD    = 7;            // días de cada período para comparativa
// Presentación
let presentationActive = false; // true cuando modo TV está activo
let presentationTimer  = null;  // ID del setInterval del slideshow
```

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
- ✅ **Mapa de calor de ventas**: calendario 365 días estilo GitHub, 4 niveles intensidad, tooltip CLP, dark/light
- ✅ Top 5 clientes
- ✅ Acordeón Pedidos y Entregas (colapsable)
- ✅ Exportar CSV (facturas, pedidos, entregas, stock)
- ✅ Imprimir / PDF (`@media print`)
- ✅ Dark/Light mode (`localStorage`)
- ✅ Multi-empresa (dropdown en header, `?company=ID`)
- ✅ Refresh visual (spinner en botón ↻)
- ✅ **Modo presentación / TV**: botón 📺, `requestFullscreen`, slider 10-60s, cicla tabs auto, oculta UI, Escape cancela
- ✅ PWA (manifest.json + sw.js)
- ✅ Stock: KPIs, gráfica, tabla dinámica, alertas stock bajo

## Roadmap pendiente
- [ ] Reporte automático por email (Apps Script trigger diario)
- [ ] Persistencia histórica en Google Sheets
- [ ] Notificaciones push de stock bajo (PWA PushManager)
- [ ] Autenticación Google OAuth
- [ ] Filtro por familia de artículos (`ItemsGroupCode`)

## Reglas del proyecto
1. **NUNCA hardcodear credenciales** — siempre Script Properties
2. **NUNCA modificar `Code.gs`** — está deprecado
3. **Tras cambiar `CodeStock.gs`**: crear nueva versión en Deploy → Manage Deployments
4. **Al hacer push**: incluir trailer `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
5. **Cache keys**: incluyen company ID → `buildCacheKey_(base, companyId, suffix)`
6. **No reimplementar** funciones que ya existen (ver lista de 51 funciones en index.html)

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

# Agregar colaborador
gh api repos/fjhr/sap-dashboard/collaborators/USUARIO --method PUT --field permission=push
```
