//2026/04/21
/*
@Name：WeTalk 自动化签到+视频奖励（最终稳定版）

[rewrite_local]
^https:\/\/api\.wetalkapp\.com\/app\/queryBalanceAndBonus url script-request-header https://raw.githubusercontent.com/zhyeji/QuantumultX/main/WeTalk.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/zhyeji/QuantumultX/main/WeTalk.js, tag=WeTalk签到, enabled=true

[MITM]
hostname = api.wetalkapp.com
*/

const scriptName = 'WeTalk';
const storeKey = 'wetalk_accounts_v1';
const statsKey = 'wetalk_daily_stats_v1';

const SECRET = '0fOiukQq7jXZV2GRi9LGlO';
const API_HOST = 'api.wetalkapp.com';
const MAX_VIDEO = 5;
const VIDEO_DELAY = 8000;
const ACCOUNT_GAP = 3500;

/* ===== ✅ 原始完整 MD5（未改动）===== */
function MD5(string) {
  function RotateLeft(lValue, iShiftBits) { return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits)); }
  function AddUnsigned(lX, lY) {
    const lX4 = lX & 0x40000000, lY4 = lY & 0x40000000, lX8 = lX & 0x80000000, lY8 = lY & 0x80000000;
    const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) return (lResult & 0x40000000) ? (lResult ^ 0xC0000000 ^ lX8 ^ lY8) : (lResult ^ 0x40000000 ^ lX8 ^ lY8);
    return lResult ^ lX8 ^ lY8;
  }
  function F(x, y, z) { return (x & y) | ((~x) & z); }
  function G(x, y, z) { return (x & z) | (y & (~z)); }
  function H(x, y, z) { return x ^ y ^ z; }
  function I(x, y, z) { return y ^ (x | (~z)); }
  function FF(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function GG(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function HH(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function II(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function ConvertToWordArray(str) {
    const lMessageLength = str.length;
    const lNumberOfWords_temp1 = lMessageLength + 8;
    const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    const lWordArray = Array(lNumberOfWords - 1).fill(0);
    let lBytePosition = 0, lByteCount = 0;
    while (lByteCount < lMessageLength) {
      const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] |= str.charCodeAt(lByteCount) << lBytePosition;
      lByteCount++;
    }
    const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] |= 0x80 << lBytePosition;
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  function WordToHex(lValue) {
    let WordToHexValue = '';
    for (let lCount = 0; lCount <= 3; lCount++) {
      const lByte = (lValue >>> (lCount * 8)) & 255;
      const WordToHexValue_temp = '0' + lByte.toString(16);
      WordToHexValue += WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
    }
    return WordToHexValue;
  }
  const x = ConvertToWordArray(string);
  let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
  const S11 = 7, S12 = 12, S13 = 17, S14 = 22, S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23, S41 = 6, S42 = 10, S43 = 15, S44 = 21;
  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = FF(a,b,c,d,x[k+0],S11,0xD76AA478); d = FF(d,a,b,c,x[k+1],S12,0xE8C7B756); c = FF(c,d,a,b,x[k+2],S13,0x242070DB); b = FF(b,c,d,a,x[k+3],S14,0xC1BDCEEE);
    a = AddUnsigned(a,AA); b = AddUnsigned(b,BB); c = AddUnsigned(c,CC); d = AddUnsigned(d,DD);
  }
  return (WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d)).toLowerCase();
}

/* ===== 下面逻辑全部稳定，仅改展示 ===== */

function getUTCSignDate() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

function getLocalDate() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function loadStore(){const raw=$prefs.valueForKey(storeKey);return raw?JSON.parse(raw):{accounts:{},order:[]};}
function loadStats(){const raw=$prefs.valueForKey(statsKey);return raw?JSON.parse(raw):{};}
function saveStats(s){$prefs.setValueForKey(JSON.stringify(s),statsKey);}

function buildUrl(path,capture){
  const params={...capture.paramsRaw};
  delete params.sign; delete params.signDate;
  params.signDate=getUTCSignDate();
  const base=Object.keys(params).sort().map(k=>`${k}=${params[k]}`).join('&');
  params.sign=MD5(base+SECRET);
  const qs=Object.keys(params).map(k=>`${k}=${encodeURIComponent(params[k])}`).join('&');
  return `https://${API_HOST}/app/${path}?${qs}`;
}

function runAccount(acc){
  const stats=loadStats();
  const today=getLocalDate();
  if(!stats[acc.id])stats[acc.id]={};
  if(!stats[acc.id][today])stats[acc.id][today]={checkin:0,video:0};

  let init=0,fin=0,videoCount=0;

  function fetchApi(p){
    return $task.fetch({url:buildUrl(p,acc.capture),headers:acc.capture.headers});
  }

  function doVideo(){
    let i=0;
    function next(){
      if(i>=MAX_VIDEO){
        stats[acc.id][today].video+=videoCount;
        saveStats(stats);
        return Promise.resolve();
      }
      return new Promise(r=>{
        setTimeout(()=>{
          i++;
          fetchApi('videoBonus').then(res=>{
            try{
              const d=JSON.parse(res.body);
              if(d.retcode===0)videoCount++;
            }catch{}
            r(next());
          }).catch(()=>r(next()));
        },i===0?1500:VIDEO_DELAY);
      });
    }
    return next();
  }

  return fetchApi('queryBalanceAndBonus')
  .then(r=>{try{init=Number(JSON.parse(r.body).result.balance||0);}catch{}})
  .then(()=>fetchApi('checkIn'))
  .then(r=>{
    try{
      if(JSON.parse(r.body).retcode===0){
        stats[acc.id][today].checkin=1;
        saveStats(stats);
      }
    }catch{}
  })
  .then(()=>doVideo())
  .then(()=>fetchApi('queryBalanceAndBonus'))
  .then(r=>{try{fin=Number(JSON.parse(r.body).result.balance||0);}catch{}})
  .then(()=>({
    initial:init.toFixed(2),
    final:fin.toFixed(2),
    checkin:`${stats[acc.id][today].checkin} 次`,
    video:`${stats[acc.id][today].video} 条`
  }));
}

/* ===== 输出对齐 ===== */
const store=loadStore();
const ids=store.order||[];

Promise.all(ids.map(id=>runAccount(store.accounts[id])))
.then(res=>{
  function padRight(str,len){return str+' '.repeat(len-str.length);}

  const l1=res.map(r=>`初始金币：${r.initial}`);
  const r1=res.map(r=>`最新金币：${r.final}`);
  const l2=res.map(r=>`今日签到：${r.checkin}`);
  const r2=res.map(r=>`今日观看：${r.video}`);

  const maxL1=Math.max(...l1.map(s=>s.length));
  const maxR1=Math.max(...r1.map(s=>s.length));
  const maxL2=Math.max(...l2.map(s=>s.length));
  const maxR2=Math.max(...r2.map(s=>s.length));

  const text=res.map((_,i)=>[
    `${padRight(l1[i],maxL1)}；${padRight(r1[i],maxR1)}`,
    `${padRight(l2[i],maxL2)}；${padRight(r2[i],maxR2)}`
  ].join('\n')).join('\n\n———\n\n');

  $notify(scriptName,`全部完成 (${res.length}个账号)`,text);
});