/* Family pages and profiles. Account creation stays in the authenticated Edge Function. */
(() => {
  const $=id=>document.getElementById(id),cloud=window.ledgerCloud,L=window.Ledger;
  const t=text=>window.I18n.t(text);
  let state=null,people=[],page='overview',generation=0,photo='',profileDirty=false,editing=null,mode='create',busy=false;
  const esc=L.escape;
  const safePhoto=value=>typeof value==='string'&&value.length<=90000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
  const avatar=p=>safePhoto(p?.avatar)?`<img src="${p.avatar}" alt="">`:`<span>${esc(Array.from(p?.name||'?')[0])}</span>`;
  const feedback=(id,message)=>$(id).textContent=t(message);
  function navigate(target,replace=false){
    page=['overview','records','members'].includes(target)?target:'overview';
    document.body.dataset.page=page;
    if(state){const hash='#'+page;if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',hash);}
    syncNavigation();window.scrollTo({top:0,behavior:'instant'});
    if(state) document.title=(page==='overview'?'罗家记':t(page==='records'?'消费明细':'我们的家人')+' · 罗家记');
  }
  function syncNavigation(){
    const current=document.body.classList.contains('account-open')?'account':page;
    document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===current));
  }
  window.addEventListener('popstate',()=>navigate(location.hash.slice(1),true));
  function renderPeople(){
    if(!state)return;
    const query=$('people-search').value.trim().toLowerCase();
    const rows=people.filter(p=>(p.name+' '+(p.email||'')).toLowerCase().includes(query));
    $('member-count').textContent=people.filter(p=>p.active).length;
    $('members').innerHTML=rows.map(p=>`<article class="person-card ${p.active?'':'inactive'}"><div class="person-heading"><div class="photo-avatar">${avatar(p)}</div><div class="person-identity"><h3 data-user-content>${esc(p.name)}</h3><div class="person-badges"><span>${t(p.role==='admin'?'管理员':'普通会员')}</span>${p.id===state.me.id?`<span>${t('我')}</span>`:''}${!p.active?`<span>${t('已移除')}</span>`:''}</div></div></div>${state.me.role==='admin'?`<p class="person-email" data-user-content>${esc(p.email||'')}</p>`:''}<div class="person-stat"><span>${t('本期累计')}</span><strong>${p.cents===null?'—':L.money(p.cents)}</strong><small>${p.count===null?t('本期明细仅本人可见'):t('共 {n} 笔消费').replace('{n}',p.count)}</small></div>${state.me.role==='admin'?`<div class="person-actions">${p.active?`<button data-role="${esc(p.id)}">${t(p.role==='admin'?'改为普通会员':'设为管理员')}</button>`:''}${p.role!=='admin'?`<button data-manage="${esc(p.id)}">${t('管理')}</button><button data-active="${esc(p.id)}" class="${p.active?'danger-text':''}">${t(p.active?'移除会员':'恢复会员')}</button>`:''}</div>`:''}</article>`).join('')||`<p class="empty">${t('没有找到成员')}</p>`;
    const me=people.find(p=>p.id===state.me.id);
    if(me){
      $('account-trigger').innerHTML=avatar(me);$('account-heading').textContent=me.name;
      if(!profileDirty){photo=me.avatar||'';$('profile-name').value=me.name;$('profile-preview').innerHTML=avatar(me);}
      $('hero-avatars').innerHTML=people.filter(p=>p.count>0).slice(0,3).map(p=>`<span>${avatar(p)}</span>`).join('');
    }
  }
  async function load(data){
    const first=!state;state=data;const current=++generation;
    $('profile-form').classList.remove('hidden');$('home-links').classList.remove('hidden');
    $('add-member').classList.toggle('hidden',data.me.role!=='admin');
    if(first)navigate(location.hash.slice(1),true);
    try{
      const result=await cloud.request('read_ledger_people',{p_period_id:data.selectedPeriod});
      if(current!==generation)return;
      people=result;feedback('people-message','');renderPeople();
    }catch(error){if(current===generation){feedback('people-message',error.message);$('members').innerHTML='';}}
  }
  function clear(){
    generation++;state=null;people=[];profileDirty=false;photo='';busy=false;
    $('profile-form').reset();$('profile-form').classList.add('hidden');$('home-links').classList.add('hidden');
    $('member-dialog').close();$('member-form').reset();$('people-search').value='';$('account-heading').textContent=t('欢迎回到罗家记');
    feedback('profile-message','');navigate('overview',true);
  }
  $('people-search').oninput=renderPeople;
  $('profile-name').oninput=()=>{profileDirty=true;};
  $('remove-avatar').onclick=()=>{photo='';profileDirty=true;$('profile-photo').value='';$('profile-preview').innerHTML=avatar({name:$('profile-name').value});};
  $('profile-photo').onchange=async()=>{
    const file=$('profile-photo').files[0];if(!file)return;
    const current=generation;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){feedback('profile-message','请选择 10 MB 以内的 JPG、PNG 或 WebP 图片。');return;}
    $('profile-save').disabled=true;
    try{
      const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
      const context=canvas.getContext('2d');context.fillStyle='#e4f2ff';context.fillRect(0,0,256,256);
      const size=Math.min(bitmap.width,bitmap.height);context.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,256,256);bitmap.close();
      const encoded=canvas.toDataURL('image/jpeg',.78);if(!safePhoto(encoded))throw Error('size');
      if(current!==generation)return;
      photo=encoded;profileDirty=true;$('profile-preview').innerHTML=avatar({avatar:photo});feedback('profile-message','头像已预览，点击保存个人资料后同步。');
    }catch{feedback('profile-message','图片读取失败，请换一张图片。');}finally{$('profile-save').disabled=false;}
  };
  $('profile-form').onsubmit=async event=>{
    event.preventDefault();$('profile-save').disabled=true;
    try{await cloud.request('update_ledger_profile',{p_name:$('profile-name').value.trim(),p_avatar:photo});profileDirty=false;await cloud.refresh(true);feedback('profile-message','个人资料已保存');}
    catch(error){feedback('profile-message',error.message);}finally{$('profile-save').disabled=false;}
  };
  function openMember(person=null,action='create'){
    editing=person;mode=action;$('member-form').reset();feedback('member-feedback','');
    $('member-dialog-title').textContent=t(action==='create'?'新增会员':'管理会员');
    $('member-name').value=person?.name||'';$('member-email').value=person?.email||'';
    $('member-email').disabled=action!=='create';$('member-password').required=action==='create';
    $('member-password-label').firstChild.textContent=t(action==='create'?'初始密码':'重设密码（选填）');
    feedback('member-help',action==='create'?'创建后即可使用邮箱和初始密码登录。请私下交给本人。':'可修改昵称或设置新密码。历史消费会继续保留。');
    $('member-dialog').showModal();
  }
  $('add-member').onclick=()=>openMember();
  $('member-dialog-close').onclick=()=>{if(!busy)$('member-dialog').close();};
  $('member-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('members').onclick=async event=>{
    if(busy||state?.me.role!=='admin')return;
    const button=event.target.closest('button');if(!button)return;
    const person=people.find(p=>p.id===(button.dataset.manage||button.dataset.active||button.dataset.role));if(!person)return;
    if(button.dataset.role){
      const role=person.role==='admin'?'member':'admin';
      const prompt=role==='admin'?'将此会员设为管理员？对方将可以管理会员、重设会员密码、管理周期和修改消费。':'将此管理员改为普通会员？对方会失去管理员权限，系统会保留至少一位管理员。';
      if(!window.I18n.confirm(prompt))return;
      busy=true;button.disabled=true;
      try{await cloud.request('set_ledger_member_role',{p_user_id:person.id,p_role:role});await cloud.refresh(true);feedback('people-message','角色已更新');}
      catch(error){feedback('people-message',error.message);}finally{busy=false;button.disabled=false;}
      return;
    }
    if(button.dataset.manage){openMember(person,'edit');return;}
    const message=person.active?'移除后，该会员不能再使用账本，历史消费会保留。确定移除？':'恢复后，该会员可以再次登录使用账本。确定恢复？';
    if(!window.I18n.confirm(message))return;
    busy=true;button.disabled=true;
    try{await cloud.request('manage_ledger_member',{p_user_id:person.id,p_name:person.name,p_active:!person.active});await load(state);}
    catch(error){feedback('people-message',error.message);}finally{busy=false;button.disabled=false;}
  };
  $('member-form').onsubmit=async event=>{
    event.preventDefault();if(busy)return;busy=true;$('member-submit').disabled=true;feedback('member-feedback','正在保存…');
    try{
      if(mode==='create'){
        await cloud.manageAccount({action:'create',name:$('member-name').value.trim(),email:$('member-email').value.trim(),password:$('member-password').value});
      }else{
        await cloud.request('manage_ledger_member',{p_user_id:editing.id,p_name:$('member-name').value.trim(),p_active:editing.active});
        if($('member-password').value)await cloud.manageAccount({action:'reset-password',userId:editing.id,password:$('member-password').value});
      }
      $('member-password').value='';$('member-dialog').close();await cloud.refresh(true);await load(state);feedback('people-message','会员资料已保存');
    }catch(error){feedback('member-feedback',error.message);}finally{busy=false;$('member-submit').disabled=false;}
  };
  window.addEventListener('languagechange',()=>{renderPeople();navigate(page,true);});
  navigate('overview',true);
  window.Family={load,clear,navigate,syncNavigation};
})();
