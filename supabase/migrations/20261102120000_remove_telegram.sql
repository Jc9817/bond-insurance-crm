-- Fix list 5.5: the Telegram bot is removed from DocFlow. Documents now come
-- in through the Emails screen, the SharePoint _Inbox folder and uploads.
--
-- Drops the bot's two tables:
--   telegram_uploads          the old Inbox. Its rows were copied into
--                             intake_items (20261024100000_intake_items.sql),
--                             so the Inbox keeps them — this copies any still
--                             missing first, to be safe
--   telegram_pending_uploads  files waiting for "New case / Existing case"
--                             in the chat (empty)
--
-- Inbox items that came from Telegram stay, labelled "Telegram", and can
-- still be filed or discarded. Safe to run more than once.

do $$
begin
  if to_regclass('public.telegram_uploads') is not null then
    insert into intake_items (id, source, sender, received_at, file_name, file_size, file_type, file_ref, status, source_meta)
    select id, 'telegram', coalesce(uploaded_by, ''), uploaded_at, coalesce(file_name, ''), coalesce(file_size, 0),
           coalesce(file_type, ''), file_data_url, 'received',
           jsonb_strip_nulls(jsonb_build_object(
             'telegramChatId', telegram_chat_id,
             'telegramMessageId', telegram_message_id,
             'telegramFileId', telegram_file_id))
    from telegram_uploads
    on conflict (id) do nothing;
  end if;
end $$;

drop table if exists telegram_pending_uploads;
drop table if exists telegram_uploads;
