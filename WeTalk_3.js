// 记录脚本刚被执行时的“启动时刻”
var startTime = Date.now();

// 模拟一点点启动过程 (这里只是做个标记)
var initTime = Date.now();

// 计算从脚本开始执行,到真正执行到这行代码的耗时(毫秒)
var startDelay = initTime - startTime;

var info = '启动耗时(ms): ' + startDelay + '\n\n';
info += '如果这个值手动和定时差别大(如 >50ms),\n我们就可以用这个值来判断!';

$notify('WeTalk 时间差测试', '', info);
$done();
