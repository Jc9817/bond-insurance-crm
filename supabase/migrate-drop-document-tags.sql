-- Removes the Document Tags catalog. Superseded: AI Scan prompts are now
-- resolved from required_documents.ai_prompt (Settings → Workflow Templates
-- → Required Documents) since every file is tagged to a required document
-- before it's scanned — the document_tags fallback for untagged files was
-- never actually needed.
--
-- Run this once in Supabase Dashboard → SQL Editor → New Query.

drop table if exists document_tags;
