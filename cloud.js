/* Shared ledger: authenticated RPCs, server-enforced roles, dates and per-entry versions. */
(() => {
  'use strict';
  const config = window.LEDGER_CONFIG || {};
  const $ = id => document.getElementById(id);
  let client, ui, user = null, selectedPeriod = null, generation = 0, busy = false, ready = false;
  let refreshPromise = null;
  const message = text => { $('account-message').textContent = text; };
  const status = text => { $('sync-status').textContent = text; };
  function errorText(error) {
    const messages = {
      LAST_ADMIN: '至少需要保留一位管理员，不能取消最后一位管理员。',
      RESTORE_MEMBER_FIRST: '请先恢复该会员，再设为管理员。',
      INVALID_ROLE: '无效的账号角色。',
      PERIOD_HAS_RECORDS: '这个周期有消费历史，不能删除。可关闭周期保留账目。',
      INVALID_PROFILE: '昵称或头像无效，请检查后重试。',
      ADMIN_PROTECTED: '不能修改管理员账号。',
      MEMBER_NOT_FOUND: '找不到该会员，请重新同步。',
      MEMBER_REQUIRED: '账号尚未加入团队或已停用，请联系管理员。',
      ADMIN_REQUIRED: '只有管理员可以操作记账周期。',
      PERIOD_LOCKED: '该周期尚未开始、已到期或已关闭，不能再修改消费。',
      PERIOD_NOT_FOUND: '找不到该周期，请重新同步。',
      PERIOD_OVERLAP: '日期与现有未关闭周期重叠，请调整日期。',
      PERIOD_CONFLICT: '该周期已建立，请同步后检查。',
      TODAY_ONLY: '普通会员只能记录或修改今天的消费（马来西亚时间）。',
      DATE_OUTSIDE_PERIOD: '消费日期必须在该周期内，且不能晚于今天。',
      NOT_YOUR_ENTRY: '普通会员只能修改自己的消费。',
      ENTRY_DELETED: '该消费已被删除，请取消编辑后检查最新记录。',
      ENTRY_CONFLICT: '这笔消费已被更新。请取消编辑，重新打开最新记录再修改。',
      INVALID_ENTRY: '消费资料无效，请检查金额、日期和内容。',
      INVALID_PERIOD: '请填写有效周期，结束日期不能早于开始日期，最长 366 天。'
    };
    for (const [code,text] of Object.entries(messages)) if (error?.message?.includes(code)) return text;
    if (error?.message?.includes('Invalid login credentials')) return '邮箱或密码不正确，请向管理员确认账号。';
    if (error?.message?.includes('Email not confirmed')) return '账号邮箱尚未确认，请联系管理员。';
    if (error?.code === 'PGRST202' || error?.message?.includes('shared_ledger')) return '云端数据库尚未就绪，请管理员执行数据库初始化脚本。';
    return '操作未完成，请检查网络或登录状态后重试。未确认成功的修改不会显示为已保存。';
  }
  function setAccount(session) {
    const next = session?.user || null;
    if (next?.id === user?.id) return false;
    generation++; user = next; selectedPeriod = null; ready = false;
    $('workspace').classList.add('hidden');
    $('team-panel').classList.add('hidden');
    $('account-login').classList.toggle('hidden', !!user);
    $('account-tools').classList.toggle('hidden', !user);
    $('account-email').textContent = user?.email || '';
    $('change-password-panel').classList.add('hidden');
    $('change-password-form').reset();
    ui.clear();
    status(user ? '正在读取云端账本…' : '请登录云端账本');
    message(user ? '正在读取团队账本…' : '使用管理员分配的邮箱和密码登录。');
    return true;
  }
  function accept(data) {
    if (!ui.validate(data)) throw Error('invalid shared_ledger');
    selectedPeriod = data.selectedPeriod;
    ready = true; ui.load(data);
    $('workspace').classList.remove('hidden');
    $('team-panel').classList.remove('hidden');
  }
  async function refresh(force = false) {
    if (!user || busy || (!force && !ui.canRefresh())) return false;
    if (refreshPromise) return refreshPromise;
    const requestGeneration = generation;
    status('正在同步…');
    refreshPromise = (async () => {
      try {
        let { data, error } = await client.rpc('read_shared_ledger', {p_period_id:selectedPeriod});
        if (error?.message?.includes('PERIOD_NOT_FOUND') && requestGeneration === generation) {
          ({data,error}=await client.rpc('read_shared_ledger',{p_period_id:null}));
        }
        if (requestGeneration !== generation) return false;
        if (error) throw error;
        accept(data);
        status('● 团队账本已同步');
        message('全员共享周期总消费。页面每 20 秒检查更新，也可点击“同步”。');
        return true;
      } catch (error) {
        if (requestGeneration !== generation) return false;
        if (error?.message?.includes('MEMBER_REQUIRED')) {
          ready=false;ui.clear();$('workspace').classList.add('hidden');$('team-panel').classList.add('hidden');
        }
        status('同步失败 · 请重试'); message(errorText(error));return false;
      }
    })();
    try { return await refreshPromise; } finally { refreshPromise = null; }
  }
  async function run(name, args) {
    if (!user || !ready) throw Error('请先登录并读取团队账本。');
    if (busy || refreshPromise) throw Error('正在同步，请稍后再操作。');
    const requestGeneration = generation;
    busy = true; status('正在保存到云端…');
    try {
      const {data,error} = await client.rpc(name,args);
      if (requestGeneration !== generation) throw Error('账号已切换，请检查当前账号。');
      if (error) throw error;
      accept(data);status('● 云端已保存');return true;
    } catch(error) {
      if(requestGeneration === generation) {
        status('保存未确认 · 请重试');message(errorText(error));busy=false;
        if (/ENTRY_CONFLICT|ENTRY_DELETED|PERIOD_LOCKED|TODAY_ONLY|MEMBER_REQUIRED/.test(error?.message||'')) await refresh(true);
      }
      throw Error(errorText(error));
    } finally { busy=false; }
  }
  async function selectPeriod(id) {
    if (busy) throw Error('正在保存，请稍后再切换。');
    if (refreshPromise) await refreshPromise;
    const previous = selectedPeriod;selectedPeriod=id;
    if (!await refresh(true)) { selectedPeriod=previous;throw Error('读取周期失败，请重试。'); }
  }
  async function init(callbacks) {
    ui = callbacks;
    $('workspace').classList.add('hidden');
    $('storage-hint').textContent = '消费记入全员共用账本。保存成功后，其他成员同步即可看到。';
    $('login-btn').disabled = true;
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      status('云端尚未开通');
      message('管理员尚未连接云端数据库。请按“开通说明”设置项目后再登录。旧个人记录不会自动加入团队账本。');
      return;
    }
    try {
      if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.supabaseUrl)) throw Error('config');
      if (!config.supabasePublishableKey.startsWith('sb_publishable_')) throw Error('config');
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');
      client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }) }
      });
      client.auth.onAuthStateChange((_event, session) => {
        if (setAccount(session) && session) setTimeout(() => refresh(true), 0);
      });
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      setAccount(data.session);
      $('login-btn').disabled = false;
      if (data.session) await refresh(true);
      else { status('请登录云端账本'); message('使用管理员分配的邮箱和密码登录。没有账号或忘记密码，请联系管理员。'); }
      setInterval(() => { if (!document.hidden) refresh(); }, 20000);
      window.addEventListener('focus', () => refresh());
      window.addEventListener('online', () => refresh());
    } catch {
      status('云端连接失败');
      message('请检查网络及 config.js 中的项目地址和 sb_publishable_ 公开密钥，再刷新页面。');
    }
  }
  $('account-login').onsubmit = async event => {
    event.preventDefault(); if (!client) return;
    $('login-btn').disabled = true; message('正在登录…');
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: $('login-email').value.trim(), password: $('login-password').value });
      if (error) throw error;
      $('login-password').value = ''; setAccount(data.session); await refresh(true);
    } catch (error) { message(errorText(error)); }
    finally { $('login-btn').disabled = false; }
  };
  $('logout-btn').onclick = async () => {
    if (busy) { message('正在保存，请稍后再退出。'); return; }
    $('logout-btn').disabled = true;
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setAccount(null);
    } catch (error) { message(errorText(error)); }
    finally { $('logout-btn').disabled = false; }
  };
  $('sync-btn').onclick = () => refresh(true);
  $('change-password-btn').onclick = () => $('change-password-panel').classList.toggle('hidden');
  $('change-password-form').onsubmit = async event => {
    event.preventDefault();
    const password = $('new-password').value;
    if (password.length < 12 || password !== $('confirm-password').value) { message('新密码至少 12 位，两次输入必须相同。'); return; }
    $('update-password-btn').disabled = true;
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      $('change-password-form').reset(); $('change-password-panel').classList.add('hidden');
      message('密码已修改，下次登录请使用新密码。');
    } catch { message('修改密码失败。请重新登录后重试，并确认新密码满足项目的密码规则。'); }
    finally { $('update-password-btn').disabled = false; }
  };
  async function request(name,args={}) {
    if(!user||!ready)throw Error('请先登录并读取团队账本。');
    const current=generation;
    const {data,error}=await client.rpc(name,args);
    if(current!==generation)throw Error('账号已切换，请检查当前账号。');
    if(error)throw Error(error.code==='PGRST202'?'请先执行 upgrade-v3.sql，启用会员与个人资料功能。':errorText(error));
    return data;
  }
  async function manageAccount(body){
    if(!user||!ready)throw Error('请先登录并读取团队账本。');
    const {data,error}=await client.functions.invoke('manage-members',{body});
    if(error){let code='';try{code=(await error.context.json()).error;}catch{}
      const messages={EMAIL_EXISTS:'该邮箱已经有账号，请在会员列表中查找。',CREATE_FAILED:'无法创建账号，请检查邮箱是否已使用及密码规则。',INVALID_PASSWORD:'密码必须为 12 至 128 位。',ADMIN_REQUIRED:'只有管理员可以管理会员。',ADMIN_PROTECTED:'不能修改管理员账号。',RESET_FAILED:'重设密码失败，请重试。'};
      throw Error(messages[code]||'会员账号服务暂不可用，请确认已部署 manage-members，再重试。');
    }
    return data;
  }
  window.ledgerCloud = { init, run, selectPeriod, request, manageAccount, refresh };
})();
