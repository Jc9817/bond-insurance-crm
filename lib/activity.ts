import type { ActivityLog, ActivityLogActionType } from './types'

// ─── Action type metadata ─────────────────────────────────────────────────────

type ActionMeta = {
  label: string
  color: 'blue' | 'indigo' | 'green' | 'red' | 'amber' | 'violet' | 'gray' | 'purple'
}

export const ACTION_META: Record<ActivityLogActionType, ActionMeta> = {
  CASE_CREATED:             { label: 'Case created',            color: 'blue'   },
  STATUS_CHANGED:           { label: 'Status changed',          color: 'blue'   },
  WORKFLOW_STEP_CHANGED:    { label: 'Workflow step changed',   color: 'indigo' },
  DOCUMENT_UPLOADED:        { label: 'Document uploaded',       color: 'green'  },
  DOCUMENT_DELETED:         { label: 'Document deleted',        color: 'red'    },
  AI_SCAN_STARTED:          { label: 'AI scan started',         color: 'violet' },
  AI_SCAN_COMPLETED:        { label: 'AI scan completed',       color: 'violet' },
  AI_EXTRACTION_APPROVED:   { label: 'AI extraction approved',  color: 'green'  },
  AI_EXTRACTION_REJECTED:   { label: 'AI extraction rejected',  color: 'red'    },
  FOLLOW_UP_CREATED:        { label: 'Follow-up created',       color: 'amber'  },
  FOLLOW_UP_COMPLETED:      { label: 'Follow-up completed',     color: 'green'  },
  CASE_CLOSED:              { label: 'Case closed',             color: 'gray'   },
  CASE_REOPENED:            { label: 'Case reopened',           color: 'blue'   },
  RESULT_SET:               { label: 'Result set',              color: 'purple' },
  NOTE_ADDED:               { label: 'Note added',              color: 'gray'   },
  INQUIRY_CREATED:          { label: 'Inquiry created',         color: 'blue'   },
  INQUIRY_STATUS_CHANGED:   { label: 'Inquiry status changed',  color: 'blue'   },
  INQUIRY_NOTE_ADDED:       { label: 'Note added',              color: 'gray'   },
  INQUIRY_QUOTATION_ADDED:  { label: 'Quotation added',         color: 'green'  },
  INQUIRY_QUOTATION_UPDATED:{ label: 'Quotation updated',       color: 'indigo' },
  INQUIRY_DOCUMENT_UPLOADED:{ label: 'Document uploaded',       color: 'green'  },
  INQUIRY_CONVERTED:        { label: 'Converted to case',       color: 'purple' },
  DOCUMENT_ASSIGNED:        { label: 'Document assigned',       color: 'indigo' },
  CASE_UPDATED:             { label: 'Case info updated',       color: 'blue'   },
}

// Color maps for Tailwind (must be full strings, not dynamic)
export const ACTION_COLOR_DOT: Record<ActionMeta['color'], string> = {
  blue:   'bg-blue-500',
  indigo: 'bg-indigo-500',
  green:  'bg-green-500',
  red:    'bg-red-500',
  amber:  'bg-amber-400',
  violet: 'bg-violet-500',
  gray:   'bg-gray-400',
  purple: 'bg-purple-500',
}

export const ACTION_COLOR_BG: Record<ActionMeta['color'], string> = {
  blue:   'bg-blue-50 text-blue-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  green:  'bg-green-50 text-green-700',
  red:    'bg-red-50 text-red-700',
  amber:  'bg-amber-50 text-amber-700',
  violet: 'bg-violet-50 text-violet-700',
  gray:   'bg-gray-100 text-gray-600',
  purple: 'bg-purple-50 text-purple-700',
}

// ─── createActivityLog helper ─────────────────────────────────────────────────

/**
 * Builds an activity log payload for addActivityLog().
 * Generates id and timestamp are added by the store.
 */
export function createActivityLog(params: {
  caseId?: string
  caseTitle?: string
  actionType: ActivityLogActionType
  title: string
  description?: string
  oldValue?: string
  newValue?: string
  changedBy: string
}): Omit<ActivityLog, 'id' | 'timestamp'> {
  return params
}

// ─── Format helpers used in the timeline UI ──────────────────────────────────

export function getActionMeta(actionType: ActivityLogActionType | undefined): ActionMeta {
  if (!actionType) return { label: 'Activity', color: 'gray' }
  return ACTION_META[actionType] ?? { label: 'Activity', color: 'gray' }
}

export function formatLogTime(timestamp: string): string {
  const d = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined })
}

export function formatLogDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-MY', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function formatLogTimeFull(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-MY', {
    hour: '2-digit', minute: '2-digit',
  })
}
