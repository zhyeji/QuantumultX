/*
 * NetNotify - 同国家多节点测速汇总
 * 适配 Quantumult X 1.5.5
 * 测速原理：完全照搬原始正常运行脚本
 */

// ==================== 节点列表 ====================
var ALL_NODES = [
    'SG-CN2-JT', 'KR-KD', 'MY-EVOXT', 'ANY-JP2',
    '新加坡 01|SIF', 'ENET-SG01', 'ENET-TW01',
    'IPLC(HW) 新加坡',
    'IEPL 企业专线-日本 01-流媒体 AI-ss-x4',
    'IEPL 企业专线-美国 01-AT&T 纯净 IP-ss-x4',
    'IEPL 企业专线-台湾 01-流媒体 AI-ss-x4',
    'IEPL 企业专线-新加坡 01-ss-x4',
    'SS-TW-GCP', 'SS-SG-GCP', 'VRV-KR-GCP',
    '台湾 01', '日本 01', '新加坡 01', '香港 01',
    'Base 瑞典',
    'BGP 智能路由-法国 01-ss-x2',
    'BGP 智能路由-新加坡 08-流媒体 AI-ss-x2',
    'IX 互联-香港 03-实验性大带宽专线-ss-x4',
    'BGP 智能路由-台湾 03-ss-x2',
    'IEPL 企业专线-日本 05-ss-x4',
    'BGP 智能路由-德国 01-ss-x2',
    'BGP 智能路由-韩国 02-ss-x2',
    'BGP 智能路由-美国 02-流媒体 AI-ss-x2'
];

var nodeMap = {};
for (var i = 0; i < ALL_NODES.length; i++) {
    nodeMap[ALL_NODES[i].trim()] = true;
}
ALL_NODES = Object.keys(nodeMap);

// ==================== 国家匹配规则 ====================
var countryRules = [
    { code: 'SG', name: '新加坡', regex: /新加坡|SG|SIF|ENET-SG/i },
    { code: 'HK', name: '香港',   regex: /香港|HK|Hong\s*Kong/i },
    { code: 'JP', name: '日本',   regex: /日本|JP|Japan|东京|Osaka/i },
    { code: 'US', name: '美国',   regex: /美国|US|USA|America|洛杉矶|纽约|硅谷|西雅图|AT&T/i },
    { code: 'TW', name: '台湾',   regex: /台湾|TW|Taiwan|Taipei|中华电信|Hinet|ENET-TW/i },
    { code: 'KR', name: '韩国',   regex: /韩国|KR|Korea|Seoul|VRV-KR/i },
    { code: 'DE', name: '德国',   regex: /德国|DE|Germany|法兰克福/i },
    { code: 'FR', name: '法国',   regex: /法国|FR|France/i },
    { code: 'SE', name: '瑞典',   regex: /瑞典|SE|Sweden|斯德哥尔摩/i },
    { code: 'MY', name: '马来西亚', regex: /马来西亚|MY|Malaysia|EVOXT/i }
];

function matchCountry(nodeName) {
    for (var i = 0; i < countryRules.length; i++) {
        if (countryRules[i].regex.test(nodeName)) return countryRules[i];
    }
    return null;
}

// ========== 测速逻辑 ==========

var TEST_ROUNDS = 3;
var TEST_MB = 1;
var TEST_BYTES = TEST_MB * 1024 * 1024;

function ReRequest(request, proxyName) {
    request = request || {};
    proxyName = proxyName || '';
    if (proxyName) {
        request.opts = request.opts || {};
        request.opts.policy = proxyName;
    }
    return request;
}

function getSpeedtestServer() {
    return $task.fetch(ReRequest({ url: 'https://www.speedtest.net/api/js/servers?engine=js', timeout: 5000 }, ''))
        .then(function(resp) {
            var servers = JSON.parse(resp.body);
            if (!servers || servers.length === 0) throw new Error('无可用服务器');
            return servers[0];
        });
}

