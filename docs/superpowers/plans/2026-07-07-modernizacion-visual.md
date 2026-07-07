# Modernización Visual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernizar el look & feel de `index.html` según `docs/superpowers/specs/2026-07-07-modernizacion-visual-design.md`: tokens de tema (oscuro refinado / claro enterprise), tipografía Inter, íconos SVG sin emojis, chips de tendencia y gráficas tematizadas.

**Architecture:** Todo vive en `c:\Users\ferna\Projects\sap-dashboard\index.html` (single-file, patrón del proyecto). El tema usa variables CSS en `:root` + overrides `.light`; los íconos van en un sprite `<symbol>` inline; las gráficas leen colores computados vía un helper `chartColors()`.

**Tech Stack:** HTML + Tailwind CDN + Chart.js 4.4.3 + CSS variables. Sin dependencias nuevas (solo `<link>` a Google Fonts).

## Global Constraints

- **Un solo archivo tocado:** `index.html`. NO tocar `CodeStock.gs`, `sw.js`, `manifest.json`, backend ni layout HTML (grids/secciones se conservan).
- **Cero emojis en la UI final** (el spec lo exige; incluye 📊🌙📺⚙️↻💰📦🖨️⬇✕👁💾🗑⚠️🔴⏹▲▼).
- **No cambiar lógica de datos** (fetch, filtros, cache, presentación). Solo presentación visual.
- Commits con trailer exacto: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
- No hacer `git push` hasta el task final.
- Verificación sin framework de tests: greps con resultado esperado + carga visual.

---

### Task 1: Tokens de tema + tipografía Inter

**Files:**
- Modify: `index.html` (bloque `<style>` líneas ~19-64, `<head>` líneas ~14-17)

**Interfaces:**
- Produces: variables CSS `--primary`, `--primary-btn`, `--up`, `--dn`, `--chip-up`, `--chip-dn`, `--shadow-card` (las usan Tasks 5 y 6).

- [ ] **Step 1: Agregar Inter al `<head>`** — después de la línea `<meta name="apple-mobile-web-app-status-bar-style" ...>` insertar:

```html
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Reemplazar los bloques `:root` y `.light`** (líneas 20-29) por:

```css
    :root {
      --bg:#0f172a;--card:#1e293b;--border:#334155;
      --text:#f1f5f9;--text2:#94a3b8;--text3:#64748b;
      --inp:#0f172a;--inp-b:#475569;
      --primary:#818cf8;--primary-btn:#6366f1;
      --up:#34d399;--dn:#f87171;
      --chip-up:rgba(52,211,153,.12);--chip-dn:rgba(248,113,113,.12);
      --shadow-card:0 4px 16px rgba(0,0,0,.3);
    }
    .light{
      --bg:#f1f5f9;--card:#ffffff;--border:#e2e8f0;
      --text:#1e293b;--text2:#475569;--text3:#94a3b8;
      --inp:#ffffff;--inp-b:#cbd5e1;
      --primary:#0a6ed1;--primary-btn:#0a6ed1;
      --up:#059669;--dn:#dc2626;
      --chip-up:rgba(5,150,105,.1);--chip-dn:rgba(220,38,38,.08);
      --shadow-card:0 1px 3px rgba(15,23,42,.08),0 4px 12px rgba(15,23,42,.05);
    }
