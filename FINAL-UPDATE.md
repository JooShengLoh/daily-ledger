# 罗家记 v3.6.0 · 更新步骤

本版恢复首页按“选中的周期”统计，并取消网站和会员服务自定的 12 位密码要求。彻底删除周期、多管理员、头像、双语、明暗主题等功能保留。

## 1. 数据库（已完成 v3.5.0 升级可以跳过）

如果上次已经执行合并的 upgrade-final.sql，这次没有新增数据库变更，不需要再跑 SQL。

如果仍在更早的版本，把包内 upgrade-final.sql 全部复制到 Supabase → SQL Editor 并 Run。升级脚本本身不会删除账号或消费记录，可以重复执行。

## 2. 更新会员账号服务（这次必须做）

Supabase → Edge Functions → manage-members → 打开代码编辑器。

使用本包根目录的 manage-members.ts 全部内容替换云端函数的 index.ts，重新 Deploy。函数名称仍为 manage-members，不要新建成其他名字。

保留现有设置：Verify JWT with legacy secret 关闭。函数内部仍会验证登录 token 和管理员角色，不需要发送或复制任何 Secret key。

这是去掉新增会员／管理员重设密码时服务器旧的 12 位限制。只更新 GitHub 无法修改云端函数。

## 3. 更新网站

打开 https://github.com/JooShengLoh/daily-ledger ，选择 Add file → Upload files。

将本包 website 文件夹“里面”的全部文件上传到仓库根目录，覆盖并 Commit changes。不要上传 website 外层文件夹或 ZIP。

等 GitHub Actions 中这次 Pages 部署成功，再打开 https://jooshengloh.github.io/daily-ledger/ 并 Ctrl+Shift+R 刷新。手机可用新标签或无痕窗口确认。网站资源带 v=3.6.0 版本标记，帮助避免旧缓存。

## 密码规则

网站和函数只要求密码非空；自己修改密码时，两次输入必须一致。管理员编辑会员时，新密码留空表示不修改密码。没有网站自定的 12 位要求或 128 位上限。

Supabase Auth 仍会执行项目自己的密码规则。进入 Authentication → Sign In / Providers → Email，查看最低密码长度和字符要求；字段名称以实际后台为准。将最低长度调整为你希望且后台允许的值并保存。Supabase Auth 默认最短长度为 6，实际以你的项目设置为准。网站不能绕过 Auth 服务的规则。

官方说明：https://supabase.com/docs/guides/auth/password-security
默认长度说明：https://supabase.github.io/auth/

## 首页统计规则

- 选哪个周期，首页就显示哪个周期的全员总额、自己的消费、人数和笔数。
- 已结束／提前关闭的周期仍显示原有总额，不再自动清零。
- 选没有消费的未来周期，显示零。
- 已关闭周期仍不能添加或修改消费。首页“记一笔”不会偷偷切到另一个周期。
- 永久删除一个周期后，其全部消费和记录会移除，页面切到剩余有效周期；没有周期时显示零。
- 明细页按同一个选中周期显示消费。筛选只改变筛选结果合计，不改变周期总额。

## 验证

1. 选择已结束且有消费的周期，首页总额应与明细页“所选周期总额”一致。
2. 选择另一个周期，确认金额跟随切换。
3. 用满足后台规则、但少于 12 位的密码测试新建会员、管理员重设密码、本人修改密码。
4. 若网站仍旧，检查仓库根目录 index.html 是否包含 v=3.6.0，以及 Pages 是否成功发布本次提交。

本地数据库／权限测试及浏览器流程测试通过。浏览器测试中的 Auth 网络使用测试替身，真实 Supabase 的密码规则需要在上线后验证。
