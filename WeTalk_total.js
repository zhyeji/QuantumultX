/*
@Name：WeTalk 自动化签到+视频奖励 (async/await 调试版)
@Desc：手动执行只查余额，定时任务签到+视频，遇超时自动重试最多5次，每日首次运行必弹窗（仅在有数据时）
[rewrite_local]
^https:\/\/api\.wetalkapp\.com\/app\/queryBalanceAndBonus url script-request-header https://raw.githubusercontent.com/zhyeji/QuantumultX/main/WeTalk_1.js
[task_local]
* * * * * https://raw.githubusercontent.com/zhyeji/QuantumultX/main/WeTalk_1.js, tag=WeTalk签到, enabled=true
[MITM]
hostname = api.wetalkapp.com
*/

var scriptName = 'WeTalk';
var storeKey = 'wetalk_accounts_v1';
var SECRET = '0fOiukQq7jXZV2GRi9LGlO';
var API_HOST = 'api.wetalkapp.com';
var MAX_VIDEO = 5;
var VIDEO_DELAY = 8000;
var ACCOUNT_GAP = 3500;

// ==================== 手动/定时通知开关 ====================
// false = 定时模式（有增长才通知）  true = 手动模式（始终通知，只查不操作）
var FORCE_NOTIFY = false;

var IOS_VERSIONS = ['17.5.1','17.6.1','17.4.1','17.2.1','16.7.8','17.6','17.3.1','18.0.1','17.1.2','16.6.1'];
var IOS_SCALES = ['2.00','3.00','3.00','2.00','3.00'];
var IPHONE_MODELS = ['iPhone14,3','iPhone13,3','iPhone15,3','iPhone16,1','iPhone14,7','iPhone13,2','iPhone15,2','iPhone12,1'];
var CFN_VERS = ['1410.0.3','1494.0.7','1568.100.1','1209.1','1474.0.4','1568.200.2'];
var DARWIN_VERS = ['22.6.0','23.5.0','23.6.0','24.0.0','22.4.0'];

// ==================== ES5 补丁 ====================
function padStart(str, len, pad) {
  str = String(str);
  while (str.length < len) str = pad + str;
  return str;
}

function arrayFill(size, value) {
  var arr = [];
  for (var i = 0; i < size; i++) arr.push(value);
  return arr;
}

// ==================== MD5 ====================
function MD5(string) {
  // ... (MD5 函数太长，此处省略，请保留你原脚本中的完整 MD5 函数)
  // 实际使用时请保留完整的 MD5 实现
  return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; // 占位
}

// ==================== 工具函数 ====================
function getUTCSignDate() {
  var now = new Date();
  var pad = function(n) { return padStart(String(n), 2, '0'); };
  return now.getUTCFullYear() + '-' + pad(now.getUTCMonth()+1) + '-' + pad(now.getUTCDate()) + ' ' +
         pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ':' + pad(now.getUTCSeconds());
}

function normalizeHeaderNameMap(headers) {
  var out = {};
  if (headers) {
    var keys = Object.keys(headers);
    for (var i = 0; i < keys.length; i++) {
      out[keys[i]] = headers[keys[i]];
    }
  }
  return out;
}

function parseRawQuery(url) {
  var query = (url.split('?')[1] || '').split('#')[0];
  var rawMap = {};
  var pairs = query.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i];
    if (!pair) continue;
    var idx = pair.indexOf('=');
    if (idx < 0) continue;
    var k = pair.slice(0, idx);
    var v = pair.slice(idx + 1);
    rawMap[k] = v;
  }
  return rawMap;
}

function fingerprintOf(paramsRaw) {
  var drop = { sign:1, signDate:1, timestamp:1, ts:1, nonce:1, random:1, reqTime:1, reqId:1, requestId:1 };
  var keys = Object.keys(paramsRaw || {});
  var keep = [];
  for (var i = 0; i < keys.length; i++) {
    if (!drop[keys[i]]) keep.push(keys[i]);
  }
  keep.sort();
  var base = '';
  for (var i = 0; i < keep.length; i++) {
    if (i > 0) base += '&';
    base += keep[i] + '=' + paramsRaw[keep[i]];
  }
  return MD5(base).slice(0, 12);
}

