// 脱敏工具：汉字 → 拼音首字母，以及「疑似人名 / 疑似地点」的启发式识别。
//
// 两类东西，性质完全不同，处理方式也不同：
//
//   名单（privacy-rules.json 的 names / places）→ 自动替换成拼音首字母。
//     这是确定性的、可复核的：你写一次名字，之后每篇稿子都按同一套规则处理。
//
//   启发式识别出来的 → 只报告，不自动替换。
//     中文里大量普通词以姓氏开头（白天、说明、和平、方向、马路……），
//     自动替换会把正文改得莫名其妙，而且你很难看出「BT」原来是「白天」。
//     宁可让你看一眼报告再决定，也不在正文里留下莫名其妙的缩写。
//
// 拼音首字母表由 macOS 自带的 CoreFoundation/ICU（Han→Latin）离线生成，
// 是一张静态数据文件，运行时不依赖任何第三方包，也不依赖系统装了 ICU。
// 代价是按单字取音，不看上下文：多音字只取常用读音（长→Z、行→X）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const table = JSON.parse(fs.readFileSync(path.join(here, 'pinyin-initials.json'), 'utf8'));
const BASE = parseInt(table.base, 16);
const TABLE = table.table;

/** 汉字串 → 拼音首字母（大写）。非汉字原样保留。 */
export function pinyinInitials(text) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= BASE && cp < BASE + TABLE.length) {
      const initial = TABLE[cp - BASE] ?? '?';
      if (initial !== '?') out += initial;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * 一个名称的替代写法。
 * 纯英文名取各词首字母（Tony Blair → TB）；中文名取拼音首字母（陈书宁 → CSN）。
 */
export function maskName(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return '';
  if (/^[\x20-\x7e]+$/.test(trimmed)) {
    return trimmed
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map(word => word[0].toUpperCase())
      .join('');
  }
  return pinyinInitials(trimmed);
}

/** 常见姓氏。用于「疑似姓名」的识别，不用于替换。 */
const SURNAMES = new Set(
  '王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛段雷侯龙史陶黎贺顾毛郝龚邵万钱严武戴莫孔向汤'.split(''),
);

/** 常见人名用字。末字命中它，才认为「像是一个名字」。
 *  刻意不含「平、和、心、天、地」这类高频普通词用字，否则「和平」「说明」「中心」会被当成姓名。 */
const GIVEN_CHARS = new Set(
  '明华伟芳娜静强磊军洋勇艳杰娟涛超秀英慧敏丽刚小康志义仁礼智信诚善孝忠毅恒健乐宁舒悦欣怡泰顺祥旭峰波江海河湖山石林森泽轩琪睿豪书国建鹏宇飞龙虎亮辉家凯楠枫瑶鹏'.split(''),
);

/** 称谓。姓 + 称谓（徐老师、李总）按你的规则不需要脱敏。 */
const TITLES = ['老师', '先生', '女士', '小姐', '同志', '师傅', '阿姨', '叔叔', '经理', '主任', '医生', '教授', '科长', '局长', '院长', '师傅', '总', '工'];

/** 常见城市与地区。命中即报告。 */
const PLACES = new Set(
  ('北京,上海,天津,重庆,河北,山西,辽宁,吉林,黑龙江,江苏,浙江,安徽,福建,江西,山东,河南,湖北,湖南,广东,广西,海南,四川,贵州,云南,陕西,甘肃,青海,台湾,内蒙古,西藏,宁夏,新疆,香港,澳门,' +
   '沈阳,大连,青岛,济南,烟台,潍坊,苏州,无锡,常州,南通,宁波,温州,绍兴,金华,杭州,嘉兴,台州,湖州,丽水,' +
   '福州,厦门,泉州,漳州,莆田,三明,龙岩,南平,宁德,合肥,芜湖,蚌埠,安庆,黄山,滁州,南昌,赣州,九江,上饶,宜春,萍乡,景德镇,' +
   '郑州,洛阳,开封,南阳,许昌,新乡,安阳,商丘,信阳,周口,驻马店,武汉,宜昌,襄阳,荆州,黄石,十堰,鄂州,孝感,咸宁,黄冈,' +
   '长沙,株洲,湘潭,衡阳,邵阳,岳阳,常德,张家界,益阳,娄底,广州,深圳,珠海,汕头,佛山,韶关,湛江,肇庆,惠州,江门,茂名,梅州,清远,潮州,揭阳,' +
   '南宁,桂林,柳州,北海,绵阳,德阳,宜宾,泸州,南充,乐山,自贡,遵义,昆明,大理,丽江,曲靖,玉溪,贵阳,拉萨,' +
   '西安,咸阳,宝鸡,渭南,汉中,榆林,兰州,天水,白银,酒泉,西宁,银川,乌鲁木齐,呼和浩特,鄂尔多斯').split(','),
);

/** 具体地点的后缀。刻意不含「市场」「超市」「书店」这类通用词 —— 「大宗商品市场」不是地点。 */
const PLACE_SUFFIXES = ['大厦', '广场', '公园', '车站', '机场', '大学', '学院', '医院', '博物馆', '体育馆', '图书馆', '饭店', '酒店', '小区', '家属院'];

/** 地点名前面的定语、介词、时间词。匹配后要剥掉，否则「个不大的广场」「第二天在超市」会被整段当成地点。 */
const PLACE_LEADING_NOISE = new Set(
  '的了在从和与跟到过是有个不条种一两三四五六七八九十第昨今明那这们很最再又也就都而其它他她我您咱谁'.split(''),
);

/** 两个字、但其实是普通词的组合。误报成本很高（报告里天天出现，人就懒得看了）。 */
const NOT_NAMES = new Set(['高明', '黎明']);

/**
 * 找出疑似人名。只报告，不替换。
 * 规则：姓 + 1~2 个字，且末字命中常见人名用字，后面不接称谓。
 */
export function detectNames(text) {
  const found = new Set();
  const source = String(text ?? '');
  for (let i = 0; i < source.length; i += 1) {
    if (!SURNAMES.has(source[i])) continue;
    for (const length of [3, 2]) {
      const candidate = source.slice(i, i + length);
      if (candidate.length < length) continue;
      if (!GIVEN_CHARS.has(candidate[length - 1])) continue;
      // 姓 + 2 字时，中间字也要是常见人名用字，否则更像普通词（说明、和平）
      if (length === 3 && !GIVEN_CHARS.has(candidate[1])) continue;
      if (NOT_NAMES.has(candidate)) continue;
      const after = source.slice(i + length);
      if (TITLES.some(title => after.startsWith(title))) continue;
      // 「分钟超8人」里的「钟超」：名字后面紧跟数字，几乎不可能是人名
      if (length === 2 && /\d/.test(after[0] ?? '')) continue;
      found.add(candidate);
      break;
    }
  }
  return [...found];
}

/**
 * 找出疑似具体地点。只报告，不替换。
 * 规则：内置城市名，或者「地名 + 具体地点后缀 / 门牌号」。
 */
export function detectPlaces(text) {
  const found = new Set();
  const source = String(text ?? '');
  for (const place of PLACES) {
    if (source.includes(place)) found.add(place);
  }
  const suffixPattern = new RegExp(`[\\u4e00-\\u9fff]{2,4}(?:${PLACE_SUFFIXES.join('|')})`, 'g');
  for (const match of source.matchAll(suffixPattern)) {
    const raw = match[0];
    const suffix = PLACE_SUFFIXES.find(item => raw.endsWith(item));
    let name = raw.slice(0, raw.length - suffix.length);
    // 剥掉「不大的」「大小的」这类修饰语
    name = name.replace(/[不很挺太最更]?[大小新旧好点些]的/g, '');
    // 剥掉开头的定语、介词、时间词
    while (name.length && PLACE_LEADING_NOISE.has(name[0])) name = name.slice(1);
    // 只剩一个字，等于「广场」「医院」这种通称，不是具体地点
    if (name.length < 2) continue;
    found.add(`${name}${suffix}`);
  }
  // 门牌号：18号、3单元502
  for (const match of source.matchAll(/\d{1,6}号/g)) found.add(match[0]);
  return [...found];
}
