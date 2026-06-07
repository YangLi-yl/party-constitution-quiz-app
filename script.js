(function () {
  "use strict";

  const APP_VERSION = "v1.2.0";
  const STORAGE_KEY = "dangzhang-progress-v6";
  const CHAPTERS = Array.isArray(window.CHAPTERS) ? window.CHAPTERS.slice().sort((a, b) => a.order - b.order) : [];
  const QUESTIONS = Array.isArray(window.QUESTIONS) ? window.QUESTIONS : [];
  const REVIEW_CARDS = Array.isArray(window.REVIEW_CARDS) ? window.REVIEW_CARDS : [];

  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const syncStatus = document.getElementById("sync-status");
  const authEntry = document.getElementById("auth-entry");
  const importFile = document.getElementById("import-file");

  const state = {
    route: "home",
    progress: loadLocalProgress(),
    practice: { list: [], index: 0, mode: "order", filters: {} },
    exam: null,
    optionOrders: {},
    session: loadSession(),
    authMode: "login",
    syncTimer: null
  };

  const supabase = createSupabaseClient();
  const REVIEW_CARD_BANK = buildReviewCardBank();

  window.addEventListener("hashchange", renderRoute);
  window.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    renderRoute();
  });
  document.getElementById("reload-app").addEventListener("click", () => location.reload());
  importFile.addEventListener("change", importProgressFile);

  init();

  function init() {
    if (!location.hash) location.hash = "#/home";
    wireGlobalNavigation();
    refreshAuthStatus();
    renderRoute();
    registerServiceWorker();
    if (state.session && supabase.enabled) pullCloudProgress(false);
  }

  function wireGlobalNavigation() {
    document.querySelectorAll('a[href^="#/"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const target = link.getAttribute("href");
        if (!target) return;
        event.preventDefault();
        if (target === "#/exam") resetExamSession();
        if (location.hash === target) renderRoute();
        else location.hash = target;
      });
    });
  }

  function resetExamSession() {
    state.exam = null;
    state.progress.examDraft = null;
    saveProgress();
  }

  function renderRoute() {
    state.route = (location.hash.replace("#/", "") || "home").split("?")[0];
    document.querySelectorAll("[data-route]").forEach((link) => link.classList.toggle("active", link.dataset.route === state.route));
    document.querySelectorAll(".bottom-nav a").forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#/${state.route}`));
    refreshAuthStatus();
    const routes = {
      home: renderHome,
      chapters: renderChapters,
      practice: renderPractice,
      exam: renderExam,
      wrong: renderWrong,
      favorites: renderFavorites,
      cards: renderCards,
      search: renderSearch,
      profile: renderProfile,
      login: renderLogin
    };
    (routes[state.route] || renderHome)();
    app.focus({ preventScroll: true });
  }

  function renderHome() {
    const stats = getStats();
    app.innerHTML = `
      <section class="home-hero">
        <div class="hero-copy">
          <span class="eyebrow">党章考试复习</span>
          <h1>党章考试在线练习</h1>
          <p>按章节刷题、模拟考试、错题复盘，适合考前集中复习。题库按党章目录整理，记录默认保存在当前浏览器。</p>
          <div class="hero-actions">
            <button class="primary" data-action="chapters">开始章节练习</button>
            <button data-action="exam">进入模拟考试</button>
          </div>
          <p class="local-note">${syncLabel()}</p>
        </div>
        <div class="hero-panel">
          <div class="panel-title">
            <strong>今日学习</strong>
            <span>${today()}</span>
          </div>
          <div class="mini-stats">
            ${miniStat("今日完成", stats.today)}
            ${miniStat("累计练习", stats.completed)}
            ${miniStat("正确率", `${stats.rate}%`)}
            ${miniStat("错题数", stats.wrong)}
            ${miniStat("连续学习", `${stats.streak} 天`)}
          </div>
          <button class="wide" data-action="continue">继续上次练习</button>
        </div>
      </section>

      <section class="section-block">
        <div class="section-title"><div><h2>快速入口</h2><p>根据当前复习阶段选择练习方式。</p></div></div>
        <div class="feature-grid">
          ${featureCard("01", "章节练习", "按党章目录逐章复习", "chapters", true)}
          ${featureCard("02", "随机刷题", "打乱顺序综合练习", "random")}
          ${featureCard("03", "模拟考试", "45 分钟完整组卷", "exam")}
          ${featureCard("04", "错题冲刺", "只练错题本题目", "wrong")}
          ${featureCard("05", "高频速背", "按章节背高频短句", "cards")}
          ${featureCard("06", "收藏复习", "复习自己收藏的题目", "favorite")}
        </div>
      </section>

      <section class="section-block">
        <div class="section-title">
          <div><h2>章节掌握预览</h2><p>按党章目录展示全部章节，横向滚动查看。</p></div>
          <a class="btn small" href="#/chapters">查看全部章节</a>
        </div>
        <div class="chapter-preview">
          ${CHAPTERS.map((chapter) => chapterPreview(chapter)).join("")}
        </div>
      </section>
    `;
    app.querySelectorAll("[data-action]").forEach((btn) => btn.addEventListener("click", () => runHomeAction(btn.dataset.action)));
  }

  function runHomeAction(action) {
    if (action === "continue") continuePractice();
    if (action === "chapters") location.hash = "#/chapters";
    if (action === "random") startPractice({ mode: "random" });
    if (action === "exam") { resetExamSession(); location.hash = "#/exam"; if (state.route === "exam") renderRoute(); }
    if (action === "wrong") startPractice({ mode: "wrong" });
    if (action === "cards") location.hash = "#/cards";
    if (action === "favorite") startPractice({ mode: "favorite" });
  }

  function buildReviewCardBank() {
    const data = {
      outline: [
        ["党的性质", "中国共产党是中国工人阶级的先锋队，同时是中国人民和中华民族的先锋队，是中国特色社会主义事业的领导核心。", ["工人阶级先锋队", "中国人民", "中华民族", "领导核心"], "中国共产党的性质是什么？", "不要漏掉“同时是中国人民和中华民族的先锋队”。"],
        ["最高理想和最终目标", "党的最高理想和最终目标是实现共产主义。", ["最高理想", "最终目标", "实现共产主义"], "党的最高理想和最终目标是什么？", "不要写成“中华民族伟大复兴”，那是历史任务相关表述。"],
        ["行动指南", "中国共产党以马克思列宁主义、毛泽东思想、邓小平理论、“三个代表”重要思想、科学发展观、习近平新时代中国特色社会主义思想作为自己的行动指南。", ["马克思列宁主义", "毛泽东思想", "习近平新时代中国特色社会主义思想"], "党的行动指南包括哪些？", "六项要按顺序背，最后是习近平新时代中国特色社会主义思想。"],
        ["初心使命", "中国共产党自成立以来，始终把为中国人民谋幸福、为中华民族谋复兴作为自己的初心使命。", ["为中国人民谋幸福", "为中华民族谋复兴"], "党的初心使命是什么？", "两个对象分别是中国人民和中华民族。"],
        ["思想路线", "一切从实际出发，理论联系实际，实事求是，在实践中检验真理和发展真理。", ["一切从实际出发", "理论联系实际", "实事求是", "实践检验真理"], "党的思想路线是什么？", "不要只背“实事求是”，四个部分都要完整。"],
        ["群众路线", "一切为了群众，一切依靠群众，从群众中来，到群众中去。", ["为了群众", "依靠群众", "从群众中来", "到群众中去"], "党的群众路线是什么？", "“为了”和“依靠”不要颠倒。"],
        ["主要矛盾", "我国社会主要矛盾是人民日益增长的美好生活需要和不平衡不充分的发展之间的矛盾。", ["美好生活需要", "不平衡不充分的发展"], "新时代我国社会主要矛盾是什么？", "不要使用旧表述“物质文化需要”。"],
        ["第一要务", "发展是我们党执政兴国的第一要务。", ["发展", "执政兴国", "第一要务"], "党执政兴国的第一要务是什么？", "答案只有“发展”，不要写成改革。"],
        ["新发展理念", "必须坚持创新、协调、绿色、开放、共享的发展理念。", ["创新", "协调", "绿色", "开放", "共享"], "新发展理念包括哪些？", "五个词顺序常考。"],
        ["五位一体和四个全面", "统筹推进经济建设、政治建设、文化建设、社会建设、生态文明建设，协调推进全面建设社会主义现代化国家、全面深化改革、全面依法治国、全面从严治党。", ["五位一体", "四个全面", "生态文明建设", "全面从严治党"], "五位一体总体布局和四个全面战略布局是什么？", "五位一体是建设领域，四个全面是战略布局。"]
      ],
      "chapter-1": [
        ["申请入党条件", "年满十八岁的中国工人、农民、军人、知识分子和其他社会阶层的先进分子，可以申请加入中国共产党。", ["年满十八岁", "先进分子", "申请入党"], "申请加入中国共产党需要具备哪些基本条件？", "年龄是十八岁，不是十六岁。"],
        ["党员基本要求", "中国共产党党员是中国工人阶级的有共产主义觉悟的先锋战士。", ["共产主义觉悟", "先锋战士"], "党章如何规定党员的基本要求？", "“先锋战士”是关键词。"],
        ["党员宗旨", "中国共产党党员必须全心全意为人民服务。", ["全心全意为人民服务"], "党员必须坚持什么宗旨？", "不要写成一般性的“为人民服务”，要完整。"],
        ["发展党员标准", "发展党员，必须把政治标准放在首位，经过党的支部，坚持个别吸收的原则。", ["政治标准", "党的支部", "个别吸收"], "发展党员必须坚持哪些要求？", "政治标准在首位，不能写成业务标准。"],
        ["入党介绍人", "申请入党的人，要有两名正式党员作介绍人。", ["两名", "正式党员", "介绍人"], "申请入党需要几名介绍人？", "必须是正式党员，预备党员不能作介绍人。"],
        ["预备期", "预备党员的预备期为一年。", ["预备党员", "预备期", "一年"], "预备党员的预备期多长？", "预备期是一年，留党察看最长不超过两年。"]
      ],
      "chapter-2": [
        ["民主集中制", "民主集中制是民主基础上的集中和集中指导下的民主相结合。", ["民主基础上的集中", "集中指导下的民主"], "什么是民主集中制？", "要背完整的两个半句。"],
        ["根本组织原则", "民主集中制是党的根本组织原则。", ["民主集中制", "根本组织原则"], "党的根本组织原则是什么？", "答案是民主集中制。"],
        ["四个服从", "党员个人服从党的组织，少数服从多数，下级组织服从上级组织，全党各个组织和全体党员服从党的全国代表大会和中央委员会。", ["个人服从组织", "少数服从多数", "下级服从上级", "全党服从中央"], "党的组织原则中四个服从是什么？", "最后一项最长，容易漏。"],
        ["选举原则", "党的各级领导机关，除它们派出的代表机关和在非党组织中的党组外，都由选举产生。", ["领导机关", "选举产生"], "党的各级领导机关怎样产生？", "注意两个例外。"],
        ["讨论决定问题", "党组织讨论决定问题，必须执行少数服从多数的原则。", ["少数服从多数"], "党组织讨论决定问题执行什么原则？", "不是个人决定，也不是简单协商一致。"],
        ["上下级组织关系", "党的下级组织既要向上级组织请示和报告工作，又要独立负责地解决自己职责范围内的问题。", ["请示报告", "独立负责"], "党的上下级组织关系如何处理？", "既要请示报告，也要独立负责。"]
      ],
      "chapter-3": [
        ["最高领导机关", "党的最高领导机关，是党的全国代表大会和它所产生的中央委员会。", ["全国代表大会", "中央委员会"], "党的最高领导机关是什么？", "不是只写全国代表大会。"],
        ["全国代表大会任期", "党的全国代表大会每五年举行一次。", ["五年", "全国代表大会"], "党的全国代表大会多久举行一次？", "数字题，五年。"],
        ["中央委员会任期", "中央委员会每届任期五年。", ["中央委员会", "五年"], "中央委员会每届任期多久？", "和全国代表大会周期相同。"],
        ["中央委员会产生", "中央委员会由党的全国代表大会选举产生。", ["选举产生", "全国代表大会"], "中央委员会由谁选举产生？", "主体是党的全国代表大会。"],
        ["中央政治局", "中央政治局和它的常务委员会由中央委员会全体会议选举。", ["中央政治局", "中央委员会全体会议"], "中央政治局由谁选举？", "不是全国代表大会直接选举。"],
        ["中央书记处", "中央书记处是中央政治局和它的常务委员会的办事机构。", ["中央书记处", "办事机构"], "中央书记处的性质是什么？", "关键词是办事机构。"]
      ],
      "chapter-4": [
        ["地方代表大会周期", "党的地方各级代表大会每五年举行一次。", ["地方各级代表大会", "五年"], "党的地方各级代表大会多久举行一次？", "数字题，五年。"],
        ["地方委员会任期", "党的地方各级委员会每届任期五年。", ["地方各级委员会", "五年"], "地方各级委员会每届任期多久？", "不要与基层委员会任期混淆。"],
        ["地方组织职责", "党的地方各级委员会在本地区发挥领导核心作用。", ["本地区", "领导核心作用"], "地方各级委员会发挥什么作用？", "范围是本地区。"],
        ["贯彻上级决定", "地方各级党组织必须贯彻执行中央和上级党组织的决定。", ["贯彻执行", "中央", "上级党组织"], "地方党组织如何对待中央和上级决定？", "关键词是贯彻执行。"],
        ["地方纪委产生", "党的地方各级纪律检查委员会由同级党的代表大会选举产生。", ["纪律检查委员会", "同级代表大会"], "地方纪委由谁选举产生？", "同级党的代表大会。"],
        ["地方党委全会", "党的地方各级委员会全体会议由常务委员会召集。", ["全体会议", "常务委员会"], "地方党委全会由谁召集？", "召集主体是常务委员会。"]
      ],
      "chapter-5": [
        ["基层组织设置", "企业、农村、机关、学校、医院、科研院所、街道社区、社会组织等基层单位，凡是有正式党员三人以上的，都应当成立党的基层组织。", ["正式党员", "三人以上", "基层组织"], "基层单位成立党的基层组织的条件是什么？", "必须是正式党员三人以上。"],
        ["党支部地位", "党支部是党的基础组织。", ["党支部", "基础组织"], "党支部在党内的地位是什么？", "答案很短但常考。"],
        ["教育管理监督党员", "党支部担负直接教育党员、管理党员、监督党员的职责。", ["教育党员", "管理党员", "监督党员"], "党支部对党员承担哪些职责？", "三个动词要完整。"],
        ["群众工作职责", "党支部担负组织群众、宣传群众、凝聚群众、服务群众的职责。", ["组织群众", "宣传群众", "凝聚群众", "服务群众"], "党支部对群众承担哪些职责？", "四个群众不要漏。"],
        ["基层组织基本任务", "党的基层组织宣传和执行党的路线、方针、政策，宣传和执行党中央、上级组织和本组织的决议。", ["宣传执行", "路线方针政策", "决议"], "基层党组织的基本任务包括什么？", "宣传和执行是高频词。"],
        ["战斗堡垒作用", "党的基层组织要充分发挥战斗堡垒作用。", ["基层组织", "战斗堡垒作用"], "基层党组织发挥什么作用？", "常与党员先锋模范作用配对考。"]
      ],
      "chapter-6": [
        ["干部地位", "党的干部是党的事业的骨干，是人民的公仆。", ["事业骨干", "人民公仆"], "党的干部是什么？", "两个定位都要背。"],
        ["选人用人原则", "党按照德才兼备、以德为先的原则选拔干部，坚持任人唯贤。", ["德才兼备", "以德为先", "任人唯贤"], "党的干部选拔原则是什么？", "以德为先不能漏。"],
        ["干部队伍要求", "着力培养忠诚干净担当的高素质干部。", ["忠诚", "干净", "担当"], "新时代干部队伍建设要求是什么？", "三个词顺序常考。"],
        ["干部能力", "党的干部必须具备履行职责所需要的马克思列宁主义、毛泽东思想等理论水平。", ["理论水平", "履行职责"], "干部应具备哪些能力素质？", "可按理论、实践、群众工作展开。"],
        ["反对四风", "反对形式主义、官僚主义、享乐主义和奢靡之风。", ["形式主义", "官僚主义", "享乐主义", "奢靡之风"], "四风包括哪些？", "最后是奢靡之风。"],
        ["干部接受监督", "党的干部必须正确行使人民赋予的权力，依法办事，清正廉洁。", ["正确行使权力", "依法办事", "清正廉洁"], "干部如何正确行使权力？", "和廉洁纪律、工作纪律相关。"]
      ],
      "chapter-7": [
        ["纪律六类", "党的纪律主要包括政治纪律、组织纪律、廉洁纪律、群众纪律、工作纪律、生活纪律。", ["政治纪律", "组织纪律", "廉洁纪律", "群众纪律", "工作纪律", "生活纪律"], "党的纪律主要包括哪六类？", "六类纪律和五种处分不要混淆。"],
        ["处分五种", "对党员的纪律处分有五种：警告、严重警告、撤销党内职务、留党察看、开除党籍。", ["警告", "严重警告", "撤销党内职务", "留党察看", "开除党籍"], "党员纪律处分有哪五种？", "五种处分按由轻到重顺序背。"],
        ["留党察看期限", "留党察看最长不超过两年。", ["留党察看", "两年"], "留党察看最长多久？", "数字题，两年。"],
        ["留党察看权利", "党员在留党察看期间没有表决权、选举权和被选举权。", ["表决权", "选举权", "被选举权"], "留党察看期间党员没有哪些权利？", "三个权利要完整。"],
        ["最高处分", "开除党籍是党内的最高处分。", ["开除党籍", "最高处分"], "党内最高处分是什么？", "答案是开除党籍。"],
        ["纪律处分原则", "党组织对违犯党的纪律的党员，应当本着惩前毖后、治病救人的精神处理。", ["惩前毖后", "治病救人"], "纪律处分应坚持什么精神？", "八字短语常考。"]
      ],
      "chapter-8": [
        ["纪委职责", "党的各级纪律检查委员会是党内监督专责机关，履行监督、执纪、问责职责。", ["党内监督专责机关", "监督", "执纪", "问责"], "纪律检查委员会履行哪些职责？", "三项职责要完整。"],
        ["维护党章", "纪律检查机关维护党的章程和其他党内法规。", ["维护党章", "党内法规"], "纪律检查机关维护什么？", "党章和其他党内法规。"],
        ["检查路线执行", "纪律检查机关检查党的路线、方针、政策和决议的执行情况。", ["路线方针政策", "决议", "执行情况"], "纪委检查什么执行情况？", "常与维护党章一起考。"],
        ["协助全面从严治党", "党的纪律检查委员会协助同级党的委员会推进全面从严治党。", ["协助党委", "全面从严治党"], "纪委如何协助党委？", "关键词是协助和全面从严治党。"],
        ["双重领导", "党的地方各级纪律检查委员会受同级党的委员会和上级纪律检查委员会双重领导。", ["同级党委", "上级纪委", "双重领导"], "地方纪委受谁领导？", "双重领导容易漏一个。"],
        ["派驻监督", "党的中央和地方纪律检查委员会向同级党和国家机关全面派驻党的纪律检查组。", ["派驻", "纪律检查组"], "纪委派驻监督如何开展？", "关键词是全面派驻。"]
      ],
      "chapter-9": [
        ["党组作用", "党组发挥领导作用。", ["党组", "领导作用"], "党组发挥什么作用？", "答案很短，注意不是战斗堡垒作用。"],
        ["贯彻路线方针政策", "党组负责贯彻执行党的路线、方针、政策。", ["贯彻执行", "路线方针政策"], "党组的重要任务是什么？", "贯彻执行是关键词。"],
        ["讨论重大问题", "党组讨论和决定本单位重大问题。", ["讨论决定", "重大问题"], "党组讨论决定什么？", "范围是本单位重大问题。"],
        ["干部管理", "党组做好干部管理工作。", ["干部管理"], "党组在干部方面承担什么工作？", "可和第六章干部联系记忆。"],
        ["基层组织关系", "党组指导机关和直属单位党组织的工作。", ["指导", "直属单位党组织"], "党组如何处理与机关党组织关系？", "关键词是指导。"],
        ["设立批准", "党组的设立，应当由批准其设立的党组织决定。", ["设立", "批准"], "党组设立由谁决定？", "不要理解为单位自行决定。"]
      ],
      "chapter-10": [
        ["共青团性质", "中国共产主义青年团是中国共产党领导的先进青年的群团组织。", ["共产党领导", "先进青年", "群团组织"], "共青团的性质是什么？", "不是一般青年组织。"],
        ["助手和后备军", "中国共产主义青年团是党的助手和后备军。", ["助手", "后备军"], "共青团与党的关系是什么？", "助手和后备军常考。"],
        ["党对共青团领导", "党要加强对共青团的领导。", ["加强领导", "共青团"], "党如何对待共青团工作？", "关键词是加强领导。"],
        ["团的建设", "共青团要围绕党的中心任务开展适合青年特点的独立活动。", ["中心任务", "青年特点", "独立活动"], "共青团如何开展工作？", "青年特点是关键词。"],
        ["团干部", "党组织要关心团干部的成长。", ["团干部", "成长"], "党组织如何对待团干部？", "可联系干部培养。"],
        ["先进青年实践", "共青团在实践中学习中国特色社会主义和共产主义。", ["实践", "中国特色社会主义", "共产主义"], "共青团员在实践中学习什么？", "两个学习对象都要记。"]
      ],
      "chapter-11": [
        ["党徽图案", "中国共产党党徽为镰刀和锤头组成的图案。", ["镰刀", "锤头", "党徽"], "党徽由什么组成？", "是锤头，不是锤子。"],
        ["党旗图案", "中国共产党党旗为旗面缀有金黄色党徽图案的红旗。", ["金黄色党徽", "红旗"], "党旗是什么样式？", "颜色和图案都要记。"],
        ["象征标志", "中国共产党的党徽党旗是中国共产党的象征和标志。", ["象征", "标志"], "党徽党旗的地位是什么？", "象征和标志两个词都要有。"],
        ["维护尊严", "党的各级组织和每一个党员都要维护党徽党旗的尊严。", ["维护", "尊严"], "谁要维护党徽党旗尊严？", "主体包括各级组织和每一个党员。"],
        ["制作使用", "党徽党旗要按照规定制作和使用。", ["规定", "制作", "使用"], "党徽党旗如何制作使用？", "按规定制作和使用。"],
        ["党徽党旗纪律", "要在适当范围内使用党徽党旗，禁止随意使用。", ["适当范围", "禁止随意使用"], "党徽党旗使用应注意什么？", "不要随意化、娱乐化使用。"]
      ]
    };
    return Object.entries(data).flatMap(([chapterId, cards]) => {
      const chapter = CHAPTERS.find((item) => item.id === chapterId) || { id: chapterId, name: chapterId };
      return cards.map((item, index) => ({
        id: `card-${chapterId}-${String(index + 1).padStart(3, "0")}`,
        chapterId,
        chapter: chapter.name,
        title: item[0],
        mustRemember: item[1],
        keywords: item[2],
        commonQuestion: item[3],
        mistakeTip: item[4],
        sourceNote: "党章原文整理"
      }));
    });
  }

  function renderChapters() {
    const stats = getStats();
    const weakCount = CHAPTERS.filter((chapter) => {
      const s = chapterStats(chapter.id);
      return s.done > 0 && (s.rate < 70 || s.wrong > 0);
    }).length;
    app.innerHTML = `
      <section class="page-head"><div><h1>章节练习</h1><p>按党章目录顺序复习，章节顺序固定。</p></div></section>
      <section class="overview-strip">
        ${miniStat("题库总量", QUESTIONS.length)}
        ${miniStat("已完成", stats.completed)}
        ${miniStat("综合正确率", `${stats.rate}%`)}
        ${miniStat("薄弱章节", weakCount)}
      </section>
      <section class="chapter-grid">
        ${CHAPTERS.map((chapter) => chapterCard(chapter)).join("")}
      </section>
    `;
    app.querySelectorAll("[data-start-chapter]").forEach((btn) => btn.addEventListener("click", () => startPractice({ mode: "chapter", chapterId: btn.dataset.startChapter })));
    app.querySelectorAll("[data-wrong-chapter]").forEach((btn) => btn.addEventListener("click", () => startPractice({ mode: "wrong", chapterId: btn.dataset.wrongChapter })));
  }

  function renderPractice() {
    if (!state.practice.list.length && state.practice.mode === "order" && !state.practice.filters.chapterId) preparePractice({ mode: "order" });
    const q = currentQuestion();
    app.innerHTML = `
      <section class="page-head">
        <div><h1>练习</h1><p>${modeName(state.practice.mode)} · 第 ${state.practice.index + 1} / ${state.practice.list.length || 0} 题</p></div>
      </section>
      <section class="toolbar card flat">
        ${selectHtml("chapter", "章节", [{ id: "all", name: "全部章节" }, ...CHAPTERS], state.practice.filters.chapterId || "all")}
        ${selectHtml("type", "题型", [{ id: "all", name: "全部题型" }, { id: "single", name: "单选题" }, { id: "blank", name: "填空题" }, { id: "short", name: "简答题" }, { id: "essay", name: "论述题" }], state.practice.filters.type || "all")}
        ${selectHtml("difficulty", "难度", [{ id: "all", name: "全部难度" }, ...unique(QUESTIONS.map((q) => q.difficulty)).map((x) => ({ id: x, name: x }))], state.practice.filters.difficulty || "all")}
        <label>知识点<input id="filter-module" value="${escapeAttr(state.practice.filters.module || "")}" placeholder="输入知识点关键词"></label>
        <button class="primary" id="apply-filter">应用筛选</button>
      </section>
      <section class="practice-layout">
        <div class="card question-card">${q ? renderQuestion(q) : emptyState("当前筛选条件下没有题目", "可以清空筛选条件，或返回章节页选择其他范围。", [["清空筛选", "clear-filter"], ["返回章节页", "chapters"]])}</div>
        <aside class="side-panel">
          <div class="card"><h3>题号跳转</h3><div class="jump-row"><input id="jump-no" type="number" min="1" max="${state.practice.list.length}" placeholder="1-${state.practice.list.length}"><button id="jump-btn">跳转</button></div></div>
          <div class="card"><h3>练习信息</h3><p class="muted">当前范围 ${state.practice.list.length} 题<br>本次进度 ${state.practice.index + 1} / ${state.practice.list.length || 0}</p>${q ? `<p class="muted">${q.chapter}<br>${q.module}<br>${typeName(q.type)} · ${q.difficulty}</p>` : ""}<a class="btn small" href="#/chapters">返回章节页</a></div>
        </aside>
      </section>
    `;
    bindPracticeEvents(q);
    app.querySelectorAll("[data-empty-action]").forEach((btn) => btn.addEventListener("click", () => {
      if (btn.dataset.emptyAction === "clear-filter") { preparePractice({ mode: "order" }); renderPractice(); }
      if (btn.dataset.emptyAction === "chapters") location.hash = "#/chapters";
    }));
  }

  function renderQuestion(q) {
    const record = rec(q.id);
    const feedback = record.completed ? feedbackHtml(q, record) : "";
    return `
      <div class="question-meta">
        <span class="tag">${q.chapter}</span><span class="tag">${q.module}</span><span class="tag">${typeName(q.type)}</span><span class="tag">${q.difficulty}</span>
      </div>
      <h2 class="question-title">${escapeHtml(q.question)}</h2>
      <div id="answer-area">${answerArea(q, record)}</div>
      <div class="question-actions">
        <div><button id="prev-q">上一题</button><button class="primary" id="next-q">下一题</button></div>
        <div><button id="keyword-q">关键词提示</button><button id="answer-q">查看答案</button></div>
        <div><button id="fav-q">${state.progress.favoriteQuestionIds.includes(q.id) ? "取消收藏" : "收藏"}</button><button id="wrong-q">标记错题</button></div>
      </div>
      <div id="wrong-reason-box" class="card flat" ${record.inWrong ? "" : "hidden"}>
        <label>错题原因<input id="wrong-reason" value="${escapeAttr(record.reason || "")}" placeholder="概念混淆 / 数字记错 / 关键词漏背"></label>
        <button id="save-reason">保存原因</button>
      </div>
      <div id="feedback">${feedback}</div>
    `;
  }

  function answerArea(q, record) {
    if (q.type === "single") {
      return `<div class="options">${optionOrder(q).map((option, index) => {
        const cls = record.completed ? (option === q.answer ? "correct" : option === record.selected ? "wrong" : "") : "";
        return `<button class="option ${cls}" data-option="${escapeAttr(option)}" ${record.completed ? "disabled" : ""}><strong>${String.fromCharCode(65 + index)}.</strong><span>${escapeHtml(option)}</span></button>`;
      }).join("")}</div>`;
    }
    if (q.type === "blank") {
      return `<div class="answer-box"><input id="blank-input" value="${escapeAttr(record.value || "")}" ${record.completed ? "disabled" : ""} placeholder="请输入答案"><div class="inline-actions"><button class="primary" id="submit-blank" ${record.completed ? "disabled" : ""}>提交答案</button>${record.completed && !record.ok ? "<button id='manual-ok'>其实我答对了</button>" : ""}</div></div>`;
    }
    return `<div class="answer-box"><textarea id="subjective-input" rows="${q.type === "essay" ? 9 : 6}" placeholder="先默写，再看提示或答案">${escapeHtml(record.value || "")}</textarea><div class="self-check"><button data-self="good" class="${record.level === "good" ? "active" : ""}">我会了</button><button data-self="mid" class="${record.level === "mid" ? "active" : ""}">模糊</button><button data-self="bad" class="${record.level === "bad" ? "active" : ""}">不会</button></div></div>`;
  }

  function bindPracticeEvents(q) {
    const applyFilter = app.querySelector("#apply-filter");
    if (applyFilter) applyFilter.addEventListener("click", () => {
      state.practice.filters = {
        chapterId: app.querySelector("#filter-chapter").value,
        type: app.querySelector("#filter-type").value,
        difficulty: app.querySelector("#filter-difficulty").value,
        module: app.querySelector("#filter-module").value.trim()
      };
      preparePractice({ mode: state.practice.mode, ...state.practice.filters });
      renderPractice();
    });
    bind("#prev-q", () => move(-1));
    bind("#next-q", () => move(1));
    bind("#keyword-q", () => showKeywords(q));
    bind("#answer-q", () => showAnswer(q));
    bind("#fav-q", () => toggleFavorite(q));
    bind("#wrong-q", () => markWrong(q));
    bind("#save-reason", () => saveReason(q));
    bind("#jump-btn", () => jumpTo(Number(app.querySelector("#jump-no").value) - 1));
    if (!q) return;
    app.querySelectorAll("[data-option]").forEach((btn) => btn.addEventListener("click", () => answerSingle(q, btn.dataset.option)));
    bind("#submit-blank", () => answerBlank(q));
    bind("#manual-ok", () => manualCorrect(q));
    app.querySelectorAll("[data-self]").forEach((btn) => btn.addEventListener("click", () => answerSelf(q, btn.dataset.self)));
  }

  function renderExam() {
    if (!state.exam && state.progress.examDraft && !state.progress.examDraft.submitted) state.exam = state.progress.examDraft;
    if (!state.exam || state.exam.submitted) {
      app.innerHTML = `
        <section class="page-head"><div><h1>模拟考试</h1><p>自定义题量和时间，完成后生成报告。</p></div></section>
        <section class="exam-setup">
          <div class="card exam-rules">
            <span class="eyebrow">考试规则</span>
            <h2>按真实复习节奏组卷</h2>
            <ul>
              <li>默认时间 45 分钟，适合一次完整模拟。</li>
              <li>默认单选 20、填空 20、简答 4、论述 1。</li>
              <li>单选和填空自动判分，简答和论述按自评记录。</li>
              <li>答错题会进入错题本，交卷后显示薄弱章节。</li>
            </ul>
          </div>
          <div class="card exam-form">
            <h2>组卷设置</h2>
            <div class="exam-fields">
              <label>单选题数量<input id="exam-single" type="number" value="20" min="0"></label>
              <label>填空题数量<input id="exam-blank" type="number" value="20" min="0"></label>
              <label>简答题数量<input id="exam-short" type="number" value="4" min="0"></label>
              <label>论述题数量<input id="exam-essay" type="number" value="1" min="0"></label>
              <label>考试时间（分钟）<input id="exam-minutes" type="number" value="45" min="5"></label>
            </div>
            <label class="check-line"><input id="exam-priority" type="checkbox"> 优先抽高频题/易错题</label>
            <button class="primary wide" id="start-exam">开始考试</button>
          </div>
        </section>
        ${state.exam && state.exam.submitted ? examReportHtml() : ""}
      `;
      bind("#start-exam", startExam);
      bind("#exam-redo-wrong", () => startPractice({ mode: "wrong" }));
      bind("#exam-again", () => { state.exam = null; renderExam(); });
      return;
    }
    const q = state.exam.questions[state.exam.index];
    if (!q) {
      toastMsg("考试题目为空，请重新设置题量。");
      state.exam = null;
      state.progress.examDraft = null;
      saveProgress();
      renderExam();
      return;
    }
    const done = state.exam.questions.filter((item) => rec(item.id).completed).length;
    app.innerHTML = `
      <section class="exam-top"><div><h1>模拟考试</h1><p>第 ${state.exam.index + 1} / ${state.exam.questions.length} 题 · 已答 ${done} 题</p></div><div class="timer" id="timer">${timeLeft()}</div><button class="danger" id="submit-exam-top">交卷</button></section>
      <section class="exam-layout">
        <div class="card question-card">${renderQuestion(q)}</div>
        <aside class="card"><h3>答题卡</h3><div class="answer-sheet">${state.exam.questions.map((item, i) => `<button data-exam-jump="${i}" class="${rec(item.id).completed ? "done" : ""} ${i === state.exam.index ? "active" : ""}">${i + 1}</button>`).join("")}</div><button class="danger" id="submit-exam">交卷</button></aside>
      </section>
    `;
    bindPracticeEvents(q);
    app.querySelectorAll("[data-exam-jump]").forEach((btn) => btn.addEventListener("click", () => { state.exam.index = Number(btn.dataset.examJump); renderExam(); }));
    bind("#submit-exam", submitExam);
    bind("#submit-exam-top", submitExam);
    tickTimer();
  }

  function renderWrong() {
    renderQuestionListPage("错题本", QUESTIONS.filter((q) => rec(q.id).inWrong), true);
  }

  function renderFavorites() {
    renderQuestionListPage("收藏题", QUESTIONS.filter((q) => state.progress.favoriteQuestionIds.includes(q.id)), false);
  }

  function renderQuestionListPage(title, list, isWrong) {
    const grouped = groupByChapter(list, isWrong);
    const empty = isWrong
      ? emptyState("还没有错题", "完成练习或模拟考试后，答错的题会自动加入错题本。", [["去章节练习", "chapters"], ["去随机刷题", "random"]])
      : emptyState("还没有收藏题", "刷题时点击收藏，可以把重点题加入这里。", [["去练习", "practice"], ["去章节练习", "chapters"]]);
    app.innerHTML = `<section class="page-head"><div><h1>${title}</h1><p>按章节分组，章节顺序固定。</p></div>${isWrong ? "<button id='export-wrong'>导出错题 Markdown</button>" : "<button id='practice-fav'>开始收藏题练习</button>"}</section><section class="list-group">${grouped || empty}</section>`;
    bind("#export-wrong", exportWrongMarkdown);
    bind("#practice-fav", () => startPractice({ mode: "favorite" }));
    app.querySelectorAll("[data-empty-action]").forEach((btn) => btn.addEventListener("click", () => {
      if (btn.dataset.emptyAction === "chapters") location.hash = "#/chapters";
      if (btn.dataset.emptyAction === "random") startPractice({ mode: "random" });
      if (btn.dataset.emptyAction === "practice") startPractice({ mode: "order" });
    }));
    app.querySelectorAll("[data-remove-wrong]").forEach((btn) => btn.addEventListener("click", () => removeWrong(btn.dataset.removeWrong)));
    app.querySelectorAll("[data-unfav]").forEach((btn) => btn.addEventListener("click", () => { removeId(state.progress.favoriteQuestionIds, btn.dataset.unfav); saveProgress(); renderFavorites(); }));
    app.querySelectorAll("[data-practice-id]").forEach((btn) => btn.addEventListener("click", () => startPractice({ mode: "singleQuestion", id: btn.dataset.practiceId })));
  }

  function renderCards() {
    const filter = state.progress.cardFilter || { chapterId: "all", status: "all" };
    const cards = filteredReviewCards();
    if (state.progress.cardStudy && state.progress.cardStudy.active) {
      renderCardStudy(cards);
      return;
    }
    app.innerHTML = `
      <section class="page-head"><div><h1>高频速背</h1><p>按章节整理党章原句、易混数字和主观题关键词。</p></div></section>
      <section class="toolbar card flat review-toolbar">
        ${selectHtml("card-chapter", "章节", [{ id: "all", name: "全部章节" }, ...CHAPTERS], filter.chapterId)}
        ${selectHtml("card-status", "掌握状态", [{ id: "all", name: "全部" }, { id: "open", name: "未掌握" }, { id: "mastered", name: "已掌握" }], filter.status)}
        <label>关键词<input id="filter-card-keyword" value="${escapeAttr(filter.keyword || "")}" placeholder="搜索速背卡"></label>
        <button class="primary" id="apply-card-filter">应用筛选</button>
        <button id="start-card-study">开始背诵</button>
      </section>
      <section class="review-card-grid">${cards.length ? cards.map((card) => reviewCardHtml(card)).join("") : emptyState("没有符合条件的速背卡", "可以切换章节或掌握状态再查看。", [])}</section>
    `;
    bind("#apply-card-filter", () => {
      state.progress.cardFilter = {
        chapterId: app.querySelector("#filter-card-chapter").value,
        status: app.querySelector("#filter-card-status").value,
        keyword: app.querySelector("#filter-card-keyword").value.trim()
      };
      saveProgress();
      renderCards();
    });
    bind("#start-card-study", () => {
      if (!cards.length) return toastMsg("当前筛选条件下没有可背诵的卡片。");
      state.progress.cardStudy = { active: true, index: 0 };
      saveProgress();
      renderCards();
    });
    app.querySelectorAll("[data-review-card]").forEach((btn) => btn.addEventListener("click", () => toggleReviewCard(btn.dataset.reviewCard)));
  }

  function filteredReviewCards() {
    const filter = state.progress.cardFilter || { chapterId: "all", status: "all", keyword: "" };
    const keyword = normalize(filter.keyword || "");
    return REVIEW_CARD_BANK.filter((card) => {
      const mastered = isReviewCardMastered(card.id);
      const text = normalize([card.chapter, card.title, card.mustRemember, card.keywords.join(" "), card.commonQuestion, card.mistakeTip].join(" "));
      return (filter.chapterId === "all" || card.chapterId === filter.chapterId) &&
        (filter.status === "all" || (filter.status === "mastered" ? mastered : !mastered)) &&
        (!keyword || text.includes(keyword));
    });
  }

  function renderCardStudy(cards) {
    if (!cards.length) {
      state.progress.cardStudy = { active: false, index: 0 };
      saveProgress();
      renderCards();
      return;
    }
    const study = state.progress.cardStudy || { active: true, index: 0 };
    study.index = clamp(study.index || 0, 0, cards.length - 1);
    state.progress.cardStudy = study;
    const card = cards[study.index];
    const mastered = isReviewCardMastered(card.id);
    app.innerHTML = `
      <section class="card-study">
        <div class="study-top">
          <div><span class="eyebrow">${card.chapter}</span><h1>${escapeHtml(card.title)}</h1><p>第 ${study.index + 1} / ${cards.length} 张</p></div>
          <button id="back-card-list">返回列表</button>
        </div>
        <article class="study-card card ${mastered ? "mastered" : ""}">
          <section><h3>必背原句</h3><p>${escapeHtml(card.mustRemember)}</p></section>
          <section><h3>关键词</h3><p>${card.keywords.map((kw) => `<mark>${escapeHtml(kw)}</mark>`).join("")}</p></section>
          <section><h3>常见问法</h3><p>${escapeHtml(card.commonQuestion)}</p></section>
          <section><h3>易错提醒</h3><p>${escapeHtml(card.mistakeTip)}</p></section>
        </article>
        <div class="study-actions">
          <button id="prev-card">上一张</button>
          <button id="next-card" class="primary">下一张</button>
          <button id="master-card">${mastered ? "已掌握" : "标记已掌握"}</button>
          <button id="unmaster-card">标记未掌握</button>
          <button id="back-card-list-bottom">返回列表</button>
        </div>
      </section>
    `;
    bind("#prev-card", () => moveStudyCard(-1));
    bind("#next-card", () => moveStudyCard(1));
    bind("#master-card", () => setReviewCardMastered(card.id, true));
    bind("#unmaster-card", () => setReviewCardMastered(card.id, false));
    bind("#back-card-list", exitCardStudy);
    bind("#back-card-list-bottom", exitCardStudy);
    saveProgress();
  }

  function moveStudyCard(delta) {
    const cards = filteredReviewCards();
    const study = state.progress.cardStudy || { active: true, index: 0 };
    const next = (study.index || 0) + delta;
    if (next < 0) return toastMsg("已经是第一张。");
    if (next >= cards.length) return toastMsg("已经是最后一张。");
    state.progress.cardStudy = { active: true, index: next };
    saveProgress();
    renderCards();
  }

  function exitCardStudy() {
    state.progress.cardStudy = { active: false, index: 0 };
    saveProgress();
    renderCards();
  }

  function handleGlobalKeydown(event) {
    if (state.route !== "cards" || !state.progress.cardStudy || !state.progress.cardStudy.active) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); moveStudyCard(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); moveStudyCard(1); }
  }

  function renderSearch() {
    app.innerHTML = `<section class="page-head"><div><h1>搜索题库</h1><p>支持多个关键词，按题干、答案、关键词、章节和解析综合排序。</p></div></section><section class="card search-panel"><input id="search-box" placeholder="例如：党员 义务 / 纪律 / 民主集中制"><p class="muted">搜索结果会高亮关键词，并显示命中位置。</p></section><section id="search-result" class="list-group"></section>`;
    const input = app.querySelector("#search-box");
    let timer = null;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const terms = parseSearchTerms(input.value);
        const result = terms.length ? searchQuestions(terms).slice(0, 80) : [];
        app.querySelector("#search-result").innerHTML = result.length ? result.map((item) => searchResultItem(item, terms)).join("") : emptyState(terms.length ? "没有找到相关题目" : "输入关键词开始搜索", terms.length ? "请尝试更换关键词，例如：党员、义务、纪律、民主集中制。" : "支持按题干、答案、关键词和章节搜索。", []);
        app.querySelectorAll("[data-practice-id]").forEach((btn) => btn.addEventListener("click", () => startPractice({ mode: "singleQuestion", id: btn.dataset.practiceId })));
      }, 180);
    });
    input.focus();
  }

  function renderProfile() {
    const stats = getStats();
    app.innerHTML = `
      <section class="profile-hero card">
        <div class="avatar">${state.session ? escapeHtml((state.session.email || "用").slice(0, 1).toUpperCase()) : "游"}</div>
        <div>
          <span class="eyebrow">${supabase.enabled ? (state.session ? "已登录" : "游客模式") : "本地模式"}</span>
          <h1>${state.session ? escapeHtml(state.session.email) : "游客模式"}</h1>
          <p>${state.session ? `同步状态：${syncStatus.textContent || "已登录"} · 最近同步：${formatTime(state.progress.lastSyncAt)}` : "当前为游客模式，学习记录保存在本设备。登录后可在电脑、手机、平板同步记录。"}</p>
        </div>
        <div class="profile-actions">${state.session ? "<button id='logout'>退出登录</button>" : "<a class='btn primary' href='#/login'>登录/注册</a>"}</div>
      </section>
      <section class="profile-stats">
        ${miniStat("累计练习", stats.completed)}
        ${miniStat("正确率", `${stats.rate}%`)}
        ${miniStat("连续学习", `${stats.streak} 天`)}
        ${miniStat("错题数", stats.wrong)}
        ${miniStat("收藏数", state.progress.favoriteQuestionIds.length)}
      </section>
      <section class="profile-main">
        <div class="card">
          <h2>章节掌握情况</h2>
          <div class="mastery-list">${CHAPTERS.map((chapter) => masteryRow(chapter)).join("")}</div>
        </div>
        <aside class="card data-panel">
          <h2>账号与数据管理</h2>
          <p class="muted">${syncLabel()}</p>
          <div class="data-actions">
            ${state.session ? "<button id='logout-side'>退出登录</button>" : "<a class='btn primary' href='#/login'>登录/注册</a>"}
            <button id="sync-cloud">手动同步</button>
            <button id="pull-cloud">从云端拉取</button>
            <button id="export-progress">导出本地进度 JSON</button>
            <button id="import-progress">导入进度 JSON</button>
            <button class="danger" id="clear-local">清空本地记录</button>
          </div>
          <h3>最近模拟考试</h3>
          ${examRecordsHtml()}
        </aside>
      </section>
    `;
    bind("#logout", logout);
    bind("#logout-side", logout);
    bind("#export-progress", exportProgress);
    bind("#import-progress", () => document.getElementById("import-file").click());
    bind("#sync-cloud", () => syncCloud(true));
    bind("#pull-cloud", () => pullCloudProgress(true));
    bind("#clear-local", clearLocal);
  }

  function renderLogin() {
    if (!supabase.enabled) {
      app.innerHTML = `
        <section class="auth-modal-wrap"><div class="auth-panel card">
          <span class="eyebrow">本地模式</span>
          <h1>账号同步未启用</h1>
          <p class="muted">当前没有配置 Supabase，网站仍可正常刷题，学习记录会保存在本设备浏览器中。</p>
          <p class="muted">登录和注册不是假按钮：它们需要 Supabase Auth。请在 <code>config.js</code> 中填写 Supabase Project URL 和 anon public key，并执行 <code>supabase.sql</code> 后启用。</p>
          <div class="disabled-auth"><button disabled>登录</button><button disabled>注册</button><span>未配置 Supabase，暂不可用</span></div>
          <div class="card-actions"><a class="btn primary" href="#/practice">去练习</a><a class="btn" href="#/profile">返回个人中心</a></div>
        </div></section>
      `;
      return;
    }
    const isRegister = state.authMode === "register";
    app.innerHTML = `
      <section class="auth-modal-wrap">
      <div class="auth-panel card">
        <button class="auth-close" id="auth-close" aria-label="关闭">×</button>
        <span class="eyebrow">账号同步</span>
        <h1>${isRegister ? "注册账号" : "登录账号"}</h1>
        <p class="muted">${isRegister ? "注册后可在不同设备同步学习记录。" : "登录后可在电脑、手机、平板同步学习记录。"}</p>
        <div id="auth-message" class="auth-message" hidden></div>
        <form id="auth-form">
          <label>邮箱<input id="auth-email" type="email" autocomplete="email" required></label>
          <label>密码<input id="auth-password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required></label>
          ${isRegister ? `<label>确认密码<input id="auth-password-confirm" type="password" autocomplete="new-password" required></label>` : ""}
          <button class="primary wide" type="submit" id="${isRegister ? "register-btn" : "login-btn"}">${isRegister ? "注册" : "登录"}</button>
        </form>
        <p class="auth-switch">${isRegister ? "已有账号？" : "还没有账号？"}<button class="link-btn" id="switch-auth">${isRegister ? "去登录" : "去注册"}</button></p>
      </div>
      </section>
    `;
    app.querySelector("#auth-form").addEventListener("submit", (e) => { e.preventDefault(); isRegister ? register() : login(); });
    bind("#switch-auth", () => { state.authMode = isRegister ? "login" : "register"; renderLogin(); });
    bind("#auth-close", () => { location.hash = "#/home"; });
  }

  function preparePractice({ mode = "order", chapterId = "all", type = "all", difficulty = "all", module = "", id = "" } = {}) {
    let list = QUESTIONS.filter((q) => (chapterId === "all" || q.chapterId === chapterId) && (type === "all" || q.type === type) && (difficulty === "all" || q.difficulty === difficulty) && (!module || q.module.includes(module)));
    if (mode === "wrong") list = list.filter((q) => rec(q.id).inWrong);
    if (mode === "favorite") list = list.filter((q) => state.progress.favoriteQuestionIds.includes(q.id));
    if (mode === "random") list = shuffle(list);
    if (mode === "singleQuestion") list = QUESTIONS.filter((q) => q.id === id);
    state.practice = { mode, list, index: 0, filters: { chapterId, type, difficulty, module } };
    state.progress.lastPractice = { mode, chapterId, type, difficulty, module, index: 0 };
    saveProgress();
  }

  function startPractice(options) {
    preparePractice(options);
    location.hash = "#/practice";
  }

  function continuePractice() {
    const last = state.progress.lastPractice || { mode: "order" };
    preparePractice(last);
    state.practice.index = last.index || 0;
    location.hash = "#/practice";
  }

  function currentQuestion() {
    return state.practice.list[state.practice.index];
  }

  function move(delta) {
    if (!state.practice.list.length) return;
    state.practice.index = clamp(state.practice.index + delta, 0, state.practice.list.length - 1);
    state.progress.lastPractice = { ...state.practice.filters, mode: state.practice.mode, index: state.practice.index };
    if (state.exam && !state.exam.submitted) state.exam.index = state.practice.index;
    saveProgress();
    state.route === "exam" ? renderExam() : renderPractice();
  }

  function jumpTo(index) {
    if (!Number.isInteger(index)) return;
    state.practice.index = clamp(index, 0, state.practice.list.length - 1);
    saveProgress();
    renderPractice();
  }

  function answerSingle(q, selected) {
    updateRecord(q, { selected, ok: selected === q.answer, completed: true, lastAnswer: selected, lastResult: selected === q.answer ? "correct" : "wrong" });
    state.route === "exam" ? renderExam() : renderPractice();
  }

  function answerBlank(q) {
    const value = app.querySelector("#blank-input").value;
    const ok = judgeBlank(q, value);
    updateRecord(q, { value, ok, completed: true, lastAnswer: value, lastResult: ok ? "correct" : "wrong" });
    state.route === "exam" ? renderExam() : renderPractice();
  }

  function answerSelf(q, level) {
    const value = app.querySelector("#subjective-input") ? app.querySelector("#subjective-input").value : "";
    updateRecord(q, { value, level, ok: level === "good", completed: true, lastAnswer: value || level, lastResult: level });
    state.route === "exam" ? renderExam() : renderPractice();
  }

  function updateRecord(q, patch) {
    const old = rec(q.id);
    const first = !old.completed;
    const record = { ...old, ...patch, attempts: (old.attempts || 0) + 1, completed: true, updatedAt: new Date().toISOString() };
    if (patch.ok) {
      record.mastered = true;
      record.inWrong = false;
    } else {
      record.mastered = false;
      record.inWrong = true;
      record.wrongCount = (old.wrongCount || 0) + 1;
      record.lastWrongAt = record.updatedAt;
    }
    state.progress.records[q.id] = record;
    state.progress.totalAttempts += 1;
    if (first) {
      addId(state.progress.completedQuestionIds, q.id);
      state.progress.dailyStats[today()] = (state.progress.dailyStats[today()] || 0) + 1;
    }
    record.mastered ? addId(state.progress.masteredQuestionIds, q.id) : removeId(state.progress.masteredQuestionIds, q.id);
    record.inWrong ? addId(state.progress.wrongQuestionIds, q.id) : removeId(state.progress.wrongQuestionIds, q.id);
    state.progress.moduleStats = buildModuleStats();
    addRecent(`${q.chapter} · ${typeName(q.type)} · ${record.mastered ? "正确" : "需复习"}`);
    saveProgress();
    scheduleSync();
    syncQuestionRecord(q, record);
  }

  function feedbackHtml(q, r) {
    const answer = Array.isArray(q.answer) ? q.answer.join("；") : q.answer;
    return `<div class="feedback ${r.ok ? "ok" : "bad"}">
      <section><h3>${r.ok ? "回答正确" : "回答错误"}</h3></section>
      <section><h3>你的答案</h3><p>${escapeHtml(r.lastAnswer || r.selected || r.value || levelText(r.level))}</p></section>
      <section><h3>参考答案</h3><p>${escapeHtml(answer)}</p></section>
      <section><h3>关键词</h3><p>${escapeHtml((q.keywords || []).join("、"))}</p></section>
      <section><h3>解析</h3><p>${escapeHtml(q.explanation || "")}</p></section>
    </div>`;
  }

  function showKeywords(q) {
    setFeedback(`<div class="feedback"><section><h3>关键词提示</h3><p>${escapeHtml((q.keywords || []).join("、") || "暂无关键词，建议先尝试作答。")}</p></section></div>`);
  }

  function showAnswer(q) {
    setFeedback(feedbackHtml(q, { ok: true, lastAnswer: "查看答案" }));
  }

  function setFeedback(html) {
    const box = app.querySelector("#feedback") || app.querySelector("#answer-area");
    if (box) box.insertAdjacentHTML("afterend", html);
  }

  function toggleFavorite(q) {
    state.progress.favoriteQuestionIds.includes(q.id) ? removeId(state.progress.favoriteQuestionIds, q.id) : addId(state.progress.favoriteQuestionIds, q.id);
    saveProgress();
    scheduleSync();
    syncQuestionRecord(q, rec(q.id));
    rerenderCurrentView();
  }

  function markWrong(q) {
    const r = rec(q.id);
    state.progress.records[q.id] = { ...r, completed: true, inWrong: true, mastered: false, wrongCount: (r.wrongCount || 0) + 1, lastWrongAt: new Date().toISOString() };
    addId(state.progress.wrongQuestionIds, q.id);
    removeId(state.progress.masteredQuestionIds, q.id);
    saveProgress();
    scheduleSync();
    rerenderCurrentView();
  }

  function saveReason(q) {
    const input = app.querySelector("#wrong-reason");
    if (!input) return;
    state.progress.records[q.id] = { ...rec(q.id), reason: input.value.trim() };
    saveProgress();
    scheduleSync();
    toastMsg("错题原因已保存");
  }

  function manualCorrect(q) {
    updateRecord(q, { ok: true, completed: true, lastResult: "correct", lastAnswer: rec(q.id).value || "" });
    rerenderCurrentView();
  }

  function startExam() {
    const getNum = (id) => {
      const value = Number(app.querySelector(id).value);
      return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    };
    const priority = Boolean(app.querySelector("#exam-priority").checked);
    const source = priority ? QUESTIONS.filter((q) => ["高频", "易错", "原句填空"].includes(q.difficulty)) : QUESTIONS;
    const needs = { single: getNum("#exam-single"), blank: getNum("#exam-blank"), short: getNum("#exam-short"), essay: getNum("#exam-essay") };
    if (!Object.values(needs).some((count) => count > 0)) {
      toastMsg("请至少设置一种题型的数量。");
      return;
    }
    const shortage = [];
    const pick = (type, count) => {
      const pool = shuffle(source.filter((q) => q.type === type));
      if (pool.length < count) shortage.push(`${typeName(type)}最多 ${pool.length} 道`);
      return take(pool, Math.min(count, pool.length));
    };
    const questions = [...pick("single", needs.single), ...pick("blank", needs.blank), ...pick("short", needs.short), ...pick("essay", needs.essay)];
    if (!questions.length) {
      toastMsg("当前条件下没有可抽取的题目，请调整题型或取消优先高频。");
      return;
    }
    if (shortage.length) toastMsg(`题量不足，已按可用数量组卷：${shortage.join("，")}。`);
    state.exam = {
      questions,
      index: 0,
      endAt: Date.now() + Math.max(5, getNum("#exam-minutes")) * 60000,
      submitted: false
    };
    state.practice = { mode: "exam", list: state.exam.questions, index: 0, filters: {} };
    state.progress.examDraft = state.exam;
    saveProgress();
    renderExam();
  }

  function submitExam() {
    state.exam.submitted = true;
    const objective = state.exam.questions.filter((q) => ["single", "blank"].includes(q.type));
    const correct = objective.filter((q) => rec(q.id).ok).length;
    const record = { at: new Date().toISOString(), total: state.exam.questions.length, objective: objective.length, score: correct };
    state.progress.examRecords.unshift(record);
    state.progress.examRecords = state.progress.examRecords.slice(0, 10);
    state.progress.examDraft = null;
    saveProgress();
    scheduleSync();
    syncExamRecord(record);
    renderExam();
  }

  function examReportHtml() {
    const objective = state.exam.questions.filter((q) => ["single", "blank"].includes(q.type));
    const correct = objective.filter((q) => rec(q.id).ok).length;
    const rate = objective.length ? Math.round(correct / objective.length * 100) : 0;
    const weak = getStats().weakChapters.slice(0, 3).map((x) => x.chapter).join("、") || "暂无明显薄弱章节";
    const wrong = state.exam.questions.filter((q) => rec(q.id).inWrong);
    return `<section class="exam-report card">
      <span class="eyebrow">考试报告</span>
      <h2>客观题 ${correct} / ${objective.length}</h2>
      <div class="mini-stats">${miniStat("正确率", `${rate}%`)}${miniStat("错题", `${wrong.length} 道`)}${miniStat("薄弱章节", escapeHtml(weak))}</div>
      <div class="report-list">
        <h3>错题列表</h3>
        ${wrong.length ? wrong.slice(0, 8).map((q) => `<p>${typeName(q.type)} · ${q.chapter} · ${escapeHtml(q.question)}</p>`).join("") : "<p class='muted'>本次考试没有新增错题。</p>"}
      </div>
      <p class="muted">下一步建议：先复习薄弱章节，再进入错题本集中处理反复出错的题。</p>
      <div class="card-actions"><button class="primary" id="exam-redo-wrong">重做错题</button><button id="exam-again">再来一套</button><a class="btn" href="#/home">返回首页</a></div>
    </section>`;
  }

  function tickTimer() {
    if (!state.exam || state.exam.submitted) return;
    const el = app.querySelector("#timer");
    const left = Math.max(0, state.exam.endAt - Date.now());
    if (el) el.textContent = formatDuration(left);
    if (left <= 0) submitExam();
    else setTimeout(() => state.route === "exam" && tickTimer(), 1000);
  }

  function groupByChapterHtml(list, wrongMode) {
    return CHAPTERS.map((chapter) => {
      const items = list.filter((q) => q.chapterId === chapter.id);
      if (!items.length) return "";
      return `<details open><summary>${chapter.name}（${items.length}）</summary>${items.map((q) => listItem(q, wrongMode)).join("")}</details>`;
    }).join("");
  }

  function listItem(q, wrongMode) {
    const r = rec(q.id);
    const answer = Array.isArray(q.answer) ? q.answer.join("；") : q.answer;
    return `<article class="list-item"><strong>${escapeHtml(q.question)}</strong><p>${typeName(q.type)} · ${q.chapter} · ${q.module}</p><p>答案：${escapeHtml(answer)}</p>${wrongMode ? `<p>最近错误：${formatTime(r.lastWrongAt)} · 错误次数：${r.wrongCount || 0} · 原因：${escapeHtml(r.reason || "未填写")}</p>` : ""}<div class="card-actions"><button data-practice-id="${q.id}">练习本题</button>${wrongMode ? `<button data-remove-wrong="${q.id}">移出错题本</button>` : `<button data-unfav="${q.id}">取消收藏</button>`}</div></article>`;
  }

  function parseSearchTerms(value) {
    return unique(String(value || "").trim().split(/\s+/).map((item) => item.trim()).filter(Boolean));
  }

  function searchQuestions(terms) {
    return QUESTIONS.map((q) => {
      const fields = {
        question: q.question || "",
        answer: Array.isArray(q.answer) ? q.answer.join(" ") : String(q.answer || ""),
        keywords: (q.keywords || []).join(" "),
        module: q.module || "",
        explanation: q.explanation || "",
        chapter: q.chapter || "",
        type: typeName(q.type)
      };
      const hitFields = new Set();
      let score = 0;
      terms.forEach((term) => {
        const n = normalize(term);
        if (normalize(fields.question).includes(n)) { score += 100; hitFields.add("题干"); }
        if (normalize(fields.answer).includes(n)) { score += 80; hitFields.add("答案"); }
        if (normalize(fields.keywords).includes(n)) { score += 75; hitFields.add("关键词"); }
        if (normalize(fields.module).includes(n)) { score += 55; hitFields.add("知识点"); }
        if (normalize(fields.explanation).includes(n)) { score += 35; hitFields.add("解析"); }
        if (normalize(fields.chapter).includes(n)) { score += 20; hitFields.add("章节"); }
        if (normalize(fields.type).includes(n)) { score += 10; hitFields.add("题型"); }
      });
      const allText = normalize(Object.values(fields).join(" "));
      const matchedTerms = terms.filter((term) => allText.includes(normalize(term))).length;
      if (matchedTerms > 1) score += matchedTerms * 40;
      return { q, score, hitFields: [...hitFields] };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  }

  function searchResultItem(item, terms) {
    const q = item.q;
    return `<article class="list-item search-item">
      <strong>${highlightText(q.question, terms)}</strong>
      <p>${typeName(q.type)} · ${highlightText(q.chapter, terms)} · ${highlightText(q.module, terms)}</p>
      <p class="muted">命中：${item.hitFields.join(" / ") || "综合内容"} · 相关度 ${item.score}</p>
      <div class="card-actions"><button data-practice-id="${q.id}">练习本题</button></div>
    </article>`;
  }

  function highlightText(value, terms) {
    let html = escapeHtml(value || "");
    terms.filter(Boolean).forEach((term) => {
      const escaped = escapeRegExp(escapeHtml(term));
      html = html.replace(new RegExp(escaped, "gi"), (match) => `<mark>${match}</mark>`);
    });
    return html;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function groupByChapter(list, wrongMode) {
    return groupByChapterHtml(list, wrongMode);
  }

  function removeWrong(id) {
    state.progress.records[id] = { ...rec(id), inWrong: false, mastered: true };
    removeId(state.progress.wrongQuestionIds, id);
    addId(state.progress.masteredQuestionIds, id);
    saveProgress();
    renderWrong();
  }

  function rerenderCurrentView() {
    if (state.route === "exam") renderExam();
    else if (state.route === "wrong") renderWrong();
    else if (state.route === "favorites") renderFavorites();
    else renderPractice();
  }

  function reviewCardHtml(card) {
    const mastered = isReviewCardMastered(card.id);
    return `<article class="review-card-v2 card ${mastered ? "mastered" : ""}">
      <div class="review-card-head"><span>${card.chapter}</span><span class="card-status-pill">${mastered ? "已掌握" : "未掌握"}</span></div>
      <h2>${escapeHtml(card.title)}</h2>
      <section><h3>必背原句</h3><p>${escapeHtml(card.mustRemember)}</p></section>
      <section><h3>关键词</h3><p>${card.keywords.map((kw) => `<mark>${escapeHtml(kw)}</mark>`).join("")}</p></section>
      <section><h3>常见问法</h3><p>${escapeHtml(card.commonQuestion)}</p></section>
      <section><h3>易错提醒</h3><p>${escapeHtml(card.mistakeTip)}</p></section>
      <button class="small ${mastered ? "" : "primary"}" data-review-card="${card.id}">${mastered ? "标记未掌握" : "标记已掌握"}</button>
    </article>`;
  }

  function toggleReviewCard(id) {
    setReviewCardMastered(id, !isReviewCardMastered(id));
  }

  function isReviewCardMastered(id) {
    return (state.progress.masteredCardIds || state.progress.masteredCards || []).includes(id);
  }

  function setReviewCardMastered(id, mastered) {
    state.progress.masteredCardIds = state.progress.masteredCardIds || state.progress.masteredCards || [];
    if (mastered) addId(state.progress.masteredCardIds, id);
    else removeId(state.progress.masteredCardIds, id);
    state.progress.masteredCards = state.progress.masteredCardIds;
    saveProgress();
    renderCards();
  }

  function chapterCard(chapter) {
    const list = QUESTIONS.filter((q) => q.chapterId === chapter.id);
    const stats = chapterStats(chapter.id);
    const byType = countBy(list, "type");
    const progress = Math.round((stats.done / Math.max(list.length, 1)) * 100);
    const status = stats.done ? `已完成 ${stats.done} 题` : "未开始";
    return `<article class="chapter-card card ${stats.done ? "started" : ""}">
      <div class="chapter-top"><span class="chapter-no">${chapter.order}</span><span class="chapter-status">${status}</span></div>
      <h2>${chapter.name}</h2>
      <div class="chapter-meta"><span>总题 ${list.length}</span><span>单选 ${byType.single || 0}</span><span>填空 ${byType.blank || 0}</span><span>简答 ${byType.short || 0}</span><span>论述 ${byType.essay || 0}</span></div>
      <div><div class="progress-bar"><span style="width:${progress}%"></span></div><p class="muted">完成度 ${progress}% · 正确率 ${stats.rate}% · 错题 ${stats.wrong}</p></div>
      <div class="card-actions"><button class="primary" data-start-chapter="${chapter.id}">开始练习</button><button data-wrong-chapter="${chapter.id}">本章错题</button></div>
    </article>`;
  }

  function getStats() {
    const completed = state.progress.completedQuestionIds.length;
    const mastered = state.progress.masteredQuestionIds.length;
    const weakChapters = CHAPTERS.map((chapter) => ({ chapter: chapter.name, ...chapterStats(chapter.id) })).filter((item) => item.done >= 3 && (item.rate < 70 || item.wrong > 0)).sort((a, b) => b.wrong - a.wrong || a.rate - b.rate);
    return {
      today: state.progress.dailyStats[today()] || 0,
      completed,
      rate: completed ? Math.round(mastered / completed * 100) : 0,
      wrong: state.progress.wrongQuestionIds.length,
      streak: calcStreak(),
      weakChapters
    };
  }

  function chapterStats(chapterId) {
    const list = QUESTIONS.filter((q) => q.chapterId === chapterId);
    const done = list.filter((q) => rec(q.id).completed).length;
    const correct = list.filter((q) => rec(q.id).mastered).length;
    const wrong = list.filter((q) => rec(q.id).inWrong).length;
    return { done, correct, wrong, rate: done ? Math.round(correct / done * 100) : 0 };
  }

  function masteryHtml() {
    return `<div class="grid">${CHAPTERS.map((chapter) => {
      const s = chapterStats(chapter.id);
      return `<div><strong>${chapter.name}</strong><div class="progress-bar"><span style="width:${s.rate}%"></span></div><p class="muted">完成 ${s.done} · 正确率 ${s.rate}% · 错题 ${s.wrong}</p></div>`;
    }).join("")}</div>`;
  }

  function masteryRow(chapter) {
    const s = chapterStats(chapter.id);
    const total = QUESTIONS.filter((q) => q.chapterId === chapter.id).length;
    const progress = Math.round((s.done / Math.max(total, 1)) * 100);
    return `<div class="mastery-row">
      <strong>${chapter.name}</strong>
      <span>完成 ${s.done}/${total}</span>
      <span>正确率 ${s.rate}%</span>
      <span>错题 ${s.wrong}</span>
      <div class="progress-bar"><span style="width:${progress}%"></span></div>
    </div>`;
  }

  function weakList(list) {
    return list.length ? list.slice(0, 3).map((item) => `<p>${item.chapter}：正确率 ${item.rate}% ，错题 ${item.wrong} 道</p>`).join("") : "<p class='muted'>暂无薄弱章节。</p>";
  }

  function examRecordsHtml() {
    return state.progress.examRecords.length ? state.progress.examRecords.map((r) => `<p class="muted">${formatTime(r.at)} · 客观题 ${r.score}/${r.objective}</p>`).join("") : "<p class='muted'>暂无考试记录。</p>";
  }

  function statCard(label, value) {
    return `<div class="card stat-card"><strong>${value}</strong><span>${label}</span></div>`;
  }

  function miniStat(label, value) {
    return `<div class="mini-stat"><strong>${value}</strong><span>${label}</span></div>`;
  }

  function featureCard(code, title, desc, action, recommended = false) {
    return `<article class="feature-card">
      <span class="feature-code">${code}</span>
      <h3>${title}</h3>
      <p>${desc}</p>
      <button class="${recommended ? "primary" : ""}" data-action="${action}">进入</button>
    </article>`;
  }

  function pathStep(index, title, desc) {
    return `<article class="path-step"><span>${index}</span><h3>${title}</h3><p>${desc}</p></article>`;
  }

  function chapterPreview(chapter) {
    const list = QUESTIONS.filter((q) => q.chapterId === chapter.id);
    const stats = chapterStats(chapter.id);
    return `<article class="chapter-mini">
      <div><strong>${chapter.name}</strong><span>${list.length} 题</span></div>
      <div class="progress-bar"><span style="width:${stats.rate}%"></span></div>
      <p>完成 ${stats.done} · 正确率 ${stats.rate}%</p>
      <button class="small" data-action="chapters">进入</button>
    </article>`;
  }

  function emptyInline(title, desc) {
    return `<div class="empty-inline"><strong>${title}</strong><p>${desc}</p></div>`;
  }

  function emptyState(title, desc, actions = []) {
    return `<div class="empty-state">
      <div class="empty-mark">—</div>
      <h2>${title}</h2>
      <p>${desc}</p>
      <div class="card-actions">${actions.map(([label, action], index) => `<button class="${index === 0 ? "primary" : ""}" data-empty-action="${action}">${label}</button>`).join("")}</div>
    </div>`;
  }

  function quick(title, desc, action) {
    return `<div class="card quick-card"><div><h3>${title}</h3><p>${desc}</p></div><button class="primary" data-action="${action}">进入</button></div>`;
  }

  function selectHtml(name, label, options, value) {
    return `<label>${label}<select id="filter-${name}">${options.map((item) => `<option value="${item.id}" ${item.id === value ? "selected" : ""}>${item.name}</option>`).join("")}</select></label>`;
  }

  function optionOrder(q) {
    if (!state.optionOrders[q.id]) state.optionOrders[q.id] = shuffle(q.options || []);
    return state.optionOrders[q.id];
  }

  function judgeBlank(q, value) {
    const text = normalize(value);
    const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
    const keywords = q.keywords && q.keywords.length ? q.keywords : answers;
    return answers.every((answer) => text.includes(normalize(answer))) || keywords.every((keyword) => text.includes(normalize(keyword)));
  }

  function exportWrongMarkdown() {
    const wrong = QUESTIONS.filter((q) => rec(q.id).inWrong);
    const md = wrong.length ? wrong.map((q, i) => {
      const r = rec(q.id);
      return `## ${i + 1}. ${q.chapter} / ${q.module}\n\n${q.question}\n\n- 答案：${Array.isArray(q.answer) ? q.answer.join("；") : q.answer}\n- 最近错误：${formatTime(r.lastWrongAt)}\n- 错误次数：${r.wrongCount || 0}\n- 原因：${r.reason || "未填写"}\n`;
    }).join("\n") : "暂无错题。";
    downloadText("wrong-questions.md", md);
  }

  function exportProgress() {
    downloadText("dangzhang-progress.json", JSON.stringify({ version: APP_VERSION, progress: state.progress }, null, 2));
  }

  function importProgressFile() {
    const file = document.getElementById("import-file").files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        state.progress = mergeProgress(data.progress || data);
        saveProgress();
        toastMsg("导入成功");
        renderRoute();
      } catch {
        toastMsg("导入失败，请检查 JSON 文件");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function clearLocal() {
    if (!confirm("确定清空本地记录吗？")) return;
    state.progress = defaultProgress();
    saveProgress();
    renderRoute();
  }

  function addRecent(text) {
    state.progress.recent.unshift(`${formatTime(new Date().toISOString())} · ${text}`);
    state.progress.recent = state.progress.recent.slice(0, 10);
  }

  function buildModuleStats(progress = state.progress) {
    const stats = {};
    QUESTIONS.forEach((q) => {
      const r = (progress.records || {})[q.id];
      if (!r || !r.completed) return;
      const key = `${q.chapterId || "outline"}::${q.module || "综合考点"}`;
      if (!stats[key]) {
        stats[key] = {
          chapterId: q.chapterId || "outline",
          chapter: q.chapter || "总纲",
          module: q.module || "综合考点",
          completed: 0,
          correct: 0,
          wrong: 0
        };
      }
      stats[key].completed += 1;
      if (r.ok || r.mastered) stats[key].correct += 1;
      if (r.inWrong) stats[key].wrong += 1;
      stats[key].rate = Math.round((stats[key].correct / stats[key].completed) * 100);
    });
    return stats;
  }

  function rec(id) {
    return state.progress.records[id] || {};
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function calcStreak() {
    const days = Object.keys(state.progress.dailyStats).sort().reverse();
    let count = 0;
    let date = new Date(today());
    while (days.includes(date.toISOString().slice(0, 10))) {
      count += 1;
      date.setDate(date.getDate() - 1);
    }
    return count;
  }

  function defaultProgress() {
    return { totalAttempts: 0, completedQuestionIds: [], masteredQuestionIds: [], wrongQuestionIds: [], favoriteQuestionIds: [], dailyStats: {}, moduleStats: {}, records: {}, recent: [], examRecords: [], examDraft: null, masteredCards: [], masteredCardIds: [], cardFilter: { chapterId: "all", status: "all", keyword: "" }, cardStudy: { active: false, index: 0 }, onlyUnmasteredCards: false };
  }

  function loadLocalProgress() {
    try {
      return mergeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch {
      return defaultProgress();
    }
  }

  function mergeProgress(progress) {
    const base = defaultProgress();
    const cardIds = progress.masteredCardIds || progress.masteredCards || [];
    const merged = { ...base, ...progress, records: progress.records || {}, dailyStats: progress.dailyStats || {}, moduleStats: progress.moduleStats || {}, recent: progress.recent || [], examRecords: progress.examRecords || [], masteredCards: cardIds, masteredCardIds: cardIds, cardFilter: progress.cardFilter || base.cardFilter, cardStudy: progress.cardStudy || base.cardStudy };
    merged.moduleStats = Object.keys(merged.moduleStats).length ? merged.moduleStats : buildModuleStats(merged);
    return merged;
  }

  function mergeStudyProgress(cloudProgress, localProgress) {
    const cloud = mergeProgress(cloudProgress || {});
    const local = mergeProgress(localProgress || {});
    const merged = mergeProgress({ ...cloud, ...local });
    ["completedQuestionIds", "masteredQuestionIds", "wrongQuestionIds", "favoriteQuestionIds", "masteredCards"].forEach((key) => {
      merged[key] = [...new Set([...(cloud[key] || []), ...(local[key] || [])])];
    });
    merged.records = { ...cloud.records, ...local.records };
    merged.dailyStats = { ...cloud.dailyStats };
    Object.entries(local.dailyStats || {}).forEach(([day, count]) => {
      merged.dailyStats[day] = Math.max(merged.dailyStats[day] || 0, count || 0);
    });
    merged.examRecords = [...(local.examRecords || []), ...(cloud.examRecords || [])].slice(0, 20);
    merged.recent = [...(local.recent || []), ...(cloud.recent || [])].slice(0, 10);
    merged.totalAttempts = Math.max(cloud.totalAttempts || 0, local.totalAttempts || 0);
    merged.moduleStats = buildModuleStats(merged);
    return merged;
  }

  function saveProgress() {
    state.progress.moduleStats = buildModuleStats();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    scheduleSync();
  }

  function createSupabaseClient() {
    const cfg = window.APP_CONFIG || {};
    const placeholder = `${cfg.SUPABASE_URL || ""}${cfg.SUPABASE_ANON_KEY || ""}`;
    const enabled = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/[填请]/.test(placeholder));
    const headers = (token) => ({ apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${token || cfg.SUPABASE_ANON_KEY}`, "Content-Type": "application/json" });
    return { enabled, url: cfg.SUPABASE_URL, key: cfg.SUPABASE_ANON_KEY, headers };
  }

  function loadSession() {
    try { return JSON.parse(localStorage.getItem("dangzhang-session") || "null"); } catch { return null; }
  }

  function saveSession(session) {
    state.session = session;
    localStorage.setItem("dangzhang-session", JSON.stringify(session));
    refreshAuthStatus();
  }

  function refreshAuthStatus() {
    if (!supabase.enabled) {
      syncStatus.textContent = "本地模式";
      authEntry.textContent = "登录/注册";
      authEntry.href = "#/login";
      return;
    }
    if (state.session) {
      syncStatus.textContent = "已登录";
      authEntry.textContent = state.session.email || "个人中心";
      authEntry.href = "#/profile";
    } else {
      syncStatus.textContent = "游客模式";
      authEntry.textContent = "登录/注册";
      authEntry.href = "#/login";
    }
  }

  function syncLabel() {
    if (!supabase.enabled) return "当前为本地模式，学习记录仅保存在本设备。";
    return state.session ? `已登录：${state.session.email}` : "游客模式：登录后可同步学习记录。";
  }

  async function login() {
    if (!supabase.enabled) return toastMsg("未配置 Supabase，当前只能使用游客模式。");
    const email = app.querySelector("#auth-email").value.trim();
    const password = app.querySelector("#auth-password").value;
    if (!email) return setAuthMessage("邮箱不能为空。", "bad");
    if (!password) return setAuthMessage("密码不能为空。", "bad");
    setAuthMessage("正在登录...", "info");
    setAuthBusy(true);
    try {
      const res = await fetch(`${supabase.url}/auth/v1/token?grant_type=password`, { method: "POST", headers: supabase.headers(), body: JSON.stringify({ email, password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setAuthMessage(data.error_description || data.msg || data.message || "登录失败，请检查邮箱和密码。", "bad");
      saveSession({ access_token: data.access_token, refresh_token: data.refresh_token, user_id: data.user.id, email: data.user.email });
      await upsertProfile();
      await pullCloudProgress(true);
      setAuthMessage("登录成功，正在进入个人中心。", "ok");
      location.hash = "#/profile";
    } catch (error) {
      setAuthMessage(`登录失败：${error.message || "网络请求异常"}`, "bad");
    } finally {
      setAuthBusy(false);
    }
  }

  async function register() {
    if (!supabase.enabled) return toastMsg("未配置 Supabase，无法注册。");
    const email = app.querySelector("#auth-email").value.trim();
    const password = app.querySelector("#auth-password").value;
    const confirm = app.querySelector("#auth-password-confirm").value;
    if (!email) return setAuthMessage("邮箱不能为空。", "bad");
    if (!password) return setAuthMessage("密码不能为空。", "bad");
    if (password.length < 6) return setAuthMessage("密码至少 6 位。", "bad");
    if (password !== confirm) return setAuthMessage("两次输入的密码不一致。", "bad");
    setAuthMessage("正在注册...", "info");
    setAuthBusy(true);
    try {
      const res = await fetch(`${supabase.url}/auth/v1/signup`, { method: "POST", headers: supabase.headers(), body: JSON.stringify({ email, password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setAuthMessage(data.error_description || data.msg || data.message || "注册失败，请检查邮箱和密码。", "bad");
      if (data.session && data.user) {
        saveSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, user_id: data.user.id, email: data.user.email });
        await upsertProfile();
        await syncCloud(false);
        setAuthMessage("注册成功，已自动登录。", "ok");
        location.hash = "#/profile";
      } else {
        setAuthMessage("注册成功，请前往邮箱点击确认链接后再登录。", "ok");
        state.authMode = "login";
        setTimeout(() => renderLogin(), 1200);
      }
    } catch (error) {
      setAuthMessage(`注册失败：${error.message || "网络请求异常"}`, "bad");
    } finally {
      setAuthBusy(false);
    }
  }

  function setAuthMessage(message, type) {
    const box = app.querySelector("#auth-message");
    if (!box) return toastMsg(message);
    box.hidden = false;
    box.className = `auth-message ${type || "info"}`;
    box.textContent = message;
  }

  function setAuthBusy(busy) {
    ["#login-btn", "#register-btn", "#switch-auth"].forEach((selector) => {
      const btn = app.querySelector(selector);
      if (btn) btn.disabled = busy;
    });
  }

  async function upsertProfile() {
    if (!supabase.enabled || !state.session) return;
    const body = { id: state.session.user_id, email: state.session.email, nickname: state.session.email.split("@")[0] };
    await fetch(`${supabase.url}/rest/v1/profiles?on_conflict=id`, {
      method: "POST",
      headers: { ...supabase.headers(state.session.access_token), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(body)
    }).catch(() => {});
  }

  async function logout() {
    if (supabase.enabled && state.session) {
      fetch(`${supabase.url}/auth/v1/logout`, {
        method: "POST",
        headers: supabase.headers(state.session.access_token)
      }).catch(() => {});
    }
    localStorage.removeItem("dangzhang-session");
    state.session = null;
    refreshAuthStatus();
    renderRoute();
  }

  async function pullCloudProgress(promptMerge) {
    if (!supabase.enabled || !state.session) return;
    syncStatus.textContent = "同步中";
    try {
      const res = await fetch(`${supabase.url}/rest/v1/user_progress?user_id=eq.${state.session.user_id}&select=progress`, { headers: supabase.headers(state.session.access_token) });
      const rows = await res.json();
      if (rows[0] && rows[0].progress) {
        if (!promptMerge) {
          state.progress = mergeStudyProgress(rows[0].progress, state.progress);
        } else {
          const choice = prompt("检测到云端记录，请输入处理方式：1 合并本地和云端；2 使用云端记录；3 用本地记录覆盖云端。", "1");
          if (choice === "2") state.progress = mergeProgress(rows[0].progress);
          else if (choice === "3") await syncCloud(false);
          else state.progress = mergeStudyProgress(rows[0].progress, state.progress);
        }
        saveProgress();
      }
      state.progress.lastSyncAt = new Date().toISOString();
      syncStatus.textContent = "已同步";
      saveProgress();
    } catch {
      syncStatus.textContent = "同步失败";
    }
  }

  function scheduleSync() {
    if (!supabase.enabled || !state.session) return;
    clearTimeout(state.syncTimer);
    state.syncTimer = setTimeout(() => syncCloud(false), 1200);
  }

  async function syncCloud(showMessage) {
    if (!supabase.enabled || !state.session) return toastMsg("当前为本地模式，未配置云同步。");
    syncStatus.textContent = "同步中";
    try {
      const body = { user_id: state.session.user_id, progress: state.progress, updated_at: new Date().toISOString() };
      const res = await fetch(`${supabase.url}/rest/v1/user_progress?on_conflict=user_id`, { method: "POST", headers: { ...supabase.headers(state.session.access_token), Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(body) });
      if (res.ok) state.progress.lastSyncAt = new Date().toISOString();
      syncStatus.textContent = res.ok ? "已同步" : "同步失败";
      if (res.ok) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
      if (showMessage) toastMsg(res.ok ? "已同步到云端" : "同步失败");
    } catch {
      syncStatus.textContent = "同步失败";
      if (showMessage) toastMsg("同步失败，稍后重试");
    }
  }

  async function syncQuestionRecord(q, record) {
    if (!supabase.enabled || !state.session) return;
    const body = {
      user_id: state.session.user_id,
      question_id: q.id,
      status: record.inWrong ? "wrong" : record.mastered ? "mastered" : "completed",
      wrong_count: record.wrongCount || 0,
      favorite: state.progress.favoriteQuestionIds.includes(q.id),
      last_answer: record.lastAnswer || record.value || record.selected || "",
      last_result: record.lastResult || "",
      reason: record.reason || "",
      updated_at: new Date().toISOString()
    };
    fetch(`${supabase.url}/rest/v1/question_records?on_conflict=user_id,question_id`, {
      method: "POST",
      headers: { ...supabase.headers(state.session.access_token), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(body)
    }).catch(() => {});
  }

  async function syncExamRecord(record) {
    if (!supabase.enabled || !state.session) return;
    const body = { user_id: state.session.user_id, exam_data: record, score: record.score, created_at: record.at };
    fetch(`${supabase.url}/rest/v1/exam_records`, {
      method: "POST",
      headers: supabase.headers(state.session.access_token),
      body: JSON.stringify(body)
    }).catch(() => {});
  }

  function bind(selector, handler) {
    const el = app.querySelector(selector);
    if (el) el.addEventListener("click", handler);
  }

  function addId(list, id) { if (!list.includes(id)) list.push(id); }
  function removeId(list, id) { const i = list.indexOf(id); if (i >= 0) list.splice(i, 1); }
  function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }
  function take(list, count) { return list.slice(0, Math.min(count, list.length)); }
  function shuffle(list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function unique(list) { return [...new Set(list.filter(Boolean))]; }
  function countBy(list, key) { return list.reduce((a, item) => (a[item[key]] = (a[item[key]] || 0) + 1, a), {}); }
  function normalize(value) { return String(value).replace(/[，,；;、。\s]/g, "").toLowerCase(); }
  function typeName(type) { return { single: "单选题", blank: "填空题", short: "简答题", essay: "论述题" }[type] || type; }
  function modeName(mode) { return { order: "顺序练习", random: "随机练习", chapter: "章节练习", wrong: "错题练习", favorite: "收藏练习", exam: "模拟考试", singleQuestion: "单题练习" }[mode] || mode; }
  function levelText(level) { return { good: "我会了", mid: "模糊", bad: "不会" }[level] || "未自评"; }
  function formatTime(value) { return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "暂无"; }
  function formatDuration(ms) { const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000); return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#096;"); }
  function downloadText(filename, text) { const blob = new Blob([text], { type: "text/plain;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href); }
  function toastMsg(message) { toast.textContent = message; toast.hidden = false; setTimeout(() => toast.hidden = true, 2200); }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register("service-worker.js").then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) document.getElementById("update-toast").hidden = false;
        });
      });
    }).catch(() => {});
  }
}());
