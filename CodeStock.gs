/**
 * SAP Business One Dashboard - Google Apps Script
 * Ventas (original) + Stock por bodega (nuevo)
 *
 * Setup:
 *  1. Script Properties: SAP_BASE_URL, SAP_COMPANY_DB, SAP_USER,
 *     SAP_PASSWORD, SAP_LANGUAGE (igual que antes)
 *  2. Web App: Execute as "Me", Access "Anyone"
 *  3. Ejecutar setupTrigger() una vez (el trigger ahora refresca ventas Y stock)
 *
 * Endpoints:
 *  - URL                  -> ventas (igual que siempre)
 *  - URL?action=stock     -> stock por bodega
 *  - URL?action=stock&refresh=1 -> stock forzando lectura fresca de SAP
 */

var CACHE_KEY = 'sap_sales_data';
var CACHE_TTL = 21600; // 6 horas en segundos

// --- Config Stock ---
var STOCK_CACHE_KEY = 'sap_stock_data';
var STOCK_SOLO_CON_STOCK = true; // true = solo articulos con stock > 0
var STOCK_MAX_PAGINAS = 100;     // tope de seguridad (100 pag x 100 items = 10.000)

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'stock') {
    return serveStock_(e);
  }

  // --- Ventas (sin cambios) ---
  var cache = CacheService.getScriptCache();
  var cached = cache.get(CACHE_KEY);
  var data = cached ? JSON.parse(cached) : fetchAndCache();

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// VENTAS (codigo original, sin cambios)
// ============================================================

function fetchAndCache() {
  var data = fetchSAPData();
  CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(data), CACHE_TTL);
  return data;
}

function fetchSAPData() {
  var props = PropertiesService.getScriptProperties();
  var baseUrl   = props.getProperty('SAP_BASE_URL');
  var companyDb = props.getProperty('SAP_COMPANY_DB');
  var user      = props.getProperty('SAP_USER');
  var password  = props.getProperty('SAP_PASSWORD');
  var language  = parseInt(props.getProperty('SAP_LANGUAGE') || '25', 10);

  var loginResp = UrlFetchApp.fetch(baseUrl + '/Login', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ CompanyDB: companyDb, UserName: user, Password: password, Language: language }),
    muteHttpExceptions: true
  });

  if (loginResp.getResponseCode() !== 200) {
    throw new Error('SAP Login failed: ' + loginResp.getContentText());
  }

  var sessionId = JSON.parse(loginResp.getContentText()).SessionId;
  var reqHeaders = { 'Cookie': 'B1SESSION=' + sessionId, 'Prefer': 'odata.maxpagesize=100' };

  var daysBack = parseInt(props.getProperty('SAP_DAYS_BACK') || '5', 10);
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  var dateFilter = Utilities.formatDate(cutoff, Session.getScriptTimeZone(), "yyyy-MM-dd");

  var fields = 'DocNum,CardCode,CardName,DocDate,DocTotal,DocumentStatus';

  var invoices   = fetchAll(baseUrl, '/Invoices',      dateFilter, fields, reqHeaders);
  var orders     = fetchAll(baseUrl, '/Orders',        dateFilter, fields, reqHeaders);
  var deliveries = fetchAll(baseUrl, '/DeliveryNotes', dateFilter, fields, reqHeaders);

  try {
    UrlFetchApp.fetch(baseUrl + '/Logout', { method: 'post', headers: reqHeaders, muteHttpExceptions: true });
  } catch(e) {}

  return {
    lastUpdated: new Date().toISOString(),
    currency: 'CLP',
    dateFrom: dateFilter,
    invoices: invoices,
    orders: orders,
    deliveries: deliveries
  };
}

function fetchAll(baseUrl, endpoint, dateFilter, fields, headers) {
  var url = baseUrl + endpoint
    + "?$filter=DocDate ge '" + dateFilter + "'"
    + "&$select=" + fields
    + "&$orderby=DocDate desc"
    + "&$top=100";

  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true
  });

  if (resp.getResponseCode() !== 200) {
    Logger.log('Error fetching ' + endpoint + ': ' + resp.getContentText());
    return [];
  }

  var json = JSON.parse(resp.getContentText());
  return json.value || [];
}

// ============================================================
// STOCK POR BODEGA (nuevo)
// ============================================================

