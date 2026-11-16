export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="TikTok Saver">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="manifest" href="/manifest.webmanifest">
<title>TikTok Saver</title>
<style>
:root{--bg:#000;--card:#121214;--ink:#fff;--muted:#a3a3ad;--rule:#2a2a30;--accent:#fe2c55;--cyan:#25f4ee;--ok:#25f4ee;--bad:#ff6b81;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
.wrap{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
h1{font-size:26px;letter-spacing:-.01em;margin:4px 0 0}
h1{text-shadow:-1.5px -1.5px 0 var(--cyan),1.5px 1.5px 0 var(--accent)}
h1 span{color:#fff}
.card{background:var(--card);border:1px solid var(--rule);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px}
label{font-size:13px;color:var(--muted);font-weight:600}
input,select,textarea{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--rule);border-radius:10px;padding:11px 12px;width:100%}
textarea{min-height:150px;resize:vertical}
.row{display:flex;gap:8px}
.row>*{flex:1}
button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:12px 14px;background:var(--ink);color:var(--bg);cursor:pointer}
button.ghost{background:transparent;color:var(--ink);border:1px solid var(--rule)}
button.accent{background:var(--accent);color:#fff;box-shadow:-3px -3px 0 var(--cyan)}
button:disabled{opacity:.5}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.status{font-size:14px;color:var(--muted);min-height:1.2em}
.status.err{color:var(--bad)}
.meta{font-size:14px;color:var(--muted);display:flex;flex-direction:column;gap:4px}
.meta b{color:var(--ink)}
.tag{display:inline-block;font-size:12px;border:1px solid currentColor;border-radius:999px;padding:1px 8px;margin-left:6px}
.tag.ok{color:var(--ok)}
.tag.warn{color:var(--accent)}
details{font-size:14px;color:var(--muted)}
[hidden]{display:none!important}
.list{display:flex;flex-direction:column}
.item{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--rule);background:none;color:inherit;border-radius:0;font-weight:400;text-align:left;width:100%}
.item:first-child{border-top:0}
.item .who{font-weight:600}
.item .when{font-size:13px;color:var(--muted);white-space:nowrap}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:var(--muted)}
.dot.done{background:var(--ok)}.dot.error{background:var(--bad)}.dot.working{background:var(--accent)}
</style>
</head>
<body>
<div class="wrap">
  <h1>TikTok <span>Saver</span></h1>

  <div class="card" id="codeCard" hidden>
    <label for="code">Access code</label>
    <input id="code" type="password" autocomplete="off" placeholder="The code you set in Cloudflare">
    <button id="saveCode" type="button">Save code on this phone</button>
  </div>

  <div class="card">
    <label for="link">TikTok link</label>
    <div class="row">
      <input id="link" type="url" inputmode="url" placeholder="https://www.tiktok.com/@…" autocomplete="off">
    </div>
    <div class="row">
      <button class="ghost" id="paste" type="button">Paste</button>
      <select id="account" aria-label="Account">
        <option value="newyorkers">@newyorkers</option>
        <option value="newyorklocals">@newyorklocals</option>
        <option value="nysports">@nysports</option>
        <option value="apartmentsnyc">@apartmentsnyc</option>
      </select>
    </div>
    <input id="igIn" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Their Instagram, if they sent it (optional)">
    <input id="note" type="text" placeholder="Optional: what happens in the video">
    <button class="accent" id="go" type="button">Get caption + video</button>
    <div class="status" id="status" role="status" aria-live="polite"></div>
  </div>

  <div class="card" id="notifyCard" hidden>
    <div class="meta" id="notifyText">Get a notification when each caption is ready, so you can leave the app while it works.</div>
    <button id="notify" type="button">🔔 Turn on notifications</button>
  </div>

  <div class="card" id="result" hidden>
    <div class="meta" id="meta"></div>
    <label for="igEdit">Instagram credit</label>
    <input id="igEdit" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="@handle (empty = credit their TikTok)">
    <label for="caption">Caption</label>
    <textarea id="caption"></textarea>
    <div class="row">
      <button id="copy" type="button">Copy caption</button>
      <button class="accent" id="save" type="button">Save video</button>
    </div>
    <div class="status" id="saveStatus" role="status" aria-live="polite"></div>
    <details id="more"><summary>TikTok caption and bio</summary><p id="raw"></p></details>
  </div>

  <div class="card" id="recentCard" hidden>
    <label>Recent</label>
    <div id="recent" class="list"></div>
  </div>

  <details>
    <summary>Forget access code</summary>
    <p><button class="ghost" id="forget" type="button">Forget it on this phone</button></p>
  </details>
