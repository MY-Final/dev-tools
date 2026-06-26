import CheatSheet from '@renderer/components/CheatSheet'
import cssData from '@renderer/tools/css-cheat-sheet/css-cheat-sheet.json'
import type { CheatSheetCategory } from '@renderer/components/CheatSheet'

const CATEGORIES: CheatSheetCategory[] = cssData as CheatSheetCategory[]

export default function CssCheatSheet(): React.JSX.Element {
  return (
    <CheatSheet
      title="CSS Cheat Sheet"
      subtitle="Flexbox · Grid · 单位 · 选择器 · 动画速查手册"
      categories={CATEGORIES}
      searchPlaceholder="搜索 CSS..."
    />
  )
}
