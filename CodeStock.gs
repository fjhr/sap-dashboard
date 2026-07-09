/**
 * SAP Business One Dashboard - Google Apps Script
 * Ventas (original) + Stock por bodega (nuevo)
 *
 * Setup:
 *  1. Script Properties: SAP_BASE_URL, SAP_COMPANY_DB, SAP_USER,
 *     SAP_PASSWORD, SAP_LANGUAGE (igual que antes)
 *  2. Web App: Execute as "Me", Access "Anyone"
 *  3. Ejecutar setupTrigger() una vez (ventas cada 6h + tramo de stock cada 5 min)
 *
 * Endpoints:
 *  - URL                  -> ventas (igual que siempre)
 *  - URL?action=stock     -> stock por bodega
 *  - URL?action=stock&refresh=1 -> stock forzando lectura fresca de SAP
 *
 * Stock troceado: con catálogos grandes, traer TODOS los artículos (con el detalle
 * por bodega de ItemWarehouseInfoCollection) no entra en los 6 min que Apps Script
 * permite por ejecución. runStockChunk_ avanza un tramo acotado en tiempo por llamada
 * y persiste el progreso (skip) en caché; el trigger refreshStockChunk_ lo continúa
 * cada 5 min hasta completar el catálogo, momento en que publica el resultado final.
 */

var CACHE_KEY = 'sap_sales_data';
var CACHE_TTL = 21600; // 6 horas en segundos

// --- Config Stock ---
var STOCK_CACHE_KEY = 'sap_stock_data';
var SELLERS_CACHE_KEY = 'sap_sellers_data';
var STOCK_SOLO_CON_STOCK = true; // true = solo articulos con stock > 0
var STOCK_MAX_PAGINAS = 100;     // tope de seguridad por tramo (100 pag x 50 items = 5.000)
var STOCK_CHUNK_BUDGET_MS = 4.5 * 60 * 1000; // margen bajo el tope de 6 min de Apps Script
var SALES_MAX_PAGINAS = 10;      // tope ventas (10 pag x 100 docs por tipo, los más recientes primero)

// Override de credenciales por-request (se setea en doGet, stateless entre requests)
var currentCredOverride_ = null;

// Errores no fatales de fetchs a SAP durante el request (se incluyen como warnings en la respuesta)
var fetchWarnings_ = [];

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
    // Límite superior opcional del rango (yyyy-mm-dd); se ignora si viene malformado
    var dateTo = (params.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(params.dateTo)) ? params.dateTo : null;
    // Con credenciales custom no usamos caché (cada usuario puede tener creds distintas)
    var cacheSuffix = [daysBack, dateTo].filter(Boolean).join('_') || null;
    var cacheKey = currentCredOverride_ ? null : buildCacheKey_(CACHE_KEY, companyConfig.id, cacheSuffix);

    var cache = CacheService.getScriptCache();
    var cached = cacheKey ? cache.get(cacheKey) : null;
    var data = cached ? JSON.parse(cached) : fetchAndCache(daysBack, cacheKey, companyConfig.db, dateTo);

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

function fetchAndCache(daysBackOverride, cacheKey, companyDb, dateTo) {
  var data = fetchSAPData(daysBackOverride, companyDb, dateTo);
  // Solo guardar en caché si hay una key válida (no guardar cuando hay credenciales custom)
  if (cacheKey) {
    try {
      CacheService.getScriptCache().put(cacheKey, JSON.stringify(data), CACHE_TTL);
    } catch (e) {
      // Rangos grandes pueden superar los 100KB por clave del cache: servir sin cachear
      Logger.log('No se pudo cachear ventas: ' + e.message);
    }
  }
  return data;
}

function fetchSAPData(daysBackOverride, companyDb, dateTo) {
  var props = PropertiesService.getScriptProperties();
  fetchWarnings_ = [];
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
   invoices   = fetchAll(session.baseUrl, '/Invoices',      dateFilter, fields, session.headers, dateTo);
   orders     = fetchAll(session.baseUrl, '/Orders',        dateFilter, fields, session.headers, dateTo);
   deliveries = fetchAll(session.baseUrl, '/DeliveryNotes', dateFilter, fields, session.headers, dateTo);
  } finally {
   closeSAPSession_(session);
  }

  var result = {
   lastUpdated: new Date().toISOString(),
    currency: 'CLP',
    dateFrom: dateFilter,
    dateTo: dateTo || null,
    invoices: invoices,
    orders: orders,
    deliveries: deliveries
  };
  if (fetchWarnings_.length) result.warnings = fetchWarnings_;
  return result;
}

