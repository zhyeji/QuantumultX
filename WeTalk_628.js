/***************************************
 * Wetalk 628 区号可用号码监控
 * 接口: getVirtualPhoneByAreaCode
 * 定时执行建议: 每30分钟
 * 如果签名过期，请重新抓包更新 API_URL 中的 sign 和 signDate 字段
 ***************************************/

// 从抓包完整复制过来的请求地址（含签名）
const API_URL = "https://api.wetalkapp.com/app/getVirtualPhoneByAreaCode" +
  "?appversion=30.6.0" +
  "&areaCode=628" +
  "&callpin=2BX3VtoXc9Ahf0gWnPFKKL" +
  "&clientName=iPhone" +
  "&clientTag=WeTalkIOS" +
  "&code=US" +
  "&countrycode=CN" +
  "&email=zhyejj%40gmail.com" +
  "&gs=" +
  "&installTime=2026-04-21%2018%3A22%3A57" +
  "&isJail=0" +
  "&language=zh_cn" +
  "&model=iPhone" +
  "&phone=8613816069282" +
  "&platform=iPhone11%2C2" +
  "&sign=54de8fa4e42118c94e26d6500a3c7c9" +
  "&signDate=2026-05-08%2002%3A05%3A44" +
  "&systemname=iOS" +
  "&systemVersion=16.6.1" +
  "&type=Virtual" +
  "&uniqueDeviceId=C9F596B3-B504-4663-AE86-5170E6C4A834WeTalkIOS";

// 请求头（Cookie 和 User-Agent 都可能影响签名校验）
const HEADERS = {
  "Host": "api.wetalkapp.com",
  "Accept": "application/json",
  "Cookie": "_ga_X8TYBPK7B8=GS2.1.s1778168271$o1$g1$t1778168339$j55$10$h1722426582; _ga=GA1.1.798189254.1778168271; _c_WBKFRo=eytbP3MhwKGi3AxnnvZjt1QjsgjLSbzcEJ94hOoP",
  "User-Agent": "WeTalk/30.6.0 (com.innovationworks.wetalk; build:28; iOS 16.6.1) Alamofire/5.4.3",
  "Accept-Language": "zh-Hans-CN;q=1.0, en-CN;q=0.9",
  "Accept-Encoding": "br;q=1.0, gzip;q=0.9, deflate;q=0.8",
  "Connection": "keep-alive"
};

const STORAGE_KEY = "wetalk_628_numbers";
const TITLE = "Wetalk 628监控";

$task.fetch({ url: API_URL, headers: HEADERS }).then(response => {
  try {
    const data = JSON.parse(response.body);
    if (data.retcode !== 0) {
      throw new Error("接口返回错误: " + data.retmsg);
    }
    // 提取号码数组（响应结构: result.numbers）
    const newNumbers = data.result.numbers || [];
    if (!newNumbers.length) {
      return $notification.post(TITLE, "号码列表为空", "当前无可用号码");
    }

    // 读取历史记录
    const oldStr = $prefs.valueForKey(STORAGE_KEY);
    const oldNumbers = oldStr ? JSON.parse(oldStr) : [];

    // 比对差异
    const added = newNumbers.filter(n => !oldNumbers.includes(n));
    const removed = oldNumbers.filter(n => !newNumbers.includes(n));

    // 发生变动时通知
    if (added.length > 0 || removed.length > 0) {
      let msg = "";
      if (added.length > 0) msg += "🟢 新增: " + added.map(n => "+1 628-" + n.slice(3)).join(", ");
      if (removed.length > 0) msg += (msg ? "\n" : "") + "🔴 消失: " + removed.map(n => "+1 628-" + n.slice(3)).join(", ");
      $notification.post(TITLE, "号码变动", msg);
    } else {
      // 无变化时静默，如需调试可取消下面注释
      // $notification.post(TITLE, "无变化", "当前共 " + newNumbers.length + " 个号码");
    }

    // 更新存储
    $prefs.setValueForKey(JSON.stringify(newNumbers), STORAGE_KEY);
    $done();
  } catch (e) {
    $notification.post(TITLE, "解析失败", e.message);
    $done();
  }
}, err => {
  $notification.post(TITLE, "请求失败", err.error || JSON.stringify(err));
  $done();
});