function serveStock_(e) {
  var forzar = e && e.parameter && e.parameter.refresh === '1';
  var data = forzar ? null : leerStockCache_();
  if (!data) {
    data = fetchStockData();
    guardarStockCache_(data);
  }
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function fetchStockData() {
  var props = PropertiesService.getScriptProperties();
  var baseUrl   = props.getProperty('SAP_BASE_URL');
  var companyDb = props.getProperty('SAP_COMPANY_DB');
  var user      = props.getProperty('SAP_USER');
  var password  = props.getProperty('SAP_PASSWORD');
  var language  = parseInt(props.getProperty('SAP_LANGUAGE') || '25', 10);

  var loginResp = UrlFetchApp.fetch(baseUrl + '/Login', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ CompanyDB: companyDb, UserName: user, Password: password, Language: language }),
    muteHttpExceptions: true
  });

  if (loginResp.getResponseCode() !== 200) {
    throw new Error('SAP Login failed (stock): ' + loginResp.getContentText());
  }

  var sessionId = JSON.parse(loginResp.getContentText()).SessionId;
  var reqHeaders = { 'Cookie': 'B1SESSION=' + sessionId, 'Prefer': 'odata.maxpagesize=100' };

  var bodegas = [];
  var articulos = [];

  try {
    bodegas = fetchBodegas_(baseUrl, reqHeaders);
    articulos = fetchArticulosStock_(baseUrl, reqHeaders);
  } finally {
    try {
      UrlFetchApp.fetch(baseUrl + '/Logout', { method: 'post', headers: reqHeaders, muteHttpExceptions: true });
    } catch(e) {}
  }

  var unidades = 0;
  articulos.forEach(function(a) { unidades += a.total; });

  return {
    lastUpdated: new Date().toISOString(),
    totales: {
      articulos: articulos.length,
      unidades: Math.round(unidades * 100) / 100,
      bodegas: bodegas.length
    },
    bodegas: bodegas,
    articulos: articulos
  };
}

function fetchBodegas_(baseUrl, headers) {
  var resp = UrlFetchApp.fetch(baseUrl + '/Warehouses?$select=WarehouseCode,WarehouseName', {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    Logger.log('Error fetching Warehouses: ' + resp.getContentText());
    return [];
  }
  var json = JSON.parse(resp.getContentText());
  return (json.value || []).map(function(w) {
    return { codigo: w.WarehouseCode, nombre: w.WarehouseName };
  });
}

function fetchArticulosStock_(baseUrl, headers) {
  var filtro = STOCK_SOLO_CON_STOCK ? '&$filter=QuantityOnStock gt 0' : '';
  var url = baseUrl + '/Items?$select=ItemCode,ItemName,QuantityOnStock,ItemWarehouseInfoCollection' + filtro;

  var articulos = [];
  var paginas = 0;

  while (url && paginas < STOCK_MAX_PAGINAS) {
    var resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: headers,
      muteHttpExceptions: true
    });

    if (resp.getResponseCode() !== 200) {
      Logger.log('Error fetching Items: ' + resp.getContentText());
      break;
    }

    var json = JSON.parse(resp.getContentText());

    (json.value || []).forEach(function(item) {
      var porBodega = {};
      (item.ItemWarehouseInfoCollection || []).forEach(function(w) {
        if (w.InStock) porBodega[w.WarehouseCode] = w.InStock;
      });
      articulos.push({
        codigo: item.ItemCode,
        nombre: item.ItemName,
        total: item.QuantityOnStock || 0,
        bodegas: porBodega
      });
    });

    var next = json['@odata.nextLink'] || json['odata.nextLink'] || null;
    if (next) {
      url = (next.indexOf('http') === 0) ? next : baseUrl + '/' + String(next).replace(/^\//, '');
    } else {
      url = null;
    }
    paginas++;
  }

  return articulos;
}

// --- Cache de stock en trozos (limite de 100KB por clave) ---

function guardarStockCache_(data) {
  var cache = CacheService.getScriptCache();
  var texto = JSON.stringify(data);
  var tam = 80000;
  var partes = Math.ceil(texto.length / tam);
  for (var i = 0; i < partes; i++) {
    cache.put(STOCK_CACHE_KEY + '_' + i, texto.substr(i * tam, tam), CACHE_TTL);
  }
  cache.put(STOCK_CACHE_KEY + '_META', String(partes), CACHE_TTL);
}

function leerStockCache_() {
  var cache = CacheService.getScriptCache();
  var meta = cache.get(STOCK_CACHE_KEY + '_META');
  if (!meta) return null;
  var partes = parseInt(meta, 10);
  var texto = '';
  for (var i = 0; i < partes; i++) {
    var parte = cache.get(STOCK_CACHE_KEY + '_' + i);
    if (parte === null) return null;
    texto += parte;
  }
  try { return JSON.parse(texto); } catch (e) { return null; }
}

/** Prueba manual del stock: ejecutar desde el editor y revisar el registro */
function testStock() {
  var data = fetchStockData();
  Logger.log('Bodegas: ' + data.totales.bodegas);
  Logger.log('Articulos con stock: ' + data.totales.articulos);
  Logger.log('Unidades totales: ' + data.totales.unidades);
  Logger.log('Primeros 3: ' + JSON.stringify(data.articulos.slice(0, 3)));
  guardarStockCache_(data);
}

// ============================================================
// TRIGGER (actualizado: refresca ventas Y stock)
// ============================================================

/** Ejecutar una vez para crear el trigger de actualización cada 6 horas */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'refreshCache') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshCache').timeBased().everyHours(6).create();
  Logger.log('Trigger creado: refreshCache cada 6 horas');
}

/** Invocado por el trigger para actualizar ambos cachés */
function refreshCache() {
  try {
    fetchAndCache();
    Logger.log('Cache ventas actualizado: ' + new Date().toISOString());
  } catch(e) {
    Logger.log('Error en refreshCache (ventas): ' + e.message);
  }
  try {
    guardarStockCache_(fetchStockData());
    Logger.log('Cache stock actualizado: ' + new Date().toISOString());
  } catch(e) {
    Logger.log('Error en refreshCache (stock): ' + e.message);
  }
}