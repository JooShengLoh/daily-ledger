/* Pure helpers shared by the browser UI and Node tests. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Ledger=factory();})(globalThis,()=>{
  const categories=['餐饮','交通','购物','居家','娱乐','健康','学习','其他'];
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=cents=>'RM '+(cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const dateString=d=>d.toISOString().slice(0,10);
  const addDays=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return dateString(d);};
  const malaysiaDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function validEntry(e){return !!e&&typeof e.id==='string'&&/^[0-9a-f-]{36}$/i.test(e.id)&&Number.isSafeInteger(e.cents)&&e.cents>0&&e.cents<=99999999999&&typeof e.title==='string'&&e.title.trim().length>0&&e.title.length<=80&&typeof e.note==='string'&&e.note.length<=300&&categories.includes(e.category)&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&!isNaN(Date.parse(e.date+'T12:00:00Z'))&&dateString(new Date(e.date+'T12:00:00Z'))===e.date&&/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time);}
  function canWrite(period,today){return !!period&&!period.closed&&today>=period.startDate&&today<=period.endDate;}
  function canEdit(e,me,period,today){return canWrite(period,today)&&(me.role==='admin'||(e.userId===me.id&&(period.allowBackdate||e.date===today)));}
  function filtered(entries,{search='',category='',member='',start='',end=''}={}){const query=search.trim().toLowerCase();return entries.filter(e=>(!start||e.date+'T'+e.time>=start)&&(!end||e.date+'T'+e.time<=end)&&(!category||e.category===category)&&(!member||e.userId===member)&&`${e.title} ${e.note} ${e.memberName}`.toLowerCase().includes(query)).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)||a.id.localeCompare(b.id));}
  return {categories,escape,money,addDays,malaysiaDate,validEntry,canWrite,canEdit,filtered};
});
