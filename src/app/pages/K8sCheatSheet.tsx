import CheatSheet from '@renderer/components/CheatSheet'
import k8sCommands from '@renderer/tools/k8s-cheat-sheet/k8s-commands.json'
import type { CheatSheetCategory } from '@renderer/components/CheatSheet'

const CATEGORIES: CheatSheetCategory[] = k8sCommands as CheatSheetCategory[]

export default function K8sCheatSheet(): React.JSX.Element {
  return (
    <CheatSheet
      title="Kubernetes Cheat Sheet"
      subtitle="K8s 命令速查手册"
      categories={CATEGORIES}
      searchPlaceholder="搜索 kubectl 命令..."
    />
  )
}
