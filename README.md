# 📊 SAP B1 Dashboard

Dashboard web de **Ventas** y **Stock** para SAP Business One. Publicado en GitHub Pages, alimentado por Google Apps Script conectado a SAP Service Layer. Instalable como PWA, soporte multi-empresa, modo TV para pantallas de sala.

🌐 **Live:** [fjhr.github.io/sap-dashboard](https://fjhr.github.io/sap-dashboard)

---

## ✨ Características completas

### 💰 Pestaña Ventas

| Característica | Detalle |
|----------------|---------|
| KPIs con comparativa | Total facturado, Facturas, Pedidos, Entregas — `▲▼ %` vs período anterior |
| Alerta meta diaria | KPI rojo si el promedio diario cae bajo el umbral configurado |
| Filtro de fecha | Rango desde/hasta — todas las vistas se actualizan en tiempo real |
| **Rango histórico** | Si el rango de fechas excede lo descargado, se recarga automáticamente desde SAP (hasta ~20 años atrás, máx 1000 docs por tipo) |
| Filtro por cliente | Búsqueda por nombre en tiempo real |
| Filtro por vendedor | Dropdown poblado desde SAP (`SalesPersonCode`) |
| Drill-down en gráfica | Click en una barra → filtra la tabla al día seleccionado |
| Gráfica de barras | Facturación CLP por día del período seleccionado |
| Gráfica de tendencia | Línea de 14 días con evolución de facturación |
| Donut comparativo | Período actual vs período anterior en proporción |
| **Mapa de calor** | Calendario año completo estilo GitHub, 4 niveles de intensidad, tooltip con monto CLP |
| Top 5 clientes | Ranking por monto con barra de progreso |
| Tabla de Facturas | Acordeón colapsable ▼/▲, inicia expandido + Exportar CSV |
| Acordeón Pedidos | Colapsable ▼/▲ con tabla completa + Exportar CSV |
| Acordeón Entregas | Colapsable ▼/▲ con tabla completa + Exportar CSV |
| Imprimir / PDF | `@media print` limpio: solo tablas, sin UI; botón 🖨️ |

### 📦 Pestaña Stock

| Característica | Detalle |
|----------------|---------|
| KPIs de inventario | Artículos, Unidades totales, Bodegas activas |
| Filtro por bodega | Dropdown con todas las bodegas |
| Búsqueda de artículo | Por código o nombre en tiempo real |
| Alerta stock mínimo | Umbral configurable; filas en rojo + badge; panel de alertas |
| Banner de warnings | Si alguna consulta OData falla (ej. `/Items`), muestra el detalle en un banner ámbar en vez de quedar vacío |
| Gráfica por bodega | Barras de unidades por bodega |
| Tabla dinámica | Stock por artículo y bodega (hasta 8 bodegas visibles) |
| Exportar CSV | Exporta todas las bodegas y artículos filtrados |

### 🎨 Generales

| Característica | Detalle |
|----------------|---------|
| Dark / Light mode | Toggle 🌙/☀️ con persistencia en `localStorage` |
| Multi-empresa | Dropdown en header; configura `SAP_COMPANIES` en Script Properties |
| Refresh visual | Botón ↻ con spinner + "Actualizando..." bloqueado durante carga |
| **⚙️ Credenciales SAP** | Modal para configurar URL/CompanyDB/Usuario/Contraseña sin tocar el código; persistidas en `localStorage`; punto naranja indica override activo |
| **Modo presentación** | Botón 📺: pantalla completa, slider 10-60s, cicla Ventas↔Stock, oculta UI, Escape cancela |
| PWA | Instalable en móvil/escritorio; funciona offline con últimos datos |

---

## 🏗️ Arquitectura

```
SAP Business One (Service Layer REST / OData v1)
          │
          │  HTTPS — trigger automático cada 6h + bajo demanda
          ▼
 Google Apps Script — CodeStock.gs (24 funciones)
  ├─ GET /exec                          → ventas (caché 6h)
  ├─ GET /exec?daysBack=N&dateTo=fecha  → ventas de rango histórico (paginado)
  ├─ GET /exec?company=ID              → ventas de empresa específica
  ├─ GET /exec?action=sellers           → lista de vendedores SAP
  ├─ GET /exec?action=companies         → lista de empresas configuradas
  ├─ GET /exec?action=stock             → stock por artículo/bodega (caché 6h)
  ├─ GET /exec?action=stock&refresh=1  → stock forzando lectura fresca
  └─ GET /exec?action=ping              → diagnóstico (eco de params recibidos)
          │
          │  fetch() al cargar / al cambiar filtros/empresa
          ▼
  GitHub Pages — index.html (~960 líneas)
  ├─ Header: empresa selector + dark/light + 📺 presentación + refresh
  ├─ Tab Ventas: filtros + KPIs + charts + mapa calor + drill-down + tablas + acordeón + print
  ├─ Tab Stock: filtros + KPIs + chart + tabla + alertas
  ├─ manifest.json  ← PWA
  └─ sw.js          ← Service Worker (cache-first static, network-first API)
```

---

## 📁 Estructura del Proyecto

```
sap-dashboard/
├── index.html                        # Dashboard — Tailwind CSS CDN + Chart.js 4.4.3
├── CodeStock.gs                      # Apps Script activo (24 funciones) ✅
├── Code.gs                           # Versión inicial (deprecada — no usar)
├── manifest.json                     # PWA manifest
├── sw.js                             # Service Worker
├── CLAUDE.md                         # Contexto para Claude Code / Superpowers
├── .github/
│   └── copilot-instructions.md       # Contexto para GitHub Copilot
├── README.md                         # Este archivo
└── SETUP.md                          # Guía paso a paso de configuración
```

> ⚠️ **Usar siempre `CodeStock.gs`** — es la versión activa y completa. `Code.gs` está deprecada.

---

## 🚀 Setup

### 1. Google Apps Script

1. [script.google.com](https://script.google.com) → Nuevo proyecto → Pegar contenido de **`CodeStock.gs`**
2. **⚙️ Project Settings → Script Properties:**

| Propiedad | Descripción | Ejemplo |
|-----------|-------------|---------|
| `SAP_BASE_URL` | URL base de Service Layer | `https://servidor:50000/b1s/v1` |
| `SAP_COMPANY_DB` | Empresa por defecto | `MIEMPRESA` |
| `SAP_USER` | Usuario de integración | `Integrador` |
| `SAP_PASSWORD` | Contraseña | `••••••` |
| `SAP_LANGUAGE` | Código de idioma | `25` (español) |
| `SAP_DAYS_BACK` | Días de historial por defecto | `5` |
| `SAP_COMPANIES` | Lista de empresas (opcional) | ver abajo |

**Para multi-empresa:**
```json
SAP_COMPANIES = [
  {"id": "TEST", "name": "Empresa Test", "db": "TESTSOP"},
  {"id": "PROD", "name": "Producción",   "db": "PRODDB"}
]
```

> ⚠️ **Nunca pongas credenciales en el código. Usa siempre Script Properties.**

3. **Deploy → New Deployment → Web App**
   - Execute as: **Me** | Who has access: **Anyone**
   - Copia la URL resultante

4. Ejecuta `setupTrigger()` una vez para activar el refresco automático cada 6 horas.

> ⚠️ **Cada vez que modifiques `CodeStock.gs`** crea una nueva versión:
> `Deploy → Manage Deployments → ✏️ → New Version → Deploy`

### 2. Configurar URLs en index.html

```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/TU_ID/exec';
const STOCK_URL       = 'https://script.google.com/macros/s/TU_ID/exec?action=stock';
```

### 3. GitHub Pages

`Settings → Pages → Deploy from branch → master / / (root)` → disponible en ~1 minuto.

---

## 🔌 API Reference

| Endpoint | Descripción |
|----------|-------------|
| `GET /exec?daysBack=14` | Ventas con rango personalizado (caché 6h) |
| `GET /exec?daysBack=N&dateTo=yyyy-mm-dd` | Ventas de rango histórico acotado — pagina hasta 1000 docs por tipo (los más recientes del rango) |
| `GET /exec?company=ID` | Ventas de empresa específica |
| `GET /exec?action=sellers` | Lista de vendedores SAP |
| `GET /exec?action=companies` | Lista de empresas configuradas (sin contraseñas) |
| `GET /exec?action=stock` | Stock por artículo y bodega (caché 6h) |
| `GET /exec?action=stock&refresh=1` | Stock forzando lectura fresca |
| `GET /exec?action=ping` | Diagnóstico: eco de los parámetros recibidos (sin credenciales en claro) |
| `GET /exec?sapUrl=...&sapDb=...&sapUser=...&sapPass=...` | **Override de credenciales SAP** — útil para multi-servidor; desactiva caché automáticamente |

**Respuesta ventas:**
```json
{
  "lastUpdated": "2026-07-06T21:00:00Z", "currency": "CLP",
  "dateFrom": "2026-06-29", "dateTo": null,
  "invoices": [{ "DocNum": 1, "CardName": "Cliente", "DocDate": "...", "DocTotal": 1250000, "DocumentStatus": "bost_Open", "SalesPersonCode": 3 }],
  "orders": [...], "deliveries": [...],
  "warnings": ["/Orders HTTP 400: ..."]
}
```
> `dateTo` refleja el límite superior pedido (`null` = hoy). `warnings` solo aparece si alguna
> consulta OData falló — los errores no se tragan silenciosamente.

**Respuesta stock:**
```json
{
  "lastUpdated": "...",
  "totales": { "articulos": 1240, "unidades": 58320, "bodegas": 5 },
  "bodegas": [{ "codigo": "01", "nombre": "Bodega Principal" }],
  "articulos": [{ "codigo": "ART001", "nombre": "Producto", "total": 150, "bodegas": { "01": 100, "02": 50 } }],
  "warnings": ["/Items HTTP 400: ..."]
}
```
> `warnings` solo aparece si `/Warehouses` o `/Items` fallaron o llegaron truncados; el frontend
> lo muestra como banner ámbar en la pestaña Stock. `/Items` se pagina con tamaño adaptativo
> (50→5→1) porque `ItemWarehouseInfoCollection` puede pesar >50MB en bases con muchas bodegas.

---

## 🔧 Diagnóstico y Mantenimiento

### Funciones útiles en el editor de Apps Script

```javascript
testSAP()    // Verifica login a SAP — revisa status 200 y SessionId
testStock()  // Consulta stock y loguea primeros 3 artículos

function clearSalesCache() {
  var c = CacheService.getScriptCache();
  ['sap_sales_data','sap_sales_data_14'].forEach(function(k){ c.remove(k); });
}
function clearStockCache() {
  var c = CacheService.getScriptCache();
  var meta = c.get('sap_stock_data_META');
  if (meta) for (var i=0; i<parseInt(meta); i++) c.remove('sap_stock_data_'+i);
  c.remove('sap_stock_data_META');
}
```

### Errores frecuentes

| Error | Causa | Solución |
|-------|-------|----------|
| Arrays vacíos, sin `warnings` | No hay documentos en el rango consultado | Ampliar el filtro "Desde" (recarga histórica automática) |
| Arrays vacíos, con `warnings` | Alguna consulta OData falló | Revisar el detalle HTTP en `warnings` |
| `SAP Login failed (HTTP xxx)` | Credenciales incorrectas o URL sin `/b1s/v1` | Verificar Script Properties o modal ⚙️; el mensaje incluye la respuesta de SAP |
| Funciona en Postman pero no en el dashboard | Certificado autofirmado o servidor SAP no accesible desde internet | Todo fetch lleva `validateHttpsCertificates:false`; Apps Script llama desde IPs de Google (no sirve VPN local) |
| Cambios en `CodeStock.gs` no se reflejan | Deployment sirviendo versión vieja | `clasp push -f` + `clasp deploy -i <deployment-id>`; verificar con `?action=ping` |
| Cambios en `index.html` no se reflejan | Service Worker anterior a `v2` sirviendo caché | Ctrl+Shift+R una vez; desde `sap-dashboard-v2` el documento va network-first y no vuelve a pasar |
| `Unterminated string in JSON at position ~52428000` | Respuesta SAP truncada al límite de ~50MB de UrlFetchApp | Ya mitigado con paginación `$top/$skip` adaptativa; si reaparece, revisar el `warnings` de la respuesta |
| Stock muestra bodegas pero no artículos | `/Items` falló o pesa demasiado (`ItemWarehouseInfoCollection`) | Leer el banner ámbar de warnings en la pestaña Stock |
| Dashboard en blanco | URL de Apps Script incorrecta | Verificar `APPS_SCRIPT_URL` / `STOCK_URL` |
| Vendedores vacíos | `/SalesPersons` sin datos | Normal en DBs de prueba; filtro se oculta |
| Empresas no aparecen | `SAP_COMPANIES` no configurada | Agregar Script Property con JSON |
| Mapa de calor gris | Datos < 14 días cargados | Normal; solo días con datos se colorean |
| Modo TV no abre fullscreen | Política del navegador | Requiere interacción del usuario previa (ya cumplida con el click) |
| Punto naranja en ⚙️ | Credenciales custom activas en localStorage | Usar ⚙️ → Limpiar para volver a Script Properties |

---

## 🔐 Seguridad

- ✅ Credenciales en **Script Properties** (cifrado en reposo por Google)
- ✅ Auth SAP: `SessionId` del body del login → `Cookie: B1SESSION=<id>`
- ✅ `?action=companies` expone solo `id` y `name`, nunca contraseña ni `db`
- ✅ Web App solo de lectura; HTML 100% estático sin credenciales
- ✅ Service Worker cachea solo assets estáticos; API siempre va a la red
- ⚠️ **Modal ⚙️**: credenciales custom se transmiten por HTTPS como query params → solo para uso interno/dev. No usar en redes públicas sin VPN. Limpiar con el botón 🗑 cuando ya no se necesiten.

---

## 🛠️ Stack

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| Google Apps Script | — | Backend, caché, triggers, auth SAP |
| SAP B1 Service Layer | OData v1 | Facturas, Pedidos, Entregas, Stock, Vendedores |
| Chart.js | 4.4.3 CDN | Barras, línea, doughnut |
| Tailwind CSS | CDN | Estilos responsive |
| GitHub Pages | — | Hosting estático gratuito |
| PWA | Web APIs | Instalable, offline-first |

---

## 📈 Roadmap

- [ ] **Reporte automático por email** — Apps Script trigger diario con resumen HTML
- [ ] **Persistencia histórica en Google Sheets** — historial de meses/años para el mapa de calor completo
- [ ] **Notificaciones push de stock bajo** — PWA PushManager
- [ ] **Autenticación Google OAuth** — acceso solo al dominio de la empresa
- [ ] **Desglose por familia de artículos** — `ItemsGroupCode` en stock y ventas
- [ ] **Indicador de rotación de inventario** — días de stock disponible según ritmo de ventas

---

## 👥 Equipo

| Usuario | Rol |
|---------|-----|
| [@fjhr](https://github.com/fjhr) | Owner / Arquitectura |
| [@KmiloVargs](https://github.com/KmiloVargs) | Colaborador / Stock |

---

## 🤝 Contribuir

```bash
git clone https://github.com/fjhr/sap-dashboard
cd sap-dashboard
git checkout -b feat/mi-mejora
# ... cambios ...
git push origin feat/mi-mejora
# Abrir Pull Request en GitHub
```

---

## 📄 Licencia

MIT — libre para uso interno y comercial.
