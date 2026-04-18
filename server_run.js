const http = require("http");

const PORT = 5173;

const mockReports = [
  {
    id: "r1",
    title: "2026 Q1 财务报告",
    company: "华辰科技",
    period: "2026Q1",
    type: "季报",
    source: "企业公告",
    publishedAt: "2026-04-17 09:30",
    url: "https://example.com/reports/huachen-2026q1.pdf"
  },
  {
    id: "r2",
    title: "2025 年度报告",
    company: "远望医疗",
    period: "2025FY",
    type: "年报",
    source: "交易所披露",
    publishedAt: "2026-04-16 14:20",
    url: "https://example.com/reports/yuanwang-2025fy.pdf"
  },
  {
    id: "r3",
    title: "2026 Q1 业绩快报",
    company: "鼎合能源",
    period: "2026Q1",
    type: "业绩快报",
    source: "公司新闻稿",
    publishedAt: "2026-04-15 17:10",
    url: "https://example.com/reports/dinghe-2026q1-flash.pdf"
  }
];

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>观数知财</title>
  <style>
    :root{--bg:#0b1220;--line:#263a59;--text:#e7eefc;--dim:#9bb0d3}
    *{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,Segoe UI,Roboto,PingFang SC,Microsoft YaHei,sans-serif;background:radial-gradient(circle at top right,#162a47 0,var(--bg) 45%);color:var(--text)}a{text-decoration:none;color:inherit}
    .wrap{width:min(1180px,92%);margin:0 auto}.nav{position:sticky;top:0;z-index:20;background:rgba(10,17,30,.75);backdrop-filter:blur(6px);border-bottom:1px solid #22324f}.nav-inner{height:64px;display:flex;align-items:center;justify-content:space-between}.brand{font-weight:800}.menu{display:flex;gap:20px;color:#c4d6f5;font-size:14px}.cta{border:1px solid #345c90;padding:8px 12px;border-radius:10px;background:linear-gradient(180deg,#1d3a60,#162e4c);font-size:13px}
    .hero{margin:18px 0;padding:22px;border:1px solid var(--line);border-radius:14px;background:linear-gradient(140deg,rgba(22,38,60,.95),rgba(13,22,37,.95));display:grid;grid-template-columns:1.2fr 1fr;gap:16px}.kicker{margin:0;color:#8fb8ff;font-size:12px;letter-spacing:1.2px}h1{margin:8px 0 10px;font-size:clamp(28px,5vw,40px)}.desc{margin:0;color:#c8d7f2;line-height:1.7}
    .metric{display:grid;gap:10px}.metric .box{padding:12px;border-radius:10px;border:1px solid #2b4367;background:rgba(20,36,58,.9)}.metric span{font-size:12px;color:#95add2}.metric b{display:block;margin-top:4px}
    .grid{display:grid;grid-template-columns:1.15fr 1fr;gap:18px;margin-bottom:24px}.card{background:linear-gradient(180deg,rgba(19,33,54,.92),rgba(12,22,38,.92));border:1px solid var(--line);border-radius:14px;padding:16px;min-height:460px}.title{margin:0;font-size:18px}.sub{margin:7px 0 0;color:var(--dim);font-size:13px;line-height:1.6}
    .chat-window{margin-top:12px;border:1px solid #24405f;background:#0d182a;border-radius:12px;min-height:280px;max-height:350px;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}.msg{max-width:84%;padding:10px 12px;border-radius:10px;border:1px solid transparent}.msg .role{font-size:11px;opacity:.75;margin-bottom:4px;display:block}.msg p{margin:0;line-height:1.6;font-size:14px}.assistant{background:#16283f;border-color:#274062}.user{margin-left:auto;background:#1d3353;border-color:#2f507e}
    .chat-input{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px}.chat-input input{height:42px;border:1px solid #2a4366;border-radius:10px;background:#0c1626;color:#eff4ff;padding:0 12px;outline:none}.chat-input button{height:42px;border:1px solid #2f6da8;border-radius:10px;background:linear-gradient(180deg,#2870b0,#1e5585);color:#eff4ff;padding:0 16px;cursor:pointer}
    .toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;font-size:12px;color:var(--dim)}.toolbar button{border:1px solid #355a8d;background:#183255;color:#e7f0ff;border-radius:8px;height:32px;padding:0 10px;cursor:pointer}
    .list{margin-top:10px;display:grid;gap:10px}.item{border:1px solid #24405f;background:rgba(15,28,45,.9);border-radius:10px;padding:12px;display:grid;grid-template-columns:1fr auto;gap:10px}.item h3{margin:0;font-size:15px}.item p{margin:6px 0 4px;color:#c7d7f2;font-size:13px}.item small{color:#96abd0;font-size:12px}.item a{border:1px solid #2f6da8;border-radius:8px;padding:8px 10px;font-size:13px;align-self:center}
    .footer{border-top:1px solid #22324f;background:rgba(10,17,30,.8)}.footer .wrap{min-height:64px;display:flex;align-items:center;justify-content:space-between;color:#9db0d1;font-size:12px;gap:12px;flex-wrap:wrap}
    @media (max-width:960px){.grid,.hero{grid-template-columns:1fr}}@media (max-width:780px){.menu{display:none}.item{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header class="nav"><div class="wrap nav-inner"><div class="brand">观数知财</div><nav class="menu"><a href="#hero">首页</a><a href="#ai">AI 助手</a><a href="#reports">财报速览</a></nav><button class="cta">专业版咨询 💰</button></div></header>
  <main class="wrap">
    <section class="hero" id="hero"><div><p class="kicker">FINANCE · ANALYTICS · AI</p><h1>观数知财</h1><p class="desc">聚焦企业财报、经营质量与估值信号，用数据结构化你的投资研究流程。让 AI 协助你更快形成分析观点。💰</p></div><div class="metric"><div class="box"><span>追踪企业</span><b>1,240+</b></div><div class="box"><span>财报更新能力</span><b>可扩展至实时推送</b></div><div class="box"><span>AI 分析助手</span><b>已预留 API Service 层</b></div></div></section>
    <section class="grid">
      <article class="card" id="ai"><h2 class="title">AI Assistant 对话区</h2><p class="sub">前端交互已完成，未来可直接接入真实模型接口。</p><div id="chatWindow" class="chat-window"></div><div class="chat-input"><input id="chatInput" placeholder="例如：这家公司现金流风险如何？" /><button id="sendBtn">发送</button></div></article>
      <article class="card" id="reports"><h2 class="title">最新财报链接</h2><p class="sub">财报数据来自 mock 数据源；已预留“实时更新”扩展能力。</p><div class="toolbar"><span id="reportMeta">条目：0</span><div><label><input id="autoRefresh" type="checkbox" checked /> 自动刷新</label><button id="reloadBtn">手动刷新</button></div></div><div id="reportList" class="list"></div></article>
    </section>
  </main>
  <footer class="footer"><div class="wrap"><div>© <span id="year"></span> 观数知财 · Data to Wealth Insight</div><div>仅供研究演示，不构成投资建议</div></div></footer>
<script>
  const reportService={async fetchLatestReports(){await sleep(250);return [...window.__MOCK_REPORTS__].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));}};
  const aiService={async ask(message){await sleep(500);let reply="已收到你的问题。当前为前端演示模式，后续可接入真实 AI 接口，返回更精准分析。💰";if(message.includes("风险"))reply="建议重点看：经营现金流、应收账款周转、债务期限结构与行业景气度。";if(message.includes("估值")||message.toUpperCase().includes("PE"))reply="可先做 PE/PB 同业分位比较，再叠加利润增速与 ROE 验证估值合理性。";return{role:"assistant",content:reply,time:now()};}};
  window.__MOCK_REPORTS__=${JSON.stringify(mockReports)};
  const state={messages:[{role:"assistant",content:"你好，我是你的财务分析助手。你可以问我：盈利能力、估值、风险点或财报解读。",time:now()}],autoRefresh:true,reportTimer:null};
  document.getElementById("year").textContent=new Date().getFullYear();
  bindEvents();renderChat();loadReports();startReportAutoRefresh();
  function bindEvents(){document.getElementById("sendBtn").addEventListener("click",sendMessage);document.getElementById("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter")sendMessage();});document.getElementById("reloadBtn").addEventListener("click",loadReports);document.getElementById("autoRefresh").addEventListener("change",e=>{state.autoRefresh=e.target.checked;state.autoRefresh?startReportAutoRefresh():stopReportAutoRefresh();});}
  async function sendMessage(){const inputEl=document.getElementById("chatInput");const sendBtn=document.getElementById("sendBtn");const text=inputEl.value.trim();if(!text)return;state.messages.push({role:"user",content:text,time:now()});inputEl.value="";renderChat();sendBtn.disabled=true;sendBtn.textContent="分析中...";try{const reply=await aiService.ask(text,state.messages);state.messages.push(reply);renderChat();}finally{sendBtn.disabled=false;sendBtn.textContent="发送";}}
  function renderChat(){const box=document.getElementById("chatWindow");box.innerHTML=state.messages.map(m=>`<div class="msg ${m.role==="user"?"user":"assistant"}"><span class="role">${m.role==="user"?"你":"AI"} · ${m.time}</span><p>${escapeHtml(m.content)}</p></div>`).join("");box.scrollTop=box.scrollHeight;}
  async function loadReports(){const listEl=document.getElementById("reportList");const metaEl=document.getElementById("reportMeta");listEl.innerHTML='<div style="color:#9db2d3;border:1px dashed #2e476b;border-radius:10px;padding:16px;text-align:center;">加载中...</div>';const reports=await reportService.fetchLatestReports();metaEl.textContent="条目："+reports.length+(reports[0]?(" ｜ 最近更新："+reports[0].publishedAt):"");if(!reports.length){listEl.innerHTML='<div style="color:#9db2d3;border:1px dashed #2e476b;border-radius:10px;padding:16px;text-align:center;">暂无财报数据</div>';return;}listEl.innerHTML=reports.map(r=>`<article class="item"><div><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.company)} · ${escapeHtml(r.period)} · ${escapeHtml(r.type)}</p><small>发布时间：${escapeHtml(r.publishedAt)} ｜ 来源：${escapeHtml(r.source)}</small></div><a href="${r.url}" target="_blank" rel="noreferrer">查看文件</a></article>`).join("");}
  function startReportAutoRefresh(){stopReportAutoRefresh();if(!state.autoRefresh)return;state.reportTimer=setInterval(loadReports,10000);}function stopReportAutoRefresh(){if(state.reportTimer){clearInterval(state.reportTimer);state.reportTimer=null;}}
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}function now(){return new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"});}function escapeHtml(str){return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`观数知财 前端已启动: http://localhost:${PORT}`);
});
