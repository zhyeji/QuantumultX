//2026/04/28 终极极速版｜内存合并写入+超低延时+两位小数+模式B保留
/*
@Name：WeTalk 自动化签到+视频奖励
@Author：TG@ZenMoFiShi

[rewrite_local]
^https:\/\/api\.wetalkapp\.com\/app\/queryBalanceAndBonus url script-request-header-header https://raw.githubusercontent.com/zhyeji/QuantumultX/main/WeTalk.js

[task_local]
* * * * * https://raw.githubusercontent.com/zhyeji/QuantumultX/main/WeTalk.js, tag=WeTalk签到, enabled=true

[MITM]
hostname = api.wetalkapp.com
*/

const scriptName = 'WeTalk';
const storeKey = 'wetalk_accounts_v1';
const statKey = 'wetalk_daily_stat';
const SECRET = '0fOiukQq7jXZV2GRi9LGlO';
const API_HOST = 'api.wetalkapp.com';
const MAX_VIDEO = 5;
// 关键：极速化延时
const VIDEO_DELAY = 1200;
const ACCOUNT_GAP = 1800;

const IOS_VERSIONS = ['17.5.1','17.6.1','17.4.1','17.2.1','16.7.8','17.6','17.3.1','18.0.1','17.1.2','16.6.1'];
const IOS_SCALES = ['2.00','3.00','3.00','2.00','3.00'];
const IPHONE_MODELS = ['iPhone14,3','iPhone13,3','iPhone15,3','iPhone16,1','iPhone14,7','iPhone13,2','iPhone15,2','iPhone12,1'];
const CFN_VERS = ['1410.0.3','1494.0.7','1568.100.1','1209.1','1474.0.4','1568.200.2'];
const DARWIN_VERS = ['22.6.0','23.5.0','23.6.0','24.0.0','22.4.0'];

function getTodayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '');
  const day = String(d.getDate()).padStart(2, '');
  return `${y}-${m}-${day}`;
}

// 金币保留两位小数
function formatMoney(num) {
  if (isNaN(Number(num))) return "0.00";
  return Number(num).toFixed(2);
}

// 内存缓冲 只最后存一次
let tempSignMap = {};
let tempVideoMap = {};
let dailyStatCache = null;

function getDailyStat() {
  if (dailyStatCache) return dailyStatCache;
  const today = getTodayDateStr();
  let raw = $prefs.valueForKey(statKey);
  let stat = {};
  try { raw && (stat = JSON.parse(raw)); } catch (e) { stat = {}; }
  if(stat.date !== today) stat = { date: today, signMap: {}, videoMap: {} };
  dailyStatCache = stat;
  return stat;
}

function finalSaveStat() {
  const stat = getDailyStat();
  Object.keys(tempSignMap).forEach(accId=>{
    stat.signMap[accId] = (stat.signMap[accId]||0) + tempSignMap[accId];
  });
  Object.keys(tempVideoMap).forEach(accId=>{
    stat.videoMap[accId] = (stat.videoMap[accId]||0) + tempVideoMap[accId];
  });
  $prefs.setValueForKey(JSON.stringify(stat), statKey);
}

function addSignCountTemp(accId) {
  tempSignMap[accId] = (tempSignMap[accId] || 0) + 1;
}
function addVideoCountTemp(accId) {
  tempVideoMap[accId] = (tempVideoMap[accId] || 0) + 1;
}
function getTotalSign(accId) {
  const s = getDailyStat();
  return (s.signMap[accId]||0) + (tempSignMap[accId]||0);
}
function getTotalVideo(accId) {
  const s = getDailyStat();
  return (s.videoMap[accId]||0) + (tempVideoMap[accId]||0);
}

