import CheatSheet from '@renderer/components/CheatSheet'
import htmlEntities from '@renderer/tools/html-entities/html-entities.json'
import type { CheatSheetCategory } from '@renderer/components/CheatSheet'

const CATEGORIES: CheatSheetCategory[] = htmlEntities as CheatSheetCategory[]

export default function HtmlEntities(): React.JSX.Element {
  return (
    <CheatSheet
      title="HTML Entities"
      subtitle="HTML 实体字符速查手册"
      categories={CATEGORIES}
      searchPlaceholder="搜索实体..."
    />
  )
}