```

- [ ] **Step 3: Actualizar reglas base** — reemplazar las reglas `body{...}`, `.card{...}`, `.inp:focus{...}`, `.up/.dn` y `.tab-a` existentes por:

```css
    body{background:var(--bg);color:var(--text);transition:background .3s,color .3s;font-family:'Inter',system-ui,sans-serif;}
    .card{background:var(--card);border:1px solid var(--border);box-shadow:var(--shadow-card);transition:background .3s;}
    .inp:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 25%,transparent);}
    .up{color:var(--up)}.dn{color:var(--dn)}.ne{color:var(--text2)}
    .tab-a{background:var(--primary-btn);color:#fff;}
```

(Las demás reglas del `<style>` no se tocan en este task. Notas: `--inp` oscuro pasa de `#1e293b` a `#0f172a` — los inputs se hunden respecto a la card, es intencional. Desviación aceptada del spec: el radio de cards queda en el `rounded-xl`/`rounded-2xl` de Tailwind ya presente (12/16px) en vez de un token `--radius` de 14px — no pelear con las clases utilitarias existentes.)

- [ ] **Step 4: Verificar** — Run: `git diff --stat index.html` → solo index.html. Grep `"--primary:#818cf8"` en index.html → 1 match. Abrir el archivo en navegador (doble click) y confirmar que carga sin errores de consola y con fuente Inter.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(ui): tokens de tema oscuro/claro + tipografia Inter

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Sprite de íconos SVG + clase .icon

**Files:**
- Modify: `index.html` (insertar sprite tras `<body ...>` línea ~70; agregar CSS `.icon` al `<style>`)

**Interfaces:**
- Produces: símbolos `#i-logo #i-moon #i-sun #i-tv #i-stop #i-settings #i-refresh #i-print #i-download #i-chevron #i-trend-up #i-trend-down #i-alert #i-x #i-eye #i-package #i-coins #i-save #i-trash` y el patrón de uso `<svg class="icon"><use href="#i-nombre"/></svg>` (lo consumen Tasks 3, 4, 5).

- [ ] **Step 1: Insertar el sprite** inmediatamente después de `<body class="min-h-screen p-4 md:p-8">`:

```html
  <!-- Sprite de íconos (estilo Lucide, stroke=currentColor) -->
  <svg xmlns="http://www.w3.org/2000/svg" style="display:none">
    <symbol id="i-logo" viewBox="0 0 24 24"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></symbol>
    <symbol id="i-moon" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></symbol>
    <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></symbol>
    <symbol id="i-tv" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></symbol>
    <symbol id="i-stop" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></symbol>
    <symbol id="i-settings" viewBox="0 0 24 24"><line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/></symbol>
    <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></symbol>
    <symbol id="i-print" viewBox="0 0 24 24"><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></symbol>
    <symbol id="i-download" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></symbol>
    <symbol id="i-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></symbol>
    <symbol id="i-trend-up" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></symbol>
    <symbol id="i-trend-down" viewBox="0 0 24 24"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></symbol>
    <symbol id="i-alert" viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></symbol>
    <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></symbol>
    <symbol id="i-package" viewBox="0 0 24 24"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></symbol>
    <symbol id="i-coins" viewBox="0 0 24 24"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/></symbol>
    <symbol id="i-save" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></symbol>
  </svg>
```

- [ ] **Step 2: Agregar CSS de íconos al `<style>`** (después de la regla `.kv{...}`):

```css
    .icon{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;display:inline-block;vertical-align:-3px;flex:none;}
    .icon-sm{width:14px;height:14px;}
    .icon-lg{width:20px;height:20px;}
    .chev{transition:transform .2s;}
    .chev.open{transform:rotate(180deg);}
```

- [ ] **Step 3: Verificar** — grep `id="i-logo"` → 1 match; grep `class="icon` → ≥1 (el CSS). Abrir en navegador: sin cambios visibles (sprite oculto), sin errores de consola.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(ui): sprite SVG de iconos estilo Lucide + clase .icon

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Header, tabs y modal sin emojis

**Files:**
- Modify: `index.html` — header (~líneas 71-84), nav tabs (~127-130), modal (~88-124), botones "✕ Limpiar" de ambos filter bars, JS `toggleTheme()`, IIFE de tema inicial, `togglePresentation()`, `setLoading()`.

**Interfaces:**
- Consumes: símbolos del sprite (Task 2).

- [ ] **Step 1: Header** — reemplazos exactos:

`<h1 class="text-2xl md:text-3xl font-bold">📊 Dashboard SAP B1</h1>` →
```html
<h1 class="text-2xl md:text-3xl font-bold flex items-center gap-2"><svg class="icon icon-lg" style="color:var(--primary)"><use href="#i-logo"/></svg>Dashboard SAP B1</h1>
```

Botón tema: `>🌙</button>` → `><svg class="icon"><use id="themeIcon" href="#i-moon"/></svg></button>`

Botón presentación: `>📺</button>` → `><svg class="icon"><use id="presIcon" href="#i-tv"/></svg></button>`

Botón settings: `>⚙️<span id="settingsDot"` → `><svg class="icon"><use href="#i-settings"/></svg><span id="settingsDot"`

Botón refresh: `>↻ Actualizar</button>` → `><svg class="icon icon-sm"><use href="#i-refresh"/></svg> Actualizar</button>`

- [ ] **Step 2: Tabs** — `>💰 Ventas<` → `><svg class="icon icon-sm"><use href="#i-coins"/></svg> Ventas<` y `>📦 Stock<` → `><svg class="icon icon-sm"><use href="#i-package"/></svg> Stock<`

- [ ] **Step 3: Modal** — reemplazos:
  - `<h2 class="text-base font-bold">⚙️ Conexión SAP Business One</h2>` → `<h2 class="text-base font-bold flex items-center gap-2"><svg class="icon"><use href="#i-settings"/></svg>Conexión SAP Business One</h2>`
  - `>✕</button>` (closeSettings) → `><svg class="icon"><use href="#i-x"/></svg></button>`
  - En el aviso naranja: `⚠️ Las credenciales` → `<svg class="icon icon-sm" style="vertical-align:-2px"><use href="#i-alert"/></svg> Las credenciales`
  - `>👁</button>` → `><svg class="icon icon-sm"><use href="#i-eye"/></svg></button>`
  - `>💾 Guardar y recargar<` → `><svg class="icon icon-sm"><use href="#i-save"/></svg> Guardar y recargar<`
  - `>🗑 Limpiar<` → `><svg class="icon icon-sm"><use href="#i-trash"/></svg> Limpiar<`

- [ ] **Step 4: Botones "✕ Limpiar"** (hay 2, en filter bar de ventas y de stock): `>✕ Limpiar</button>` → `><svg class="icon icon-sm"><use href="#i-x"/></svg> Limpiar</button>` (ambos).

- [ ] **Step 5: JS** — en `toggleTheme()` reemplazar `document.getElementById('btnTheme').textContent=l?'☀️':'🌙';` por:

```javascript
document.getElementById('themeIcon').setAttribute('href',l?'#i-sun':'#i-moon');
```

En la IIFE de tema inicial reemplazar `document.getElementById('btnTheme').textContent='☀️';` por `document.getElementById('themeIcon').setAttribute('href','#i-sun');`

En `togglePresentation()` reemplazar `document.getElementById('btnPresentation').textContent=presentationActive?'⏹':'📺';` por:

```javascript
document.getElementById('presIcon').setAttribute('href',presentationActive?'#i-stop':'#i-tv');
```

En `setLoading()` reemplazar la línea del innerHTML por:

```javascript
btn.innerHTML=busy?'<span class="spinner-inline mr-1 align-[-2px]"></span> Actualizando...':'<svg class="icon icon-sm"><use href="#i-refresh"/></svg> Actualizar';
```

- [ ] **Step 6: Verificar** — grep de `🌙|📺|⚙️|📊|💰|📦|👁|💾|🗑|↻` en index.html → 0 matches. Abrir en navegador: header y modal con íconos SVG, toggle de tema alterna luna/sol.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(ui): header, tabs y modal con iconos SVG (sin emojis)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Acordeones, export, estados de carga/error y alertas sin emojis

**Files:**
- Modify: `index.html` — chevrons de acordeón (~215, 240, 264), botones export/imprimir (~219-220, 244, 268, 336), estados de error (~152, 303), título alertas stock (~323), botón salir presentación (~352), JS `syncAccordion()`.

**Interfaces:**
- Consumes: sprite (Task 2). Produces: chevrons por clase `.chev`/`.open` (sin textContent).

- [ ] **Step 1: Chevrons** — los tres spans:
  - `<span id="invoicesChevron" class="text-sm">▲</span>` → `<svg id="invoicesChevron" class="icon chev open"><use href="#i-chevron"/></svg>`
  - `<span id="ordersChevron" class="text-sm">▼</span>` → `<svg id="ordersChevron" class="icon chev"><use href="#i-chevron"/></svg>`
  - `<span id="deliveriesChevron" class="text-sm">▼</span>` → `<svg id="deliveriesChevron" class="icon chev"><use href="#i-chevron"/></svg>`

  En `syncAccordion()` reemplazar `document.getElementById(type+'Chevron').textContent=accordionState[type]?'▲':'▼';` por:

```javascript
document.getElementById(type+'Chevron').classList.toggle('open',accordionState[type]);
```

- [ ] **Step 2: Botones export/imprimir** (4 export + 1 imprimir):
  - `>🖨️ Imprimir<` → `><svg class="icon icon-sm"><use href="#i-print"/></svg> Imprimir<`
  - Cada `>⬇ Exportar CSV<` → `><svg class="icon icon-sm"><use href="#i-download"/></svg> Exportar CSV<` (hay 4: facturas, pedidos, entregas, stock).

- [ ] **Step 3: Estados de error y alertas:**
  - `<p class="text-red-400 text-lg">⚠️ Error al cargar datos</p>` → `<p class="text-lg flex items-center justify-center gap-2" style="color:var(--dn)"><svg class="icon icon-lg"><use href="#i-alert"/></svg>Error al cargar datos</p>`
  - Ídem stock: `⚠️ Error al cargar stock` → mismo patrón con texto `Error al cargar stock`.
  - `<h2 class="text-sm font-semibold t2 mb-4">🔴 Alertas de Stock Bajo</h2>` → `<h2 class="text-sm font-semibold t2 mb-4 flex items-center gap-2"><svg class="icon icon-sm" style="color:var(--dn)"><use href="#i-alert"/></svg>Alertas de Stock Bajo</h2>`
  - Botón salir presentación: `>⏹ Salir</button>` → `><svg class="icon icon-sm"><use href="#i-stop"/></svg> Salir</button>`

- [ ] **Step 4: Buscar emojis restantes** — grep `⚠️|🔴|⏹|🖨|⬇|▲|▼|✕` en index.html. Si `applyStockFilters`/`renderStockTable`/`stockAlerts` generan ▲▼/🔴/⚠️ en JS, aplicar el mismo patrón (chevron por clase, alert por `#i-alert`). Resultado esperado: 0 matches (el `▲▼` de `trend()` se elimina en Task 5, ignorarlo aquí si aún existe).

- [ ] **Step 5: Verificar en navegador** — acordeones abren/cierran con chevron rotando; export/print con íconos.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(ui): acordeones, export y estados con iconos SVG

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Chips de tendencia y estados

**Files:**
- Modify: `index.html` — CSS (agregar `.chip*`), JS `trend()`, `setTrend()`, `renderDocumentTable()`, CSS `.badge-low` y `.alert-card`.

**Interfaces:**
- Consumes: tokens `--chip-up/--chip-dn/--up/--dn` (Task 1), `#i-trend-up/down` (Task 2).

- [ ] **Step 1: CSS chips** (agregar tras `.icon-lg{...}`):

```css
    .chip{display:inline-flex;align-items:center;gap:3px;font-size:.65rem;font-weight:600;padding:2px 8px;border-radius:9999px;}
    .chip-up{background:var(--chip-up);color:var(--up);}
    .chip-dn{background:var(--chip-dn);color:var(--dn);}
    .chip-ne{background:var(--border);color:var(--text2);}
```

- [ ] **Step 2: Reemplazar `trend()` y `setTrend()`** por:

```javascript
    function trend(curr,prev){
      if(!prev)return{cls:'chip-ne',html:'— vs período anterior'};
      const p=((curr-prev)/prev*100);
      const icon=p>=0?'#i-trend-up':'#i-trend-down';
      return{cls:p>=0?'chip-up':'chip-dn',html:`<svg class="icon" style="width:11px;height:11px"><use href="${icon}"/></svg>${Math.abs(p).toFixed(1)}% vs anterior`};
    }
    function setTrend(id,c,p){const t=trend(c,p);const el=document.getElementById(id);el.innerHTML=`<span class="chip ${t.cls}">${t.html}</span>`;el.className='text-xs mt-1';}
```

- [ ] **Step 3: Estados de documento como chips del tema** — en `renderDocumentTable()` reemplazar la celda de estado:

```javascript
          <td class="py-2 text-xs"><span class="chip ${d.DocumentStatus==='bost_Close'?'chip-ne':'chip-up'}">${getStatusLabel(d.DocumentStatus)}</span></td>
```

- [ ] **Step 4: Badge y alert-card con tokens** — reemplazar:

```css
    .alert-card{background:var(--chip-dn)!important;border-color:var(--dn)!important;}
    .badge-low{background:var(--dn);color:#fff;font-size:.65rem;padding:1px 5px;border-radius:9999px;display:inline-block;}
```

- [ ] **Step 5: Verificar** — cargar con datos: KPIs muestran chips redondeados con flechita SVG; tabla de facturas con chips Abierta/Cerrada. grep `▲|▼` → 0 matches.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(ui): tendencias y estados como chips con iconos

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Gráficas y heatmap tematizados + re-render al alternar tema

**Files:**
- Modify: `index.html` — `cc()` → `chartColors()`, `renderCharts()`, chart de stock (buscar `stockChart=new Chart` o similar), `renderTopClients()`, `renderHeatmap()` (niveles), `toggleTheme()`, `<meta name="theme-color">`.

**Interfaces:**
- Consumes: tokens de Task 1. Produces: `chartColors()` → `{primary, primarySoft, up, sky, grid, ticks}`.

- [ ] **Step 1: Reemplazar `cc()`** por:

```javascript
    function cssVar(name){return getComputedStyle(document.body).getPropertyValue(name).trim();}
    function hexToRgba(hex,a){const n=parseInt(hex.slice(1),16);return`rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;}
    function chartColors(){
      const isLight=document.body.classList.contains('light');
      const primary=cssVar('--primary');
      return{
        primary,
        primarySoft:hexToRgba(primary,.15),
        primaryBar:hexToRgba(primary,.7),
        up:cssVar('--up'),
        sky:isLight?'#38bdf8':'#38bdf8',
        grid:isLight?'#e2e8f0':'#334155',
        ticks:isLight?'#475569':'#94a3b8'
      };
    }
