/**
 * Curated regex snippets for the Regex Tester. Plain data only: patterns are
 * written as literals and never built at runtime. Patterns marked "简化" are
 * deliberately partial and say so in their description.
 */

export interface RegexPreset {
  id: string
  name: string
  pattern: string
  flags: string
  description: string
  /** Text pasted into the test pane when the preset is chosen. */
  sample: string
}

export interface RegexPresetCategory {
  id: string
  name: string
  presets: RegexPreset[]
}

export const REGEX_PRESET_CATEGORIES: RegexPresetCategory[] = [
  {
    id: 'web',
    name: '网络',
    presets: [
      {
        id: 'email',
        name: '邮箱',
        pattern: '[\\w.%+-]+@[\\w-]+(?:\\.[\\w-]+)*\\.[A-Za-z]{2,}',
        flags: 'g',
        description: '常见邮箱格式（简化，不覆盖 RFC 5322 全部语法）',
        sample: '联系 alice.zhang@example.com 或 bob+dev@mail.co.uk 获取帮助'
      },
      {
        id: 'url',
        name: 'URL',
        pattern: 'https?:\\/\\/[^\\s/$.?#]\\S*',
        flags: 'g',
        description: 'http / https 链接（简化，末尾紧跟的标点也会被一并匹配）',
        sample: '官网 https://example.com/docs?id=1#top 和 http://localhost:8080/api'
      },
      {
        id: 'ipv4',
        name: 'IPv4',
        pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b',
        flags: 'g',
        description: '0.0.0.0 至 255.255.255.255',
        sample: '内网 192.168.1.1，网关 10.0.0.254，非法 256.1.1.1'
      },
      {
        id: 'ipv6',
        name: 'IPv6',
        pattern:
          '(?<![\\w:])(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}(?![\\w:])|(?<![\\w:])(?:[0-9a-f]{1,4}:){1,7}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?(?![\\w:])',
        flags: 'gi',
        description: '简化：覆盖完整八段写法与 :: 压缩写法，不匹配内嵌 IPv4 形式',
        sample: '2001:0db8:85a3:0000:0000:8a2e:0370:7334 与 fe80::1，时间 12:30:45 不应命中'
      }
    ]
  },
  {
    id: 'cn',
    name: '中国大陆',
    presets: [
      {
        id: 'cn-mobile',
        name: '手机号',
        pattern: '(?<!\\d)1[3-9]\\d{9}(?!\\d)',
        flags: 'g',
        description: '11 位大陆手机号（号段简化为 13 至 19 开头）',
        sample: '客服 13800138000，备用 +86 15912345678，无效 12345678901'
      },
      {
        id: 'cn-id-card',
        name: '身份证号',
        pattern:
          '(?<!\\d)[1-9]\\d{5}(?:18|19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx](?!\\d)',
        flags: 'g',
        description: '18 位身份证号，校验地址码、出生日期段格式，不校验末位校验码',
        sample: '身份证 11010519491231002X，旧版 110105491231002 不匹配'
      }
    ]
  },
  {
    id: 'datetime',
    name: '日期时间',
    presets: [
      {
        id: 'date',
        name: '日期 YYYY-MM-DD',
        pattern:
          '(?<!\\d)(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])(?!\\d)',
        flags: 'g',
        description: '按月日范围校验，不校验闰年与各月天数（2 月 30 日也会匹配，简化）',
        sample: '发布于 2026-10-28，截止 2026-02-30 前'
      },
      {
        id: 'time',
        name: '时间 HH:mm:ss',
        pattern: '(?<!\\d)(?<hour>[01]\\d|2[0-3]):(?<minute>[0-5]\\d):(?<second>[0-5]\\d)(?!\\d)',
        flags: 'g',
        description: '24 小时制时分秒，命名分组 hour / minute / second',
        sample: '会议 09:30:00 开始，最晚 23:59:59，非法 24:00:00'
      }
    ]
  },
  {
    id: 'dev',
    name: '开发',
    presets: [
      {
        id: 'hex-color',
        name: '十六进制颜色',
        pattern: '#(?:[0-9a-fA-F]{3}){1,2}(?![0-9a-fA-F])',
        flags: 'g',
        description: '#RGB 或 #RRGGBB',
        sample: '背景 #1e90ff，文字 #FFF，错误 #12345'
      },
      {
        id: 'uuid',
        name: 'UUID',
        pattern:
          '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}',
        flags: 'g',
        description: 'RFC 4122 版本 1 至 5 的 UUID',
        sample: 'trace=550e8400-e29b-41d4-a716-446655440000'
      },
      {
        id: 'html-tag',
        name: 'HTML 标签',
        pattern: '<\\/?[a-zA-Z][\\w-]*(?:\\s[^<>]*)?\\/?>',
        flags: 'g',
        description: '开始、结束与自闭合标签（简化，不解析属性值中的尖括号）',
        sample: '<div class="box"><p>你好</p><br/></div>'
      }
    ]
  },
  {
    id: 'text',
    name: '文本',
    presets: [
      {
        id: 'cjk',
        name: '中文字符',
        pattern: '\\p{Script=Han}',
        flags: 'gu',
        description: 'Unicode 汉字脚本，含扩展区字符（需要 u 标志）',
        sample: 'Hello 世界，Regex 测试 123 𠀀'
      },
      {
        id: 'number',
        name: '数字（含千分位）',
        pattern: '\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?',
        flags: 'g',
        description: '千分位数字优先匹配，普通整数与小数也会匹配',
        sample: '总计 1,234,567.89 元，库存 4096 件，单价 0.5'
      },
      {
        id: 'password',
        name: '密码强度',
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)\\S{8,}$',
        flags: 'gm',
        description: '至少 8 位、不含空白，且同时包含大写字母、小写字母与数字',
        sample: 'Passw0rd\nabc12345\nSecure2024\nWEAK1234\nLonger#Pass99'
      },
      {
        id: 'blank-lines',
        name: '空白行',
        pattern: '^[ \\t]*\\r?\\n',
        flags: 'gm',
        description: '整行空白（含换行符）；切换到替换模式并留空即可删除空行',
        sample: '第一行\n\n    \n第二行\n\t\n结束'
      },
      {
        id: 'repeated-word',
        name: '重复单词',
        pattern: '\\b(\\w+)\\s+\\1\\b',
        flags: 'gi',
        description: '相邻重复的单词（如 the the），演示反向引用 \\1',
        sample: 'This is is a test of the the regex regex tool.'
      }
    ]
  }
]

/** Every preset in display order, for lookups and counts. */
export function flattenRegexPresets(
  categories: RegexPresetCategory[] = REGEX_PRESET_CATEGORIES
): RegexPreset[] {
  return categories.flatMap((category) => category.presets)
}

/**
 * Case-insensitive search across category name, preset name, id and
 * description. Empty categories are dropped; an empty query returns everything.
 */
export function filterRegexPresets(
  categories: RegexPresetCategory[],
  query: string
): RegexPresetCategory[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return categories
  return categories
    .map((category) => {
      const categoryHit = category.name.toLowerCase().includes(needle)
      const presets = category.presets.filter(
        (preset) =>
          categoryHit ||
          preset.name.toLowerCase().includes(needle) ||
          preset.id.toLowerCase().includes(needle) ||
          preset.description.toLowerCase().includes(needle)
      )
      return { ...category, presets }
    })
    .filter((category) => category.presets.length > 0)
}
