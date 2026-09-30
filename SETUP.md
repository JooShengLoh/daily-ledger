> 最终整合版本请优先阅读 [FINAL-UPDATE.md](FINAL-UPDATE.md)。已有项目只执行 upgrade-final.sql，然后覆盖网站文件。

# 开通团队共用账本

> 新版：浅蓝主题、头像昵称、中英文、明暗模式、独立页面与网页会员管理。已有线上版本请先按 [UPDATE-V3.md](UPDATE-V3.md) 更新数据库、部署账号服务和上传新版文件。

目标：**你是管理员 → 建立普通会员账号 → 网页开启两星期周期 → 会员每天记消费 → 全员看周期总额。**

同一 Supabase 项目中的所有启用成员属于同一个团队。只有登录后的成员能查看，不是公开给互联网访客看。

## 1. 创建 Supabase 项目

打开 [Supabase 控制台](https://supabase.com/dashboard)，创建项目。选择合适区域与套餐，费用以当时控制台为准。保管数据库密码，不要放入网页或 GitHub。

## 2. 初始化共享数据库

进入项目 **SQL Editor**，粘贴并执行 [supabase/schema.sql](supabase/schema.sql) 全部内容。接着执行 [supabase/upgrade-final.sql](supabase/upgrade-final.sql)，一次启用头像、会员管理、多管理员、删除空周期与首页当前统计。

新建成员、周期和逐笔消费三张表，启用访问限制，安装 RPC，并为以后创建的 Auth 用户自动建立普通会员资料。已有 Auth 用户也会加入会员表，角色默认为普通会员；若已有多人不应属于此团队，请在发放网站前按后文停用。

脚本可重复执行，不清空共享消费、不重置已设置的管理员。若之前执行过个人账本版本：旧表数据保留，旧接口被关闭，不会自动向团队公开个人消费。

## 3. 关闭自行注册

在 **Authentication** 登录／用户注册设置中关闭 **Allow new users to sign up**，保持 Email / Password 登录启用，不启用匿名登录。

这是一个封闭团队，新用户通过你创建账号后才加入。只隐藏注册按钮不足以阻止注册，必须关闭服务端设置。[官方配置说明](https://supabase.com/docs/guides/auth/general-configuration)。

合并升级包含多管理员功能。可在网站成员页提升或降级角色，最后一位管理员不能降级。

## 4. 建立账号并指定首位管理员

1. 在 **Authentication → Users → Add user / Create new user** 建立你自己的邮箱账号，设置初始密码，并完成邮箱确认（或选 Auto confirm user）。
2. 打开 [supabase/set-admin.sql](supabase/set-admin.sql)，把 `admin_email` 改成你刚创建的邮箱。
3. 在 SQL Editor 执行修改后的脚本。这是第一次指定管理员；不会覆盖已存在的另一位管理员。
4. 用同样方式为其他人建立邮箱账号。后续账号自动是普通会员，不能开周期或修改别人的消费。
5. 每人使用独立初始密码，通过私下方式发送。成员登录后可点击“修改密码”。

不要把大家设成相同账号，否则系统会把他们当成同一人。网页不提供公开注册。完成 [新版部署](UPDATE-V3.md) 后，管理员可以在网站的“成员 → 新增会员”直接创建账号，也可以继续使用 Supabase 控制台。

### 设置成员显示姓名

旧账号默认显示邮箱 @ 前面的部分。新版成员可在“我的”修改昵称与头像，管理员可以在成员页改昵称；也可使用以下 SQL：

```sql
update public.ledger_members
set display_name = '小明'
where user_id = (select id from auth.users where email = 'member@example.com');
```

角色保存在成员表；不要尝试修改 Auth metadata 来设置管理员，它不会授予权限。

### 停用成员而保留历史消费

```sql
update public.ledger_members
set active = false
where user_id = (select id from auth.users where email = 'member@example.com');
```

该成员将无法继续读取或提交，原来的消费和姓名仍保留在历史记录中。重新启用可将 active 设为 true。不要删除有历史账目的用户来重置密码。成员忘记密码时联系管理员；本版只有登录后修改密码，邮件找回流程尚未实现。

## 5. 填写公开连接配置

在项目 **Connect / API Keys** 找到 Project URL 和新版 **Publishable key**，修改 `config.js`：

```js
window.LEDGER_CONFIG = {
  supabaseUrl: 'https://你的项目编号.supabase.co',
  supabasePublishableKey: 'sb_publishable_你的公开密钥'
};
```

公开配置可随代码上传，权限由登录身份和数据库执行。**不要填入 sb_secret_、service_role 或数据库密码。**

## 6. 发布 GitHub Pages

1. 建立 GitHub 仓库，上传代码；必须包含 `index.html`、`style.css`、`family.css`、`logo.svg`、`ledger.js`、`app.js`、`cloud.js`、`family.js`、`i18n.js`、`config.js`、`SETUP.md`、`UPDATE-V3.md`。
2. 不上传 node_modules、私人导出或管理密钥。
3. 打开 **Settings → Pages**，选择 **Deploy from a branch**、`main`、`/ (root)`。
4. 等待部署完成，取得 HTTPS 网站地址，发给成员。
5. Supabase **Authentication → URL Configuration** 的 Site URL 设为这个正式地址。

云端登录请用 HTTP(S) 网站，不要直接通过 file:// 打开。

## 7. 开启第一个两星期周期

1. 用管理员账号登录网站，展开“管理员 · 开启新的记账周期”。
2. 输入名称，例如“十月上半月消费”。
3. 选择开始日期，点击“两星期”。例如 9 月 30 日开始，10 月 13 日结束，共 14 天。
4. 默认全员可看所有明细，会员只能记录当天。也可以在创建前选择允许补记，或只展示全员总额和自己的明细。
5. 点击创建。成员同步后就能看到这个周期。
6. 周期结束日期包含当天，到次日 00:00 自动锁定，无需定时任务。统一依据马来西亚时间。

管理员可提前结束周期；一旦关闭，不再允许任何人改账，仍可查看历史。第一版不提供重新打开或修改周期规则，避免改变已经结束的账目。可以创建下一期，未关闭周期之间不能日期重叠。

## 8. 上线验收

- 普通会员 A、B 用不同设备登录，看见同一个周期。
- A 记录 RM 12.50，B 记录 RM 8.00。两人同步后全员总额都是 RM 20.50。
- A 的个人小计是 RM 12.50，B 是 RM 8.00。筛选某一成员不会改变全员总额。
- 会员不能开周期、不能编辑或删除别人的记录。普通会员只能填写当天（除非该周期允许补记）。
- 管理员提前结束周期后，会员保存失败，历史总额仍可查看。
- 未来周期开始前不能记账；到期周期自动锁定。
- 刷新和重新登录后记录还在。断网保存显示失败并保留表单，联网后可以重试。
- 退出后账本和邮箱不再显示；确认 Supabase 已关闭自行注册。

## 旧个人资料

本版不再提供将旧个人账本直接导入团队的入口，以免误公开私人记录或绕过周期规则。旧浏览器数据和旧数据库表都保留。若要搬迁，先导出备份，并确认每笔所属成员与周期，再另行迁移。

## 常见问题

- 云端尚未开通：补齐 config.js。
- 数据库尚未就绪：在同一项目完整执行新版 schema.sql。
- 登录后没有管理员入口：核对 set-admin.sql 的邮箱与当前登录账号是否相同。
- 账号未加入团队或停用：检查 ledger_members 中对应行和 active。
- 看不到刚创建的周期：点击同步，选择对应周期。
- 无法保存：检查周期是否进行中、日期是否符合规则，或取消编辑并重新打开最新记录。
