/**
 * Browser bootstrap that recovers a tab whose modules stopped loading. The usual
 * cause is a restart or a new build while the tab is open: the tab still holds
 * module URLs that no longer answer, or a mix of old and new bundles where React
 * internals read as null ("Cannot read properties of null (reading 'use')").
 *
 * The tab reloads itself, but only once the page *and* the module that failed
 * actually serve again. A server that is coming back answers its document long
 * before its modules are ready, and reloading into that state is what used to
 * leave a blank screen. If the module never comes back, a plain screen with a
 * Refresh button is shown instead.
 *
 * Injected into the document head as a plain string so it runs before any module
 * import. Keep it dependency-free, free of a closing script tag, and free of
 * backticks, template placeholders and backslashes — it lives in a template
 * literal.
 */
export const deployRecoveryScript = `(function(){
var K="deployment-reload-attempted";
var MAX_RELOADS=4;
var PROBE_TRIES=12;
var SENT=0;
var recovering=false;
var failingUrl=null;
function store(k){try{return sessionStorage.getItem(k)}catch(e){return null}}
function setStore(k,v){try{sessionStorage.setItem(k,v)}catch(e){}}
function removeStore(k){try{sessionStorage.removeItem(k)}catch(e){}}
function attempted(){return store(K)==="1"}
function mark(){setStore(K,"1")}
function count(){var v=store(K+":n");return v?+v:0}
function fallback(){if(document.getElementById("deploy-recovery"))return;var d=document.createElement("div");d.id="deploy-recovery";d.style.cssText="position:fixed;inset:0;z-index:99999;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:system-ui,sans-serif;text-align:center;padding:24px";var h=document.createElement("div");h.style.cssText="font-size:20px;font-weight:700;color:#1c1917";h.textContent="New version available";var p=document.createElement("div");p.style.cssText="font-size:14px;color:#57534e;max-width:320px";p.textContent="This page is updating to the latest version. Please refresh.";var b=document.createElement("button");b.style.cssText="margin-top:8px;padding:10px 24px;font-size:15px;font-weight:600;color:#fff;background:#1c1917;border:none;border-radius:8px;cursor:pointer";b.textContent="Refresh Page";b.onclick=function(){removeStore(K);removeStore(K+":n");location.reload()};d.appendChild(h);d.appendChild(p);d.appendChild(b);(document.body||document.documentElement).appendChild(d)}
function notice(){if(document.getElementById("deploy-notice"))return;var d=document.createElement("div");d.id="deploy-notice";d.setAttribute("role","status");d.style.cssText="position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:99998;background:#1c1917;color:#fff;padding:10px 16px;border-radius:10px;font:600 14px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25)";d.textContent="Loading the new version… one moment";(document.body||document.documentElement).appendChild(d)}
function send(kind,msg){if(SENT>=10)return;SENT++;try{var b=JSON.stringify({kind:String(kind).slice(0,60),message:String(msg||kind).slice(0,1500),route:location.pathname});if(navigator.sendBeacon){navigator.sendBeacon("/api/public/telemetry/runtime-error",new Blob([b],{type:"application/json"}))}else{fetch("/api/public/telemetry/runtime-error",{method:"POST",body:b,headers:{"content-type":"application/json"},keepalive:true})}}catch(x){}}
window.__winstoneReportError=send;
function log(kind,detail){var e={at:new Date().toISOString(),kind:kind,detail:String(detail||"").slice(0,300),page:location.pathname,reloaded:attempted()};try{var L=JSON.parse(localStorage.getItem("winstone-reload-log")||"[]");L.push(e);localStorage.setItem("winstone-reload-log",JSON.stringify(L.slice(-20)))}catch(x){}var ok=kind==="recovered-after-reload";try{(ok?console.info:console.error)("[winstone-recovery]",JSON.stringify(e))}catch(x){}if(!ok)send(kind,e.detail||kind);if(kind==="fallback-shown")try{window.__lovableReportRuntimeError&&window.__lovableReportRuntimeError({message:"Module load recovery: "+kind+" — "+e.detail,filename:location.pathname})}catch(x){}}
function sameOrigin(u){if(!u)return false;try{var x=new URL(u,location.href);return x.origin===location.origin&&x.protocol.indexOf("http")===0}catch(e){return false}}
function isModuleType(res){var ct=String(res.headers.get("content-type")||"");return !ct||ct.indexOf("javascript")>=0||ct.indexOf("ecmascript")>=0}
function get(u,method){return new Promise(function(resolve,reject){var controller=new AbortController();var timer=setTimeout(function(){controller.abort()},4000);fetch(u,{method:method,cache:"no-store",signal:controller.signal}).then(function(res){clearTimeout(timer);resolve(res)},function(err){clearTimeout(timer);reject(err)})})}
function probeModule(u){
return new Promise(function(resolve){
if(!sameOrigin(u)){resolve(true);return}
get(u,"HEAD").then(function(res){
if(res.ok&&isModuleType(res)){resolve(true);return}
if(res.status===405||res.status===501){get(u,"GET").then(function(r2){resolve(r2.ok&&isModuleType(r2))},function(){resolve(false)});return}
resolve(false)
},function(){resolve(false)})
})}
function probeDocument(){return get(location.pathname+location.search,"HEAD").then(function(res){return !!res.ok},function(){return false})}
function waitThenReload(){
var t=0;
function ping(){
Promise.all([probeDocument(),probeModule(failingUrl)]).then(function(ok){
if(ok[0]&&ok[1]){setTimeout(function(){location.reload()},400+3000*Math.max(0,count()-1))}else{again()}
},function(){again()})
}
function again(){if(++t>=PROBE_TRIES){recovering=false;fallback();return}setTimeout(ping,2000)}
ping();
}
function r(kind,detail){
if(recovering)return;
recovering=true;
log(kind,detail);
var c=count();
if(attempted()&&c>=MAX_RELOADS){log("fallback-shown",detail);fallback();return}
mark();setStore(K+":n",String(c+1));
notice();waitThenReload();
}
function bad(m){return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError|Cannot read properties of (?:null|undefined) (?:reading|setting) '(?:use|H|ReactCurrentDispatcher|_currentValue|useState|useContext)'/i.test(String(m||""))}
function urlFrom(m){
var s=String(m||"");
var i=s.indexOf(".js");
if(i<0){i=s.indexOf(".mjs")}
if(i<0)return null;
var j=i;
while(j>0){var c=s.charAt(j-1);if(c===" "||c==="\\""||c==="'"||c==="("||c==="["||c==="{"||c===",")break;j--}
var k=i+3;
while(k<s.length){var d=s.charAt(k);if(d===" "||d==="\\""||d==="'"||d===")"||d==="]"||d==="}"||d===",")break;k++}
var u=s.slice(j,k);
return u.indexOf("http")===0||u.charAt(0)==="/"||u.indexOf("/@")===0?u:null;
}
var F=window.fetch;if(F){window.fetch=function(){var a=arguments;return F.apply(this,a).then(function(res){try{var u=String(a[0]&&a[0].url||a[0]);if(res.status===500&&u.indexOf("/_serverFn/")>=0){res.clone().text().then(function(t){if(/Invalid server function ID/i.test(t))r("stale-server-fn",u.split("?")[0].slice(-80))}).catch(function(){})}}catch(x){}return res})}}
window.addEventListener("vite:preloadError",function(e){e.preventDefault();var p=e.payload;var u=p&&(p.src||p.url)||urlFrom(p&&p.message);if(u&&sameOrigin(u)){failingUrl=u}r("preload-error",p&&p.message)});
window.addEventListener("error",function(e){var t=e.target;if(t&&t.tagName==="SCRIPT"&&t.type==="module"){failingUrl=t.src;r("script-load-failed",t.src);return}if(bad(e.message)){var u=urlFrom(e.message);if(u&&sameOrigin(u)){failingUrl=u}r("module-error",e.message)}},true);
window.addEventListener("unhandledrejection",function(e){var m=e.reason&&e.reason.message||e.reason;if(bad(m)){var u=urlFrom(m);if(u&&sameOrigin(u)){failingUrl=u}r("import-rejected",m);return}send("unhandled-rejection",m)});
window.addEventListener("error",function(e){if(e.target&&e.target!==window)return;if(bad(e.message))return;if(!e.message||/ResizeObserver loop/.test(e.message))return;send("runtime-error",e.message+(e.filename?" @ "+String(e.filename).split("?")[0]+":"+e.lineno:""))});
window.__clearDeployReloadFlag=function(){if(recovering)return;var d=document.getElementById("deploy-notice");if(d)d.remove();var f=document.getElementById("deploy-recovery");if(f)f.remove();if(attempted())log("recovered-after-reload","");removeStore(K);removeStore(K+":n")};
})();`;
