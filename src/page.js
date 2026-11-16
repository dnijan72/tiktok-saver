export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="TikTok Saver">
<meta name="theme-color" content="#111214">
<title>TikTok Saver</title>
<style>
:root{--bg:#f4f4f1;--card:#fff;--ink:#141518;--muted:#62666f;--rule:#dcdcd6;--accent:#e2512a;--ok:#1f7a4d;--bad:#b3261e;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#111214;--card:#1b1d21;--ink:#ececee;--muted:#9a9ea8;--rule:#2e3138;--accent:#f27448;--ok:#5cc98f;--bad:#f2837a;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
.wrap{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
h1{font-size:26px;letter-spacing:-.01em;margin:4px 0 0}
h1 span{color:var(--accent)}
.card{background:var(--card);border:1px solid var(--rule);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px}
label{font-size:13px;color:var(--muted);font-weight:600}
input,select,textarea{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--rule);border-radius:10px;padding:11px 12px;width:100%}
textarea{min-height:150px;resize:vertical}
.row{display:flex;gap:8px}
.row>*{flex:1}
button{font:inherit;font-weight:600;border:0;border-radius:10px;padding:12px 14px;background:var(--ink);color:var(--bg);cursor:pointer}
button.ghost{background:transparent;color:var(--ink);border:1px solid var(--rule)}
button.accent{background:var(--accent);color:#fff}
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
    <input id="note" type="text" placeholder="Optional: what happens in the video (helps the caption)">
    <button class="accent" id="go" type="button">Get caption + video</button>
    <div class="status" id="status" role="status" aria-live="polite"></div>
  </div>

  <div class="card" id="result" hidden>
    <div class="meta" id="meta"></div>
    <label for="caption">Caption</label>
    <textarea id="caption"></textarea>
    <div class="row">
      <button id="copy" type="button">Copy caption</button>
      <button class="accent" id="save" type="button">Save video</button>
    </div>
    <div class="status" id="saveStatus" role="status" aria-live="polite"></div>
    <details id="more"><summary>TikTok caption and bio</summary><p id="raw"></p></details>
  </div>

  <details>
    <summary>Forget access code</summary>
    <p><button class="ghost" id="forget" type="button">Forget it on this phone</button></p>
  </details>
</div>
<script>
(function(){
  const $=(id)=>document.getElementById(id);
  let token=""; try{ token=localStorage.getItem("ts_code")||""; }catch(e){}
  let lastUrl="", lastName="tiktok.mp4";
  $("codeCard").hidden=!!token;
  try{ const a=localStorage.getItem("ts_account"); if(a) $("account").value=a; }catch(e){}
  const params=new URLSearchParams(location.search); if(params.get("url")) $("link").value=params.get("url");
  if(params.get("account")&&$("account").querySelector('option[value="'+params.get("account")+'"]')) $("account").value=params.get("account");
  const videoOnly=params.get("caption")==="0";

  function say(el,t,err){ el.textContent=t||""; el.classList.toggle("err",!!err); }
  const esc=(s)=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  $("saveCode").onclick=()=>{ token=$("code").value.trim(); if(!token) return; try{ localStorage.setItem("ts_code",token); }catch(e){} $("codeCard").hidden=true; };
  $("forget").onclick=()=>{ token=""; try{ localStorage.removeItem("ts_code"); }catch(e){} $("codeCard").hidden=false; };
  $("account").onchange=()=>{ try{ localStorage.setItem("ts_account",$("account").value); }catch(e){} };
  $("paste").onclick=async()=>{ try{ $("link").value=(await navigator.clipboard.readText()).trim(); }catch(e){ say($("status"),"Couldn't read the clipboard. Long-press the box and tap Paste.",true); } };

  async function post(path,body){
    return fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.assign({token},body))});
  }

  $("go").onclick=async()=>{
    const url=$("link").value.trim();
    if(!token){ $("codeCard").hidden=false; say($("status"),"Enter your access code first.",true); return; }
    if(!url){ say($("status"),"Paste a TikTok link first.",true); return; }
    $("go").disabled=true; $("result").hidden=true; say($("status"),"Reading the TikTok and writing the caption…");
    try{
      const r=await post("/api/info",{url,account:$("account").value,note:$("note").value.trim(),skipCaption:videoOnly});
      const j=await r.json();
      if(!j.ok){ if(r.status===401){ $("codeCard").hidden=false; } throw new Error(j.error||"Something went wrong."); }
      lastUrl=j.url; lastName="tiktok-"+(j.tiktok||"video")+".mp4";
      const ig=j.instagram?'<b>@'+esc(j.instagram)+'</b> on Instagram<span class="tag ok">from '+(j.instagramFoundIn==="bio"?"bio":"link in bio")+'</span>'
        :'No Instagram found<span class="tag warn">crediting TikTok</span>';
      $("meta").innerHTML='<div>Creator: <b>'+esc(j.tiktokName||"")+'</b> (@'+esc(j.tiktok||"?")+' on TikTok)</div><div>'+ig+'</div>'+(j.hasVideo?"":'<div class="status err">Video file not found. Caption still works.</div>');
      $("caption").value=j.full||j.credit||"";
      $("raw").innerHTML='<b>TikTok caption:</b> '+esc(j.tiktokCaption||"(none)")+'<br><b>Bio:</b> '+esc(j.bio||"(none)")+(j.bioLink?'<br><b>Link:</b> '+esc(j.bioLink):"");
      $("result").hidden=false; $("save").disabled=!j.hasVideo;
      say($("status"),j.captionError?"Caption didn't generate: "+j.captionError:"");
      say($("saveStatus"),"");
    }catch(e){ say($("status"),e.message,true); }
    finally{ $("go").disabled=false; }
  };

  $("copy").onclick=async()=>{
    try{ await navigator.clipboard.writeText($("caption").value); $("copy").textContent="Copied ✓"; setTimeout(()=>$("copy").textContent="Copy caption",1500); }
    catch(e){ $("caption").select(); say($("saveStatus"),"Select the text and copy it.",true); }
  };

  $("save").onclick=async()=>{
    if(!lastUrl) return;
    $("save").disabled=true; say($("saveStatus"),"Downloading the video…");
    try{
      const r=await post("/api/video",{url:lastUrl});
      if(!r.ok){ let m="Download failed."; try{ m=(await r.json()).error||m; }catch(e){} throw new Error(m); }
      const blob=await r.blob();
      const name=r.headers.get("x-filename")||lastName;
      const file=new File([blob],name,{type:"video/mp4"});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        say($("saveStatus"),"Tap Save Video in the share sheet.");
        await navigator.share({files:[file]});
        say($("saveStatus"),"Saved. It's in your Photos.");
      }else{
        const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
        say($("saveStatus"),"Downloaded.");
      }
    }catch(e){ if(e&&e.name==="AbortError") say($("saveStatus"),""); else say($("saveStatus"),e.message,true); }
    finally{ $("save").disabled=false; }
  };

  // Links from Claude: ?url=...&go=1 runs right away (caption=0 skips the caption, since Claude wrote it in chat).
  if(params.get("url")&&params.get("go")==="1"&&token) $("go").click();
})();
</script>
</body>
</html>`;
