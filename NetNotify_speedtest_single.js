/*
 * NetNotify - 网络测速通知版（Speedtest · IP vs 节点 · 国家代码+城市IATA码）
 * 适配 Quantumult X（无小组件场景）
 *
 * 参数示例（对比用）：
 * mb=1&node=香港01
 *
 * 默认：
 * - 标题显示：NetNotify · [国家代码] [城市IATA码] vs [你填的节点名]（节点）[✅/⚠️]
 * - 正文两行：
 *   🔻 下行: xx.xx MB/s
 *   ⏱️ 延迟: xx ms  ⏳ 耗时: xx ms
 */

const $ = new Env('NetNotify');

// ========== 参数解析 ==========
let arg = {};
if (typeof $argument !== 'undefined') {
    arg = Object.fromEntries($argument.split('&').map(item => item.split('=')));
}
const mb = parseFloat($.lodash_get(arg, 'mb', '1'));
const bytes = mb * 1024 * 1024;
const manualNodeName = arg?.node || '';       // 手动填写的节点名
const aviationKey = 'b4342a9cca04028aa6fd5ad5fbcc8298';  // 你的 Aviationstack API Key

// ========== 代理注入 ==========
function ReRequest(request = {}, proxyName = '') {
    if (proxyName) {
        if (request.opts) {
            request.opts.policy = proxyName;
        } else {
            request.opts = { policy: proxyName };
        }
    }
    return request;
}

// ========== Speedtest 服务器获取 ==========
async function getSpeedtestServer() {
    try {
        const resp = await $.http.get(
            ReRequest({ url: 'https://www.speedtest.net/api/js/servers?engine=js', timeout: 5000 }, '')
        );
        const servers = JSON.parse(resp.body);
        if (!servers || servers.length === 0) throw new Error('无可用服务器');
        return servers[0];
    } catch (e) {
        $.logErr('获取Speedtest服务器失败', e.message);
        throw e;
    }
}

// ========== 单轮测速 ==========
async function runSpeedtestRound(server, bytes) {
    const baseUrl = server.url.replace(/\/$/, '');
    // 延迟测试
    const pingStart = Date.now();
    await $.http.get(ReRequest({ url: `${baseUrl}/speedtest/latency.txt`, timeout: 3000 }, ''));
    const pingMs = Date.now() - pingStart;

    // 下载测试
    const downloadUrl = `${baseUrl}/speedtest/random${bytes}x${Math.random().toString(36).substring(2)}.jpg`;
    const downStart = Date.now();
    await $.http.get(ReRequest({ url: downloadUrl, timeout: 10000 }, ''));
    const downEnd = Date.now();
    const durationMs = downEnd - downStart;
    const speedMbps = (bytes * 8) / (durationMs / 1000) / 1e6;

    return { pingMs, durationMs, speedMbps };
}

// ========== 通过 Aviationstack 查询城市 IATA 代码 ==========
async function getCityCode(cityName) {
    if (!cityName || !aviationKey) return cityName;
    try {
        const url = `https://api.aviationstack.com/v1/cities?access_key=${aviationKey}&search=${encodeURIComponent(cityName)}&limit=1`;
        const resp = await $.http.get({ url: url, timeout: 5000 });
        const data = JSON.parse(resp.body);
        if (data.data && data.data.length > 0 && data.data[0].code) {
            return data.data[0].code;   // 返回 IATA 三字码，如 TYO、SIN
        }
        return cityName;  // 查不到保留原名
    } catch (e) {
        $.logErr(`查询城市代码失败 (${cityName})`, e.message);
        return cityName;
    }
}

// ========== IP 地理信息（国家代码 + 城市 IATA 码） ==========
async function getNodeInfo() {
    try {
        const resp = await $.http.get({
            url: 'https://api.ip.sb/geoip',
            timeout: 5000
        });
        const data = JSON.parse(resp.body);
        const countryCode = data.country_code || data.country || '';
        const cityName = data.city || '';

        // 获取城市 IATA 代码
        const cityCode = await getCityCode(cityName);

        return [countryCode, cityCode].filter(Boolean).join(' ');
    } catch (e) {
        $.logErr('获取IP信息失败', e.message);
        return '';
    }
}

