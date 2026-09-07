-- Sets the AI extraction prompt on the "Letter of Award (LOA)" required
-- document row(s). Matches by name so it updates every workflow template
-- variant that has this document (Sdn Bhd and Sole Proprietor), keeping
-- them in sync with one edit.
--
-- Run this once in Supabase Dashboard → SQL Editor → New Query.

update required_documents
set ai_prompt = $prompt$Extract the following fields from this contract/award letter document. Respond with raw JSON only — no markdown formatting, no code fences, no backticks. Shape: {"fields": {"projectName": "", "referenceNumber": "", "totalContractValue": "", "projectDuration": "", "defectLiabilityPeriod": "", "thirdPartyLiability": "", "contractorName": "", "contractorSSMNumber": "", "contractorAddress": ""}, "confidence": "high|medium|low", "reasoning": ""}. Field guidance: projectName is the full title of the work (the 'Tajuk Kerja' or the work description in the subject/heading). referenceNumber is the 'No. Kontrak' or 'No. Sebut Harga'. totalContractValue is the 'Harga Kontrak' in RM. projectDuration should combine the stated contract period (e.g. '16 minggu' or '1 tahun') with the start and end dates ('Tarikh Milik Tapak' to 'Tarikh Siap Kerja'), formatted like 'X minggu/tahun (DD.MM.YYYY - DD.MM.YYYY)'. defectLiabilityPeriod is frequently not stated as a single explicit figure — if no direct statement exists, derive it from the gap between the contract completion date and the expiry date shown in the Bon Pelaksanaan or Polisi Insurans Kerja sections, and explicitly note in your reasoning that this value was derived rather than directly stated. thirdPartyLiability is the insured value from 'Polisi Insurans Tanggungan Awam'. contractorName, contractorSSMNumber, and contractorAddress come from the recipient company's name, SSM/registration number, and address shown in the letter.$prompt$
where name = 'Letter of Award (LOA)';