// ==================== 存储 ====================
function loadStore() {
  var raw = $prefs.valueForKey(storeKey);
  if (!raw) return { version: 1, accounts: {}, order: [], dailyStats: {} };
  try {
    var obj = JSON.parse(raw);
    if (!obj.accounts) obj.accounts = {};
    if (!Array.isArray(obj.order)) obj.order = Object.keys(obj.accounts);
    if (!obj.dailyStats) obj.dailyStats = {};
    return obj;
  } catch (e) {
    return { version: 1, accounts: {}, order: [], dailyStats: {} };
  }
}

function saveStore(store) {
  $prefs.setValueForKey(JSON.stringify(store), storeKey);
}

// ==================== 随机化 ====================
function pickItem(arr, seed) {
  return arr[seed % arr.length];
}

function buildUA(baseUA, seed) {
  var iosVer = pickItem(IOS_VERSIONS, seed);
  var scale = pickItem(IOS_SCALES, seed + 1);
  var model = pickItem(IPHONE_MODELS, seed + 2);
  var cfn = pickItem(CFN_VERS, seed + 3);
  var darwin = pickItem(DARWIN_VERS, seed + 4);
  if (baseUA && typeof baseUA === 'string') {
    var ua = baseUA;
    var changed = false;
    if (/iOS \d+(\.\d+){0,2}/.test(ua)) { ua = ua.replace(/iOS \d+(\.\d+){0,2}/, 'iOS ' + iosVer); changed = true; }
    if (/Scale\/\d+(\.\d+)?/.test(ua)) { ua = ua.replace(/Scale\/\d+(\.\d+)?/, 'Scale/' + scale); changed = true; }
    if (/iPhone\d+,\d+/.test(ua)) { ua = ua.replace(/iPhone\d+,\d+/, model); changed = true; }
    if (/CFNetwork\/[\d.]+/.test(ua)) { ua = ua.replace(/CFNetwork\/[\d.]+/, 'CFNetwork/' + cfn); changed = true; }
    if (/Darwin\/[\d.]+/.test(ua)) { ua = ua.replace(/Darwin\/[\d.]+/, 'Darwin/' + darwin); changed = true; }
    if (changed) return ua;
  }
  return 'WeTalk/30.6.0 (com.innovationworks.wetalk; build:28; iOS ' + iosVer + ') Alamofire/5.4.3';
}

// ==================== 请求构造 ====================
function buildSignedParamsRaw(capture) {
  var params = {};
  var keys = Object.keys(capture.paramsRaw || {});
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k !== 'sign' && k !== 'signDate') params[k] = capture.paramsRaw[k];
  }
  params.signDate = getUTCSignDate();
  var sortedKeys = Object.keys(params).sort();
  var signBase = '';
  for (var i = 0; i < sortedKeys.length; i++) {
    if (i > 0) signBase += '&';
    signBase += sortedKeys[i] + '=' + params[sortedKeys[i]];
  }
  params.sign = MD5(signBase + SECRET);
  return params;
}

function buildUrl(path, capture) {
  var params = buildSignedParamsRaw(capture);
  var keys = Object.keys(params);
  var qs = '';
  for (var i = 0; i < keys.length; i++) {
    if (i > 0) qs += '&';
    qs += keys[i] + '=' + encodeURIComponent(params[keys[i]]);
  }
  return 'https://' + API_HOST + '/app/' + path + '?' + qs;
}

function cloneHeaders(headers) {
  var out = {};
  if (headers) {
    var keys = Object.keys(headers);
    for (var i = 0; i < keys.length; i++) {
      out[keys[i]] = headers[keys[i]];
    }
  }
  return out;
}

function buildHeaders(capture, ua) {
  var headers = cloneHeaders(capture.headers || {});
  delete headers['Content-Length']; delete headers['content-length'];
  delete headers[':authority']; delete headers[':method']; delete headers[':path']; delete headers[':scheme'];
  headers['Host'] = API_HOST;
  headers['Accept'] = headers['Accept'] || 'application/json';
  var headerKeys = Object.keys(headers);
  for (var i = 0; i < headerKeys.length; i++) {
    if (headerKeys[i].toLowerCase() === 'user-agent') delete headers[headerKeys[i]];
  }
  headers['User-Agent'] = ua;
  return headers;
}

// ==================== 通知等 ====================
function notify(title, body) {
  $notify(scriptName, title, body);
}

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

