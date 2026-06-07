# 党章在线测试与复习系统

## 项目简介

本项目是一个用于党章学习与考试复习的在线测试系统，主要面向入党积极分子党章考试复习场景。系统将复习资料、题库练习、模拟测试和错题记录整合到网页中，方便用户进行在线刷题和复习。

项目支持用户注册、登录和学习数据同步。用户登录账号后，可以在电脑、手机、平板等不同设备上继续使用，学习进度和错题记录能够同步保存，适合碎片化复习和考前冲刺使用。

## 在线体验

在线访问地址：

https://radiant-empanada-643834.netlify.app

## 主要功能

* 用户注册与登录
* 跨设备同步学习进度
* 党章知识点复习
* 在线刷题练习
* 模拟考试
* 错题记录与复习
* 学习进度保存
* 移动端适配，支持电脑、手机和平板访问
* PWA 支持，可在部分设备上添加到主屏幕使用

## 技术栈

* HTML
* CSS
* JavaScript
* Supabase
* LocalStorage
* Service Worker
* Netlify

## 项目结构

```text
party-constitution-quiz-app
├── materials/              # 党章复习资料与相关内容
├── config.example.js       # 配置文件示例
├── DEPLOY.md               # 部署说明
├── icon.svg                # 项目图标
├── index.html              # 页面入口文件
├── manifest.json           # PWA 配置文件
├── questions.js            # 题库数据
├── README.md               # 项目说明文档
├── script.js               # 页面交互逻辑
├── service-worker.js       # 离线缓存与 PWA 支持
├── style.css               # 页面样式
└── supabase.sql            # Supabase 数据库初始化脚本
```

## 数据同步说明

本项目已接入 Supabase，用于支持用户注册、登录、学习进度保存和错题记录同步。

用户可以通过账号登录系统，在不同设备上继续学习。例如，在电脑端完成练习后，可以在手机或平板端登录同一账号继续复习，相关学习记录会同步保存。

## 本地运行方式

如果只是体验项目，可以直接访问上方的在线体验地址，无需额外配置。

如果需要将项目下载到本地运行，请按以下步骤操作。

### 1. 克隆项目

```bash
git clone https://github.com/YangLi-yl/party-constitution-quiz-app.git
```

进入项目目录：

```bash
cd party-constitution-quiz-app
```

### 2. 配置 Supabase

本项目的登录、注册和数据同步功能依赖 Supabase。

请先复制配置示例文件：

```text
config.example.js → config.js
```

然后在 `config.js` 中填写自己的 Supabase 项目配置，例如：

```js
const SUPABASE_URL = "your-supabase-url";
const SUPABASE_ANON_KEY = "your-supabase-anon-key";
```

出于安全考虑，公开仓库中不上传作者本人的 `config.js` 文件，仅保留 `config.example.js` 作为配置模板。

### 3. 初始化数据库

在 Supabase 项目中执行 `supabase.sql` 文件中的 SQL 语句，用于创建项目所需的数据表。

### 4. 打开项目

配置完成后，可以直接在浏览器中打开：

```text
index.html
```

也可以使用 VS Code 的 Live Server 插件运行项目。

## 部署说明

本项目为前端静态网页项目，已部署至 Netlify。

当前线上访问地址：

https://radiant-empanada-643834.netlify.app

如果需要自行部署，可以选择以下平台：

* Netlify
* GitHub Pages
* Vercel

部署时需要注意：

1. 如果项目需要正常使用注册、登录和跨设备同步功能，需要正确配置 Supabase。
2. 公开 GitHub 仓库中不建议上传作者本人的 `config.js` 文件。
3. 在线部署版本需要能够读取正确的 Supabase 配置，否则登录、注册和数据同步功能可能无法正常使用。

## 注意事项

* `config.js` 中可能包含 Supabase 项目配置，不建议上传到公开 GitHub 仓库。
* `config.example.js` 用于提供配置模板，方便其他人根据自己的 Supabase 项目进行配置。
* 如果只是访问线上版本，用户不需要进行任何配置，直接注册或登录即可使用。
* 本项目主要用于党章考试复习、课程实践和个人项目展示，题库内容可根据实际复习资料继续补充和完善。

## 项目说明

本项目来源于个人党章考试复习需求，目标是将零散的党章复习资料整理为一个可练习、可记录、可反复复习的在线系统。通过题库练习、模拟考试、错题复习和学习进度同步，提高复习效率，也作为前端开发、数据同步和网页部署实践项目进行展示。