</div>
<script>
if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
(function(){
  const $=(id)=>document.getElementById(id);
  let token=""; try{ token=localStorage.getItem("ts_code")||""; }catch(e){}
  let lastUrl="", lastName="tiktok.mp4";
  $("codeCard").hidden=!!token;
  try{ const a=localStorage.getItem("ts_account"); if(a) $("account").value=a; }catch(e){}
  const params=new URLSearchParams(location.search); if(params.get("url")) $("link").value=params.get("url");
  if(params.get("account")&&$("account").querySelector('option[value="'+params.get("account")+'"]')) $("account").value=params.get("account");
  const videoOnly=params.get("caption")==="0";
  if(params.get("ig")) $("igIn").value=params.get("ig");

  function say(el,t,err){ el.textContent=t||""; el.classList.toggle("err",!!err); }
  const esc=(s)=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  $("saveCode").onclick=()=>{ token=$("code").value.trim(); if(!token) return; try{ localStorage.setItem("ts_code",token); }catch(e){} $("codeCard").hidden=true; };
  $("forget").onclick=()=>{ token=""; try{ localStorage.removeItem("ts_code"); }catch(e){} $("codeCard").hidden=false; };
  $("account").onchange=()=>{ try{ localStorage.setItem("ts_account",$("account").value); }catch(e){} };
  $("paste").onclick=async()=>{ try{ $("link").value=(await navigator.clipboard.readText()).trim(); }catch(e){ say($("status"),"Couldn't read the clipboard. Long-press the box and tap Paste.",true); } };

  async function post(path,body){
    return fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.assign({token},body))});
  }

  function render(j){
    lastUrl=j.url; lastName="tiktok-"+(j.tiktok||"video")+".mp4";
    const from={manual:"you entered",tiktok:"linked on TikTok",bio:"bio",link:"link in bio"}[j.instagramFoundIn]||"bio";
    const ig=j.instagram?'<b>@'+esc(j.instagram)+'</b> on Instagram<span class="tag ok">'+esc(from)+'</span>'
      :'No Instagram found<span class="tag warn">crediting TikTok</span>';
    $("meta").innerHTML='<div>'+ig+'</div><div>TikTok: <b>'+esc(j.tiktokName||"")+'</b> (@'+esc(j.tiktok||"?")+')</div>'+(j.hasVideo?"":'<div class="status err">Video file not found. Caption still works.</div>');
    current={tiktok:j.tiktok};
    $("igEdit").value=j.instagram?"@"+j.instagram:"";
    $("caption").value=j.full||j.credit||"";
    $("raw").innerHTML='<b>TikTok caption:</b> '+esc(j.tiktokCaption||"(none)")+'<br><b>Bio:</b> '+esc(j.bio||"(none)")+(j.bioLink?'<br><b>Link:</b> '+esc(j.bioLink):"");
    $("result").hidden=false; $("save").disabled=!j.hasVideo;
    if(j.hasVideo) setTimeout(()=>prefetch(j.url),0);
    say($("status"),j.captionError?"Caption didn't generate: "+j.captionError:"");
  }

  let current={};
  const NL=String.fromCharCode(10);
  function creditFor(v){
    v=String(v||"").trim();
    const i=v.toLowerCase().indexOf("instagram.com/"); if(i>=0) v=v.slice(i+14);
    v=v.replace(/^@+/,"").split(/[ ?/]/)[0];
    if(v) return "🎥: @"+v;
    return current.tiktok?"🎥: @"+current.tiktok+" on TikTok":"";
  }
  $("igEdit").addEventListener("input",()=>{
    const lines=$("caption").value.trimEnd().split(NL);
    while(lines.length&&(lines[lines.length-1].startsWith("🎥:")||!lines[lines.length-1].trim())) lines.pop();
    const body=lines.join(NL).trim(); const c=creditFor($("igEdit").value);
    $("caption").value=[body,c].filter(Boolean).join(NL+NL);
  });

  let polling=null;
  async function watch(id){
    clearTimeout(polling);
    try{
      const r=await post("/api/job",{id}); const j=await r.json();
      if(!j.ok) throw new Error(j.error||"Couldn't load that result.");
      const job=j.job;
      if(job.status==="working"){
        say($("status"),(pushOn()?"Working on it. You can leave the app; you'll get a notification.":"Reading the TikTok and writing the caption…"));
        polling=setTimeout(()=>watch(id),document.hidden?6000:2000); return;
      }
      $("go").disabled=false; loadRecent();
      if(job.status==="error") throw new Error(job.error||"Something went wrong.");
      render(job.result);
      if(params.get("save")==="1"&&job.result.hasVideo) say($("saveStatus"),"Tap Save video to put it in Photos.");
    }catch(e){ $("go").disabled=false; say($("status"),e.message,true); }
  }

  $("go").onclick=async()=>{
    const url=$("link").value.trim();
    if(!token){ $("codeCard").hidden=false; say($("status"),"Enter your access code first.",true); return; }
    if(!url){ say($("status"),"Paste a TikTok link first.",true); return; }
    $("go").disabled=true; $("result").hidden=true; say($("status"),"Starting…");
    try{
      const r=await post("/api/jobs",{url,account:$("account").value,note:$("note").value.trim(),instagram:$("igIn").value.trim(),skipCaption:videoOnly});
      const j=await r.json();
      if(!j.ok){ if(r.status===401){ $("codeCard").hidden=false; } throw new Error(j.error||"Something went wrong."); }
      try{ history.replaceState(null,"","/?job="+j.job.id); }catch(e){}
      $("igIn").value=""; $("note").value="";
      loadRecent(); watch(j.job.id);
    }catch(e){ $("go").disabled=false; say($("status"),e.message,true); }
  };

  async function loadRecent(){
    if(!token) return;
    try{
      const r=await post("/api/recent",{}); const j=await r.json(); if(!j.ok) return;
      const box=$("recent"); box.innerHTML="";
      j.jobs.forEach(job=>{
        const b=document.createElement("button"); b.type="button"; b.className="item";
        const res=job.result||{}; const who=res.instagram?"@"+res.instagram:res.tiktok?"@"+res.tiktok:(job.url||"").split("//").pop().replace("www.","").slice(0,32);
        const t=new Date(job.createdAt).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
        b.innerHTML='<span><span class="dot '+esc(job.status)+'"></span><span class="who">'+esc(who)+'</span></span><span class="when">'+esc(t)+'</span>';
        b.onclick=()=>{ try{ history.replaceState(null,"","/?job="+job.id); }catch(e){} $("result").hidden=true; window.scrollTo(0,0); watch(job.id); };
        box.appendChild(b);
      });
      $("recentCard").hidden=!j.jobs.length;
    }catch(e){}
  }

  // Notifications (iPhone: only inside the home-screen app, iOS 16.4+)
  const standalone=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
  const canPush="serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
  const pushOn=()=>{ try{ return canPush&&Notification.permission==="granted"&&localStorage.getItem("ts_push")==="1"; }catch(e){ return false; } };
  function paintNotify(){
    if(!token){ $("notifyCard").hidden=true; return; }
    if(pushOn()){ $("notifyCard").hidden=true; return; }
    $("notifyCard").hidden=false;
    if(!canPush||!standalone){
      $("notifyText").textContent="To get notifications on iPhone: tap Share, then Add to Home Screen, then open TikTok Saver from its icon and turn them on there.";
      $("notify").hidden=true;
    }else if(Notification.permission==="denied"){
      $("notifyText").textContent="Notifications are blocked. Turn them on in Settings, then Notifications, then TikTok Saver.";
      $("notify").hidden=true;
    }
  }
  function keyBytes(b64){ const s=b64.replace(/-/g,"+").replace(/_/g,"/"); const bin=atob(s+"===".slice((s.length+3)%4)); return Uint8Array.from(bin,c=>c.charCodeAt(0)); }
  $("notify").onclick=async()=>{
    $("notify").disabled=true;
    try{
      const perm=await Notification.requestPermission();
      if(perm!=="granted") throw new Error("Notifications weren't allowed.");
      const reg=await navigator.serviceWorker.ready;
      const k=await (await fetch("/api/push-key")).json(); if(!k.ok) throw new Error(k.error);
      let sub=await reg.pushManager.getSubscription();
      if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(k.key)});
      const r=await post("/api/subscribe",{subscription:sub.toJSON()}); const j=await r.json(); if(!j.ok) throw new Error(j.error);
      try{ localStorage.setItem("ts_push","1"); }catch(e){}
      $("notifyText").textContent="Notifications are on ✅"; $("notify").hidden=true;
      setTimeout(paintNotify,2500);
    }catch(e){ $("notifyText").textContent=e.message; }
    finally{ $("notify").disabled=false; }
  };
  paintNotify();
  $("saveCode").addEventListener("click",()=>{ paintNotify(); loadRecent(); });

  $("copy").onclick=async()=>{
    try{ await navigator.clipboard.writeText($("caption").value); $("copy").textContent="Copied ✓"; setTimeout(()=>$("copy").textContent="Copy caption",1500); }
    catch(e){ $("caption").select(); say($("saveStatus"),"Select the text and copy it.",true); }
  };

  // The video downloads in the background as soon as a result shows, so the Save tap
  // can open the share sheet right away (Safari only allows that straight after a tap).
  let vid={url:null,file:null,promise:null,error:null};
  function prefetch(url){
    if(vid.url===url&&(vid.file||vid.promise)) return vid.promise;
    vid={url,file:null,error:null,promise:null};
    say($("saveStatus"),"Downloading the video…"); $("save").textContent="Save video";
    vid.promise=(async()=>{
      let lastErr=null;
      for(let attempt=0;attempt<2;attempt++){
        try{
          const r=await post("/api/video",{url});
          if(!r.ok){ let m="Download failed."; try{ m=(await r.json()).error||m; }catch(e){} throw new Error(m); }
          const blob=await r.blob();
          if(blob.size<50000) throw new Error("The video came back empty.");
          const name=r.headers.get("x-filename")||lastName;
          if(vid.url!==url) return;
          vid.file=new File([blob],name,{type:"video/mp4"});
          say($("saveStatus"),"Video ready ("+(blob.size/1048576).toFixed(1)+" MB). Tap Save video.");
          return;
        }catch(e){
          lastErr=e;
          if(/load failed|network|fetch/i.test(String(e&&e.message))&&attempt===0){ say($("saveStatus"),"Connection dropped, retrying…"); continue; }
          break;
        }
      }
      if(vid.url!==url) return;
      vid.error=/load failed|network|fetch/i.test(String(lastErr&&lastErr.message))?"The download got cut off. Check your connection and tap Save video to try again.":(lastErr&&lastErr.message)||"Download failed.";
      say($("saveStatus"),vid.error,true);
    })();
    return vid.promise;
  }

  $("save").onclick=async()=>{
    if(!lastUrl) return;
    if(vid.url!==lastUrl||vid.error){ vid.url=null; prefetch(lastUrl); return; }
    if(!vid.file){ say($("saveStatus"),"Still downloading. It'll say when it's ready."); return; }
    const file=vid.file;
    try{
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file]});
        say($("saveStatus"),"Saved. Check Photos.");
      }else{
        const a=document.createElement("a"); a.href=URL.createObjectURL(file); a.download=file.name; document.body.appendChild(a); a.click(); a.remove();
        say($("saveStatus"),"Downloaded.");
      }
    }catch(e){
      if(e&&e.name==="AbortError") say($("saveStatus"),"Video ready. Tap Save video, then Save Video.");
      else say($("saveStatus"),"Couldn't open the share sheet ("+e.message+"). Tap Save video again.",true);
    }
  };

  // Links from Claude: ?url=...&go=1 runs right away (caption=0 skips the caption, since Claude wrote it in chat).
  if(params.get("job")&&token) watch(params.get("job"));
  else if(params.get("url")&&params.get("go")==="1"&&token) $("go").click();
  loadRecent();
})();
</script>
</body>
</html>`;
