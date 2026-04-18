const http = require("http");

const PORT = 5188;
const BACKEND_HOST = process.env.BACKEND_HOST || "127.0.0.1";
const BACKEND_PORT = process.env.BACKEND_PORT || "8010";
const API_BASE = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

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
  <title>观数知财（米白金主题）</title>
  <style>
    :root{
      --bg:#efe6d6;
      --bg-soft:#e8dcc7;
      --line:#c9b189;
      --text:#3b3326;
      --dim:#6f6047;
      --primary:#b8914d;
      --primary-strong:#9f7938;
      --accent-green:#97a97c;
      --accent-rose:#c99f84;
      --card:#f9f1e4;
    }
    *{box-sizing:border-box}
    body{margin:0;font-family:Inter,system-ui,Segoe UI,Roboto,PingFang SC,Microsoft YaHei,sans-serif;background:radial-gradient(circle at top right,#dfc79a 0,var(--bg) 48%);color:var(--text);background-image:radial-gradient(circle at top right,#dfc79a 0,#efe6d6 46%),radial-gradient(circle at 15% 85%,rgba(151,169,124,.18) 0,rgba(151,169,124,0) 35%),radial-gradient(circle at 85% 70%,rgba(201,159,132,.14) 0,rgba(201,159,132,0) 30%)}
    a{text-decoration:none;color:inherit}
    .wrap{width:min(1180px,92%);margin:0 auto}
    .nav{position:sticky;top:0;z-index:20;background:rgba(249,241,228,.95);backdrop-filter:blur(6px);border-bottom:1px solid var(--line)}
    .nav-inner{height:64px;display:flex;align-items:center;justify-content:space-between}
        .brand{font-weight:800;letter-spacing:.5px;color:#6a5631}
        .menu{display:flex;gap:20px;color:#867454;font-size:14px}
        .status{display:flex;align-items:center;gap:8px;font-size:12px;color:#6f6047}
        .card-head{display:flex;align-items:center;justify-content:space-between;gap:12px}

        .dot{width:10px;height:10px;border-radius:999px;background:#9aa08f;display:inline-block}
        .dot.ok{background:#2f9e44}.dot.bad{background:#d9480f}.dot.warn{background:#e0a800}


    .hero{margin:18px 0;padding:22px;border:1px solid var(--line);border-radius:14px;background:linear-gradient(140deg,#f6eddf,#ead8bc);display:grid;grid-template-columns:1.2fr 1fr;gap:16px;box-shadow:0 8px 24px rgba(92,67,26,.18)}
    .kicker{margin:0;color:#a18247;font-size:12px;letter-spacing:1.2px}
    h1{margin:8px 0 10px;font-size:clamp(28px,5vw,40px);color:#5d4a28}
    .dynamic-title{color:#5d4a28;letter-spacing:.5px;text-shadow:0 1px 0 rgba(255,255,255,.35);animation:titleFloat 3.2s ease-in-out infinite}
    .dynamic-title::after{content:" ✨";color:#a18247;animation:sparkle 1.6s ease-in-out infinite}
    @keyframes titleFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes sparkle{0%,100%{opacity:.35}50%{opacity:1}}
    .desc{margin:0;color:#66583f;line-height:1.7}
    .metric{display:grid;gap:10px}
    .metric .box{padding:12px;border-radius:10px;border:1px solid var(--line);background:linear-gradient(135deg,#f2e6d1,#eee2ce)}
    .metric span{font-size:12px;color:#8c7751}
    .metric b{display:block;margin-top:4px;color:#5b4b2f}

    .grid{display:grid;grid-template-columns:1.15fr 1fr;gap:18px;margin-bottom:24px}
    .card{background:linear-gradient(180deg,#f9f1e4,#f4e8d2);border:1px solid var(--line);border-radius:14px;padding:16px;min-height:460px;box-shadow:0 8px 24px rgba(92,67,26,.16)}
    .title{margin:0;font-size:18px;color:#5b4b2f}
    .sub{margin:7px 0 0;color:var(--dim);font-size:13px;line-height:1.6}

    .chat-window{margin-top:12px;border:1px solid var(--line);background:var(--bg-soft);border-radius:12px;min-height:280px;max-height:350px;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
    .msg{max-width:84%;padding:10px 12px;border-radius:10px;border:1px solid transparent}
    .msg .role{font-size:11px;opacity:.75;margin-bottom:4px;display:block}
    .msg p{margin:0;line-height:1.6;font-size:14px}
    .assistant{background:linear-gradient(180deg,#efe2c9,#e8d8bd);border-color:#cdb38a}
    .user{margin-left:auto;background:linear-gradient(180deg,#e2c793,#d9ba82);border-color:#b8914d}

    .chat-input{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px}
    .chat-input input{height:42px;border:1px solid var(--line);border-radius:10px;background:#f8f1e4;color:var(--text);padding:0 12px;outline:none}
    .chat-input button{height:42px;border:1px solid #b48a3c;border-radius:10px;background:linear-gradient(180deg,#dcc08c,#c8a45a);color:#4e3d1f;padding:0 16px;cursor:pointer;font-weight:600}

    .toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;font-size:12px;color:var(--dim)}
    .toolbar button{border:1px solid #b99756;background:#efe0bf;color:#4e3d1f;border-radius:8px;height:32px;padding:0 10px;cursor:pointer}

    .list{margin-top:10px;display:grid;gap:10px}
    .item{border:1px solid var(--line);background:linear-gradient(135deg,#f3e8d5,#ecddc5);border-radius:10px;padding:12px;display:grid;grid-template-columns:1fr auto;gap:10px}
    .item h3{margin:0;font-size:15px;color:#5b4b2f}
    .item p{margin:6px 0 4px;color:#6f6045;font-size:13px}
    .item small{color:#8e7c5d;font-size:12px}
    .item a{border:1px solid #b48a3c;border-radius:8px;padding:8px 10px;font-size:13px;align-self:center;background:#e8d5ad;color:#4e3d1f}

    .footer{border-top:1px solid var(--line);background:#ede2ce}
    .footer .wrap{min-height:64px;display:flex;align-items:center;justify-content:space-between;color:#827457;font-size:12px;gap:12px;flex-wrap:wrap}

    @media (max-width:960px){.grid,.hero{grid-template-columns:1fr}}
    @media (max-width:780px){.menu{display:none}.item{grid-template-columns:1fr}}
  </style>
</head>
<body>
        <header class="nav"><div class="wrap nav-inner"><div class="brand">观数知财</div><nav class="menu"><a href="#hero">首页</a><a href="#ai">AI 助手</a><a href="#reports">财报速览</a></nav></div></header>


  <main class="wrap">
    <section class="hero" id="hero"><div><p class="kicker">FINANCE · ANALYTICS · AI</p><h1 id="dynamicTitle" class="dynamic-title">观数知财</h1><p class="desc">聚焦企业财报、经营质量与估值信号，用数据结构化你的投资研究流程。让 AI 协助你更快形成分析观点。💰</p></div><div class="metric"><div class="box"><span>追踪企业</span><b>1,240+</b></div><div class="box"><span>财报更新能力</span><b>可扩展至实时推送</b></div><div class="box"><span>AI 分析助手</span><b>已预留 API Service 层</b></div></div></section>
    <section class="grid">
            <article class="card" id="ai"><div class="card-head"><h2 class="title">AI Assistant 对话区</h2><div class="status"><span id="statusDot" class="dot warn"></span><span id="statusText">后端检测中...</span></div></div><p class="sub">前端交互已完成，未来可直接接入真实模型接口。</p><div id="chatWindow" class="chat-window"></div><div class="chat-input"><input id="chatInput" placeholder="例如：这家公司现金流风险如何？" /><button id="sendBtn">发送</button></div></article>

      <article class="card" id="reports"><h2 class="title">最新财报链接</h2><p class="sub">财报数据来自 mock 数据源；已预留“实时更新”扩展能力。</p><div class="toolbar"><span id="reportMeta">条目：0</span><div><label><input id="autoRefresh" type="checkbox" checked /> 自动刷新</label><button id="reloadBtn">手动刷新</button></div></div><div id="reportList" class="list"></div></article>
    </section>
  </main>
  <footer class="footer"><div class="wrap"><div>© <span id="year"></span> 观数知财 · Data to Wealth Insight</div><div>仅供研究演示，不构成投资建议</div></div></footer>
<script>
    const API_BASE=${JSON.stringify(API_BASE)};
    const HEALTH_READY_URL=API_BASE+"/health/ready";

  const reportService={async fetchLatestReports(){await sleep(250);return [...window.__MOCK_REPORTS__].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));}};
  const aiService={async ask(message){
    const resp=await fetch(API_BASE+"/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message})});
    const data=await resp.json();
    if(!resp.ok){
      const detail=(data&&data.detail)?data.detail:"调用后端接口失败";
      throw new Error(detail);
    }
    return{role:"assistant",content:data.reply||"(空回复)",time:now()};
  }};

  window.__MOCK_REPORTS__=${JSON.stringify(mockReports)};
  const state={messages:[{role:"assistant",content:"你好，我是你的财务分析助手。你可以问我：盈利能力、估值、风险点或财报解读。",time:now()}],autoRefresh:true,reportTimer:null};
  document.getElementById("year").textContent=new Date().getFullYear();
    startDynamicTitle();
  bindEvents();renderChat();loadReports();startReportAutoRefresh();
  checkBackendStatus();
  setInterval(checkBackendStatus,15000);

  function bindEvents(){document.getElementById("sendBtn").addEventListener("click",sendMessage);document.getElementById("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter")sendMessage();});document.getElementById("reloadBtn").addEventListener("click",loadReports);document.getElementById("autoRefresh").addEventListener("change",e=>{state.autoRefresh=e.target.checked;state.autoRefresh?startReportAutoRefresh():stopReportAutoRefresh();});}
    async function sendMessage(){const inputEl=document.getElementById("chatInput");const sendBtn=document.getElementById("sendBtn");const text=inputEl.value.trim();if(!text)return;state.messages.push({role:"user",content:text,time:now()});inputEl.value="";renderChat();sendBtn.disabled=true;sendBtn.textContent="思考中...";try{const reply=await aiService.ask(text,state.messages);state.messages.push(reply);}catch(err){state.messages.push({role:"assistant",content:"后端调用失败："+String(err.message||err),time:now()});}finally{renderChat();sendBtn.disabled=false;sendBtn.textContent="发送";}}

  function renderChat(){const box=document.getElementById("chatWindow");box.innerHTML=state.messages.map(m=>'<div class="msg '+(m.role==="user"?"user":"assistant")+'"><span class="role">'+(m.role==="user"?"你":"AI")+' · '+m.time+'</span><p>'+escapeHtml(m.content)+'</p></div>').join("");box.scrollTop=box.scrollHeight;}
  async function loadReports(){const listEl=document.getElementById("reportList");const metaEl=document.getElementById("reportMeta");listEl.innerHTML='<div style="color:#8c7751;border:1px dashed #d7c09a;border-radius:10px;padding:16px;text-align:center;">加载中...</div>';const reports=await reportService.fetchLatestReports();metaEl.textContent="条目："+reports.length+(reports[0]?(" ｜ 最近更新："+reports[0].publishedAt):"");if(!reports.length){listEl.innerHTML='<div style="color:#8c7751;border:1px dashed #d7c09a;border-radius:10px;padding:16px;text-align:center;">暂无财报数据</div>';return;}listEl.innerHTML=reports.map(r=>'<article class="item"><div><h3>'+escapeHtml(r.title)+'</h3><p>'+escapeHtml(r.company)+' · '+escapeHtml(r.period)+' · '+escapeHtml(r.type)+'</p><small>发布时间：'+escapeHtml(r.publishedAt)+' ｜ 来源：'+escapeHtml(r.source)+'</small></div><a href="'+r.url+'" target="_blank" rel="noreferrer">查看文件</a></article>').join("");}
  function startReportAutoRefresh(){stopReportAutoRefresh();if(!state.autoRefresh)return;state.reportTimer=setInterval(loadReports,10000);}function stopReportAutoRefresh(){if(state.reportTimer){clearInterval(state.reportTimer);state.reportTimer=null;}}
  function startDynamicTitle(){
    const el=document.getElementById("dynamicTitle");
    if(!el)return;
    el.textContent="观数知财";
    document.title="观数知财｜米白金主题";
  }
    async function checkBackendStatus(){
    const dot=document.getElementById("statusDot");
    const text=document.getElementById("statusText");
    if(!dot||!text) return;
    dot.className="dot warn";
    text.textContent="后端检测中...";
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),5000);
    try{
      const resp=await fetch(HEALTH_READY_URL,{signal:controller.signal});
      const data=await resp.json();
      if(resp.ok&&data.ok){dot.className="dot ok";text.textContent="后端正常";}
      else{dot.className="dot bad";text.textContent="后端异常："+(data.error_code||"NOT_READY");}
    }catch(err){
      dot.className="dot bad";
      text.textContent="后端不可达";
    }finally{clearTimeout(timer);}
  }
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
  console.log(`观数知财（米白金主题）已启动: http://localhost:${PORT}`);
  console.log("请访问：http://127.0.0.1:" + PORT);
  console.log(`前端将调用后端：${API_BASE}`);
});