function fetchAll(baseUrl, endpoint, dateFilter, fields, headers, dateTo) {
  var filter = "DocDate ge '" + dateFilter + "'";
  if (dateTo) filter += " and DocDate le '" + dateTo + "'";

  // Paginación explícita con $top/$skip: no todos los servidores SAP respetan el
  // Prefer odata.maxpagesize, y una respuesta única puede superar los ~50MB que
  // tolera UrlFetchApp (JSON truncado => "Unterminated string in JSON")
  var pageSize = 100;
  var docs = [];
  var paginas = 0;
  var recibidos = pageSize;

  while (recibidos === pageSize && paginas < SALES_MAX_PAGINAS) {
    var url = baseUrl + endpoint
      + "?$filter=" + filter
      + "&$select=" + fields
      + "&$orderby=DocDate desc"
      + "&$top=" + pageSize
      + "&$skip=" + (paginas * pageSize);

    var resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: headers,
      muteHttpExceptions: true,
      validateHttpsCertificates: false
    });

    if (resp.getResponseCode() !== 200) {
      Logger.log('Error fetching ' + endpoint + ': ' + resp.getContentText());
      fetchWarnings_.push(endpoint + ' HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().substring(0, 200));
      break;
    }

    var json = JSON.parse(resp.getContentText());
    var pagina = json.value || [];
    docs = docs.concat(pagina);
    recibidos = pagina.length;
    paginas++;
  }

  return docs;
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
  var companyDb = companyConfig.db;
  var companyId = companyConfig.id;
  var forzar = e && e.parameter && e.parameter.refresh === '1';

  // Credenciales custom: nunca cachear (cada usuario puede tener creds distintas);
  // se corre un único tramo acotado y se devuelve lo que se alcance a traer.
  if (currentCredOverride_) {
    return jsonResponse_(runStockChunk_(companyDb, null, STOCK_CHUNK_BUDGET_MS));
  }

  var finalKey = buildCacheKey_(STOCK_CACHE_KEY, companyId);
  var cached = forzar ? null : leerStockCache_(finalKey);
  if (cached) return jsonResponse_(cached);

  return jsonResponse_(runStockChunk_(companyDb, companyId, STOCK_CHUNK_BUDGET_MS));
}

/**
 * Avanza un tramo (<= budgetMs) del refresco de stock. Si con eso alcanza a
 * recorrer todo el catálogo, publica y retorna el resultado final. Si no,
 * persiste el progreso (skip) para el próximo tramo y retorna lo mejor
 * disponible (caché anterior, o el resultado parcial de este tramo) con un
 * warning explicando que sigue en curso — así el usuario nunca se queda sin
 * respuesta ni con un "Failed to fetch" mientras el catálogo es grande.
 */
