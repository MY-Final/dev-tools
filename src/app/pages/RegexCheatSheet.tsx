import CheatSheet from '@renderer/components/CheatSheet'
import regexCheatSheet from '@renderer/tools/regex-cheat-sheet/regex-cheat-sheet.json'
import type { CheatSheetCategory } from '@renderer/components/CheatSheet'

const CATEGORIES: CheatSheetCategory[] = regexCheatSheet as CheatSheetCategory[]

export default function RegexCheatSheet(): React.JSX.Element {
  return (
    <CheatSheet
      title="Regex Cheat Sheet"
      subtitle="正则表达式语法速查手册"
      categories={CATEGORIES}
      searchPlaceholder="搜索正则语法..."
    />
  )
}
