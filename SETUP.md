# Guía de Configuración

## 1. Google Apps Script

### Crear el proyecto

1. Ve a [script.google.com](https://script.google.com) y crea un nuevo proyecto.
2. Nómbralo **SAP B1 Dashboard**.
3. Copia el contenido de **`CodeStock.gs`** de este repositorio al editor (⚠️ NO uses `Code.gs`, está deprecado).

> 💡 Alternativa CLI: con [clasp](https://github.com/google/clasp) (`npm i -g @google/clasp`, `clasp login`)
> puedes subir y desplegar sin tocar el editor — ver "Actualizar el script" más abajo.

### Configurar credenciales (Script Properties)

> ⚠️ **Nunca pongas contraseñas directamente en el código.**

En el editor de Apps Script:

1. Click en ⚙️ **Project Settings** (ícono de engranaje)
2. Scroll hasta **Script Properties**
3. Agrega las siguientes propiedades:

| Propiedad       | Valor                                              |
|-----------------|----------------------------------------------------|
| SAP_BASE_URL    | https://dev-seidorb1.cloudseidor.com:50000/b1s/v1  |
| SAP_COMPANY_DB  | TESTSOP                                            |
| SAP_USER        | Integrador                                         |
| SAP_PASSWORD    | (tu contraseña de SAP)                             |
| SAP_LANGUAGE    | 25                                                 |
| SAP_DAYS_BACK   | 5 (días de historial por defecto)                  |
| SAP_COMPANIES   | (opcional) `[{"id":"ID","name":"Nombre","db":"DB"}]` |

### Desplegar como Web App

1. Click en **Deploy** → **New Deployment**
2. Tipo: **Web App**
3. Configuración:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** y copia la URL resultante (`https://script.google.com/macros/s/.../exec`)

### Actualizar el script (tras cada cambio en CodeStock.gs)

El deployment sirve una **versión congelada** del código: subir cambios no basta, hay que crear
una nueva versión del **mismo** deployment (para no cambiar la URL):

```bash
clasp push -f
clasp deployments                        # anota el ID del deployment (el de la URL /macros/s/<ID>/exec)
clasp deploy -i <deployment-id> -d "descripción del cambio"
```

O manualmente: `Deploy → Manage Deployments → ✏️ → New Version → Deploy`.

Verifica que la nueva versión está viva con `GET <url>/exec?action=ping`.

### Crear trigger de actualización

1. En el editor, selecciona la función `setupTrigger` en el menú desplegable
2. Click ▶️ **Run**
3. Aprueba los permisos solicitados
4. Esto creará un trigger que actualiza el caché cada 6 horas

---

## 2. HTML (GitHub Pages)

1. Abre `index.html` en este repositorio
2. Busca las líneas:
   ```js
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/TU_ID/exec';
   const STOCK_URL       = 'https://script.google.com/macros/s/TU_ID/exec';
   ```
3. Reemplaza ambas con la URL obtenida en el paso anterior (es el mismo deployment)
4. Haz commit y push:
   ```bash
   git add index.html
   git commit -m "chore: set Apps Script URL"
   git push
   ```

---

## 3. Habilitar GitHub Pages

1. Ve a `https://github.com/fjhr/sap-dashboard/settings/pages`
2. Source: **Deploy from branch**
3. Branch: `master` / `/ (root)`
4. Click **Save**
5. En ~1 minuto, tu dashboard estará en:
   **https://fjhr.github.io/sap-dashboard**

---

## Verificación

- Abre `https://fjhr.github.io/sap-dashboard`
- Deberías ver el spinner y luego los datos de SAP
- Si hay error, abre DevTools → Console para ver el mensaje

## Estructura del proyecto

```
sap-dashboard/
├── index.html      ← Dashboard (GitHub Pages)
├── CodeStock.gs    ← Google Apps Script ACTIVO (subir con clasp o copiar al editor)
├── Code.gs         ← Versión inicial (deprecada — no usar)
├── .clasp.json     ← Config de clasp (deploy automatizado)
├── manifest.json   ← PWA manifest
├── sw.js           ← Service Worker
├── README.md
└── SETUP.md        ← Esta guía
```

> 💡 Si el dashboard no refleja un cambio recién publicado en `index.html`, el Service Worker
> puede estar sirviendo la versión cacheada: recarga con **Ctrl+Shift+R**.
