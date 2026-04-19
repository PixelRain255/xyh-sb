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
  <link rel="icon" type="image/png" href="https://q1.qlogo.cn/g?b=qq&nk=3063208613&s=640" />

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
        .status-clickable{position:relative;cursor:pointer;user-select:none}
        .status-clickable::after{content:attr(data-tip);position:absolute;top:125%;right:0;white-space:nowrap;background:#5e4d2f;color:#fff7e6;padding:4px 8px;border-radius:6px;font-size:11px;opacity:0;pointer-events:none;transform:translateY(-2px);transition:opacity .15s ease,transform .15s ease}
        .status-clickable:hover::after{opacity:1;transform:translateY(0)}
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
        .msg .content{margin:0;line-height:1.6;font-size:14px;word-break:break-word}
    .msg .content p{margin:0 0 8px}
    .msg .content p:last-child{margin-bottom:0}
    .msg .content pre{margin:8px 0;padding:10px;border-radius:8px;background:rgba(78,61,31,.08);overflow:auto}
    .msg .content code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;background:rgba(78,61,31,.08);padding:1px 4px;border-radius:4px}
    .msg .content pre code{background:transparent;padding:0}
    .msg .content a{text-decoration:underline}
    .typing-cursor{display:inline-block;width:8px;height:1em;background:#7a6642;margin-left:2px;vertical-align:-2px;border-radius:1px;animation:blinkCursor 1s steps(1,end) infinite}
    @keyframes blinkCursor{0%,49%{opacity:1}50%,100%{opacity:0}}

    .assistant{background:linear-gradient(180deg,#efe2c9,#e8d8bd);border-color:#cdb38a}
    .user{margin-left:auto;background:linear-gradient(180deg,#e2c793,#d9ba82);border-color:#b8914d}

    .chat-input{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px}
    .chat-input input{height:42px;border:1px solid var(--line);border-radius:10px;background:#f8f1e4;color:var(--text);padding:0 12px;outline:none}
        .chat-input button{height:42px;border:1px solid #b48a3c;border-radius:10px;background:linear-gradient(180deg,#dcc08c,#c8a45a);color:#4e3d1f;padding:0 16px;cursor:pointer;font-weight:600;transition:all .18s ease}
        .chat-input button.thinking{background:linear-gradient(180deg,#e2c98f,#d0ad66);border-color:#bc944a}
                .chat-input button.thinking.stop-hover{background:linear-gradient(180deg,#f16d6d,#d94848);border-color:#b93838;color:#fff3f3}

        .chat-input button.stop-cooldown{background:linear-gradient(180deg,#c8c8c8,#a6a6a6);border-color:#8a8a8a;color:#2f2f2f;cursor:not-allowed}




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
                        <article class="card" id="ai"><div class="card-head"><h2 class="title">AI Assistant 对话区</h2><div id="statusWrap" class="status status-clickable" data-tip="是否刷新健康状态？"><span id="statusDot" class="dot warn"></span><span id="statusText">后端检测中...</span></div></div><p class="sub">前端交互已完成，未来可直接接入真实模型接口。</p><div id="chatWindow" class="chat-window"></div><div class="chat-input"><input id="chatInput" placeholder="例如：这家公司现金流风险如何？" /><button id="sendBtn">发送</button></div></article>


      <article class="card" id="reports"><h2 class="title">最新财报链接</h2><p class="sub">财报数据来自 mock 数据源；已预留“实时更新”扩展能力。</p><div class="toolbar"><span id="reportMeta">条目：0</span><div><label><input id="autoRefresh" type="checkbox" checked /> 自动刷新</label><button id="reloadBtn">手动刷新</button></div></div><div id="reportList" class="list"></div></article>
    </section>
  </main>
  <footer class="footer"><div class="wrap"><div>© <span id="year"></span> 观数知财 · Data to Wealth Insight</div><div>仅供研究演示，不构成投资建议</div></div></footer>
<script>
        const API_BASE=${JSON.stringify(API_BASE)};
    const HEALTH_URL=API_BASE+"/health";
    const HEALTH_READY_URL=API_BASE+"/health/ready";


  const reportService={async fetchLatestReports(){await sleep(250);return [...window.__MOCK_REPORTS__].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));}};
                const aiService={async askOnce(message,signal){
    const resp=await fetch(API_BASE+"/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message}),signal});

    let data=null;
    try{data=await resp.json();}catch(_){/* ignore */}
    if(!resp.ok){
      const detail=(data&&data.detail)?data.detail:"调用后端接口失败";
      throw new Error(detail);
    }
    return String((data&&data.reply)?data.reply:"(空回复)");
  },
    async askStream(message,onDelta,signal){
    const resp=await fetch(API_BASE+"/chat/stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message}),signal});

    if(!resp.ok){
      let detail="调用后端接口失败";
      try{
        const data=await resp.json();
        detail=(data&&data.detail)?data.detail:detail;
      }catch(_){
        try{detail=await resp.text();}catch(__){}
      }
      throw new Error(detail);
    }
    if(!resp.body){
      throw new Error("浏览器不支持流式响应");
    }

    const reader=resp.body.getReader();
    const decoder=new TextDecoder("utf-8");
    let buffer="";
    let fullText="";

    const processEvent=(rawEvent)=>{
            const lines=rawEvent.split(/\\r?\\n/);

      const payloadText=lines.filter(line=>line.startsWith("data:")).map(line=>line.slice(5).trim()).join("\\n");

      if(!payloadText) return false;

      let payload;
      try{payload=JSON.parse(payloadText);}catch(_){return false;}

      if(payload.type==="delta"){
        const piece=String(payload.text||"");
        fullText+=piece;
        onDelta(fullText,piece);
        return false;
      }
      if(payload.type==="error"){
        throw new Error(payload.message||"流式调用失败");
      }
      if(payload.type==="done"){
        return true;
      }
      return false;
    };

    while(true){
      const {value,done}=await reader.read();
      if(value){
        buffer+=decoder.decode(value,{stream:!done});
      }

            const parts=buffer.split(/\\r?\\n\\r?\\n/);

      buffer=parts.pop()||"";

      for(const rawEvent of parts){
        if(processEvent(rawEvent)) return fullText||"(空回复)";
      }

      if(done) break;
    }

    if(buffer.trim()) processEvent(buffer);
    return fullText||"(空回复)";
  }};



  window.__MOCK_REPORTS__=${JSON.stringify(mockReports)};
        const state={messages:[{role:"assistant",content:"你好，我是你的财务分析助手。你可以问我：盈利能力、估值、风险点或财报解读。",time:now()}],autoRefresh:true,reportTimer:null,generating:false,abortController:null,stopping:false,stopTimer:null};


  document.getElementById("year").textContent=new Date().getFullYear();
    startDynamicTitle();
  bindEvents();renderChat();loadReports();startReportAutoRefresh();
    checkBackendStatus();
  setInterval(checkBackendStatus,120000);


        function bindEvents(){const sendBtn=document.getElementById("sendBtn");sendBtn.addEventListener("click",sendMessage);sendBtn.addEventListener("mouseenter",onSendBtnMouseEnter);sendBtn.addEventListener("mouseleave",onSendBtnMouseLeave);const statusWrap=document.getElementById("statusWrap");if(statusWrap){statusWrap.addEventListener("click",()=>checkBackendStatus(true));}document.getElementById("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter")sendMessage();});document.getElementById("reloadBtn").addEventListener("click",loadReports);document.getElementById("autoRefresh").addEventListener("change",e=>{state.autoRefresh=e.target.checked;state.autoRefresh?startReportAutoRefresh():stopReportAutoRefresh();});}


                                                                async function sendMessage(){const inputEl=document.getElementById("chatInput");if(state.stopping)return;if(state.generating){if(state.abortController){state.stopping=true;updateSendButton();state.abortController.abort();}return;}const text=inputEl.value.trim();if(!text)return;const sendBtn=document.getElementById("sendBtn");state.messages.push({role:"user",content:text,time:now()});inputEl.value="";const assistantMsg={role:"assistant",content:"",time:now()};state.messages.push(assistantMsg);state.generating=true;state.abortController=new AbortController();updateSendButton();renderChat();const controller=state.abortController;try{const finalText=await aiService.askStream(text,(accText)=>{assistantMsg.content=accText||"正在思考";renderChat();},controller.signal);assistantMsg.content=finalText||"(空回复)";}catch(err){const aborted=controller.signal.aborted||String((err&&err.message)||err).includes("AbortError");if(!aborted){try{const fallbackText=await aiService.askOnce(text,controller.signal);assistantMsg.content=fallbackText||"(空回复)";}catch(err2){assistantMsg.content="后端调用失败："+String((err2&&err2.message)||err2||err.message||err);}}}finally{state.generating=false;state.abortController=null;if(state.stopping){if(state.stopTimer)clearTimeout(state.stopTimer);state.stopTimer=setTimeout(()=>{state.stopping=false;state.stopTimer=null;updateSendButton();},800);}else{updateSendButton();}renderChat();}}



        function updateSendButton(){const sendBtn=document.getElementById("sendBtn");if(!sendBtn)return;if(state.stopping){sendBtn.classList.add("thinking");sendBtn.classList.remove("stop-hover");sendBtn.classList.add("stop-cooldown");sendBtn.textContent="停止中...";sendBtn.disabled=true;return;}sendBtn.classList.remove("stop-cooldown");if(state.generating){sendBtn.classList.add("thinking");sendBtn.classList.remove("stop-hover");sendBtn.textContent="正在思考";sendBtn.disabled=false;}else{sendBtn.classList.remove("thinking");sendBtn.classList.remove("stop-hover");sendBtn.textContent="发送";sendBtn.disabled=false;}}


    function onSendBtnMouseEnter(){const sendBtn=document.getElementById("sendBtn");if(!sendBtn||!state.generating||state.stopping)return;sendBtn.classList.add("stop-hover");sendBtn.textContent="停止生成";}
  function onSendBtnMouseLeave(){const sendBtn=document.getElementById("sendBtn");if(!sendBtn||!state.generating||state.stopping)return;sendBtn.classList.remove("stop-hover");sendBtn.textContent="正在思考";}





    function renderChat(){const box=document.getElementById("chatWindow");box.innerHTML=state.messages.map((m,idx)=>{const isUser=m.role==="user";const roleLabel=isUser?"你":"AI";const isCurrentThinking=!isUser&&state.generating&&idx===state.messages.length-1&&!String(m.content||"").trim();const displayContent=isCurrentThinking?"正在思考":m.content;const bodyHtml=isUser?escapeHtml(displayContent).replaceAll("\\n","<br>"):renderMarkdown(displayContent);const cursorHtml=(!isUser&&state.generating&&idx===state.messages.length-1)?'<span class="typing-cursor" aria-hidden="true"></span>':'';return '<div class="msg '+(isUser?"user":"assistant")+'"><span class="role">'+roleLabel+' · '+m.time+'</span><div class="content">'+bodyHtml+cursorHtml+'</div></div>';}).join("");box.scrollTop=box.scrollHeight;}

  async function loadReports(){const listEl=document.getElementById("reportList");const metaEl=document.getElementById("reportMeta");listEl.innerHTML='<div style="color:#8c7751;border:1px dashed #d7c09a;border-radius:10px;padding:16px;text-align:center;">加载中...</div>';const reports=await reportService.fetchLatestReports();metaEl.textContent="条目："+reports.length+(reports[0]?(" ｜ 最近更新："+reports[0].publishedAt):"");if(!reports.length){listEl.innerHTML='<div style="color:#8c7751;border:1px dashed #d7c09a;border-radius:10px;padding:16px;text-align:center;">暂无财报数据</div>';return;}listEl.innerHTML=reports.map(r=>'<article class="item"><div><h3>'+escapeHtml(r.title)+'</h3><p>'+escapeHtml(r.company)+' · '+escapeHtml(r.period)+' · '+escapeHtml(r.type)+'</p><small>发布时间：'+escapeHtml(r.publishedAt)+' ｜ 来源：'+escapeHtml(r.source)+'</small></div><a href="'+r.url+'" target="_blank" rel="noreferrer">查看文件</a></article>').join("");}
  function startReportAutoRefresh(){stopReportAutoRefresh();if(!state.autoRefresh)return;state.reportTimer=setInterval(loadReports,10000);}function stopReportAutoRefresh(){if(state.reportTimer){clearInterval(state.reportTimer);state.reportTimer=null;}}
  function startDynamicTitle(){
    const el=document.getElementById("dynamicTitle");
    if(!el)return;
    el.textContent="观数知财";
    document.title="观数知财｜米白金主题";
  }
        async function checkBackendStatus(manual=false){

    const dot=document.getElementById("statusDot");
    const text=document.getElementById("statusText");
    if(!dot||!text) return;
        dot.className="dot warn";
        text.textContent="后端检测中...";


    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),5000);
        try{
      const url=manual?HEALTH_READY_URL:HEALTH_URL;
      const resp=await fetch(url,{signal:controller.signal});
      const data=await resp.json();
            if(resp.ok&&data.ok){dot.className="dot ok";text.textContent="后端在线";}

      else{dot.className="dot bad";text.textContent="后端异常："+(data.error_code||"NOT_READY");}
    }catch(err){

      dot.className="dot bad";
      text.textContent="后端不可达";
    }finally{clearTimeout(timer);}
  }
    function renderMarkdown(input){const codeBlocks=[];const bt=String.fromCharCode(96);const fence=bt+bt+bt;let text=String(input||"").replace(/\\r\\n/g,"\\n");const codeBlockRe=new RegExp(fence+"([a-zA-Z0-9_-]*)\\\\n([\\\\s\\\\S]*?)"+fence,"g");text=text.replace(codeBlockRe,(_,lang,code)=>{const token="@@CODEBLOCK_"+codeBlocks.length+"@@";const safeLang=escapeHtml(lang||"");const langAttr=safeLang?(' class="lang-'+safeLang+'"'):"";codeBlocks.push('<pre><code'+langAttr+'>'+escapeHtml(code)+'</code></pre>');return token;});text=escapeHtml(text);text=text.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,'<a href="$2" target="_blank" rel="noreferrer">$1</a>');const inlineCodeRe=new RegExp(bt+"([^"+bt+"]+)"+bt,"g");text=text.replace(inlineCodeRe,'<code>$1</code>');text=text.replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>');text=text.replace(/\\n/g,'<br>');text=text.replace(/@@CODEBLOCK_(\\d+)@@/g,(_,i)=>codeBlocks[Number(i)]||"");return text||"";}

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
  
});