// ==================== 单账号执行（async/await 调试版） ====================
async function runAccount(acc, store, forceNotify, notifyOnError) {
  function padRight(str, len) {
    str = String(str);
    while (str.length < len) str += ' ';
    return str;
  }

  var now = new Date();
  var today = now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate();
  var stats = store.dailyStats[acc.id];
  if (!stats || stats.date !== today) {
    stats = { date: today, checkInCount: 0, videoCount: 0, initialBalance: null, lastBalance: null };
  }
  if (stats.lastBalance === undefined) stats.lastBalance = null;

  var ua = buildUA(acc.baseUA, acc.uaSeed);
  var headers = buildHeaders(acc.capture, ua);

  function fetchApi(path) {
    return $task.fetch({
      url: buildUrl(path, acc.capture),
      method: 'GET',
      headers: headers,
      timeout: 15000
    });
  }

  function parseBody(res) {
    try {
      return JSON.parse(res.body);
    } catch (e) {
      return null;
    }
  }

  function formatAndNotify(finalBalance) {
    var ini = stats.initialBalance !== null ? stats.initialBalance.toFixed(3) : '--';
    var fin = finalBalance !== null ? finalBalance.toFixed(3) : '--';
    var leftCoin = '初始金币: ' + ini + ' ';
    var leftSign = '今日签到: ' + stats.checkInCount + ' 次 ';
    var maxLen = Math.max(leftCoin.length, leftSign.length);
    leftCoin = padRight(leftCoin, maxLen);
    leftSign = padRight(leftSign, maxLen);
    var line1 = leftCoin + '; 最新金币: ' + fin;
    var line2 = leftSign + '; 今日观看: ' + stats.videoCount + ' 条';
    notify(acc.alias || acc.id, line1 + '\n' + line2);
  }

  try {
    // 第一次余额查询
    var res1 = await fetchApi('queryBalanceAndBonus');
    var d1 = parseBody(res1);
    if (d1 && d1.retcode === 0 && d1.result && d1.result.balance !== undefined) {
      stats.initialBalance = Number(d1.result.balance);
    }

    if (forceNotify) {
      // 手动模式：只查余额，不签到不视频
      var res2 = await fetchApi('queryBalanceAndBonus');
      var d2 = parseBody(res2);
      var finalBalance = null;
      if (d2 && d2.retcode === 0 && d2.result && d2.result.balance !== undefined) {
        finalBalance = Number(d2.result.balance);
      }
      formatAndNotify(finalBalance);
      store.dailyStats[acc.id] = stats;
      saveStore(store);
      return;
    }

    // 自动模式：签到（无论是否成功，都继续执行后续视频）
    try {
      var resCheck = await fetchApi('checkIn');
      var dCheck = parseBody(resCheck);
      if (dCheck && dCheck.retcode === 0) {
        var hasReward = dCheck.result && (dCheck.result.bonus !== undefined || dCheck.result.bonusHint !== undefined);
        var msg = dCheck.retmsg || '';
        var isNewCheckIn = msg.indexOf('已经签过') === -1 && msg.indexOf('明天再试') === -1;
        if (hasReward || isNewCheckIn) {
          stats.checkInCount++;
        }
      }
    } catch (e) {
      // 签到失败不影响视频任务继续
    }

    // 视频任务链
    var videoLimitReached = false;
    for (var i = 0; i < MAX_VIDEO; i++) {
      if (videoLimitReached) break;
      var waitTime = (i === 0) ? 1500 : VIDEO_DELAY;
      await sleep(waitTime);
      try {
        var resVideo = await fetchApi('videoBonus');
        var dVideo = parseBody(resVideo);
        if (dVideo && dVideo.retcode === 0) {
          var hasBonus = dVideo.result && dVideo.result.bonus !== undefined && Number(dVideo.result.bonus) > 0;
          var msg = dVideo.retmsg || '';
          var notLimited = msg.indexOf('次数过多') === -1 && msg.indexOf('明天再试') === -1;
          if (hasBonus && notLimited) {
            stats.videoCount++;
          } else {
            videoLimitReached = true;
          }
        } else {
          videoLimitReached = true;
        }
      } catch (e) {
        // 单个视频请求失败，继续尝试下一个
      }
    }

    // 最后查询余额（带完整调试）
    var resFinal = await fetchApi('queryBalanceAndBonus');
    
    // 【调试】把完整的响应弹出来
    var debugMsg = "status: " + resFinal.status + "\n";
    debugMsg += "body: " + (resFinal.body || "（空）");
    notify("调试-最终余额响应", debugMsg);

    var dFinal = parseBody(resFinal);
    var finalBalance = null;
    if (dFinal && dFinal.retcode === 0 && dFinal.result && dFinal.result.balance !== undefined) {
      finalBalance = Number(dFinal.result.balance);
    }

    // 严格真实逻辑：只有获取到有效余额才考虑弹窗
    var shouldNotify = false;
    if (finalBalance !== null) {
      if (stats.lastBalance === null || finalBalance > stats.lastBalance) {
        shouldNotify = true;
      }
      stats.lastBalance = finalBalance;
    }
    // 如果 finalBalance === null，shouldNotify 保持 false，不弹窗，也不更新 lastBalance

    store.dailyStats[acc.id] = stats;
    saveStore(store);

    if (shouldNotify) {
      formatAndNotify(finalBalance);
    }

  } catch (err) {
    // 最终兜底：确保有状态记录（但不使用虚假值）
    if (stats && stats.initialBalance !== null && stats.lastBalance === null) {
      // 注意：这里不强制更新 lastBalance，以免影响后续判断
      // 仅保存现有状态
    }
    store.dailyStats[acc.id] = stats;
    saveStore(store);

    if (forceNotify) {
      formatAndNotify(null);
    } else {
      var errMsg = (err && err.error) ? err.error : String(err);
      if (notifyOnError) {
        notify(acc.alias || acc.id, '初始金币: -- ; 最新金币: --\n今日签到: -- 次   ; 今日观看: -- 条\n异常: ' + errMsg);
      }
    }
    throw err;
  }
}