function runStockChunk_(companyDb, companyId, budgetMs) {
  var finalKey = companyId ? buildCacheKey_(STOCK_CACHE_KEY, companyId) : null;
  var wipKey = companyId ? buildCacheKey_(STOCK_CACHE_KEY, companyId, 'wip') : null;
  var deadline = Date.now() + budgetMs;
  var previous = finalKey ? leerStockCache_(finalKey) : null;

  fetchWarnings_ = [];
  var session = openSAPSession_(companyDb);
  var state, page;
  try {
    state = (wipKey && leerStockCache_(wipKey)) || null;
    if (!state) state = { skip: 0, articulos: [], bodegas: fetchBodegas_(session.baseUrl, session.headers) };
    page = fetchArticulosStockPage_(session.baseUrl, session.headers, state.skip, deadline);
    state.articulos = state.articulos.concat(page.articulos);
    state.skip = page.nextSkip;
  } finally {
    closeSAPSession_(session);
  }

  if (page.done) {
    var unidades = 0;
    state.articulos.forEach(function(a) { unidades += a.total; });
    var finalData = {
      lastUpdated: new Date().toISOString(),
      totales: {
        articulos: state.articulos.length,
        unidades: Math.round(unidades * 100) / 100,
        bodegas: state.bodegas.length
      },
      bodegas: state.bodegas,
      articulos: state.articulos
    };
    if (fetchWarnings_.length) finalData.warnings = fetchWarnings_;
    if (finalKey) { guardarStockCache_(finalData, finalKey); borrarStockCache_(wipKey); }
    return finalData;
  }

  // No alcanzó a completar el catálogo en este tramo
  if (wipKey) guardarStockCache_(state, wipKey);
  var aviso = companyId
    ? 'Actualizando stock desde SAP (catálogo grande) — se completa en varios tramos de '
      + Math.round(budgetMs / 60000) + ' min. '
      + (previous ? 'Mostrando datos de ' + previous.lastUpdated + ' mientras tanto.' : 'Resultado parcial, volvé a intentar en unos minutos para completar.')
    : 'La consulta alcanzó el tiempo máximo (' + Math.round(budgetMs / 60000) + ' min) — resultado parcial, volvé a intentar para continuar.';

  if (previous) {
    previous.warnings = (previous.warnings || []).concat(fetchWarnings_, [aviso]);
    return previous;
  }
  var unidadesParcial = 0;
  state.articulos.forEach(function(a) { unidadesParcial += a.total; });
  return {
    lastUpdated: null,
    totales: {
      articulos: state.articulos.length,
      unidades: Math.round(unidadesParcial * 100) / 100,
      bodegas: (state.bodegas || []).length
    },
    bodegas: state.bodegas || [],
    articulos: state.articulos,
    warnings: fetchWarnings_.concat([aviso])
  };
}

/** Uso manual (editor): pull sincrónico completo, sin tope de tiempo (puede exceder los 6 min de Apps Script con catálogos grandes) */
function fetchStockData(companyDb) {
  fetchWarnings_ = [];
  var session = openSAPSession_(companyDb);
  var bodegas = [], articulos = [];
  try {
    bodegas = fetchBodegas_(session.baseUrl, session.headers);
    var skip = 0, page;
    do {
      page = fetchArticulosStockPage_(session.baseUrl, session.headers, skip, Infinity);
      articulos = articulos.concat(page.articulos);
      skip = page.nextSkip;
    } while (!page.done);
  } finally {
    closeSAPSession_(session);
  }

  var unidades = 0;
  articulos.forEach(function(a) { unidades += a.total; });

  var result = {
    lastUpdated: new Date().toISOString(),
    totales: {
      articulos: articulos.length,
      unidades: Math.round(unidades * 100) / 100,
      bodegas: bodegas.length
    },
    bodegas: bodegas,
    articulos: articulos
  };
  if (fetchWarnings_.length) result.warnings = fetchWarnings_;
  return result;
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
    fetchWarnings_.push('/Warehouses HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().substring(0, 200));
    return [];
  }
  var json = JSON.parse(resp.getContentText());
  return (json.value || []).map(function(w) {
    return { codigo: w.WarehouseCode, nombre: w.WarehouseName };
  });
}

/**
 * Trae artículos de stock desde skipStart, deteniéndose ANTES de superar `deadline`
 * (Date.now() en ms) o el tope de páginas de este tramo. Retorna {articulos, nextSkip, done}:
 * done=true cuando se llegó al final real del catálogo (o a un error/tope que no vale
 * la pena reintentar); done=false cuando se cortó por tiempo y hay que seguir en otro tramo.
 */