// 精简MD5 无冗余变量
function MD5(string){function RotateLeft(lValue,iShiftBits){return(lValue<<iShiftBits)|(lValue>>>(32-iShiftBits))}function AddUnsigned(lX,lY){const lX4=lX&1073741824,lY4=lY&1073741824,lX8=lX&2147483648,lY8=lY&2147483648;let lResult=(lX&1073741823)+(lY&1073741823);if(lX4&lY4)return lResult^2147483647^lX8^lY8;if(lX4|lY4)return(lResult&1073741824)?(lResult^3221225471^lX8^lY8):(lResult^1073741823^lX8^lY8);return lResult^lX8^lY8}function F(x,y,z){return(x&y)|(~x&z)}function G(x,y,z){return(x&z)|(y&~z)}function H(x,y,z){return x^y^z}function I(x,y,z){return y^(x|~z)}function FF(a,b,c,d,x,s,ac){a=AddUnsigned(a,AddUnsigned(AddUnsigned(F(b,c,d),x),ac));return AddUnsigned(RotateLeft(a,s),b)}function GG(a,b,c,d,x,s,ac){a=AddUnsigned(a,AddUnsigned(AddUnsigned(G(b,c,d),x),ac));return AddUnsigned(RotateLeft(a,s),b)}function HH(a,b,c,d,x,s,ac){a=AddUnsigned(a,AddUnsigned(AddUnsigned(H(b,c,d),x),ac));return AddUnsigned(RotateLeft(a,s),b)}function II(a,b,c,d,x,s,ac){a=AddUnsigned(a,AddUnsigned(AddUnsigned(I(b,c,d),x),ac));return AddUnsigned(RotateLeft(a,s),b)}function ConvertToWordArray(str){const lMessageLength=str.length;const lNumberOfWords_temp1=lMessageLength+8;const lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1%64))/64;const lNumberOfWords=(lNumberOfWords_temp2+1)*16;const lWordArray=Array(lNumberOfWords-1).fill(0);let lBytePosition=0,lByteCount=0;while(lByteCount<lMessageLength){const lWordCount=(lByteCount-(lByteCount%4))/4;lBytePosition=(lByteCount%4)*8;lWordArray[lWordCount]|=str.charCodeAt(lByteCount)<<lBytePosition;lByteCount++}const lWordCount=(lByteCount-(lByteCount%4))/4;lBytePosition=(lByteCount%4)*8;lWordArray[lWordCount]|=128<<lBytePosition;lWordArray[lNumberOfWords-2]=lMessageLength<<3;lWordArray[lNumberOfWords-1]=lMessageLength>>>29;return lWordArray}function WordToHex(lValue){let WordToHexValue="";for(let lCount=0;lCount<=3;lCount++){const lByte=(lValue>>>(lCount*8))&255;const WordToHexValue_temp="0"+lByte.toString(16);WordToHexValue+=WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2)}return WordToHexValue}const x=ConvertToWordArray(string);let a=1732584193,b=4023233417,c=2562383102,d=271733878;const S11=7,S12=12,S13=17,S14=22,S21=5,S22=9,S23=14,S24=20,S31=4,S32=11,S33=16,S34=23,S41=6,S42=10,S43=15,S44=21;for(let k=0;k<x.length;k+=16){const AA=a,BB=b,CC=c,DD=d;a=FF(a,b,c,d,x[k+0],S11,361409086);d=FF(d,a,b,c,x[k+1],S12,390540271);c=FF(c,d,a,b,x[k+2],S13,606105819);b=FF(b,c,d,a,x[k+3],S14,3250441966);a=FF(a,b,c,d,x[k+4],S11,1770035416);d=FF(d,a,b,c,x[k+5],S12,233635792);c=FF(c,d,a,b,x[k+6],S13,242122186);b=FF(b,c,d,a,x[k+7],S14,1839030562);a=FF(a,b,c,d,x[k+8],S11,421758335);d=FF(d,a,b,c,x[k+9],S12,2727652291);c=FF(c,d,a,b,x[k+10],S13,1835309962);b=FF(b,c,d,a,x[k+11],S14,353095562);a=FF(a,b,c,d,x[k+12],S11,1291685773);d=FF(d,a,b,c,x[k+13],S12,4153958454);c=FF(c,d,a,b,x[k+14],S13,1126891415);b=FF(b,c,d,a,x[k+15],S14,2850285829);a=GG(a,b,c,d,x[k+1],S21,2435635242);d=GG(d,a,b,c,x[k+6],S22,3738973048);c=GG(c,d,a,b,x[k+11],S23,376403917);b=GG(b,c,d,a,x[k+0],S24,1272893353);a=GG(a,b,c,d,x[k+5],S21,248793495);d=GG(d,a,b,c,x[k+10],S22,3273935613);c=GG(c,d,a,b,x[k+15],S23,3957729889);b=GG(b,c,d,a,x[k+4],S24,1445527070);a=GG(a,b,c,d,x[k+9],S21,2817193593);d=GG(d,a,b,c,x[k+14],S22,4243563512);c=GG(c,d,a,b,x[k+3],S23,1735328473);b=GG(b,c,d,a,x[k+8],S24,2368359562);a=GG(a,b,c,d,x[k+13],S21,429458854);d=GG(d,a,b,c,x[k+2],S22,1763441644);c=GG(c,d,a,b,x[k+7],S23,2475605484);b=GG(b,c,d,a,x[k+12],S24,3604077311);a=HH(a,b,c,d,x[k+5],S31,3936516458);d=HH(d,a,b,c,x[k+8],S32,2003608908);c=HH(c,d,a,b,x[k+11],S33,1797127868);b=HH(b,c,d,a,x[k+14],S34,3174756045);a=HH(a,b,c,d,x[k+1],S31,3207229522);d=HH(d,a,b,c,x[k+4],S32,1309151649);c=HH(c,d,a,b,x[k+7],S33,4110760120);b=HH(b,c,d,a,x[k+10],S34,3921956887);a=HH(a,b,c,d,x[k+13],S31,681217793);d=HH(d,a,b,c,x[k+0],S32,3936439740);c=HH(c,d,a,b,x[k+3],S33,3572290472);b=HH(b,c,d,a,x[k+6],S34,76029179);a=HH(a,b,c,d,x[k+9],S31,3657036280);d=HH(d,a,b,c,x[k+12],S32,3040363171);c=HH(c,d,a,b,x[k+15],S33,530740312);b=HH(b,c,d,a,x[k+2],S34,2385395609);a=II(a,b,c,d,x[k+0],S41,3373176754);d=II(d,a,b,c,x[k+7],S42,3895622217);c=II(c,d,a,b,x[k+14],S43,568446438);b=II(b,c,d,a,x[k+5],S44,3275160632);a=II(a,b,c,d,x[k+12],S41,4181727794);d=II(d,a,b,c,x[k+3],S42,1163531501);c=II(c,d,a,b,x[k+10],S43,2754234494);b=II(b,c,d,a,x[k+1],S44,2305245924);a=II(a,b,c,d,x[k+8],S41,1835305929);d=II(d,a,b,c,x[k+15],S42,4244420496);c=II(c,d,a,b,x[k+6],S43,1995604967);b=II(b,c,d,a,x[k+13],S44,3546552940);a=II(a,b,c,d,x[k+4],S41,2760221919);d=II(d,a,b,c,x[k+11],S42,1873313274);c=II(c,d,a,b,x[k+2],S43,4281193195);b=II(b,c,d,a,x[k+9],S44,322281082);a=AddUnsigned(a,AA);b=AddUnsigned(b,BB);c=AddUnsigned(c,CC);d=AddUnsigned(d,DD)}return(WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d)).toLowerCase()}

