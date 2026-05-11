var info = '--- 测试开始 ---\n';
info += 'typeof $trigger: ' + (typeof $trigger) + '\n';
info += '$trigger 值: [' + ($trigger === undefined ? 'undefined' : String($trigger)) + ']\n';
info += '$trigger === "": ' + ($trigger === '') + '\n';
info += '类型检查: ' + (typeof $trigger === 'string' ? '是字符串' : '不是字符串') + '\n';

if (typeof $trigger === 'string') {
  info += '包含 "time": ' + ($trigger.indexOf('time') >= 0) + '\n';
}

$notify('WeTalk 触发测试', '', info);
$done();