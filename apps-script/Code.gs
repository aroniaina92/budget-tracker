/**
 * Budget tracker – Google Apps Script backend (sync API for the installable app)
 * --------------------------------------------
 * The Google Sheet this script is attached to is the database.
 * Tabs (created automatically on first launch):
 *   Accounts, Categories, Goals, Ledger, Settings
 *
 * Every money movement is ONE row in "Ledger":
 *   income   : account +amount, envelope +amount   (env empty = "To assign")
 *   expense  : account -amount, envelope -amount
 *   transfer : account -amount, account2 +amount   (between accounts)
 *   move     : envelope -amount, envelope2 +amount (between envelopes/goals)
 * Envelopes are written "c:<categoryId>" or "g:<goalId>".
 */

var TABLES = {
  Accounts:   ['id', 'name_fr', 'name_en', 'opening', 'active', 'order', 'emoji', 'spend', 'savings', 'fund'],
  Categories: ['id', 'name_fr', 'name_en', 'active', 'order', 'emoji', 'fund'],
  Goals:      ['id', 'name_fr', 'name_en', 'kind', 'target', 'deadline', 'yearly', 'active', 'order', 'emoji'],
  Ledger:     ['id', 'date', 'type', 'amount', 'acc', 'acc2', 'env', 'env2', 'grp', 'ref', 'note', 'created', 'fund'],
  Settings:   ['key', 'value']
};

// Columns kept as plain text so Sheets does not turn them into dates
var CHECKED_ = {};
var TEXT_COLS = { Goals: ['deadline'], Ledger: ['date', 'ref', 'created'] };

/* ---------- Web API (called by the installed app) ----------
 * The app (hosted on GitHub Pages) sends POST requests: {token, fn, args}.
 * The token is created by running setup() once; only requests with that token are accepted.
 */
var API = {
  apiGetAll: apiGetAll, apiInit: apiInit, apiAppend: apiAppend, apiDeleteGroup: apiDeleteGroup,
  apiUpsert: apiUpsert, apiBulkUpsert: apiBulkUpsert, apiSetSetting: apiSetSetting, apiDeleteItem: apiDeleteItem
};

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!token || req.token !== token) {
      out = { ok: false, error: 'AUTH' };
    } else if (!API[req.fn]) {
      out = { ok: false, error: 'Unknown function ' + req.fn };
    } else {
      out = { ok: true, result: API[req.fn].apply(null, req.args || []) };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: 'budget-tracker' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run this ONCE from the Apps Script editor (select "setup" ▸ Run).
 * It creates your secret access code and shows it in the execution log (View ▸ Logs).
 * Running it again creates a new code (the old one stops working).
 */
function setup() {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  PropertiesService.getScriptProperties().setProperty('TOKEN', token);
  ['Accounts', 'Categories', 'Goals', 'Ledger', 'Settings'].forEach(sheet_);
  Logger.log('Your access code: ' + token);
  return token;
}

/* ---------- Spreadsheet helpers ---------- */
function ss_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('No spreadsheet: open the script from your Google Sheet (Extensions > Apps Script).');
  return SpreadsheetApp.openById(id);
}

function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var head = TABLES[name];
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
    (TEXT_COLS[name] || []).forEach(function (col) {
      var c = head.indexOf(col) + 1;
      sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@');
    });
  } else if (!CHECKED_[name]) {
    // Older sheets: add any column introduced by a newer version of the app
    var cur = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
    TABLES[name].forEach(function (h) {
      if (cur.indexOf(h) < 0) {
        cur.push(h);
        sh.getRange(1, cur.length).setValue(h).setFontWeight('bold');
      }
    });
  }
  CHECKED_[name] = true;
  return sh;
}

function readTable_(name) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  var head = values.shift();
  var tz = Session.getScriptTimeZone();
  return values
    .filter(function (r) { return r[0] !== '' && r[0] !== null; })
    .map(function (r) {
      var o = {};
      head.forEach(function (h, i) {
        var v = r[i];
        if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
        o[h] = v;
      });
      return o;
    });
}

function toRow_(name, obj) {
  return TABLES[name].map(function (h) {
    var v = obj[h];
    return (v === undefined || v === null) ? '' : v;
  });
}

/* ---------- API called from the web page ---------- */

