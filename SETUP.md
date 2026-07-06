# Guía de Configuración

## 1. Google Apps Script

### Crear el proyecto

1. Ve a [script.google.com](https://script.google.com) y crea un nuevo proyecto.
2. Nómbralo **SAP B1 Dashboard**.
3. Copia el contenido de `Code.gs` de este repositorio al editor.

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

### Desplegar como Web App

1. Click en **Deploy** → **New Deployment**
2. Tipo: **Web App**
3. Configuración:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** y copia la URL resultante (`https://script.google.com/macros/s/.../exec`)

### Crear trigger de actualización

1. En el editor, selecciona la función `setupTrigger` en el menú desplegable
2. Click ▶️ **Run**
3. Aprueba los permisos solicitados
4. Esto creará un trigger que actualiza el caché cada 6 horas

---

## 2. HTML (GitHub Pages)

1. Abre `index.html` en este repositorio
2. Busca la línea:
   ```js
   const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL';
   ```
3. Reemplaza `YOUR_APPS_SCRIPT_WEB_APP_URL` con la URL obtenida en el paso anterior
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
3. Branch: `main` / `/ (root)`
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
├── index.html    ← Dashboard (GitHub Pages)
├── Code.gs       ← Google Apps Script (copiar al editor)
├── README.md
└── SETUP.md      ← Esta guía
```
