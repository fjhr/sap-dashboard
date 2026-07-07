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
var SELLERS_CACHE_KEY = 'sap_sellers_data';
var STOCK_SOLO_CON_STOCK = true; // true = solo articulos con stock > 0
var STOCK_MAX_PAGINAS = 100;     // tope de seguridad (100 pag x 100 items = 10.000)

// Override de credenciales por-request (se setea en doGet, stateless entre requests)
var currentCredOverride_ = null;

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action;

    // Endpoint de diagnóstico — devuelve qué recibió el script (sin credenciales en claro)
    if (action === 'ping') {
      return jsonResponse_({
        ok: true,
        receivedParams: Object.keys(params),
        hasCredOverride: !!(params.sapUrl || params.sapUser || params.sapPass || params.sapDb),
        sapUrlReceived: params.sapUrl ? params.sapUrl.substring(0, 30) + '...' : null,
        sapDbReceived:  params.sapDb  || null,
        sapUserReceived: params.sapUser ? '***' : null,
        timestamp: new Date().toISOString()
      });
    }

    // Credenciales custom desde el dashboard (override Script Properties)
    if (params.sapUrl || params.sapUser || params.sapPass || params.sapDb) {
      currentCredOverride_ = {
        sapUrl:  params.sapUrl  || null,
        sapUser: params.sapUser || null,
        sapPass: params.sapPass || null,
        sapDb:   params.sapDb   || null
      };
    } else {
      currentCredOverride_ = null;
    }

    if (action === 'companies') return jsonResponse_({ companies: getPublicCompanies_() });

    var companyConfig = getCompanyConfig_(params);
    // Si hay override de companyDb, tomarlo directamente
    if (currentCredOverride_ && currentCredOverride_.sapDb) {
      companyConfig = { id: currentCredOverride_.sapDb, db: currentCredOverride_.sapDb };
    }

    if (action === 'sellers') return serveSellers_(companyConfig);
    if (action === 'stock') return serveStock_(e, companyConfig);

    var daysBack = params.daysBack ? parseInt(params.daysBack, 10) : null;
    // Con credenciales custom no usamos caché (cada usuario puede tener creds distintas)
    var cacheKey = currentCredOverride_ ? null : buildCacheKey_(CACHE_KEY, companyConfig.id, daysBack);

    var cache = CacheService.getScriptCache();
    var cached = cacheKey ? cache.get(cacheKey) : null;
    var data = cached ? JSON.parse(cached) : fetchAndCache(daysBack, cacheKey, companyConfig.db);

    return jsonResponse_(data);

  } catch (err) {
    // Siempre retornar JSON válido para que CORS funcione aunque haya error
    Logger.log('doGet ERROR: ' + err.message + '\n' + err.stack);
    return jsonResponse_({ error: true, message: err.message, timestamp: new Date().toISOString() });
  }
}

// ============================================================
// VENTAS
// ============================================================

function fetchAndCache(daysBackOverride, cacheKey, companyDb) {
  var data = fetchSAPData(daysBackOverride, companyDb);
  // Solo guardar en caché si hay una key válida (no guardar cuando hay credenciales custom)
  if (cacheKey) {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(data), CACHE_TTL);
  }
  return data;
}

function fetchSAPData(daysBackOverride, companyDb) {
  var props = PropertiesService.getScriptProperties();
  var session = openSAPSession_(companyDb);

  var daysBack = daysBackOverride || parseInt(props.getProperty('SAP_DAYS_BACK') || '5', 10);
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  var dateFilter = Utilities.formatDate(cutoff, Session.getScriptTimeZone(), "yyyy-MM-dd");

  var fields = 'DocNum,CardCode,CardName,DocDate,DocTotal,DocumentStatus,SalesPersonCode';
  var invoices = [];
  var orders = [];
  var deliveries = [];

  try {
   invoices   = fetchAll(session.baseUrl, '/Invoices',      dateFilter, fields, session.headers);
   orders     = fetchAll(session.baseUrl, '/Orders',        dateFilter, fields, session.headers);
   deliveries = fetchAll(session.baseUrl, '/DeliveryNotes', dateFilter, fields, session.headers);
  } finally {
   closeSAPSession_(session);
  }

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
    muteHttpExceptions: true,
    validateHttpsCertificates: false
  });

  if (resp.getResponseCode() !== 200) {
    Logger.log('Error fetching ' + endpoint + ': ' + resp.getContentText());
    return [];
  }

  var json = JSON.parse(resp.getContentText());
  return json.value || [];
}