```

- [ ] **Step 2: Actualizar `renderCharts()`** — `const c=cc();` → `const c=chartColors();` y colores:
  - salesChart dataset: `backgroundColor:'rgba(99,102,241,.7)',borderColor:'rgba(99,102,241,1)'` → `backgroundColor:c.primaryBar,borderColor:c.primary`
  - trendChart dataset: `borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,.1)'` → `borderColor:c.primary,backgroundColor:c.primarySoft`
  - donutChart: `backgroundColor:['#6366f1','#38bdf8']` → `backgroundColor:[c.primary,c.sky]`

  Si existe otro `cc()` (chart de stock), reemplazar igual: `const c=chartColors();` y sus colores emerald por `c.up` / `hexToRgba(c.up,.7)`.

- [ ] **Step 3: `renderTopClients()`** — dos reemplazos exactos en el template literal:
  - `<span class="text-emerald-400 font-mono ml-2">${fmt.format(tot)}</span>` → `<span class="kv ml-2" style="color:var(--up)">${fmt.format(tot)}</span>`
  - `<div class="bg-emerald-500 h-1.5 rounded-full" style="width:${(tot/max*100).toFixed(1)}%"></div>` → `<div class="h-1.5 rounded-full" style="background:var(--up);width:${(tot/max*100).toFixed(1)}%"></div>`

