# Modernización visual del Dashboard SAP B1 — Diseño

**Fecha:** 2026-07-07
**Estado:** Aprobado por Fernando (@fjhr)
**Alcance:** Solo look & feel (paleta, tipografía, íconos, componentes). El layout, la lógica JS
de datos y las features no cambian. La mejora móvil queda para una iteración posterior.

## Contexto

El dashboard (`index.html`, ~970 líneas, Tailwind CDN + Chart.js 4.4.3 + variables CSS propias)
usa emojis como íconos (📊⚙️📺🌙↻🖨), tendencias como texto plano (▲▼%) y una paleta oscura
funcional pero sin pulir. Fernando quiere una interfaz moderna **sin emojis con colores**.

## Decisiones aprobadas

Dirección estética elegida en sesión visual (companion):

- **Modo oscuro (default): "Oscuro refinado"** — evolución del look actual.
- **Modo claro: "Claro enterprise"** — tipo SAP Fiori.
- Tipografía **Inter** + números tabulares.
- **Íconos SVG de línea** (estilo Lucide) — cero emojis en toda la UI, incluido el logo del título.
- Tendencias **▲▼% como chips** redondeados con fondo tenue.

## 1. Sistema de temas

Se conserva el mecanismo actual: variables CSS en `:root` (oscuro) + overrides en `body.light`.
Tokens nuevos además de los existentes (`--bg`, `--card`, `--border`, `--text`, `--text2`,
`--text3`, `--inp`, `--inp-b`):

| Token | Oscuro (A) | Claro (C) |
|-------|-----------|-----------|
| `--bg` | `#0f172a` | `#f1f5f9` |
| `--card` | `#1e293b` | `#ffffff` |
| `--border` | `#334155` | `#e2e8f0` |
| `--primary` | `#818cf8` | `#0a6ed1` |
| `--primary-btn` | `#6366f1` | `#0a6ed1` |
| `--up` | `#34d399` | `#059669` |
| `--dn` | `#f87171` | `#dc2626` |
| `--chip-up` | `rgba(52,211,153,.12)` | `rgba(5,150,105,.1)` |
| `--chip-dn` | `rgba(248,113,113,.12)` | `rgba(220,38,38,.08)` |
| `--radius` | `14px` (cards) / `10px` (controles) | igual |
| `--shadow-card` | `0 4px 16px rgba(0,0,0,.3)` | `0 1px 3px rgba(15,23,42,.08), 0 4px 12px rgba(15,23,42,.05)` |

El `<meta name="theme-color">` se actualiza en `toggleTheme()`: `#0f172a` oscuro / `#ffffff` claro.

## 2. Íconos

- **Sprite SVG inline** al inicio del `<body>`: bloque `<svg style="display:none"><symbol
  id="i-nombre" viewBox="0 0 24 24">…</symbol></svg>` con paths estilo Lucide,
  `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"`.
- Uso: `<svg class="icon"><use href="#i-nombre"/></svg>`; clase `.icon` define tamaño
  (16px default, variantes 14/20) y `vertical-align`.
- Set mínimo: `i-logo` (barras), `i-moon`, `i-sun`, `i-refresh`, `i-tv`, `i-print`,
  `i-settings` (sliders), `i-download` (export CSV), `i-chevron` (acordeones, rota al abrir),
  `i-trend-up`, `i-trend-down`, `i-alert` (triángulo), `i-search`, `i-building` (empresa),
  `i-x` (cerrar modal), `i-eye` (mostrar contraseña).
- **Cero emojis** en la UI. El logo 📊 del `<h1>` pasa a `i-logo` en color `--primary`.
- El punto naranja indicador de credenciales custom se mantiene como badge posicionado sobre
  el botón de settings.
- Los emojis en textos de documentación/mensajes de error del backend no son parte del alcance.

## 3. Tipografía

- Inter vía Google Fonts: `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">` con fallback `system-ui, sans-serif`.
- `font-variant-numeric: tabular-nums` en valores de KPI y celdas de monto (clase `.num`).
- Números grandes de KPI: `letter-spacing: -0.5px`, peso 700.
- Offline: la fuente NO queda precacheada por el SW (las respuestas opacas cross-origin tienen
  `ok=false` y el handler no las guarda) — sin red se usa el fallback `system-ui`, lo cual es
  aceptable. No se modifica el SW por esto.

## 4. Componentes

- **KPI cards:** label uppercase con ícono; valor grande tabular; chip de tendencia
  (`--chip-up`/`--chip-dn` + `i-trend-*`) en vez del texto plano actual. La clase `.alert-card`
  (meta diaria incumplida) se conserva con el rojo del tema.
- **Botones:** primario relleno (`--primary-btn`, texto blanco, radio 10px); secundarios ghost
  (borde `--border`, texto `--text2`); íconos SVG a la izquierda del label.
- **Inputs/selects:** fondo `--inp`, borde `--inp-b`, radio 10px, `focus-visible` con ring del
  primario (2px).
- **Tablas:** encabezados uppercase con letter-spacing, hover de fila (`--border` al 40%),
  bordes horizontales sutiles; montos con `.num`; estados (Abierta/Cerrada/…) como chips.
- **Acordeones:** `i-chevron` con rotación CSS en vez de ▼/▲ de texto.
- **Modal ⚙️:** mismos tokens (radio, sombra, botones); botón cerrar con `i-x`.
- **Badges stock bajo:** chip `--chip-dn` + `i-alert`.

## 5. Gráficas y heatmap

- Helper `chartColors()` que lee las variables CSS computadas del tema activo y entrega
  `{primary, up, dn, grid, ticks}`; todas las gráficas (barras, línea, donut) lo usan.
  Hoy ya existe lectura parcial de colores por tema — se centraliza ahí.
- Heatmap: los 4 niveles de intensidad se derivan de `--primary` (alfa creciente) en ambos modos.
- Al alternar tema deben re-renderizarse **gráficas y heatmap**. Hoy `toggleTheme()` solo
  re-renderiza el heatmap — se extiende para regenerar también los charts (o re-ejecutar
  `applyFilters()`/`applyStockFilters()` según la pestaña activa).

## 6. Fuera de alcance (explícito)

- Layout/estructura HTML (grids, secciones, orden) — no cambia.
- Lógica JS de datos, endpoints, Apps Script — no cambia.
- Mejora móvil/responsive — iteración siguiente (ya conversada, quedó en pausa).
- `@media print` — debe seguir funcionando igual (verificar, no rediseñar).
- Ícono PWA — el generado (barras blancas sobre indigo) ya calza; no se regenera.

## 7. Verificación

1. Revisión visual de ambos modos en navegador (mockup final por el companion o captura).
2. Alternar tema: sin colores "pegados" del modo anterior (charts y heatmap incluidos).
3. Contraste AA en textos secundarios (`--text2`/`--text3` sobre `--card`) en ambos modos.
4. Imprimir/PDF: tablas legibles, sin fondos oscuros.
5. PWA sigue instalable (manifest/íconos sin regresión); `theme-color` correcto por modo.
6. Grep final: cero emojis en el HTML de la UI.

## Notas de implementación

- Todo vive en `index.html` (single-file, patrón del proyecto). El sprite SVG suma ~80-100
  líneas al archivo.
- Tras publicar: bump de `CACHE_NAME` del SW **no** es necesario para index.html (network-first
  desde v3), pero sí conviene verificar con Ctrl+Shift+R la primera vez.
- Regla del repo: commits con trailer de Copilot.