// ========== 主流程 ==========
(async () => {
    const testRounds = 3;
    const intervalMs = 1000;
    let totalSpeedMbps = 0;
    let totalPingMs = 0;
    let totalDurationMs = 0;

    try {
        const server = await getSpeedtestServer();

        for (let i = 0; i < testRounds; i++) {
            const round = await runSpeedtestRound(server, bytes);
            totalPingMs += round.pingMs;
            totalDurationMs += round.durationMs;
            totalSpeedMbps += round.speedMbps;

            if (i < testRounds - 1) {
                await $.wait(intervalMs);
            }
        }

        const avgSpeedMbps = totalSpeedMbps / testRounds;
        const avgSpeedMBs = avgSpeedMbps / 8;
        const avgPingMs = Math.round(totalPingMs / testRounds);
        const avgDurationMs = Math.round(totalDurationMs / testRounds);

        // IP 地理位置
        const ipLocation = await getNodeInfo();

        // 判断是否手动填了节点名
        const displayNodeName = manualNodeName;
        let marker = '';
        if (displayNodeName && ipLocation) {
            // 简单对比：IP位置是否包含节点名的一部分（可自行修改规则）
            const matched = ipLocation.includes(displayNodeName) || displayNodeName.includes(ipLocation.split(' ')[0]);
            marker = matched ? ' ✅' : ' ⚠️';
        }

        // 构造标题
        let title = arg?.title;
        if (!title) {
            const parts = ['NetNotify'];
            if (ipLocation) parts.push(ipLocation);
            if (displayNodeName) parts.push(displayNodeName + '（节点）' + marker);
            if (parts.length === 2) {
                title = parts.join(' · ');
            } else if (parts.length >= 3) {
                title = `${parts[0]} · ${parts[1]} vs ${parts[2]}`;
            } else {
                title = parts[0];
            }
        }

        const body = `🔻 下行: ${avgSpeedMBs.toFixed(2)} MB/s\n⏱️ 延迟: ${avgPingMs} ms  ⏳ 耗时: ${avgDurationMs} ms`;

        $notify(title, '', body);
        $.log(`✅ 测速完成 | 下行 ${avgSpeedMBs.toFixed(2)} MB/s | IP:${ipLocation} | 节点:${displayNodeName}`);
    } catch (e) {
        $.logErr('测速异常', e.message);
        $notify(arg?.title || 'NetNotify', '❌ 测速失败', e.message || '请检查网络');
    } finally {
        $.done();
    }
})();

