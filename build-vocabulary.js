const fs = require('fs');
const path = require('path');

const vocabDir = path.join(__dirname, 'Vocabulary');
const outputFile = path.join(__dirname, 'functions', 'api', 'vocabulary.js');

let allWords = new Set();

const safeWordsList = new Set([
  // 1. 日常高频词 & 代词 & 动作
  "没有", "时间", "联系", "安全", "测试", "如果", "记得", "完成", "处理", "代表", "一个",
  "如今", "未来", "计划", "买", "卖", "退", "出", "吃", "咬", "脱", "摸", "干", "操", "上", "日",
  "滚", "贱", "死", "杀", "炸", "药", "毒", "血", "痛", "疼", "痒", "其他", "限制", "网址", "复制",
  "传单", "刻章", "卡号", "出售", "有售", "清仓", "过夜", "解码", "真象", "真相", "舆论",
  "起诉", "判决", "死刑", "监狱", "诈骗", "骗局", "传销", "木马", "病毒",
  // 2. 称谓 & 职业 & 人物
  "老婆", "丈夫", "妻子", "太太", "夫人", "前夫", "父亲", "女儿", "女婿", "亲友", "儿子",
  "妈", "爸", "爹", "爷", "奶", "哥哥", "司机", "师傅", "律师", "姐夫", "小姐", "女人",
  "男人", "女孩", "男孩", "老母", "他妈", "你妈", "尼玛", "你妹", "基友", "小三", "全职", "兼职",
  "客服", "技师", "协警", "教徒", "大师", "弟子", "瞎子", "聋子", "胖子", "华人", "猛男",
  // 3. IT / 互联网 / 商业
  "网络", "系统", "管理", "维护", "官方", "手机", "地址", "价格", "资格", "证明", "办理",
  "淘宝", "客服", "招聘", "兼职", "销售", "购买", "供应", "网站", "电话", "联系", "热线",
  "代理", "代办", "代购", "批发", "微店", "网购", "订购", "专卖", "直销",
  "QQ", "qq", "cs", "CS", "sf", "wg", "GM", "Gm", "gm", "av", "AV", "sm", "SM",
  "网关", "信息", "制作", "发票", "挂牌", "转让", "收账", "点数",
  // 4. 国家 & 社会 & 地名
  "国家", "社会", "政府", "中央", "政策", "美国", "日本", "印尼", "朝鲜", "非洲", "澳洲",
  "警察", "公安", "法院", "税务", "城管", "刑警", "武警", "交警", "保安", "特警", "民警",
  "北京", "武汉", "浙江", "深圳", "杭州", "河南", "东北", "台湾", "香港", "澳门",
  "大陆", "中华", "亚洲", "地球", "南蛮", "高丽", "西藏", "新疆", "广州", "上海",
  "广场", "世博", "总理", "总局",
  // 5. 宗教 & 信仰 (中性词)
  "宗教", "佛教", "道教", "基督", "天主", "耶稣", "如来", "普贤", "文殊", "地藏", "圣母",
  "喇嘛", "活佛", "神佛", "风水", "迷信", "清真", "回族", "汉人", "经文", "讲法", "主神",
  "升天",
,
]);

try {
  const files = fs.readdirSync(vocabDir);

  for (const file of files) {
    if (file.endsWith('.txt')) {
      const filePath = path.join(vocabDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const words = content.split(/\r?\n/);
      for (let word of words) {
        word = word.trim();
        // 过滤条件:
        // 1. 不能为空
        // 2. 不能以 # 开头 (注释)
        // 3. 长度必须大于 1 (过滤所有单字和单字符)
        // 4. 不能在预设的白名单 (safeWordsList) 中
        if (word && !word.startsWith('#') && word.length > 1 && !safeWordsList.has(word)) {
          allWords.add(word);
        }
      }
    }
  }

  const wordsArray = Array.from(allWords);
  const fileContent = `// Automatically generated from Vocabulary directory\nexport const sensitiveWords = ${JSON.stringify(wordsArray)};\n`;

  fs.writeFileSync(outputFile, fileContent, 'utf-8');
  console.log(`Successfully generated vocabulary.js with ${wordsArray.length} words (filtered out common false positives and single characters).`);
} catch (error) {
  console.error("Error generating vocabulary:", error);
}