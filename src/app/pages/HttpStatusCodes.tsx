import CheatSheet from '@renderer/components/CheatSheet'
import httpStatusCodes from '@renderer/tools/http-status-codes/http-status-codes.json'
import type { CheatSheetCategory } from '@renderer/components/CheatSheet'

const CATEGORIES: CheatSheetCategory[] = httpStatusCodes as CheatSheetCategory[]

export default function HttpStatusCodes(): React.JSX.Element {
  return (
    <CheatSheet
      title="HTTP Status Codes"
      subtitle="HTTP 状态码速查手册"
      categories={CATEGORIES}
      searchPlaceholder="搜索状态码..."
    />
  )
}
