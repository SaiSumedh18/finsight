import { useEffect, useState } from 'react';
import { api } from '../lib/api';
export default function CsvImport() {
 const [id,setId]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!id) return;
  let cancelled=false;
  const timer=window.setInterval(async()=>{
   try {
    const response=await api.get(`/imports/${id}`);
    if(cancelled) return;
    const job=response.data.import;
    if(job.status==='completed' || job.status==='failed') {
     setMessage(job.status==='completed' ? `Imported ${job.rowCount} transactions. Refresh the list to see them.` : job.error || 'Import failed.');
     setId(''); setBusy(false);
    }
   } catch { if(!cancelled) setMessage('Status unavailable. Your accepted import will continue; retry checking later.'); }
  },1000);
  return ()=>{cancelled=true; window.clearInterval(timer);};
 },[id]);
 return <section aria-label="CSV transaction import">
  <label>Import CSV (up to 10,000 transactions, 2 MB)
   <input type="file" accept=".csv,text/csv" disabled={busy} onChange={async event=>{
    const file=event.target.files?.[0]; if(!file) return;
    if(file.size>2_000_000) {setMessage('File exceeds 2 MB.');return;}
    setBusy(true);setMessage('Uploading…');
    const key=crypto.randomUUID();
    try {
     const csv=await file.text();
     // Preserve this key across transport retries in the same submission.
     const send=()=>api.post('/imports',{csv},{headers:{'Idempotency-Key':key}});
     let response;
     try { response=await send(); } catch (error) {
      if((error as {response?:unknown}).response) throw error;
      response=await send();
     }
     setId(response.data.import.id);setMessage('Accepted. Processing in the background…');
    } catch {setBusy(false);setMessage('Unable to accept this import. Check the CSV and server configuration.');}
    finally {event.target.value='';}
   }}/>
  </label>
  <p>Headers: accountId, categoryId, transactionType, amount, description, transactionDate, notes. Dates use YYYY-MM-DD; categoryId and notes may be blank.</p>
  <p role="status">{message}</p>
 </section>;
}
