/**
 * 問卷後端：Google Apps Script
 *
 * 用法：在「要存資料的 Google Sheet」中，點 擴充功能 → Apps Script，
 * 把本檔內容整份貼上，然後依 README 部署為「網頁應用程式」。
 *
 * 對外提供：
 *   POST {action:'submit', ...}  → 受訪者提交問卷（公開）
 *   POST {action:'list', token}  → 管理頁讀取全部資料（需 ADMIN_TOKEN）
 *   GET                          → 健康檢查
 *
 * 管理密碼請存在：專案設定 → 指令碼屬性 → ADMIN_TOKEN（不要寫在程式碼裡）
 */

const SHEET_NAME = 'responses';
const TIMEZONE = 'Asia/Taipei';

// 欄位順序（Sheet 第一列）
const HEADERS = (function () {
  const h = [
    'timestamp', 'submission_id', 'duration_sec', 'consent',
    'gender', 'school_type', 'school_other', 'grade', 'experience',
    'mood_count', 'mood_1', 'mood_2', 'mood_3', 'mood_4', 'mood_5',
    'mood_x_avg', 'mood_y_avg'
  ];
  for (let i = 1; i <= 5; i++) h.push('resp_' + i);
  for (let i = 1; i <= 5; i++) h.push('eff_' + i);
  for (let i = 1; i <= 21; i++) h.push('bystander_' + i);
  return h;
})();

/* ---------- 入口 ---------- */

function doGet() {
  return json_({ ok: true, service: 'survey-backend' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'empty body' });
    }
    const body = JSON.parse(e.postData.contents);

    switch (body.action) {
      case 'submit': return json_(handleSubmit_(body));
      case 'list':   return json_(handleList_(body));
      default:       return json_({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: 'server error' });
  }
}

/* ---------- 提交問卷 ---------- */

function handleSubmit_(body) {
  const d = body.data || {};
  const id = String(body.submissionId || '');

  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return { ok: false, error: 'invalid submission id' };
  if (d.consent !== true) return { ok: false, error: 'consent required' };

  const problem = validate_(d);
  if (problem) return { ok: false, error: problem };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // 多人同時提交時排隊，避免資料互相覆蓋
  try {
    const sheet = getSheet_();
    if (idExists_(sheet, id)) return { ok: true, duplicate: true }; // 網路重送，不重複寫入
    sheet.appendRow(buildRow_(id, body, d));
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function validate_(d) {
  const required = ['gender', 'school', 'grade', 'experience'];
  for (const k of required) {
    if (typeof d[k] !== 'string' || !d[k]) return 'missing field: ' + k;
  }
  if (!Array.isArray(d.selectedMoods) || d.selectedMoods.length < 1 || d.selectedMoods.length > 5) {
    return 'invalid moods';
  }
  const scaleKeys = [];
  for (let i = 1; i <= 5; i++) { scaleKeys.push('resp_' + i, 'eff_' + i); }
  for (const k of scaleKeys) {
    if (!isScore_(d[k])) return 'invalid score: ' + k;
  }
  const by = d.bystander || {};
  for (let i = 1; i <= 21; i++) {
    if (!isScore_(by['Q' + i])) return 'invalid score: bystander Q' + i;
  }
  return null;
}

function isScore_(v) {
  return Number.isInteger(v) && v >= 1 && v <= 5;
}

function buildRow_(id, body, d) {
  const moods = d.selectedMoods.slice(0, 5).map(function (m) { return clean_(m, 40); });

  // 從 "憤怒的(X:1,Y:9)" 取出座標，計算平均 X（愉悅度）與 Y（能量）
  let sx = 0, sy = 0, n = 0;
  moods.forEach(function (m) {
    const match = /X:(\d+),Y:(\d+)/.exec(m);
    if (match) { sx += Number(match[1]); sy += Number(match[2]); n++; }
  });

  let duration = Number(body.durationSec);
  duration = isFinite(duration) && duration >= 0 && duration <= 86400 ? Math.round(duration) : '';

  const row = {
    timestamp: Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
    submission_id: id,
    duration_sec: duration,
    consent: 'Y',
    gender: clean_(d.gender, 20),
    school_type: clean_(d.school, 40),
    school_other: clean_(d.school_other, 100),
    grade: clean_(d.grade, 20),
    experience: clean_(d.experience, 20),
    mood_count: moods.length,
    mood_x_avg: n ? Math.round((sx / n) * 100) / 100 : '',
    mood_y_avg: n ? Math.round((sy / n) * 100) / 100 : ''
  };
  for (let i = 0; i < 5; i++) row['mood_' + (i + 1)] = moods[i] || '';
  for (let i = 1; i <= 5; i++) {
    row['resp_' + i] = d['resp_' + i];
    row['eff_' + i] = d['eff_' + i];
  }
  for (let i = 1; i <= 21; i++) row['bystander_' + i] = d.bystander['Q' + i];

  return HEADERS.map(function (h) { return row[h] === undefined ? '' : row[h]; });
}

// 轉成字串、限制長度，並避免 Sheet 把開頭是 = + - @ 的文字當成公式執行
function clean_(v, max) {
  let s = String(v == null ? '' : v).slice(0, max);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function idExists_(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const found = sheet.getRange(2, 2, last - 1, 1)
    .createTextFinder(id).matchEntireCell(true).findNext();
  return !!found;
}

/* ---------- 管理頁讀取 ---------- */

function handleList_(body) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  const given = String(body.token || '');

  if (!expected || !safeEqual_(given, expected)) {
    Utilities.sleep(1000); // 拖慢暴力猜密碼
    return { ok: false, error: 'unauthorized' };
  }

  const values = getSheet_().getDataRange().getDisplayValues();
  return { ok: true, headers: values[0], rows: values.slice(1) };
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------- 工具 ---------- */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('B:B').setNumberFormat('@'); // 提交編號當純文字，避免被轉成數字
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 第一次使用請在編輯器手動執行這個函式一次：
 * 會跳出授權視窗，並自動建立 responses 分頁與表頭。
 */
function setup() {
  getSheet_();
  Logger.log('完成：已建立分頁「' + SHEET_NAME + '」。請記得到「專案設定 → 指令碼屬性」新增 ADMIN_TOKEN。');
}
