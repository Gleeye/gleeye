# Directive: Report Automation (DOE Framework)

**Goal**: Automatically generate structured reports from meeting voice memos using NotebookLM.

## 1. Trigger
- User uploads an audio file in the "Report" tab of a PM item.
- User requests Antigravity to "Generate report for the latest audio".

## 2. Inputs
- `audio_url`: URL of the file in Supabase storage.
- `space_id`: UUID of the current PM space.
- `item_id`: UUID of the parent project/task.
- `notebook_id` (Optional): Target notebook in NotebookLM.

## 3. Standard Operating Procedure (SOP)
1. **Validation**: Ensure the file exists and is a valid audio format (.mp3, .wav, .m4a).
2. **Execution**: Run the `execution/process_voice_memo.py` script with the provided parameters.
3. **Drafting**:
   - The script will upload to NotebookLM.
   - It will poll for transcription.
   - It will generate a "Report" artifact.
4. **Integration**:
   - The script will create a new page in `public.doc_pages` titled "Report: [Meeting Date]".
   - It will insert the report content as `public.doc_blocks` (markdown type).
5. **Notification**: Inform the user when the report is ready and provide a link to the document.

## 4. Error Handling
- **Upload Failed**: Retransmit or notify user of storage issues.
- **NotebookLM Timeout**: Log the error and suggest manual upload if persistent.
- **Transcription Error**: If the audio is too short or garbled, inform the user.

## 5. Tools
- `notebooklm-py` (CLI + Python API)
- `supabase-js` (via script)
- `python3.12`
