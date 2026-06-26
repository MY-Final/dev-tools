import { lazy } from 'react'
import type { ComponentType } from 'react'

// ── Page Registry ──────────────────────────────────────────────
// Single source of truth: tool ID → component.
// Adding a new tool only requires:
//   1. Add the page component in pages/
//   2. Register it here
//   3. Add the entry in tools/tools.json
// App.tsx never needs to change.

const pageMap: Record<string, React.LazyExoticComponent<ComponentType>> = {
  'data-size-converter': lazy(() => import('./Converter')),
  'my-ip': lazy(() => import('./MyIp')),
  'device-info': lazy(() => import('./DeviceInfo')),
  'token-generator': lazy(() => import('./TokenGenerator')),
  'jwt-generator': lazy(() => import('./JWTGenerator')),
  'cron-generator': lazy(() => import('./CronGenerator')),
  'json-formatter': lazy(() => import('./JsonFormatter')),
  'url-codec': lazy(() => import('./URLCodec')),
  'hash-generator': lazy(() => import('./HashGenerator')),
  'password-generator': lazy(() => import('./PasswordGenerator')),
  'jwt-decoder': lazy(() => import('./JWTDecoder')),
  'timestamp-converter': lazy(() => import('./TimestampConverter')),
  'base64-codec': lazy(() => import('./Base64Codec')),
  'keyboard-tester': lazy(() => import('./KeyboardTester')),
  'mouse-tester': lazy(() => import('./MouseTester')),
  'port-generator': lazy(() => import('./PortGenerator')),
  'subnet-calculator': lazy(() => import('./SubnetCalculator')),
  'ipv4-converter': lazy(() => import('./IPv4Converter')),
  'ip-range-expander': lazy(() => import('./IPRangeExpander')),
  'text-analyzer': lazy(() => import('./TextAnalyzer')),
  'git-cheat-sheet': lazy(() => import('./GitCheatSheet')),
  'docker-cheat-sheet': lazy(() => import('./DockerCheatSheet')),
  'maven-dependency': lazy(() => import('./MavenDependency')),
  'file-generator': lazy(() => import('./FileGenerator')),
  'case-converter': lazy(() => import('./CaseConverter')),
  'env-vars': lazy(() => import('./EnvVars')),
  'ascii-table': lazy(() => import('./AsciiTable')),
  'unicode-inspector': lazy(() => import('./UnicodeInspector')),
  'npm-cheat-sheet': lazy(() => import('./NpmCheatSheet')),
  'linux-cheat-sheet': lazy(() => import('./LinuxCheatSheet')),
  'k8s-cheat-sheet': lazy(() => import('./K8sCheatSheet')),
  'color-converter': lazy(() => import('./ColorConverter')),
  'lorem-ipsum': lazy(() => import('./LoremIpsum')),
  'regex-tester': lazy(() => import('./RegexTester')),
  'diff-checker': lazy(() => import('./DiffChecker')),
  'number-base': lazy(() => import('./NumberBase')),
  'unit-converter': lazy(() => import('./UnitConverter')),
  'timer-stopwatch': lazy(() => import('./TimerStopwatch')),
  'usb-viewer': lazy(() => import('./USBViewer')),
  'xpath-tester': lazy(() => import('./XPathTester')),
  'http-status-codes': lazy(() => import('./HttpStatusCodes')),
  'regex-cheat-sheet': lazy(() => import('./RegexCheatSheet')),
  'html-entities': lazy(() => import('./HtmlEntities')),
  'sql-cheat-sheet': lazy(() => import('./SqlCheatSheet')),
  'image-tools': lazy(() => import('./ImageTools')),
  'data-converter': lazy(() => import('./DataConverter')),
  'uuid-decoder': lazy(() => import('./UUIDDecoder')),
  'css-cheat-sheet': lazy(() => import('./CssCheatSheet')),
  'json-converter': lazy(() => import('./JsonConverter')),
  'gradient-generator': lazy(() => import('./GradientGenerator')),
  'html-to-jsx': lazy(() => import('./HtmlToJsx')),
  'aes-des-encryptor': lazy(() => import('./AesDesEncryptor')),
  'certificate-parser': lazy(() => import('./CertificateParser')),
  'hmac-generator': lazy(() => import('./HmacGenerator')),
  'ssh-key-generator': lazy(() => import('./SshKeyGenerator')),
  'clipboard-manager': lazy(() => import('./ClipboardManager')),
  'screen-info': lazy(() => import('./ScreenInfo')),
  'storage-viewer': lazy(() => import('./StorageViewer')),
  'timezone-converter': lazy(() => import('./TimezoneConverter')),
  'date-format-converter': lazy(() => import('./DateFormatConverter')),
  'number-formatter': lazy(() => import('./NumberFormatter')),
  'translator': lazy(() => import('./Translator')),
  'npm-search': lazy(() => import('./NpmSearch')),
  'dockerhub-search': lazy(() => import('./DockerHubSearch'))
}

export function getPageComponent(id: string): React.LazyExoticComponent<ComponentType> | null {
  return pageMap[id] ?? null
}
