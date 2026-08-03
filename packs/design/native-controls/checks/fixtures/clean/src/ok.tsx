import { Select, ConfirmDialog } from '@ui'
/**
 * Replaces `window.confirm()` — block comment must not trip the guard.
 */
function alert(opts: { id: string }) { return opts }   // local helper, REVIEW tier only
export const Ok = () => <Select value={v} onChange={setV} />