function serveSellers_(companyConfig) {
  var cache = CacheService.getScriptCache();
  // Sin caché cuando hay credenciales custom (cada usuario puede apuntar a otro servidor)
  var cacheKey = currentCredOverride_ ? null : buildCacheKey_(SELLERS_CACHE_KEY, companyConfig.id);
  var cached = cacheKey ? cache.get(cacheKey) : null;
  var data = cached ? JSON.parse(cached) : fetchSellersData_(companyConfig.db);
  if (!cached && cacheKey) cache.put(cacheKey, JSON.stringify(data), CACHE_TTL);
  return jsonResponse_({ sellers: data });
}

function fetchSellersData_(companyDb) {
  var session = openSAPSession_(companyDb);
  try {
    var resp = UrlFetchApp.fetch(session.baseUrl + '/SalesPersons?$select=SalesEmployeeCode,SalesEmployeeName', {
      method: 'get',
      headers: session.headers,
      muteHttpExceptions: true,
      validateHttpsCertificates: false
    });
    if (resp.getResponseCode() !== 200) {
      Logger.log('Error fetching SalesPersons: ' + resp.getContentText());
      return [];
    }
    var json = JSON.parse(resp.getContentText());
    return (json.value || []).map(function(item) {
      return {
        id: String(item.SalesEmployeeCode),
        code: item.SalesEmployeeCode,
        name: item.SalesEmployeeName || ('Vendedor ' + item.SalesEmployeeCode)
      };
    });
  } finally {
    closeSAPSession_(session);
  }
}

// ============================================================
// STOCK POR BODEGA (nuevo)
// ============================================================

function serveStock_(e, companyConfig) {
  // Siempre forzar lectura fresca cuando hay credenciales custom
  var forzar = currentCredOverride_ || (e && e.parameter && e.parameter.refresh === '1');
  var cacheKey = currentCredOverride_ ? null : buildCacheKey_(STOCK_CACHE_KEY, companyConfig.id);
  var data = forzar ? null : leerStockCache_(cacheKey);
  if (!data) {
    data = fetchStockData(companyConfig.db);
    if (cacheKey) guardarStockCache_(data, cacheKey);
  }
  return jsonResponse_(data);
}

