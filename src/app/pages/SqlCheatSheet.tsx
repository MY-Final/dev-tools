import CheatSheet from '@renderer/components/CheatSheet'
import sqlCheatSheet from '@renderer/tools/sql-cheat-sheet/sql-cheat-sheet.json'
import type { CheatSheetCategory } from '@renderer/components/CheatSheet'

const CATEGORIES: CheatSheetCategory[] = sqlCheatSheet as CheatSheetCategory[]

export default function SqlCheatSheet(): React.JSX.Element {
  return (
    <CheatSheet
      title="SQL Cheat Sheet"
      subtitle="SQL 常用语法速查手册"
      categories={CATEGORIES}
      searchPlaceholder="搜索 SQL 语法..."
    />
  )
}
