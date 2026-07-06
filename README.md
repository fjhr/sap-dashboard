# 📊 SAP B1 Dashboard

Dashboard web de **Ventas** y **Stock** para SAP Business One. Publicado en GitHub Pages, alimentado por Google Apps Script conectado a SAP Service Layer en tiempo real. Instalable como aplicación (PWA).

🌐 **Live:** [fjhr.github.io/sap-dashboard](https://fjhr.github.io/sap-dashboard)

---

## ✨ Características

### 💰 Pestaña Ventas
| Característica | Detalle |
|----------------|---------|
| **KPIs con comparativa** | Total facturado, N° Facturas, Pedidos, Entregas — cada uno con `▲▼ %` vs período anterior |
| **Alerta de meta diaria** | KPI se vuelve rojo si el promedio diario cae bajo el umbral configurado |
| **Gráfica de barras** | Facturación CLP por día del período seleccionado |
| **Gráfica de tendencia** | Línea de 14 días mostrando evolución de facturación |
| **Donut comparativo** | Período actual vs período anterior en proporción |
| **Top 5 clientes** | Ranking por monto facturado con barra de progreso |
| **Filtros interactivos** | Rango de fechas, búsqueda por cliente, meta diaria — todo en tiempo real |
| **Tabla de facturas** | Detalle con N° doc, cliente, fecha, monto y estado |
| **Exportar CSV** | Descarga inmediata con todos los datos filtrados (compatible Excel) |

### 📦 Pestaña Stock
| Característica | Detalle |
|----------------|---------|
| **KPIs de inventario** | Artículos con stock, Unidades totales, N° Bodegas |
| **Gráfica de barras** | Unidades por bodega |
| **Panel de alertas** | Lista de artículos bajo el stock mínimo configurado |
| **Filtros interactivos** | Bodega específica, búsqueda por código/nombre, umbral de stock mínimo |
| **Tabla dinámica** | Stock por artículo desglosado por bodega (hasta 8 bodegas visibles) |
| **Filas en rojo** | Artículos por debajo del mínimo se destacan visualmente con badge |
| **Exportar CSV** | Exporta toda la tabla (todas las bodegas) como CSV |

### 🎨 Generales
- **Dark / Light mode** — toggle con persistencia en `localStorage`
- **PWA** — instalable como app en móvil y escritorio, funciona offline con últimos datos
- **Actualización automática** — botón ↻ y trigger cada 6h en Apps Script

---

## 🏗️ Arquitectura

```
SAP Business One (Service Layer REST/OData)
          │
          │  HTTPS — cada 6 horas (trigger automático)
          │  o bajo demanda (?refresh=1)
          ▼
 Google Apps Script (Web App)
  ├─ GET /exec                    → ventas (últimos N días, caché 6h)
  ├─ GET /exec?daysBack=14        → ventas con más historial (comparativa)
  ├─ GET /exec?action=stock       → stock por artículo y bodega (caché 6h)
  └─ GET /exec?action=stock&refresh=1 → fuerza lectura fresca desde SAP
          │
          │  fetch() al cargar / al cambiar filtros
          ▼
  GitHub Pages (index.html)        ← estático, gratuito
  ├─ Tab Ventas  (Chart.js + filtros + CSV export)
  ├─ Tab Stock   (Chart.js + filtros + alertas + CSV export)
  ├─ manifest.json                 ← PWA
  └─ sw.js                         ← Service Worker (cache-first)
```

---

## 📁 Estructura del Proyecto

```
sap-dashboard/
├── index.html       # Dashboard web (Tailwind CSS + Chart.js)
├── CodeStock.gs     # Apps Script: ventas + stock ✅ (usar este)
├── Code.gs          # Apps Script: solo ventas (versión base, deprecado)
├── manifest.json    # PWA manifest
├── sw.js            # Service Worker
├── README.md        # Este archivo
└── SETUP.md         # Guía de configuración paso a paso
```

> ⚠️ **Usar siempre `CodeStock.gs`** — incluye ventas y stock. `Code.gs` es la versión inicial y está deprecada.

---

## 🚀 Configuración Rápida

### 1. Google Apps Script

1. Ve a [script.google.com](https://script.google.com) → **Nuevo proyecto**
2. Pega el contenido de **`CodeStock.gs`** (reemplaza todo el editor)
3. En **⚙️ Project Settings → Script Properties**, agrega:

| Propiedad | Descripción | Ejemplo |
|-----------|-------------|---------|
| `SAP_BASE_URL` | URL base de Service Layer | `https://servidor:50000/b1s/v1` |
| `SAP_COMPANY_DB` | Nombre de la empresa en SAP | `MIEMPRESA` |
| `SAP_USER` | Usuario de integración SAP | `Integrador` |
| `SAP_PASSWORD` | Contraseña del usuario | `••••••` |
| `SAP_LANGUAGE` | Código de idioma SAP | `25` (español) |
| `SAP_DAYS_BACK` | Días de historial por defecto | `5` (el HTML pide 14) |

> ⚠️ **Nunca pongas credenciales directamente en el código. Usa siempre Script Properties.**

4. **Deploy → New Deployment → Web App**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Copia la URL: `https://script.google.com/macros/s/.../exec`

5. Ejecuta `setupTrigger()` una vez para activar el refresco automático cada 6 horas.

6. Si tu DB tiene datos históricos (no recientes), agrega la propiedad:
   ```
   SAP_DAYS_BACK = 800
   ```

### 2. Configurar el HTML

En `index.html`, actualiza las dos constantes:

```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/.../exec';
const STOCK_URL       = 'https://script.google.com/macros/s/.../exec?action=stock';
```

> Si usas un solo deploy de `CodeStock.gs`, ambas URLs comparten el mismo base URL — solo difiere `?action=stock`.

Luego haz push:
```bash
git add index.html
git commit -m "chore: set Apps Script URLs"
git push
```

### 3. GitHub Pages

1. Ve a `https://github.com/fjhr/sap-dashboard/settings/pages`
2. Source: **Deploy from branch** / `master` / `/ (root)`
3. En ~1 minuto disponible en **`https://fjhr.github.io/sap-dashboard`**

---

## 🔌 API Reference

### Ventas

```
GET /exec                    # últimos SAP_DAYS_BACK días (desde Script Properties)
GET /exec?daysBack=14        # sobrescribe el rango (útil para comparativas)
```

**Respuesta:**
```json
{
  "lastUpdated": "2026-07-06T21:00:00Z",
  "currency": "CLP",
  "dateFrom": "2026-06-29",
  "invoices":   [{ "DocNum": 247041, "CardName": "Cliente SA", "DocDate": "2026-07-01T00:00:00Z", "DocTotal": 1250000, "DocumentStatus": "bost_Open" }],
  "orders":     [...],
  "deliveries": [...]
}
```

### Stock

```
GET /exec?action=stock              # stock cacheado (6h TTL)
GET /exec?action=stock&refresh=1    # fuerza lectura fresca desde SAP
```

**Respuesta:**
```json
{
  "lastUpdated": "2026-07-06T21:00:00Z",
  "totales": { "articulos": 1240, "unidades": 58320, "bodegas": 5 },
  "bodegas":   [{ "codigo": "01", "nombre": "Bodega Principal" }],
  "articulos": [{ "codigo": "ART001", "nombre": "Producto X", "total": 150, "bodegas": { "01": 100, "02": 50 } }]
}
```

---

## 🔧 Diagnóstico y Mantenimiento

### Funciones útiles en Apps Script

```javascript
// Verificar login a SAP (revisar logs)
testSAP()

// Consultar y loguear primeros artículos de stock
testStock()

// Forzar limpieza del caché de ventas
function clearCache() {
  var c = CacheService.getScriptCache();
  c.remove('sap_sales_data');
  c.remove('sap_sales_data_14'); // si se usó daysBack=14
}

// Limpiar caché de stock
function clearStockCache() {
  var c = CacheService.getScriptCache();
  c.remove('sap_stock_data_META');
  for (var i = 0; i < 20; i++) c.remove('sap_stock_data_' + i);
}
```

### Errores frecuentes

| Error | Causa probable | Solución |
|-------|----------------|----------|
| `invoices: []` vacío | Filtro de fecha no coincide con datos | Aumentar `SAP_DAYS_BACK` o verificar fechas en SAP |
| `SAP Login failed` | Credenciales incorrectas | Verificar Script Properties |
| `HTTP 401` en queries | Cookie `B1SESSION` expirada | El script hace logout/login automático; verificar `SessionTimeout` en SAP |
| `HTTP 500` en stock | Timeout por volumen de artículos | Reducir `STOCK_MAX_PAGINAS` en `CodeStock.gs` |
| Dashboard en blanco | URL de Apps Script incorrecta | Verificar las constantes `APPS_SCRIPT_URL` y `STOCK_URL` en `index.html` |

### Actualizar después de cambios en Apps Script

Cada vez que modifiques `CodeStock.gs` debes **crear una nueva versión del deploy**:
```
Deploy → Manage Deployments → ✏️ editar → New Version → Deploy
```
Los cambios **no** se aplican automáticamente al deploy existente.

---

## 🔐 Seguridad

- ✅ Credenciales en **Script Properties** (cifrado en reposo por Google)
- ✅ Auth SAP: `SessionId` del body del login → cookie `B1SESSION=<id>` (no usar `Set-Cookie` header)
- ✅ El Web App solo expone datos de lectura — no acepta escritura
- ✅ El HTML es 100% estático — no almacena credenciales ni datos sensibles
- ✅ Service Worker solo cachea assets estáticos; las llamadas a la API siempre van a la red

---

## 🛠️ Stack Tecnológico

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| [Google Apps Script](https://script.google.com) | — | Backend, caché, triggers |
| [SAP B1 Service Layer](https://help.sap.com) | OData v1 | Fuente de datos |
| [Chart.js](https://www.chartjs.org/) | 4.4.3 | Gráficas interactivas |
| [Tailwind CSS](https://tailwindcss.com/) | CDN | Estilos |
| [GitHub Pages](https://pages.github.com/) | — | Hosting estático gratuito |
| PWA (Web APIs) | — | Instalable, offline-first |

---

## 📈 Roadmap / Ideas Futuras

- [ ] Filtro por vendedor (requiere campo `SalesPersonCode` en SAP)
- [ ] Comparativa semana a semana automática (sin selección manual)
- [ ] Notificaciones push cuando el stock cae bajo mínimo
- [ ] Autenticación con Google OAuth (acceso solo al dominio de la empresa)
- [ ] Soporte multi-empresa (selector de `SAP_COMPANY_DB`)
- [ ] Panel de KPIs configurables por el usuario

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
# Crear rama de trabajo
git checkout -b feat/mi-mejora
# ... hacer cambios ...
git push origin feat/mi-mejora
# Abrir Pull Request en GitHub
```

---

## 📄 Licencia

MIT — libre para uso interno y comercial.

Dashboard web de **Ventas** y **Stock** para SAP Business One, publicado en GitHub Pages y alimentado por Google Apps Script en tiempo real.

🌐 **Live:** [fjhr.github.io/sap-dashboard](https://fjhr.github.io/sap-dashboard)

---

## ✨ Características

### Pestaña Ventas
- **KPIs**: Total facturado (CLP), N° de Facturas, Pedidos y Entregas
- **Gráfica de barras**: Facturación diaria de los últimos N días
- **Gráfica donut**: Distribución proporcional de documentos
- **Top 5 clientes**: Ranking por monto facturado con barra de progreso
- **Tabla de facturas**: Detalle con número, cliente, fecha, monto y estado

### Pestaña Stock
- **KPIs**: Artículos con stock, Unidades totales, N° de Bodegas
- **Gráfica de barras**: Unidades por bodega
- **Tabla interactiva**: Stock por artículo y bodega con buscador en tiempo real
- Soporte para paginación automática (hasta 10.000 artículos)

---

## 🏗️ Arquitectura

```
SAP Business One (Service Layer)
          │
          │  HTTPS – cada 6 horas (trigger automático)
          ▼
 Google Apps Script (Web App)
  ├─ doGet()            → ventas (últimos N días)
  ├─ doGet(?action=stock) → stock por bodega
  └─ CacheService       → respuestas en memoria (6h TTL)
          │
          │  fetch() al cargar la página
          ▼
  GitHub Pages (index.html)
  ├─ Tab: Ventas  (Tailwind + Chart.js)
  └─ Tab: Stock   (Tailwind + Chart.js + búsqueda)
```

---

## 📁 Estructura del Proyecto

```
sap-dashboard/
├── index.html      # Dashboard web (Tailwind CSS + Chart.js)
├── Code.gs         # Apps Script: solo ventas (versión base)
├── CodeStock.gs    # Apps Script: ventas + stock (versión completa ✅)
├── README.md       # Este archivo
└── SETUP.md        # Guía de configuración paso a paso
```

> **Usar `CodeStock.gs`** — es la versión más completa e incluye todo lo de `Code.gs`.

---

## 🚀 Configuración Rápida

### 1. Google Apps Script

1. Ve a [script.google.com](https://script.google.com) → **Nuevo proyecto**
2. Pega el contenido de `CodeStock.gs`
3. En **⚙️ Project Settings → Script Properties**, agrega:

| Propiedad | Valor |
|-----------|-------|
| `SAP_BASE_URL` | `https://tu-servidor:50000/b1s/v1` |
| `SAP_COMPANY_DB` | nombre de la empresa en SAP |
| `SAP_USER` | usuario de integración |
| `SAP_PASSWORD` | contraseña |
| `SAP_LANGUAGE` | `25` (español) |
| `SAP_DAYS_BACK` | `5` (días hacia atrás, ajustable) |

> ⚠️ **Nunca pongas credenciales directamente en el código.**

4. **Deploy → New Deployment → Web App**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Copia la URL generada

5. Ejecuta `setupTrigger()` una vez para activar la actualización automática cada 6 horas.

### 2. Configurar el HTML

En `index.html`, actualiza las dos constantes con tus URLs de Apps Script:

```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/.../exec';
const STOCK_URL       = 'https://script.google.com/macros/s/.../exec?action=stock';
```

### 3. GitHub Pages

1. Ve a `Settings → Pages` del repositorio
2. Source: **Deploy from branch** / `master` / `/ (root)`
3. En ~1 minuto el sitio estará disponible en `https://TU_USUARIO.github.io/sap-dashboard`

---

## 🔌 API Reference (Apps Script)

| Endpoint | Descripción |
|----------|-------------|
| `GET /exec` | Ventas de los últimos N días (caché 6h) |
| `GET /exec?action=stock` | Stock por artículo y bodega (caché 6h) |
| `GET /exec?action=stock&refresh=1` | Stock forzando lectura fresca desde SAP |

### Respuesta de Ventas
```json
{
  "lastUpdated": "2026-07-06T21:00:00Z",
  "currency": "CLP",
  "dateFrom": "2026-07-01",
  "invoices": [ { "DocNum": 247041, "CardName": "Cliente", "DocDate": "...", "DocTotal": 990 } ],
  "orders": [ ... ],
  "deliveries": [ ... ]
}
```

### Respuesta de Stock
```json
{
  "lastUpdated": "2026-07-06T21:00:00Z",
  "totales": { "articulos": 1240, "unidades": 58320, "bodegas": 5 },
  "bodegas": [ { "codigo": "01", "nombre": "Bodega Principal" } ],
  "articulos": [ { "codigo": "ART001", "nombre": "Producto", "total": 150, "bodegas": { "01": 100, "02": 50 } } ]
}
```

---

## 🔧 Funciones de Diagnóstico (Apps Script)

Ejecuta estas funciones desde el editor de Apps Script para diagnosticar problemas:

```javascript
testSAP()    // Verifica login a SAP → revisa status 200 y SessionId
testStock()  // Consulta stock completo y loguea los primeros 3 artículos
clearCache() // (agregar manualmente) Limpia caché para forzar re-consulta
```

### Limpiar caché manualmente
```javascript
function clearCache() {
  var c = CacheService.getScriptCache();
  c.remove('sap_sales_data');
  c.remove('sap_stock_data_META');
}
```

---

## 🔐 Seguridad

- Las credenciales SAP se almacenan en **Script Properties** (cifrado en reposo por Google)
- La autenticación usa `SessionId` del body del login como cookie `B1SESSION`
- El Apps Script solo expone datos agregados — no acepta parámetros de escritura
- El HTML es completamente estático y no almacena credenciales

---

## 👥 Equipo

| Usuario | Rol |
|---------|-----|
| [@fjhr](https://github.com/fjhr) | Owner / Backend |
| [@KmiloVargs](https://github.com/KmiloVargs) | Colaborador |

---

## 🛠️ Tecnologías

| Tecnología | Uso |
|-----------|-----|
| [Google Apps Script](https://script.google.com) | Backend / integración SAP |
| [SAP B1 Service Layer](https://help.sap.com/docs/SAP_BUSINESS_ONE) | Fuente de datos (OData REST) |
| [Chart.js 4](https://www.chartjs.org/) | Gráficas interactivas |
| [Tailwind CSS](https://tailwindcss.com/) | Estilos (CDN) |
| [GitHub Pages](https://pages.github.com/) | Hosting estático gratuito |

---

## 📄 Licencia

MIT — libre para uso interno y comercial.