// ========== Env 工具库 ==========
// prettier-ignore
function Env(t,s){class e{constructor(t){this.env=t}send(t,s="GET"){t="string"==typeof t?{url:t}:t;let e=this.get;return"POST"===s&&(e=this.post),new Promise((s,i)=>{e.call(this,t,(t,e,r)=>{t?i(t):s(e)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,s){this.name=t,this.http=new e(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,s)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $environment&&$environment["surge-version"]}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}isStash(){return"undefined"!=typeof $environment&&$environment["stash-version"]}toObj(t,s=null){try{return JSON.parse(t)}catch{return s}}toStr(t,s=null){try{return JSON.stringify(t)}catch{return s}}getjson(t,s){let e=s;const i=this.getdata(t);if(i)try{e=JSON.parse(this.getdata(t))}catch{}return e}setjson(t,s){try{return this.setdata(JSON.stringify(t),s)}catch{return!1}}getScript(t){return new Promise(s=>{this.get({url:t},(t,e,i)=>s(i))})}runScript(t,s){return new Promise(e=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=s&&s.timeout?s.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,s,i)=>e(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),s=this.path.resolve(process.cwd(),this.dataFile),e=this.fs.existsSync(t),i=!e&&this.fs.existsSync(s);if(!e&&!i)return{};{const i=e?t:s;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),s=this.path.resolve(process.cwd(),this.dataFile),e=this.fs.existsSync(t),i=!e&&this.fs.existsSync(s),r=JSON.stringify(this.data);e?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(s,r):this.fs.writeFileSync(t,r)}}lodash_get(t,s,e){const i=s.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return e;return r}lodash_set(t,s,e){return Object(t)!==t?t:(Array.isArray(s)||(s=s.toString().match(/[^.[\]]+/g)||[]),s.slice(0,-1).reduce((t,e,i)=>Object(t[e])===t[e]?t[e]:t[e]=Math.abs(s[i+1])>>0==+s[i+1]?[]:{},t)[s[s.length-1]]=e,t)}getdata(t){let s=this.getval(t);if(/^@/.test(t)){const[,e,i]=/^@(.*?)\.(.*?)$/.exec(t),r=e?this.getval(e):"";if(r)try{const t=JSON.parse(r);s=t?this.lodash_get(t,i,""):s}catch(t){s=""}}return s}setdata(t,s){let e=!1;if(/^@/.test(s)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(s),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const s=JSON.parse(h);this.lodash_set(s,r,t),e=this.setval(JSON.stringify(s),i)}catch(s){const o={};this.lodash_set(o,r,t),e=this.setval(JSON.stringify(o),i)}}else e=this.setval(t,s);return e}getval(t){return this.isSurge()||this.isShadowrocket()||this.isLoon()||this.isStash()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,s){return this.isSurge()||this.isShadowrocket()||this.isLoon()||this.isStash()?$persistentStore.write(t,s):this.isQuanX()?$prefs.setValueForKey(t,s):this.isNode()?(this.data=this.loaddata(),this.data[s]=t,this.writedata(),!0):this.data&&this.data[s]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,s=(()=>{})){if(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isShadowrocket()||this.isLoon()||this.isStash())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,e,i)=>{!t&&e&&(e.body=i,e.statusCode=e.status?e.status:e.statusCode,e.status=e.statusCode),s(t,e,i)});else if(this.isQuanX())this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:e,statusCode:i,headers:r,body:o}=t;s(null,{status:e,statusCode:i,headers:r,body:o},o)},t=>s(t&&t.error||"UndefinedError"));else if(this.isNode()){let e=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,s)=>{try{if(t.headers["set-cookie"]){const e=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();e&&this.ckjar.setCookieSync(e,null),s.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:i,statusCode:r,headers:o,rawBody:h}=t,a=e.decode(h,this.encoding);s(null,{status:i,statusCode:r,headers:o,rawBody:h,body:a},a)},t=>{const{message:i,response:r}=t;s(i,r,r&&e.decode(r.rawBody,this.encoding))})}}post(t,s=(()=>{})){const e=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isShadowrocket()||this.isLoon()||this.isStash())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[e](t,(t,e,i)=>{!t&&e&&(e.body=i,e.statusCode=e.status?e.status:e.statusCode,e.status=e.statusCode),s(t,e,i)});else if(this.isQuanX())t.method=e,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:e,statusCode:i,headers:r,body:o}=t;s(null,{status:e,statusCode:i,headers:r,body:o},o)},t=>s(t&&t.error||"UndefinedError"));else if(this.isNode()){let i=require("iconv-lite");this.initGotEnv(t);const{url:r,...o}=t;this.got[e](r,o).then(t=>{const{statusCode:e,statusCode:r,headers:o,rawBody:h}=t,a=i.decode(h,this.encoding);s(null,{status:e,statusCode:r,headers:o,rawBody:h,body:a},a)},t=>{const{message:e,response:r}=t;s(e,r,r&&i.decode(r.rawBody,this.encoding))})}}time(t,s=null){const e=s?new Date(s):new Date;let i={"M+":e.getMonth()+1,"d+":e.getDate(),"H+":e.getHours(),"m+":e.getMinutes(),"s+":e.getSeconds(),"q+":Math.floor((e.getMonth()+3)/3),S:e.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(e.getFullYear()+"").substr(4-RegExp.$1.length)));for(let s in i)new RegExp("("+s+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[s]:("00"+i[s]).substr((""+i[s]).length)));return t}queryStr(t){let s="";for(const e in t){let i=t[e];null!=i&&""!==i&&("object"==typeof i&&(i=JSON.stringify(i)),s+=`${e}=${i}&`)}return s=s.substring(0,s.length-1),s}msg(s=t,e="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()||this.isShadowrocket()||this.isStash()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let s=t.openUrl||t.url||t["open-url"],e=t.mediaUrl||t["media-url"];return{openUrl:s,mediaUrl:e}}if(this.isQuanX()){let s=t["open-url"]||t.url||t.openUrl,e=t["media-url"]||t.mediaUrl,i=t["update-pasteboard"]||t.updatePasteboard;return{"open-url":s,"media-url":e,"update-pasteboard":i}}if(this.isSurge()||this.isShadowrocket()||this.isStash()){let s=t.url||t.openUrl||t["open-url"];return{url:s}}}};if(this.isMute||(this.isSurge()||this.isShadowrocket()||this.isLoon()||this.isStash()?$notification.post(s,e,i,o(r)):this.isQuanX()&&$notify(s,e,i,o(r))),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(s),e&&t.push(e),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,s){const e=!this.isSurge()||this.isShadowrocket()&&!this.isQuanX()&&!this.isLoon()&&!this.isStash();e?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(s=>setTimeout(s,t))}done(t={}){const s=(new Date).getTime(),e=(s-this.startTime)/1e3;this.isSurge()||this.isShadowrocket()||this.isQuanX()||this.isLoon()||this.isStash()?$done(t):this.isNode()&&process.exit(1)}}(t,s)}