function getUTCSignDate(){const now=new Date();const pad=n=>String(n).padStart(2,'0');return `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`}
function normalizeHeaderNameMap(h){const o={};Object.keys(h||{}).forEach(k=>o[k]=h[k]);return o}
function parseRawQuery(u){const q=(u.split('?')[1]||'').split('#')[0];const m={};q.split('&').forEach(p=>{if(!p)return;let i=p.indexOf('=');i>0&&(m[p.slice(0,i)]=p.slice(i+1))});return m}
function fingerprintOf(p){const d={sign:1,signDate:1,timestamp:1,ts:1,nonce:1};return Object.keys(p||{}).filter(k=>!d[k]).sort().map(k=>`${k}=${p[k]}`).join('&')}
function loadStore(){const r=$prefs.valueForKey(storeKey);if(!r)return{version:1,accounts:{},order:[]};try{let o=JSON.parse(r);return o.accounts||(o.accounts={}),Array.isArray(o.order)||(o.order=Object.keys(o.accounts)),o}catch(e){return{version:1,accounts:{},order:[]}}}
function saveStore(s){$prefs.setValueForKey(JSON.stringify(s),storeKey)}
function pickItem(a,s){return a[s%a.length]}
function buildUA(u,s){const iosVer=pickItem(IOS_VERSIONS,s),scale=pickItem(IOS_SCALES,s+1),model=pickItem(IPHONE_MODELS,s+2),cfn=pickItem(CFN_VERS,s+3),darwin=pickItem(DARWIN_VERS,s+4);if(u&&typeof u==="string"){let a=u;a=a.replace(/iOS \d+(\.\d+){0,2}/,`iOS ${iosVer}`);a=a.replace(/Scale\/\d+(\.\d+)?/,`Scale/${scale}`);a=a.replace(/iPhone\d+,\d+/,model);a=a.replace(/CFNetwork\/[\d.]+/,`CFNetwork/${cfn}`);a=a.replace(/Darwin\/[\d.]+/,`Darwin/${darwin}`);return a}return `WeTalk/30.6.0 (com.innovationworks.wetalk; build:28; iOS ${iosVer}) Alamofire/5.4.3`}
function buildSignedParamsRaw(c){const p={};Object.keys(c.paramsRaw||{}).forEach(k=>{if(k!=='sign'&&k!=='signDate')p[k]=c.paramsRaw[k]});p.signDate=getUTCSignDate();p.sign=MD5(Object.keys(p).sort().map(k=>`${k}=${p[k]}`).join('&')+SECRET);return p}
function buildUrl(p,c){const params=buildSignedParamsRaw(c);const qs=Object.keys(params).map(k=>`${k}=${encodeURIComponent(params[k])}`).join('&');return `https://${API_HOST}/app/${p}?${qs}`}
function cloneHeaders(h){const o={};Object.keys(h||{}).forEach(k=>o[k]=h[k]);return o}
function buildHeaders(c,ua){const h=cloneHeaders(c.headers||{});delete h['Content-Length'],delete h[':authority'],delete h[':method'],delete h[':path'],delete h[':scheme'];h.Host=API_HOST;h.Accept=h.Accept||"application/json";Object.keys(h).forEach(k=>k.toLowerCase()==='user-agent'&&delete h[k]);h['User-Agent']=ua;return h}
function notify(t,b){$notify(scriptName,t,b)}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

