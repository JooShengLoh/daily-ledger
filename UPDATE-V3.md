> 此文档描述早期更新。现在请使用 [FINAL-UPDATE.md](FINAL-UPDATE.md) 与 upgrade-final.sql 一次完成升级，不要只执行本文旧脚本后使用最新网站。

# 罗家记 · 更新上线步骤

本地新版已准备好。GitHub 上的旧网站不会自动更新，需要依次完成以下三步。已有账号、周期和消费不需要重建。

## 1. 更新数据库

在 Supabase → SQL Editor 新建查询，复制 `supabase/upgrade-v3.sql` 全部代码并 Run。

接着执行 `supabase/upgrade-v4.sql`，增加管理员“删除空周期”功能；再执行 `supabase/upgrade-v5.sql`，启用多位同等权限的管理员。

这一步增加头像、昵称和会员管理接口，可以重复执行。不要重新运行 `set-admin.sql`，也不要删除现有表。

新项目则先执行 `schema.sql`，再执行 `upgrade-v3.sql`，然后按 `SETUP.md` 设置第一位管理员。

## 2. 部署会员账号服务（新增账号 / 重设密码）

新增账号必须在服务器执行，GitHub Pages 本身不能持有管理密钥。

在 Supabase 项目左侧找到 **Edge Functions**：

1. 选择创建新函数并使用编辑器（页面可能显示 Deploy a new function / Via Editor）。
2. 函数名称必须是 **`manage-members`**。
3. 把 `supabase/functions/manage-members/index.ts` 全部内容贴入函数的 `index.ts`。
4. 部署函数。
5. 在该函数设置中，关闭网关的旧 JWT 校验选项（通常叫 **Verify JWT with legacy secret**），并保存。函数内部仍会用 `auth.getUser()` 验证登录 token，再检查数据库中的管理员身份。这样也兼容新版签名密钥。

所用的 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 是 Supabase 托管函数提供的服务器环境变量，不需要填入网页，也不要复制进 GitHub 的 `config.js`。

如果使用已登录的 Supabase CLI，可以从项目目录执行：

```powershell
supabase functions deploy manage-members --project-ref nrnyhifyazuahfdplhyr
```

`supabase/config.toml` 已配置 `verify_jwt = false`；真正的身份与角色校验在函数内。非管理员、未登录和伪造 token 均不能创建或重设账号。

参考：[Supabase 服务端创建用户](https://supabase.com/docs/reference/javascript/auth-admin-createuser)、[验证登录用户](https://supabase.com/docs/reference/javascript/auth-getuser)。

## 3. 更新 GitHub Pages 文件

打开仓库，选择 **Add file → Upload files**，上传以下文件到仓库根目录，覆盖旧版后 Commit changes：

```text
index.html
style.css
family.css
logo.svg
ledger.js
app.js
cloud.js
family.js
i18n.js
config.js
SETUP.md
UPDATE-V3.md
```

也可以解压 `release/luojiaji-web.zip`，把里面的文件上传到根目录。不要直接上传 ZIP，也不要上传包外层文件夹。SQL 和 Edge Function 代码按前两步单独部署。

等待 Pages 发布完成，然后刷新网站；电脑可按 Ctrl+Shift+R。地址继续使用：

https://jooshengloh.github.io/daily-ledger/

## 删除误建周期

管理员在首页选择周期，展开“记账规则”，点击“删除空周期”并确认。进行中、未开始或已关闭的空周期都支持；包含任何消费历史（包括已删除记录）的周期会拒绝删除。删除无法恢复，其他设备同步时会自动切换有效周期。

## 如何使用

- 顶部 **EN / 中文** 切换语言；月亮 / 太阳切换明暗模式，偏好保存在当前设备。
- **首页**：全员总额、我的消费和管理员周期设置。
- **明细**：按日期、分类、成员与关键字筛选，按天查看小计，编辑允许修改的记录或导出。
- **成员**：显示昵称、头像、当前周期累计与笔数。限制明细的周期不会向其他普通会员显示个人金额。
- **我的 / 右上角头像**：修改昵称、上传照片、保存个人资料或修改密码。照片裁成方形并压缩为 256 × 256 JPEG，再存入数据库，跨设备共享。
- 管理员在 **成员 → 新增会员** 填昵称、邮箱、初始密码。账号创建后可直接登录，不需邮件确认；请私下交给本人，并让他们更换密码。
- **管理**：改昵称，或填写新密码完成重设；密码留空则不修改。
- **移除会员**：停用该会员的账本访问权，保留账号和历史消费；需要时点击 **恢复会员**。管理员账号必须先降级为普通会员，才能移除；最后一位管理员不能降级。

## 设置另一位管理员

执行 `supabase/upgrade-v5.sql` 后，更新 GitHub 根目录的 `family.js`、`family.css`、`cloud.js` 和 `i18n.js`（也可使用最新版完整上传包）。无需重新部署 Edge Function。

在成员页面找到已启用的会员，点击“设为管理员”并确认，对方同步或重新登录后拥有同等权限。点击管理员卡片的“改为普通会员”可以降级；数据库会保护最后一位管理员。不能直接移除管理员，需先降级。首次 bootstrap 脚本 `set-admin.sql` 仍仅用于创建首位管理员，之后请通过网页调整角色。

## 上线验证

1. 管理员新建一个测试会员，退出后用该会员登录。
2. 会员修改昵称和头像，刷新页面，再换另一台设备查看。
3. 管理员移除测试会员，会员同步后应无法访问账本；恢复后可以重新使用。
4. 确认移除会员前后的历史消费总额不变。
5. 在手机切换首页、明细、成员以及语言和主题。

若显示“请先执行 upgrade-v3.sql”，重新检查第一步是否在同一个 Supabase 项目执行。若新增账号提示账号服务不可用，检查函数名称、部署状态与第二步的网关设置。不要把失败提示当作保存成功；网络中断后先同步列表，确认账号是否已经创建。

本地自动化验证使用真实 PostgreSQL 兼容数据库执行 SQL；浏览器中的登录和云端网络是测试替身。仍需以上步骤验证真实 Supabase Auth / Edge Function 部署。