function runSpeedtestRound(server, bytes) {
    return new Promise(function(resolve) {
        var baseUrl = server.url.replace(/\/$/, '');
        
        var pingStart = Date.now();
        $task.fetch(ReRequest({ url: baseUrl + '/speedtest/latency.txt', timeout: 3000 }, ''))
            .then(function() {
                var pingMs = Date.now() - pingStart;
                
                var downloadUrl = baseUrl + '/speedtest/random' + bytes + 'x' + Math.random().toString(36).substring(2) + '.jpg';
                var downStart = Date.now();
                
                $task.fetch(ReRequest({ url: downloadUrl, timeout: 10000 }, ''))
                    .then(function() {
                        var downEnd = Date.now();
                        var durationMs = downEnd - downStart;
                        var speedMbps = (bytes * 8) / (durationMs / 1000) / 1e6;
                        resolve({ pingMs: pingMs, durationMs: durationMs, speedMbps: speedMbps });
                    })
                    .catch(function() {
                        resolve({ pingMs: pingMs, durationMs: 0, speedMbps: 0 });
                    });
            })
            .catch(function() {
                resolve({ pingMs: 0, durationMs: 0, speedMbps: 0 });
            });
    });
}

function testNode(server) {
    return new Promise(function(resolve) {
        var totalSpeedMbps = 0;
        var totalPingMs = 0;
        var totalDurationMs = 0;
        var okRounds = 0;
        
        function runRound(index) {
            if (index >= TEST_ROUNDS) {
                if (okRounds === 0) {
                    resolve({ ping: 0, speed: 0, duration: 0, ok: false });
                    return;
                }
                var avgSpeedMbps = totalSpeedMbps / okRounds;
                var avgSpeedMBs = avgSpeedMbps / 8;
                var avgPingMs = Math.round(totalPingMs / okRounds);
                var avgDurationMs = Math.round(totalDurationMs / okRounds);
                resolve({ ping: avgPingMs, speed: avgSpeedMBs, duration: avgDurationMs, ok: true });
                return;
            }
            
            runSpeedtestRound(server, TEST_BYTES).then(function(round) {
                if (round.durationMs > 0) {
                    totalPingMs += round.pingMs;
                    totalDurationMs += round.durationMs;
                    totalSpeedMbps += round.speedMbps;
                    okRounds++;
                }
                
                if (index < TEST_ROUNDS - 1) {
                    setTimeout(function() { runRound(index + 1); }, 1000);
                } else {
                    runRound(index + 1);
                }
            });
        }
        
        runRound(0);
    });
}

function getIpInfo() {
    return $task.fetch({ url: 'https://api.ip.sb/geoip', timeout: 5000 })
        .then(function(resp) {
            var d = JSON.parse(resp.body);
            return { code: d.country_code || d.country || '', city: d.city || '', isp: d.isp || '', ip: d.ip || '' };
        })
        .catch(function() {
            return $task.fetch({ url: 'http://ip-api.com/json/?fields=countryCode,city,isp,query', timeout: 5000 })
                .then(function(resp) {
                    var d = JSON.parse(resp.body);
                    return { code: d.countryCode || '', city: d.city || '', isp: d.isp || '', ip: d.query || '' };
                })
                .catch(function() {
                    return { code: '', city: '', isp: '', ip: '' };
                });
        });
}

function padName(name) {
    var len = 9;
    if (name.length > len) return name.substring(0, len);
    while (name.length < len) name += ' ';
    return name;
}

// ========== 主流程 ==========
var startTime = Date.now();
console.log('========================================');
console.log('NetNotify 启动 | 共 ' + ALL_NODES.length + ' 个节点');