function fetchArticulosStockPage_(baseUrl, headers, skipStart, deadline) {
  var filtro = STOCK_SOLO_CON_STOCK ? '&$filter=' + encodeURIComponent('QuantityOnStock gt 0') : '';

  // Paginación explícita con $top/$skip (ver comentario en fetchAll) y tamaño de página
  // ADAPTATIVO: ItemWarehouseInfoCollection trae una entrada por CADA bodega del sistema
  // (~40 campos c/u); en bases con muchas bodegas una página de 50 artículos puede superar
  // los ~50MB de UrlFetchApp (JSON truncado). Si la página no parsea, se reduce y reintenta.
  var pageSize = 50;
  var articulos = [];
  var skip = skipStart || 0;
  var paginas = 0;
  var done = false;

  while (paginas < STOCK_MAX_PAGINAS) {
    if (Date.now() >= deadline) break; // se acabó el tiempo de este tramo; continúa el próximo

    var url = baseUrl + '/Items?$select=ItemCode,ItemName,QuantityOnStock,ItemWarehouseInfoCollection'
      + filtro
      + '&$orderby=ItemCode'
      + '&$top=' + pageSize
      + '&$skip=' + skip;

    var resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: headers,
      muteHttpExceptions: true,
      validateHttpsCertificates: false
    });

    if (resp.getResponseCode() !== 200) {
      Logger.log('Error fetching Items: ' + resp.getContentText());
      fetchWarnings_.push('/Items HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().substring(0, 200));
      done = true; // error real, no seguir reintentando tramo tras tramo
      break;
    }

    var json;
    try {
      json = JSON.parse(resp.getContentText());
    } catch (e) {
      // Página truncada por el límite de ~50MB de UrlFetchApp
      if (pageSize > 1) {
        pageSize = Math.max(1, Math.floor(pageSize / 10));
        Logger.log('Página /Items truncada; reintentando con pageSize=' + pageSize);
        continue; // reintenta el mismo skip con página más chica
      }
      fetchWarnings_.push('/Items: la respuesta supera 50MB incluso pidiendo 1 artículo — el servidor ignora $top o el artículo es gigante: ' + e.message);
      done = true;
      break;
    }

    var pagina = json.value || [];
    pagina.forEach(function(item) {
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

    skip += pagina.length;
    paginas++;
    if (pagina.length < pageSize) { done = true; break; } // última página real
  }

  if (paginas >= STOCK_MAX_PAGINAS) {
    fetchWarnings_.push('/Items: tramo detenido en el tope de ' + STOCK_MAX_PAGINAS + ' páginas (seguirá en el próximo tramo)');
  }

  return { articulos: articulos, nextSkip: skip, done: done };
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

function borrarStockCache_(cacheBaseKey) {
  if (!cacheBaseKey) return;
  var cache = CacheService.getScriptCache();
  var meta = cache.get(cacheBaseKey + '_META');
  if (!meta) return;
  var partes = parseInt(meta, 10);
  var keys = [cacheBaseKey + '_META'];
  for (var i = 0; i < partes; i++) keys.push(cacheBaseKey + '_' + i);
  cache.removeAll(keys);
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
// TRIGGERS — ventas cada 6h (síncrono, cabe en una ejecución) +
// stock en tramos cada 5 min (runStockChunk_ persiste el avance)
// ============================================================

/** Ejecutar una vez para (re)crear ambos triggers */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === 'refreshCache' || fn === 'refreshStockChunk_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshCache').timeBased().everyHours(6).create();
  ScriptApp.newTrigger('refreshStockChunk_').timeBased().everyMinutes(5).create();
  Logger.log('Triggers creados: refreshCache (ventas) cada 6h, refreshStockChunk_ (stock) cada 5 min');
}

/** Invocado por el trigger de 6h para refrescar el caché de ventas */
function refreshCache() {
  try {
    fetchAndCache(null, buildCacheKey_(CACHE_KEY, 'DEFAULT'), getCompanyDb_({}));
    Logger.log('Cache ventas actualizado: ' + new Date().toISOString());
  } catch(e) {
    Logger.log('Error en refreshCache (ventas): ' + e.message);
  }
}

/**
 * Invocado cada 5 min: si el caché de stock sigue vigente (< CACHE_TTL) y no hay
 * un refresco a medio camino, no hace nada. Si no, avanza (o inicia) un tramo de
 * runStockChunk_ — así catálogos grandes se terminan de refrescar en background
 * sin depender de que una sola ejecución alcance a recorrer todo /Items.
 */
function refreshStockChunk_() {
  var companyId = 'DEFAULT';
  var finalKey = buildCacheKey_(STOCK_CACHE_KEY, companyId);
  var wipKey = buildCacheKey_(STOCK_CACHE_KEY, companyId, 'wip');
  var enCurso = !!leerStockCache_(wipKey);
  if (!enCurso) {
    var actual = leerStockCache_(finalKey);
    var edadMs = actual && actual.lastUpdated ? (Date.now() - new Date(actual.lastUpdated).getTime()) : Infinity;
    if (edadMs < CACHE_TTL * 1000) return; // aún vigente, nada que hacer
  }
  try {
    runStockChunk_(getCompanyDb_({}), companyId, STOCK_CHUNK_BUDGET_MS);
    Logger.log('Tramo de refresco de stock ejecutado: ' + new Date().toISOString());
  } catch (e) {
    Logger.log('Error en refreshStockChunk_: ' + e.message);
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