async function runAccount(acc){
  const accId=acc.id;
  const headers=buildHeaders(acc.capture,buildUA(acc.baseUA,acc.uaSeed));
  let initBalance="",lastBalance="";
  const fetchApi=p=>$task.fetch({url:buildUrl(p,acc.capture),method:'GET',headers});

  // 签到
  await fetchApi('queryBalanceAndBonus').then(res=>{try{let d=JSON.parse(res.body);d.retcode===0&&(initBalance=formatMoney(d.result.balance))}catch(e){}});
  await fetchApi('checkIn').then(res=>{try{let d=JSON.parse(res.body);d.retcode===0&&addSignCountTemp(accId)}catch(e){}});

  // 极速视频循环
  for(let i=0;i<MAX_VIDEO;i++){
    await sleep(VIDEO_DELAY);
    await fetchApi('videoBonus').then(res=>{try{let d=JSON.parse(res.body);d.retcode===0&&addVideoCountTemp(accId)}catch(e){}});
  }

  await fetchApi('queryBalanceAndBonus').then(res=>{try{let d=JSON.parse(res.body);d.retcode===0&&(lastBalance=formatMoney(d.result.balance))}catch(e){}});

  const totalSign=getTotalSign(accId);
  const totalVideo=getTotalVideo(accId);
  return `初始金币：${initBalance} ；最新金币：${lastBalance}\n今日签到：${totalSign} 次 ；今日观看：${totalVideo} 条`;
}

// 抓包入库逻辑不变
if(typeof $request!=='undefined'&&$request){
  const paramsRaw=parseRawQuery($request.url);
  const headersMap=normalizeHeaderNameMap($request.headers||{});
  let baseUA="";Object.keys(headersMap).forEach(k=>k.toLowerCase()==='user-agent'&&(baseUA=headersMap[k]));
  const store=loadStore();
  const fp=fingerprintOf(paramsRaw);
  const existed=!!store.accounts[fp];
  const alias=existed?store.accounts[fp].alias:`账号${store.order.length+1}`;
  store.accounts[fp]={id:fp,alias,uaSeed:existed?store.accounts[fp].uaSeed:store.order.length,baseUA,capture:{url:$request.url,paramsRaw,headers:headersMap},updatedAt:Date.now()};
  !existed&&store.order.push(fp);
  saveStore(store);
  notify(existed?'🔄 账号参数已更新':'✅ 新账号已入库',`${alias}\n当前账号总数：${store.order.length}`);
  $done({});
}else{
  tempSignMap={};tempVideoMap={};dailyStatCache=null;
  const store=loadStore();
  const list=store.order.filter(id=>store.accounts[id]);
  if(!list.length)return notify('⚠️ 未抓到任何账号','请先打开 WeTalk 触发抓包'),$done();
  let results=[];
  (async()=>{
    for(let id of list){
      let text=await runAccount(store.accounts[id]);
      results.push(text);
      await sleep(ACCOUNT_GAP);
    }
    finalSaveStat();
    notify(`🎉 全部完成 (${list.length}个账号)`,results.join('\n———\n'));
    $done();
  })();
}