// ==================== 主流程 ====================
if (typeof $request !== 'undefined' && $request) {
  // 抓包捕获账号信息
  var paramsRaw = parseRawQuery($request.url);
  var headersMap = normalizeHeaderNameMap($request.headers || {});
  var baseUA = '';
  var hKeys = Object.keys(headersMap);
  for (var i = 0; i < hKeys.length; i++) {
    if (hKeys[i].toLowerCase() === 'user-agent') baseUA = headersMap[hKeys[i]];
  }

  var store = loadStore();
  var fp = fingerprintOf(paramsRaw);
  var nowTime = Date.now();
  var existed = !!store.accounts[fp];
  var uaSeed = existed ? store.accounts[fp].uaSeed : store.order.length;
  var alias = existed ? store.accounts[fp].alias : '账号' + (store.order.length + 1);

  store.accounts[fp] = {
    id: fp,
    alias: alias,
    uaSeed: uaSeed,
    baseUA: baseUA,
    capture: { url: $request.url, paramsRaw: paramsRaw, headers: headersMap },
    createdAt: existed ? store.accounts[fp].createdAt : nowTime,
    updatedAt: nowTime
  };
  if (!existed) store.order.push(fp);
  saveStore(store);

  var total = store.order.length;
  if (!existed) {
    notify('新账号已入库', alias + '（id:' + fp + '）\n当前账号总数：' + total);
  }
  $done({});
} else {
  // 定时任务执行
  var store = loadStore();
  var ids = [];
  var order = store.order;
  for (var i = 0; i < order.length; i++) {
    var id = order[i];
    if (store.accounts[id]) ids.push(id);
  }
  if (!ids.length) {
    notify('未抓到任何账号', '请先打开 WeTalk 触发抓包');
    $done();
  } else {
    // ===== 检测是否为手动执行 =====
    var isManualExecution = true;
    if (typeof $environment !== 'undefined' && $environment === 'task') {
      isManualExecution = false;
    }
    // 如果是手动执行，强制设定为手动模式，确保只查余额
    var isManual = FORCE_NOTIFY || isManualExecution;
    // ===== 结束检测 =====

    var accountIndex = 0;

    async function runAllAccounts() {
      while (accountIndex < ids.length) {
        var currentAccount = store.accounts[ids[accountIndex]];
        var retryCount = 0;
        var success = false;

        while (retryCount < 5 && !success) {
          try {
            // 最后一次重试时允许弹窗
            var shouldNotifyOnError = (retryCount === 4);
            await runAccount(currentAccount, store, isManual, shouldNotifyOnError);
            success = true;
          } catch (err) {
            var errMsg = (err && err.error) ? err.error : String(err);
            var isTimeout = errMsg.toLowerCase().indexOf('timeout') !== -1;
            if (isTimeout && retryCount < 4) {
              retryCount++;
            } else {
              success = true; // 跳过当前账号
            }
          }
        }
        accountIndex++;
      }
      $done();
    }

    runAllAccounts();
  }
}
