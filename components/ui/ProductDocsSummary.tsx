'use client'

import { useStore } from '@/lib/store'
import type { CaseProduct } from '@/lib/types'
import { PRODUCT_DOCS_TEMPLATE_ID, automaticWorkflow, productChecklist } from '@/lib/product-documents'

// Under the product list on a case form: what the ticked products add up to.
export default function ProductDocsSummary({ caseType, requestType, selected, businessType }: {
  caseType: string           // '' = Automatic
  requestType?: string
  selected: CaseProduct[]
  businessType?: string
}) {
  const { products, productDocuments, workflowTemplates } = useStore()
  if (caseType) return null
  const auto = automaticWorkflow(requestType, selected, products)
  if (!auto.usesProductDocuments) return null

  const master = workflowTemplates.find(t => t.id === PRODUCT_DOCS_TEMPLATE_ID)?.requiredDocuments ?? []
  const docs = productChecklist(selected, businessType, productDocuments, master)
  const required = docs.filter(d => d.required).length
  return (
    <p className="text-xs text-gray-500 mt-2">
      <b>{docs.length}</b> document{docs.length === 1 ? '' : 's'} needed ({required} required, {docs.length - required} optional) · follows {auto.caseType}
    </p>
  )
}
