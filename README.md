# 📊 SAP B1 Dashboard

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