/** Returns everything the page needs. `empty: true` on first launch. */
function apiGetAll() {
  var settingsRows = readTable_('Settings');
  var settings = {};
  settingsRows.forEach(function (r) {
    try { settings[r.key] = JSON.parse(r.value); } catch (e) { settings[r.key] = r.value; }
  });
  return {
    empty: settingsRows.length === 0,
    accounts: readTable_('Accounts'),
    categories: readTable_('Categories'),
    goals: readTable_('Goals'),
    ledger: readTable_('Ledger'),
    settings: settings
  };
}

/** First launch: writes the default accounts, categories, goals and settings sent by the page. */
function apiInit(defaults) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (readTable_('Settings').length) return apiGetAll(); // already initialised
    ['Accounts', 'Categories', 'Goals'].forEach(function (t) {
      var rows = (defaults[t] || []).map(function (o) { return toRow_(t, o); });
      if (rows.length) sheet_(t).getRange(2, 1, rows.length, TABLES[t].length).setValues(rows);
    });
    var s = defaults.Settings || {};
    var srows = Object.keys(s).map(function (k) { return [k, JSON.stringify(s[k])]; });
    if (srows.length) sheet_('Settings').getRange(2, 1, srows.length, 2).setValues(srows);
    sheet_('Ledger');
  } finally {
    lock.releaseLock();
  }
  return apiGetAll();
}

/**
 * Appends ledger rows (one entry = several rows sharing the same `grp`).
 * Rows carrying a `ref` (salary of a month, monthly rollover) are refused if
 * that ref already exists, so the same salary can never be counted twice.
 */
function apiAppend(rows) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_('Ledger');
    var existing = readTable_('Ledger');
    var refs = {}, ids = {};
    existing.forEach(function (r) { if (r.ref) refs[r.ref] = true; ids[String(r.id)] = true; });
    // Rows already saved (e.g. a retry after a lost connection) are skipped
    rows = rows.filter(function (r) { return !ids[String(r.id)]; });
    var dup = rows.filter(function (r) { return r.ref && refs[r.ref]; });
    if (dup.length) throw new Error('DUPLICATE:' + dup[0].ref);
    var now = new Date().toISOString();
    var values = rows.map(function (r) {
      r.created = r.created || now;
      return toRow_('Ledger', r);
    });
    if (values.length) {
      sh.getRange(sh.getLastRow() + 1, 1, values.length, TABLES.Ledger.length).setValues(values);
    }
    return rows;
  } finally {
    lock.releaseLock();
  }
}

/** Deletes every ledger row of one entry (used by "Delete" in the history). */
function apiDeleteGroup(grp) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_('Ledger');
    var values = sh.getDataRange().getValues();
    var col = TABLES.Ledger.indexOf('grp');
    for (var i = values.length - 1; i >= 1; i--) {
      if (String(values[i][col]) === String(grp)) sh.deleteRow(i + 1);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** Insert or update one account / category / goal (matched on id). */
function apiUpsert(table, obj) {
  if (['Accounts', 'Categories', 'Goals'].indexOf(table) < 0) throw new Error('Bad table');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(table);
    var values = sh.getDataRange().getValues();
    var row = toRow_(table, obj);
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(obj.id)) {
        sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return obj;
      }
    }
    sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    return obj;
  } finally {
    lock.releaseLock();
  }
}

/** Insert or update several rows of one table in a single call. */
function apiBulkUpsert(table, list) {
  if (['Accounts', 'Categories', 'Goals'].indexOf(table) < 0) throw new Error('Bad table');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(table);
    var values = sh.getDataRange().getValues();
    var width = TABLES[table].length;
    (list || []).forEach(function (obj) {
      var row = toRow_(table, obj);
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(obj.id)) {
          sh.getRange(i + 1, 1, 1, width).setValues([row]);
          return;
        }
      }
      sh.getRange(sh.getLastRow() + 1, 1, 1, width).setValues([row]);
      values.push(row);
    });
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** Deletes one account / category / goal (the app only allows it when it was never used). */
function apiDeleteItem(table, id) {
  if (['Accounts', 'Categories', 'Goals'].indexOf(table) < 0) throw new Error('Bad table');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(table);
    var values = sh.getDataRange().getValues();
    for (var i = values.length - 1; i >= 1; i--) {
      if (String(values[i][0]) === String(id)) sh.deleteRow(i + 1);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** Saves one setting (salaries, irregular-income rule, rollover rule...). */
function apiSetSetting(key, value) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_('Settings');
    var values = sh.getDataRange().getValues();
    var json = JSON.stringify(value);
    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === key) {
        sh.getRange(i + 1, 2).setValue(json);
        return true;
      }
    }
    sh.appendRow([key, json]);
    return true;
  } finally {
    lock.releaseLock();
  }
}
