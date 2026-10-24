-- Run this in Supabase SQL Editor
-- The AI scan status model changed from an in-app Anthropic scan with a
-- human Approve/Reject review step (Not Scanned / Processing / Ready for
-- Review / Approved / Rejected) to an n8n-triggered pipeline with a simpler
-- terminal state (Pending / Processing / Extracted / Failed). Remap
-- existing rows so they still show up correctly under the new model.

update case_files set ai_status = 'Extracted' where ai_status in ('Ready for Review', 'Approved');
update case_files set ai_status = 'Failed' where ai_status = 'Rejected';
update case_files set ai_status = 'Pending' where ai_status in ('Not Scanned', 'Processing') or ai_status is null;