getIpInfo().then(function(ipInfo) {
    var countryCode = ipInfo.code;
    
    if (!countryCode) {
        for (var i = 0; i < ALL_NODES.length; i++) {
            var mc = matchCountry(ALL_NODES[i]);
            if (mc) { countryCode = mc.code; break; }
        }
    }
    
    if (!countryCode) {
        $notify('NetNotify', '无法确定当前国家', '');
        $done();
        return;
    }
    
    var matchedRule = null;
    for (var i = 0; i < countryRules.length; i++) {
        if (countryRules[i].code === countryCode) {
            matchedRule = countryRules[i];
            break;
        }
    }
    if (!matchedRule) {
        matchedRule = { code: countryCode, name: countryCode, regex: new RegExp(countryCode, 'i') };
    }
    
    var countryName = matchedRule.name;
    console.log('当前国家: ' + countryName + ' (' + countryCode + ')');
    
    var targetNodes = [];
    for (var i = 0; i < ALL_NODES.length; i++) {
        if (matchedRule.regex.test(ALL_NODES[i])) {
            targetNodes.push(ALL_NODES[i]);
        }
    }
    
    if (targetNodes.length === 0) {
        $notify('NetNotify', '无' + countryName + '节点', '');
        $done();
        return;
    }
    
    console.log(countryName + '节点: ' + targetNodes.length + ' 个 | 每节点' + TEST_ROUNDS + '轮');
    
    getSpeedtestServer().then(function(server) {
        console.log('测速服务器: ' + (server.sponsor || '未知'));
        
        var results = [];
        
        function next(index) {
            if (index >= targetNodes.length) {
                results.sort(function(a, b) {
                    if (a.ok && !b.ok) return -1;
                    if (!a.ok && b.ok) return 1;
                    return b.speed - a.speed;
                });
                
                var ok = results.filter(function(r) { return r.ok; });
                var dur = Math.round((Date.now() - startTime) / 1000);
                
                var bestName = ok.length > 0 ? padName(ok[0].name) : '无        ';
                var bestSpeed = ok.length > 0 ? ok[0].speed.toFixed(2) + ' MB/s' : '0.00 MB/s';
                var bestPing = ok.length > 0 ? ok[0].ping + 'ms' : '0ms';
                
                var worstName = ok.length > 1 ? padName(ok[ok.length-1].name) : '无        ';
                var worstSpeed = ok.length > 1 ? ok[ok.length-1].speed.toFixed(2) + ' MB/s' : '0.00 MB/s';
                var worstPing = ok.length > 1 ? ok[ok.length-1].ping + 'ms' : '0ms';
                
                var title = 'NetNotify ' + countryName + ' (' + ok.length + '/' + targetNodes.length + ')';
                var body = '🚀 ' + bestName + '  ' + bestSpeed + '  ' + bestPing + '\n';
                
                if (ok.length > 1) {
                    body += '🐢 ' + worstName + '  ' + worstSpeed + '  ' + worstPing;
                }
                
                if (ok.length > 2) {
                    body += '\n\n';
                    for (var i = 1; i < ok.length - 1; i++) {
                        var r = ok[i];
                        body += '🔆 ' + padName(r.name) + '  ' + r.speed.toFixed(2) + ' MB/s  ' + r.ping + 'ms\n';
                    }
                }
                
                $notify(title, '', body);
                console.log('完成 | ' + dur + 's | ' + ok.length + '/' + targetNodes.length);
                $done();
                return;
            }
            
            var node = targetNodes[index];
            console.log('[' + (index+1) + '/' + targetNodes.length + '] ' + node);
            
            testNode(server).then(function(r) {
                r.name = node;
                results.push(r);
                console.log('  ' + (r.ok ? r.speed.toFixed(2) + ' MB/s, ' + r.ping + 'ms' : '失败'));
                setTimeout(function() { next(index+1); }, 500);
            });
        }
        
        next(0);
    }).catch(function(e) {
        $notify('NetNotify', '测速服务器错误', '');
        $done();
    });
}).catch(function(e) {
    $notify('NetNotify', '网络错误', '');
    $done();
});