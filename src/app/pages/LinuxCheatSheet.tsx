import CheatSheet from '@renderer/components/CheatSheet'
import linuxCommands from '@renderer/tools/linux-cheat-sheet/linux-commands.json'
import type { CheatSheetCategory } from '@renderer/components/CheatSheet'

const CATEGORIES: CheatSheetCategory[] = linuxCommands as CheatSheetCategory[]

export default function LinuxCheatSheet(): React.JSX.Element {
  return (
    <CheatSheet
      title="Linux Command Cheat Sheet"
      subtitle="Linux 常用命令速查手册"
      categories={CATEGORIES}
      searchPlaceholder="搜索 Linux 命令..."
    />
  )
}
