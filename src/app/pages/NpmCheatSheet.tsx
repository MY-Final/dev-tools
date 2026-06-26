import CheatSheet from '@renderer/components/CheatSheet'
import npmCommands from '@renderer/tools/npm-cheat-sheet/npm-commands.json'
import type { CheatSheetCategory } from '@renderer/components/CheatSheet'

const CATEGORIES: CheatSheetCategory[] = npmCommands as CheatSheetCategory[]

export default function NpmCheatSheet(): React.JSX.Element {
  return (
    <CheatSheet
      title="npm / Yarn / pnpm Cheat Sheet"
      subtitle="包管理器命令速查手册"
      categories={CATEGORIES}
      searchPlaceholder="搜索 npm / yarn / pnpm 命令..."
    />
  )
}