- [ ] **Step 4: Heatmap desde `--primary`** — reemplazar la línea `const levels=isLight?[...]:[...];` por:

```javascript
      const primary=cssVar('--primary');
      const levels=[hexToRgba(primary,.25),hexToRgba(primary,.45),hexToRgba(primary,.7),primary];
```

  (la variable `isLight` puede quedar sin uso en esta función — eliminarla si el linter/lector lo nota; también revisar que la leyenda `legend` use `levels`).

- [ ] **Step 5: `toggleTheme()` re-renderiza todo + theme-color** — reemplazar la función completa por:

```javascript
    function toggleTheme(){
      const l=document.body.classList.toggle('light');
      document.getElementById('themeIcon').setAttribute('href',l?'#i-sun':'#i-moon');
      localStorage.setItem('theme',l?'light':'dark');
      document.querySelector('meta[name="theme-color"]').setAttribute('content',l?'#ffffff':'#0f172a');
      if(rawData)applyFilters();
      if(stockData)applyStockFilters();
    }
```

  Y en la IIFE inicial de tema, tras poner el ícono de sol, agregar: `document.querySelector('meta[name="theme-color"]').setAttribute('content','#ffffff');`

- [ ] **Step 6: Verificar** — alternar tema con datos cargados: barras/línea/donut cambian a azul `#0a6ed1` en claro e indigo en oscuro; heatmap re-colorea; sin restos verdes/indigo del modo anterior. Consola sin errores.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(ui): graficas y heatmap tematizados via chartColors()

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Verificación final, docs y push

