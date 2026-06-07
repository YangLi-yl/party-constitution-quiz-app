# 部署说明

本项目是纯前端静态网站，可以直接部署到 Netlify、GitHub Pages、Cloudflare Pages 或 Vercel。

## 必须上传的文件

- `index.html`
- `style.css`
- `script.js`
- `questions.js`
- `manifest.json`
- `service-worker.js`
- `icon.svg`
- `config.js`
- `README.md`
- `DEPLOY.md`

如果要配置登录同步，也建议保留：

- `config.example.js`
- `supabase.sql`

`materials` 文件夹是原始复习资料，网页运行时不依赖它，可以不上传。

## 本地测试

方式一：双击 `index.html`。

方式二：用 VS Code Live Server 打开项目根目录。

建议部署前至少测试：

- 首页能打开。
- 章节页顺序正确。
- 练习页能答题、收藏、标记错题。
- 模拟考试能开始、答题、交卷。
- 个人中心能导出和导入进度 JSON。

## Netlify 拖拽部署

1. 打开 Netlify 并登录。
2. 进入原来的站点项目。
3. 打开 `Deploys` 页面。
4. 找到手动拖拽部署区域。
5. 把整个项目文件夹拖进去，确保 `index.html` 在根目录。
6. 等待部署完成。
7. Netlify 生成的网址就是可以发给别人使用的网址。

朋友不需要下载代码，也不需要登录即可刷题。默认数据保存在朋友自己的浏览器里。

## GitHub Pages 部署

1. 新建 GitHub 仓库。
2. 上传项目根目录文件，确保 `index.html` 在仓库根目录。
3. 打开仓库 `Settings`。
4. 找到 `Pages`。
5. Source 选择 `Deploy from a branch`。
6. Branch 选择 `main`，目录选择 `/root`。
7. 等待 GitHub Pages 生成网址。

## Cloudflare Pages / Vercel

导入静态项目即可，不需要构建命令。输出目录保持根目录。

## 配置 Supabase 登录同步

登录同步是可选功能。不配置时网站会显示“本地模式”，所有练习功能仍然可用。

配置步骤：

1. 在 Supabase 新建项目。
2. 打开 SQL Editor。
3. 复制 `supabase.sql` 全部内容并执行。
4. 打开 Project Settings -> API。
5. 复制 Project URL 和 anon public key。
6. 复制 `config.example.js` 为 `config.js`。
7. 在 `config.js` 填入：

```js
window.APP_CONFIG = {
  SUPABASE_URL: "你的 Project URL",
  SUPABASE_ANON_KEY: "你的 anon public key"
};
```

8. 重新部署。

注意：不要把 `service_role` key 写进前端，不要上传到公开仓库。前端只能使用 anon public key。

## 部署后测试登录注册和同步

1. 打开部署后网址。
2. 进入“个人中心”。
3. 如果显示“本地模式”，说明 Supabase 未配置或配置为空。
4. 如果显示登录入口，进入“登录/注册”。
5. 用邮箱和密码注册。
6. 按 Supabase 的邮箱确认设置完成确认后登录。
7. 刷几道题，刷新页面确认记录仍在。
8. 换设备或浏览器登录同一账号，选择合并或拉取云端记录。

Supabase 免费额度通常够个人小范围使用；大量用户访问或开启付费能力可能产生费用。本项目不做短信登录，避免短信验证费用。
