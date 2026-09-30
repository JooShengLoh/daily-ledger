(() => {
  'use strict';
  const $=id=>document.getElementById(id), L=window.Ledger, cloud=window.ledgerCloud;
  let accountReturnFocus=null;
  let state=null, editing=null, draftId=crypto.randomUUID(), saving=false, dirty=false, range='all', toastTimer, periodDraft=null;
  const period=()=>state?.periods.find(p=>p.id===state.selectedPeriod)||null;
  const today=()=>state?.today||L.malaysiaDate();
  const isAdmin=()=>state?.me.role==='admin';
  const mobileQuery=matchMedia('(max-width:700px)');
  const categoryVisuals={'餐饮':['food','food'],'交通':['car','transport'],'购物':['bag','shopping'],'居家':['home','home'],'娱乐':['star','shopping'],'健康':['heart','health'],'学习':['book','transport'],'其他':['wallet','other']};
  const icon=name=>'<svg class="icon" aria-hidden="true"><use href="#i-'+name+'"/></svg>';
  const initial=name=>L.escape(Array.from(name||'?')[0]);
  function closeEntry(){
    if($('entry-dialog').open)$('entry-dialog').close();
    document.body.classList.remove('sheet-open');document.body.append($('toast'));
  }
  function mountEntry(){
    closeEntry();
    $('entry-dialog').append($('entry-panel'));
  }
  async function openEntry(){
    if(!state)return;
    if(document.body.dataset.page==='overview'&&state.dashboard.periodId&&state.selectedPeriod!==state.dashboard.periodId){
      if((dirty||editing)&&!window.I18n.confirm('切换周期会清除未保存的表单，继续？'))return;
      try{await cloud.selectPeriod(state.dashboard.periodId);}catch(error){toast(error.message);return;}
    }
    closeAccount();
    if(true){
      if(!$('entry-dialog').open)$('entry-dialog').showModal();
      $('entry-dialog').append($('toast'));document.body.classList.add('sheet-open');
    }else $('entry-panel').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function syncNavigation(){window.Family?.syncNavigation();}
  function openAccount(){
    if(!state){$('account-panel').scrollIntoView({behavior:'smooth'});return;}
    accountReturnFocus=document.activeElement;$('account-panel').setAttribute('role','dialog');$('account-panel').setAttribute('aria-modal','true');$('account-panel').setAttribute('aria-labelledby','account-heading');
    document.body.classList.add('account-open');$('account-trigger').setAttribute('aria-expanded','true');$('account-close').focus({preventScroll:true});syncNavigation();
  }
  function closeAccount(){const wasOpen=document.body.classList.contains('account-open');document.body.classList.remove('account-open');$('account-trigger').setAttribute('aria-expanded','false');$('account-panel').removeAttribute('role');$('account-panel').removeAttribute('aria-modal');if(wasOpen&&accountReturnFocus?.isConnected)accountReturnFocus.focus({preventScroll:true});syncNavigation();}
  const statusLabels={active:'进行中',upcoming:'未开始',ended:'已到期',closed:'已关闭'};
  function toast(text){$('toast').textContent=window.I18n.t(text);$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),5500);}
  function updateCategories(){document.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.category===$('category').value));}
  function resetForm(){
    editing=null;dirty=false;draftId=crypto.randomUUID();$('expense-form').reset();$('date').value=today();
    $('time').value=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
    $('form-title').textContent='记录今天的消费';$('save-btn').textContent='＋ 保存到共用账本';$('cancel-edit').classList.add('hidden');
    $('note-options').open=false;updateCategories();updatePermissions();
  }
  function updatePermissions(){
    const p=period(),open=L.canWrite(p,today());
    document.querySelectorAll('[data-open-entry]').forEach(b=>{b.disabled=!state||saving;b.setAttribute('aria-label',open?'记一笔消费':'查看记账状态');});
    $('expense-fields').disabled=!open||saving;
    $('entry-lock').textContent=!p?'等待管理员开启记账周期。':open?'':p.status==='upcoming'?'该周期尚未开始，开始后即可记账。':'本周期已结束，记录保留供所有成员查看。';
    $('date').min=p?.startDate||today();$('date').max=p?(p.endDate<today()?p.endDate:today()):today();
    const todayOnly=!isAdmin()&&!p?.allowBackdate;
    $('date').readOnly=todayOnly;
    if(todayOnly){$('date').min=today();$('date').max=today();if(!dirty&&!editing)$('date').value=today();}
    if(editing&&!L.canEdit(editing,state.me,p,today())){
      $('expense-fields').disabled=true;$('entry-lock').textContent='当前记录已不可修改，请取消编辑查看最新账本。';
    }
  }
  function bounds(){if(range==='today')return [today()+'T00:00',today()+'T23:59'];if(range==='custom')return [$('start').value,$('end').value];return ['',''];}
  function rows(){const [start,end]=bounds();return L.filtered(state?.entries||[],{start,end,search:$('search').value,category:$('filter-category').value,member:$('filter-member').value});}
  function renderRecords(){
    const [start,end]=bounds(),records=rows(),p=period();
    $('filter-error').textContent=start&&end&&start>end?'开始时间不能晚于结束时间。':'';
    $('record-count').textContent=records.length;
    const filterCount=['search','filter-member','filter-category'].filter(id=>$(id).value.trim()).length;
    $('filter-count').textContent=filterCount;$('filter-count').classList.toggle('hidden',!filterCount);$('clear-filters').classList.toggle('hidden',!filterCount);
    $('filtered-total').textContent='筛选合计 '+L.money(records.reduce((sum,e)=>sum+e.cents,0));
    const totals=new Map();records.forEach(e=>totals.set(e.date,(totals.get(e.date)||0)+e.cents));let lastDate='';
    $('record-list').innerHTML=records.length?records.map(e=>{
      let heading='';if(lastDate!==e.date){lastDate=e.date;heading=`<div class="day-heading"><span>${L.escape(e.date)}</span><span>${L.money(totals.get(e.date))}</span></div>`;}
      const edit=state&&L.canEdit(e,state.me,p,today());
      return heading+`<div class="record"><div class="category-icon ${categoryVisuals[e.category][1]}" title="${L.escape(e.category)}">${icon(categoryVisuals[e.category][0])}</div><div class="record-main"><div class="record-title">${L.escape(e.title)}</div><div class="record-meta"><b>${L.escape(e.memberName)}</b> · ${L.escape(e.time)}${e.note?' · '+L.escape(e.note):''}</div></div><div class="record-amount">${L.money(e.cents)}</div>${edit?`<details class="row-menu"><summary aria-label="操作 ${L.escape(e.title)}">···</summary><div class="row-actions"><button data-edit="${L.escape(e.id)}">编辑记录</button><button class="delete" data-delete="${L.escape(e.id)}">删除记录</button></div></details>`:''}</div>`;
    }).join(''):'<div class="empty"><b>还没有符合条件的消费</b>周期内记下今天的第一笔，或调整筛选条件。</div>';
  }
  function render(){
    if(!state)return;
    const p=period();$('role-badge').textContent=isAdmin()?'管理员':'普通会员';$('admin-panel').classList.toggle('hidden',!isAdmin());
    $('period-select').innerHTML=state.periods.length?state.periods.map(item=>`<option value="${L.escape(item.id)}">${L.escape(item.title)} · ${window.I18n.t(statusLabels[item.status])}</option>`).join(''):'<option value="">暂无周期</option>';
    $('period-select').value=state.selectedPeriod||'';$('period-select').disabled=!state.periods.length;
    $('period-heading').textContent=p?.title||'暂无记账周期';$('period-status').textContent=p?statusLabels[p.status]:'等待开启';
    $('period-status').className='status-pill '+(p?.status||'');
    $('period-description').textContent=p?p.startDate.replaceAll('-','.')+' — '+p.endDate.replaceAll('-','.'):'等待管理员开启周期';
    const days=p?Math.round((Date.parse(p.endDate)-Date.parse(p.startDate))/86400000)+1:0;
    const elapsed=p?Math.max(0,Math.min(days,Math.round((Date.parse(today())-Date.parse(p.startDate))/86400000)+1)):0;
    const progress=p?.closed?100:days?Math.round(elapsed/days*100):0;
    $('period-progress-label').textContent=p?(p.status==='active'?'第 '+elapsed+' / '+days+' 天':statusLabels[p.status]):'一起记下第一笔';
    $('period-progress-fill').style.width=progress+'%';document.querySelector('.period-progress').setAttribute('aria-valuenow',progress);
    $('period-rules').textContent=p?`${p.allowBackdate?'可补记周期内已经过去的日期':'会员只可记录当天消费'} · ${p.showDetails?'全员可看全部明细':'会员只看总额与自己的明细'} · 到期后锁定`:'历史周期和总消费会保留。';
    $('close-period').classList.toggle('hidden',!isAdmin()||!p||p.closed||p.status==='ended');
    $('delete-period').classList.toggle('hidden',!isAdmin()||!p);
    const dashboard=state.dashboard;
    $('total').textContent=L.money(dashboard.summary.totalCents);$('my-total').textContent=L.money(dashboard.summary.myCents);
    $('dashboard-period').textContent=dashboard.periodId?dashboard.title:window.I18n.t('目前没有进行中的周期');
    $('history-total').textContent=L.money(state.summary.totalCents);
    $('history-mine').textContent=L.money(state.summary.myCents);
    $('history-count').textContent=state.summary.count;
    $('contributors').textContent=dashboard.summary.contributors+' 人';$('total-count').textContent='共 '+dashboard.summary.count+' 笔消费';
    const canSeeAll=!!p&&(p.showDetails||isAdmin());$('member-summary').classList.remove('hidden');
    $('member-count').textContent=state.members.length;
    $('hero-avatars').innerHTML=state.members.filter(m=>state.selectedPeriod===dashboard.periodId&&m.count>0).slice(0,3).map(m=>'<span>'+initial(m.name)+'</span>').join('');
    $('hero-contributors').textContent=dashboard.summary.contributors?dashboard.summary.contributors+' 位伙伴 · '+dashboard.summary.count+' 笔日常':dashboard.periodId?'等你记下第一笔':'历史消费可在明细页查看';
    document.querySelectorAll('[data-nav="members"]').forEach(button=>button.disabled=false);
    const selectedMember=$('filter-member').value;
    $('filter-member').innerHTML='<option value="">'+(canSeeAll?'全部成员':'我的记录')+'</option>'+state.members.map(m=>`<option value="${L.escape(m.id)}">${L.escape(m.name)}</option>`).join('');
    if(state.members.some(m=>m.id===selectedMember))$('filter-member').value=selectedMember;
    $('filter-member').disabled=!canSeeAll;
    $('visibility-hint').textContent=p&&!canSeeAll?'本期只展示自己的明细；所选周期总额仍包含所有成员。':'';
    $('today-label').textContent=today()+' · 马来西亚时间';updatePermissions();renderRecords();window.Family?.load(state);
  }
  function validate(data){return !!data?.me&&Number.isSafeInteger(data.dashboard?.summary?.totalCents)&&['admin','member'].includes(data.me.role)&&Array.isArray(data.periods)&&Array.isArray(data.entries)&&data.entries.every(e=>L.validEntry(e)&&typeof e.userId==='string'&&typeof e.memberName==='string'&&Number.isInteger(e.version))&&Array.isArray(data.members)&&Number.isSafeInteger(data.summary?.totalCents)&&/^\d{4}-\d{2}-\d{2}$/.test(data.today);}
  function load(data){
    const changed=!state||state.selectedPeriod!==data.selectedPeriod;state=data;document.body.classList.add('signed-in');
    if(changed){resetForm();range='all';$('search').value='';$('filter-member').value='';$('filter-category').value='';$('custom-range').classList.add('hidden');document.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('active',b.dataset.period==='all'));$('start').value=(period()?.startDate||today())+'T00:00';$('end').value=(period()?.endDate||today())+'T23:59';}
    render();
  }
  async function mutate(name,args){
    if(saving)return false;saving=true;$('workspace').inert=true;$('team-panel').inert=true;$('entry-panel').inert=true;
    try{await cloud.run(name,args);return true;}catch(error){toast(error.message);return false;}
    finally{saving=false;$('workspace').inert=false;$('team-panel').inert=false;$('entry-panel').inert=false;updatePermissions();}
  }
  $('expense-form').addEventListener('input',()=>{dirty=true;});
  $('expense-form').onsubmit=async event=>{
    event.preventDefault();if(saving||!state)return;
    const p=period();if(!L.canWrite(p,today())){toast('本周期尚未开始或已结束，不能记账。');return;}
    const e={id:editing?.id||draftId,cents:Math.round(Number($('amount').value)*100),title:$('title').value.trim(),date:$('date').value,time:$('time').value,category:$('category').value,note:$('note').value.trim()};
    if(!L.validEntry(e)){toast('请填写有效的消费金额、内容、日期和时间。');return;}
    if(!isAdmin()&&!p.allowBackdate&&e.date!==today()){toast('会员只能记录今天的消费。');return;}
    if(e.date<p.startDate||e.date>p.endDate||e.date>today()){toast('日期必须在周期内，且不能晚于今天。');return;}
    if(await mutate('save_shared_expense',{p_period_id:p.id,p_entry:e,p_expected_version:editing?.version||0})){resetForm();render();closeEntry();toast('已保存到团队账本');}
  };
  $('cancel-edit').onclick=()=>{resetForm();render();};
  $('record-list').onclick=async event=>{
    const button=event.target.closest('button');if(!button||saving||!state)return;button.closest('details')?.removeAttribute('open');
    const e=state.entries.find(row=>row.id===(button.dataset.edit||button.dataset.delete));
    if(!e||!L.canEdit(e,state.me,period(),today()))return;
    if(button.dataset.delete){if(window.I18n.confirm(`删除 ${e.memberName} 的「${e.title}」？`)&&await mutate('delete_shared_expense',{p_period_id:period().id,p_entry_id:e.id,p_expected_version:e.version})){if(editing?.id===e.id)resetForm();render();toast('消费已删除');}return;}
    if(dirty&&!window.I18n.confirm('放弃当前未保存内容，编辑这笔消费？'))return;
    editing={...e};dirty=false;['title','date','time','category','note'].forEach(key=>$(key).value=e[key]);$('amount').value=(e.cents/100).toFixed(2);
    $('form-title').textContent='编辑 '+e.memberName+' 的消费';$('save-btn').textContent='保存修改';$('cancel-edit').classList.remove('hidden');$('note-options').open=!!e.note;updateCategories();updatePermissions();openEntry();
  };
  $('period-tabs').onclick=event=>{const button=event.target.closest('[data-period]');if(!button)return;range=button.dataset.period;document.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('active',b===button));$('custom-range').classList.toggle('hidden',range!=='custom');renderRecords();};
  ['start','end','search','filter-category','filter-member'].forEach(id=>$(id).addEventListener('input',renderRecords));
  $('period-select').onchange=async()=>{
    if((dirty||editing)&&!window.I18n.confirm('切换周期会清除未保存的表单，继续？')){$('period-select').value=state.selectedPeriod;return;}
    const id=$('period-select').value;$('period-select').disabled=true;
    try{await cloud.selectPeriod(id);}catch(error){toast(error.message);render();}finally{$('period-select').disabled=false;}
  };
  function updateDuration(){const a=$('period-start').value,b=$('period-end').value;const days=(Date.parse(b+'T12:00Z')-Date.parse(a+'T12:00Z'))/86400000+1;$('duration-label').textContent=Number.isFinite(days)&&days>0?'共 '+days+' 天（首尾均计入）':'';}
  function seedPeriod(){const date=today();$('period-start').value=date;$('period-end').value=L.addDays(date,13);updateDuration();}
  document.querySelectorAll('[data-days]').forEach(button=>button.onclick=()=>{const start=$('period-start').value||today();$('period-start').value=start;$('period-end').value=L.addDays(start,Number(button.dataset.days)-1);updateDuration();});
  ['period-start','period-end'].forEach(id=>$(id).addEventListener('input',updateDuration));
  $('period-form').onsubmit=async event=>{
    event.preventDefault();if(saving||!isAdmin())return;
    const args={p_title:$('period-title').value.trim(),p_start:$('period-start').value,p_end:$('period-end').value,p_allow_backdate:$('period-backdate').value==='backdate',p_show_details:$('period-visibility').value==='all'};
    if(!args.p_title||!args.p_start||!args.p_end||args.p_start>args.p_end){toast('请填写名称及正确的开始、结束日期。');return;}
    const key=JSON.stringify(args);if(!periodDraft||periodDraft.key!==key)periodDraft={key,id:crypto.randomUUID()};
    if(await mutate('create_ledger_period',{...args,p_id:periodDraft.id})){periodDraft=null;$('period-form').reset();seedPeriod();$('admin-panel').open=false;toast('新周期已创建，所有成员都能看到。');}
  };
  $('close-period').onclick=async()=>{const p=period();if(!p||!isAdmin()||!window.I18n.confirm(`结束「${p.title}」？所有人将无法再添加、修改或删除本期消费，历史记录仍可查看。`))return;if(await mutate('close_ledger_period',{p_period_id:p.id})){resetForm();render();toast('周期已结束，历史记录已保留。');}};
  let deleteTarget=null;
  $('delete-period').onclick=async()=>{
    if(saving||!isAdmin())return;
    if(!await cloud.refresh(true)){toast('读取周期失败，请重试。');return;}
    const p=period();if(!p||!isAdmin())return;
    deleteTarget={id:p.id,title:p.title,count:state.summary.count,total:state.summary.totalCents};
    $('delete-period-name').textContent=p.title;
    $('delete-period-impact').textContent=window.I18n.t('将删除 {count} 笔消费，合计 {total}。').replace('{count}',deleteTarget.count).replace('{total}',L.money(deleteTarget.total));
    $('delete-period-form').reset();$('delete-period-dialog').showModal();$('delete-period-confirmation').focus();
  };
  $('cancel-delete-period').onclick=()=>{if(!saving)$('delete-period-dialog').close();};
  $('delete-period-dialog').addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  $('delete-period-confirmation').oninput=()=>$('delete-period-confirmation').setCustomValidity('');
  $('delete-period-form').onsubmit=async event=>{
    event.preventDefault();if(saving||!deleteTarget||!isAdmin())return;
    if($('delete-period-confirmation').value!==deleteTarget.title){$('delete-period-confirmation').setCustomValidity(window.I18n.t('请输入完全相同的周期名称。'));$('delete-period-confirmation').reportValidity();return;}
    $('confirm-delete-period').disabled=true;$('delete-period-dialog').append($('toast'));
    const ok=await mutate('delete_ledger_period',{p_period_id:deleteTarget.id,p_confirmation:$('delete-period-confirmation').value,p_expected_count:deleteTarget.count,p_expected_total:deleteTarget.total});
    $('confirm-delete-period').disabled=false;
    if(ok){$('delete-period-dialog').close();document.body.append($('toast'));deleteTarget=null;resetForm();render();document.querySelector('.period-more').open=false;toast('周期和全部消费已永久删除');}
  };
  $('delete-period-dialog').addEventListener('close',()=>document.body.append($('toast')));
  function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('backup').onclick=()=>{if(!state)return;download('罗家记-团队周期-'+today()+'.json',JSON.stringify({format:'shared-ledger-export-v2',exportedAt:new Date().toISOString(),period:period(),summary:state.summary,entries:state.entries,members:state.members},null,2),'application/json');};
  $('export-csv').onclick=()=>{const cell=value=>'"'+String(value).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';const data=[['周期','成员','日期','时间','内容','分类','金额 MYR','备注'],...rows().map(e=>[period()?.title||'',e.memberName,e.date,e.time,e.title,e.category,(e.cents/100).toFixed(2),e.note])];download('罗家记-团队消费-'+today()+'.csv','\ufeff'+data.map(row=>row.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');};
  window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
  document.querySelectorAll('[data-open-entry]').forEach(button=>button.onclick=openEntry);
  $('entry-close').onclick=()=>{if(!saving)closeEntry();};
  $('entry-dialog').addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  $('entry-dialog').addEventListener('close',()=>{document.body.classList.remove('sheet-open');document.body.append($('toast'));});
  $('entry-dialog').addEventListener('click',event=>{if(event.target===$('entry-dialog')&&!saving){const r=event.target.getBoundingClientRect();if(event.clientY<r.top||event.clientX<r.left||event.clientX>r.right)closeEntry();}});
  mobileQuery.addEventListener('change',mountEntry);
  $('account-trigger').onclick=()=>document.body.classList.contains('account-open')?closeAccount():openAccount();
  $('account-close').onclick=closeAccount;$('account-backdrop').onclick=closeAccount;
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')closeAccount();
    if(event.key==='Tab'&&document.body.classList.contains('account-open')){
      const targets=[...$('account-panel').querySelectorAll('button,input,select,a,textarea')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=targets[0],last=targets.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  document.addEventListener('click',event=>document.querySelectorAll('.row-menu[open],.export-menu[open],.period-more[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;}));
  $('filters-toggle').onclick=()=>{const open=!$('record-filters').classList.contains('expanded');$('record-filters').classList.toggle('expanded',open);$('filters-toggle').setAttribute('aria-expanded',open);};
  $('clear-filters').onclick=()=>{['search','filter-member','filter-category'].forEach(id=>$(id).value='');renderRecords();};
  $('category-options').innerHTML=L.categories.map(category=>'<button type="button" class="category-choice" data-category="'+category+'" aria-pressed="false">'+icon(categoryVisuals[category][0])+'<span>'+category+'</span></button>').join('');
  $('category-options').onclick=event=>{const button=event.target.closest('[data-category]');if(!button)return;$('category').value=button.dataset.category;$('category').dispatchEvent(new Event('input',{bubbles:true}));updateCategories();};
  $('category').addEventListener('change',updateCategories);
  document.querySelectorAll('[data-nav]').forEach(button=>button.onclick=()=>{
    const target=button.dataset.nav;
    if(target==='account'){openAccount();return;}
    closeAccount();window.Family.navigate(target);
    document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===target));
  });
  let navFrame=null;window.addEventListener('scroll',()=>{if(navFrame)return;navFrame=requestAnimationFrame(()=>{navFrame=null;syncNavigation();});},{passive:true});
  window.addEventListener('languagechange',render);
  mountEntry();resetForm();seedPeriod();$('today-label').textContent=today()+' · 马来西亚时间';
  cloud.init({validate,load,canRefresh:()=>!saving,clear:()=>{
    state=null;$('delete-period-dialog').close();window.Family?.clear();closeEntry();closeAccount();document.body.classList.remove('signed-in');clearTimeout(toastTimer);$('toast').classList.add('hidden');$('record-list').innerHTML='';$('members').innerHTML='';
    $('admin-panel').classList.add('hidden');$('period-form').reset();periodDraft=null;resetForm();seedPeriod();
    $('record-filters').classList.remove('expanded');$('filters-toggle').setAttribute('aria-expanded','false');$('total').textContent='RM 0.00';$('my-total').textContent='RM 0.00';$('contributors').textContent='0 人';
  }});
})();