**Files:**
- Modify: `CLAUDE.md` (sección CSS Theme System), `.github/copilot-instructions.md` (línea de convención CSS)

- [ ] **Step 1: Grep global de emojis** en index.html:

Run (Grep tool o): `git grep -nP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{25A0}-\x{25FF}]" -- index.html`
Expected: 0 matches (o solo en comentarios JS, que también deben limpiarse si aparecen).

- [ ] **Step 2: Revisión visual completa** — ambos modos: header, tabs, filtros, KPIs con chips, 3 gráficas, heatmap, acordeones, tablas, modal ⚙️ (abrir/cerrar, ojo de contraseña), tab stock (KPIs, chart, alertas, tabla). Vista de impresión (Ctrl+P): tablas legibles en blanco.

- [ ] **Step 3: Actualizar docs** — en `CLAUDE.md`, sección "CSS Theme System", agregar los tokens nuevos y la nota de íconos:

```markdown
Variables CSS (no Tailwind dark mode):
```css
:root { --bg, --card, --border, --text, --text2, --text3, --inp, --inp-b,
        --primary, --primary-btn, --up, --dn, --chip-up, --chip-dn, --shadow-card }
body.light { /* valores claros (enterprise, primario #0a6ed1) */ }
```
Clases: `.card`, `.t2`, `.t3`, `.inp`, `.tab-a`, `.tab-i`, `.kv`, `.alert-card`, `.badge-low`, `.up`, `.dn`, `.ne`, `.icon`, `.chip`, `.chip-up`, `.chip-dn`, `.chev`
**Íconos:** sprite SVG inline (`#i-*`) al inicio del body — `<svg class="icon"><use href="#i-nombre"/></svg>`. **Prohibido usar emojis en la UI.**
```

En `copilot-instructions.md`, en Convenciones agregar: `- Íconos: sprite SVG inline (#i-*) con <use>; prohibido emojis en la UI. Charts leen colores via chartColors()/tokens CSS`.

- [ ] **Step 4: Commit final y push**

```bash
git add index.html CLAUDE.md .github/copilot-instructions.md
git commit -m "docs: tokens y convencion de iconos SVG en contexto

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push
```

- [ ] **Step 5: Post-push** — esperar ~1 min (GitHub Pages) y verificar https://fjhr.github.io/sap-dashboard con Ctrl+Shift+R.
