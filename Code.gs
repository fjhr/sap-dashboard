/**
 * SAP Business One Sales Dashboard - Google Apps Script
 *
 * Setup:
 *  1. En el editor, ve a Project Settings > Script Properties y agrega:
 *     SAP_BASE_URL  = https://dev-seidorb1.cloudseidor.com:50000/b1s/v1
 *     SAP_COMPANY_DB = TESTSOP
 *     SAP_USER       = Integrador
 *     SAP_PASSWORD   = <tu contraseña>
 *     SAP_LANGUAGE   = 25
 *  2. Despliega como Web App: Execute as "Me", Access "Anyone"
 *  3. Ejecuta setupTrigger() una vez para crear el trigger de 6 horas
 */

var CACHE_KEY = 'sap_sales_data';
var CACHE_TTL = 21600; // 6 horas en segundos

function doGet(e) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(CACHE_KEY);
  var data = cached ? JSON.parse(cached) : fetchAndCache();

  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  return output;
}

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

  // --- Login ---
  var loginResp = UrlFetchApp.fetch(baseUrl + '/Login', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ CompanyDB: companyDb, UserName: user, Password: password, Language: language }),
    muteHttpExceptions: true
  });

  if (loginResp.getResponseCode() !== 200) {
    throw new Error('SAP Login failed: ' + loginResp.getContentText());
  }

  var cookies = loginResp.getAllHeaders()['Set-Cookie'];
  var sessionCookie = Array.isArray(cookies) ? cookies.join('; ') : cookies;
  var reqHeaders = { 'Cookie': sessionCookie, 'Prefer': 'odata.maxpagesize=100' };

  // --- Fecha límite: hace 5 días ---
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 5);
  var dateFilter = Utilities.formatDate(cutoff, Session.getScriptTimeZone(), "yyyy-MM-dd");

  var fields = 'DocNum,CardCode,CardName,DocDate,DocTotal,DocumentStatus';

  var invoices   = fetchAll(baseUrl, '/Invoices',      dateFilter, fields, reqHeaders);
  var orders     = fetchAll(baseUrl, '/Orders',        dateFilter, fields, reqHeaders);
  var deliveries = fetchAll(baseUrl, '/DeliveryNotes', dateFilter, fields, reqHeaders);

  // --- Logout ---
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

/** Ejecutar una vez para crear el trigger de actualización cada 6 horas */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'refreshCache') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshCache').timeBased().everyHours(6).create();
  Logger.log('Trigger creado: refreshCache cada 6 horas');
}

/** Invocado por el trigger para actualizar el caché */
function refreshCache() {
  try {
    fetchAndCache();
    Logger.log('Cache actualizado: ' + new Date().toISOString());
  } catch(e) {
    Logger.log('Error en refreshCache: ' + e.message);
  }
}