function fetchStockData(companyDb) {
  var session = openSAPSession_(companyDb);

  var bodegas = [];
  var articulos = [];

  try {
    bodegas = fetchBodegas_(session.baseUrl, session.headers);
    articulos = fetchArticulosStock_(session.baseUrl, session.headers);
  } finally {
    closeSAPSession_(session);
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
    muteHttpExceptions: true,
    validateHttpsCertificates: false
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
      muteHttpExceptions: true,
      validateHttpsCertificates: false
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

function guardarStockCache_(data, cacheBaseKey) {
  var cache = CacheService.getScriptCache();
  var texto = JSON.stringify(data);
  var tam = 80000;
  var partes = Math.ceil(texto.length / tam);
  var key = cacheBaseKey || STOCK_CACHE_KEY;
  for (var i = 0; i < partes; i++) {
    cache.put(key + '_' + i, texto.substr(i * tam, tam), CACHE_TTL);
  }
  cache.put(key + '_META', String(partes), CACHE_TTL);
}

function leerStockCache_(cacheBaseKey) {
  var cache = CacheService.getScriptCache();
  var key = cacheBaseKey || STOCK_CACHE_KEY;
  var meta = cache.get(key + '_META');
  if (!meta) return null;
  var partes = parseInt(meta, 10);
  var texto = '';
  for (var i = 0; i < partes; i++) {
    var parte = cache.get(key + '_' + i);
    if (parte === null) return null;
    texto += parte;
  }
  try { return JSON.parse(texto); } catch (e) { return null; }
}

/** Prueba manual del stock: ejecutar desde el editor y revisar el registro */
function testStock() {
  var data = fetchStockData(getCompanyDb_({}));
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
    fetchAndCache(null, buildCacheKey_(CACHE_KEY, 'DEFAULT'), getCompanyDb_({}));
    Logger.log('Cache ventas actualizado: ' + new Date().toISOString());
  } catch(e) {
    Logger.log('Error en refreshCache (ventas): ' + e.message);
  }
  try {
    guardarStockCache_(fetchStockData(getCompanyDb_({})), buildCacheKey_(STOCK_CACHE_KEY, 'DEFAULT'));
    Logger.log('Cache stock actualizado: ' + new Date().toISOString());
  } catch(e) {
    Logger.log('Error en refreshCache (stock): ' + e.message);
  }
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildCacheKey_(baseKey, companyId, suffix) {
  var key = baseKey + '_' + sanitizeCachePart_(companyId || 'DEFAULT');
  return suffix ? key + '_' + suffix : key;
}

function sanitizeCachePart_(value) {
  return String(value || 'DEFAULT').replace(/[^A-Za-z0-9_-]/g, '_');
}

function openSAPSession_(companyDb, credOverride) {
  var cred = credOverride || currentCredOverride_ || {};
  var props = PropertiesService.getScriptProperties();
  var baseUrl  = cred.sapUrl  || props.getProperty('SAP_BASE_URL');
  var user     = cred.sapUser || props.getProperty('SAP_USER');
  var password = cred.sapPass || props.getProperty('SAP_PASSWORD');
  var db       = cred.sapDb   || companyDb || props.getProperty('SAP_COMPANY_DB');
  var language = parseInt(props.getProperty('SAP_LANGUAGE') || '25', 10);
  var loginResp = UrlFetchApp.fetch(baseUrl + '/Login', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ CompanyDB: db, UserName: user, Password: password, Language: language }),
    muteHttpExceptions: true,
    validateHttpsCertificates: false  // permite certificados autofirmados (dev/internal SAP)
  });

  if (loginResp.getResponseCode() !== 200) {
    throw new Error('SAP Login failed (HTTP ' + loginResp.getResponseCode() + '): ' + loginResp.getContentText().substring(0, 300));
  }

  var sessionId = JSON.parse(loginResp.getContentText()).SessionId;
  return {
    baseUrl: baseUrl,
    headers: { 'Cookie': 'B1SESSION=' + sessionId, 'Prefer': 'odata.maxpagesize=100' }
  };
}

function closeSAPSession_(session) {
  if (!session || !session.baseUrl || !session.headers) return;
  try {
    UrlFetchApp.fetch(session.baseUrl + '/Logout', {
      method: 'post',
      headers: session.headers,
      muteHttpExceptions: true,
      validateHttpsCertificates: false
    });
  } catch (e) {}
}

function getCompanyDb_(params) {
  var props = PropertiesService.getScriptProperties();
  var companyId = params && params.company;
  if (!companyId) return props.getProperty('SAP_COMPANY_DB');

  var companies = getCompanies_();
  for (var i = 0; i < companies.length; i++) {
    if (companies[i].id === companyId) return companies[i].db;
  }
  throw new Error('Empresa no configurada: ' + companyId);
}

function getCompanyConfig_(params) {
  var companyId = params && params.company;
  if (!companyId) {
    return { id: 'DEFAULT', db: getCompanyDb_({}), name: 'Empresa por defecto' };
  }

  var companies = getCompanies_();
  for (var i = 0; i < companies.length; i++) {
    if (companies[i].id === companyId) return companies[i];
  }
  throw new Error('Empresa no configurada: ' + companyId);
}

function getCompanies_() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('SAP_COMPANIES');
  if (!raw) return [];

  try {
    var parsed = JSON.parse(raw);
    if (!(parsed instanceof Array)) return [];
    return parsed
      .filter(function(item) { return item && item.id && item.db; })
      .map(function(item) {
        return {
          id: String(item.id),
          name: item.name || String(item.id),
          db: item.db
        };
      });
  } catch (e) {
    Logger.log('SAP_COMPANIES inválido: ' + e.message);
    return [];
  }
}

function getPublicCompanies_() {
  return getCompanies_().map(function(item) {
    return { id: item.id, name: item.name };
  });
}