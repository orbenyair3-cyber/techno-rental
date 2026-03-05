
const STORAGE_KEY='technoTools',CART_KEY='technoCart',BOOKING_KEY='technoBooking',ADMIN_KEY='technoAdminLogged',TOOLS_SYNC_STATE_KEY='technoToolsSyncState',ADMIN_USERNAME='Gal65',ADMIN_PASSWORD='Gal65$',API_BASE='https://techno-rental.onrender.com';
const SUPABASE_URL_RAW='https://aqzxhiaaivahmgyhchdd.supabase.co 2222222';
const SUPABASE_URL=String(SUPABASE_URL_RAW||'').trim().split(/\s+/)[0];
const SUPABASE_KEY='sb_publishable_wW6wy43I3Z7n2Tn24F6GXg_aAesbAjc';
const TOOL_MEDIA_BUCKET='tool-media';
const ALLOWED_MEDIA_TYPES=['image/jpeg','image/png','image/webp','video/mp4','video/webm'];
const MAX_MEDIA_BYTES=20*1024*1024;
const DEFAULT_TOOLS=['מקדחת יהלום','מקדחת אדמה','קונגו','מכונת פוליש','שואב אבק תעשייתי','גנרטור','מחרצת בטון','אקדח מסמרים עם מדחס','רמפה לגובה 1.8 מטר משקל 1 טון','פטישון נטען','מדחס אויר','מכונה לחידוש דקים','משאבת טבילה','משאבת מים'].map((n)=>({name:n,category:'כלי עבודה',price:400,deposit:3000,max_days:2,description:'תיאור כלי מקצועי',image_url:`https://picsum.photos/seed/${encodeURIComponent(n)}/600/400`,media_urls:[`https://picsum.photos/seed/${encodeURIComponent(n)}/600/400`]}));
const $=id=>document.getElementById(id), j=v=>JSON.stringify(v), p=v=>{try{return JSON.parse(v)}catch{return null}};
let TOOLS_CACHE=[];
let supabaseClient=null;
const tools=()=>Array.isArray(TOOLS_CACHE)?TOOLS_CACHE:[], saveTools=t=>{TOOLS_CACHE=Array.isArray(t)?t:[]; try{localStorage.setItem(STORAGE_KEY,j(TOOLS_CACHE));}catch{}};
const cart=()=>p(localStorage.getItem(CART_KEY))||[], saveCart=c=>localStorage.setItem(CART_KEY,j(c));
const booking=()=>p(localStorage.getItem(BOOKING_KEY))||{}, saveBooking=b=>localStorage.setItem(BOOKING_KEY,j(b));
const getToolsSyncState=()=>p(localStorage.getItem(TOOLS_SYNC_STATE_KEY))||{pending:false};
const setToolsSyncState=(v)=>localStorage.setItem(TOOLS_SYNC_STATE_KEY,j(v||{pending:false}));
saveTools([]);

const toolPages=new Set(['catalog','schedule','payment','admin']);

const toClientTool=(tool={})=>{
  const media=Array.isArray(tool?.media_urls)?tool.media_urls.filter(Boolean):[];
  const image=tool.image_url||tool.image||media[0]||'';
  const busyDates=Array.isArray(tool?.busyDates)?tool.busyDates:(Array.isArray(tool?.busydates)?tool.busydates:[]);
  const isAvailable=tool?.is_available===undefined ? tool?.status!=='maintenance' : Boolean(tool?.is_available);
  return {
    ...(tool||{}),
    id:tool?.id,
    name:tool?.name||'',
    category:tool?.category||'כלי',
    price:Number(tool?.price||0),
    deposit:Number(tool?.deposit||0),
    maxDays:Number(tool?.maxDays??tool?.max_days??0),
    image,
    image_url:image,
    desc:tool?.desc||tool?.description||'',
    description:tool?.description||tool?.desc||'',
    media_urls:media.length?media:(image?[image]:[]),
    busyDates,
    is_available:isAvailable,
    status:isAvailable?'available':'maintenance'
  };
};

const toServerToolPayload=(tool={})=>{
  const normalized=toClientTool(tool);
  return {
    name:normalized.name,
    category:normalized.category,
    price:normalized.price,
    deposit:normalized.deposit,
    max_days:Number(normalized.maxDays||0),
    image_url:normalized.image_url||normalized.image||'',
    description:normalized.description||normalized.desc||'',
    media_urls:Array.isArray(normalized.media_urls)?normalized.media_urls.filter(Boolean):[]
  };
};

async function apiJson(url,options={}){
  const r=await fetch(url,{cache:'no-store',headers:{'Accept':'application/json','Cache-Control':'no-cache',...(options.headers||{})},...options});
  let body=null;
  try{body=await r.json();}catch{}
  if(!r.ok){
    const err={status:r.status,body:body||{error:`http_${r.status}`}};
    throw err;
  }
  return body;
}

async function fetchToolsFromServer(){
  const rows=await apiJson(`${API_BASE}/api/tools?_=${Date.now()}`);
  return Array.isArray(rows)?rows.map(toClientTool):[];
}

async function syncToolsFromServer(){
  try{
    const serverTools=await fetchToolsFromServer();
    saveTools(serverTools);
    setToolsSyncState({pending:false,lastSyncedAt:Date.now()});
    window.dispatchEvent(new Event('tools-updated'));
    return true;
  }catch{
    setToolsSyncState({pending:true,lastFailedAt:Date.now()});
    return false;
  }
}
async function bootstrapDefaultToolsIfEmpty(){
  try{
    const rows=await fetchToolsFromServer();
    if(Array.isArray(rows)&&rows.length) return false;
    for(const tool of DEFAULT_TOOLS){
      await createToolOnServer(tool);
    }
    return true;
  }catch{
    return false;
  }
}
async function createToolOnServer(tool){
  const payload=toServerToolPayload(tool||{});
  await apiJson(`${API_BASE}/api/tools`,{method:'POST',headers:{'Content-Type':'application/json'},body:j(payload)});
}
async function updateToolOnServer(id,tool){
  const payload=toServerToolPayload(tool||{});
  await apiJson(`${API_BASE}/api/tools/${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:j(payload)});
}
async function fetchOrdersFromServer(){
  try{
    const r=await fetch(`${API_BASE}/api/orders?_=${Date.now()}`,{headers:{'Accept':'application/json','Cache-Control':'no-cache'},cache:'no-store'});
    if(!r.ok) return [];
    const rows=await r.json();
    return Array.isArray(rows)?rows:[];
  }catch{return []}
}
let toolsRealtimeSource=null;
let supabaseRealtimeChannel=null;
async function initToolsRealtime(){
  if(toolsRealtimeSource) return;
  try{
    const cfg=await apiJson(`${API_BASE}/api/realtime-config?_=${Date.now()}`);
    const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const sb=mod.createClient(cfg.url,cfg.anonKey);
    const ch=sb.channel(`tools-live-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'tools'},()=>{syncToolsFromServer();})
      .subscribe();
    supabaseRealtimeChannel=ch;
    toolsRealtimeSource={type:'supabase',client:sb};
  }catch{
    try{
      const es=new EventSource(`${API_BASE}/api/tools/stream`);
      es.onmessage=()=>{syncToolsFromServer();};
      es.onerror=()=>{};
      toolsRealtimeSource=es;
    }catch{}
  }
}
async function updateOrderStatusOnServer(orderId,status){
  try{
    const r=await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderId)}`,{method:'PUT',headers:{'Content-Type':'application/json','Accept':'application/json'},body:j({status})});
    return r.ok;
  }catch{return false}
}
const expandDateRange=(start,end)=>{
  if(!start||!end) return [];
  const out=[];
  const d1=new Date(start+'T00:00:00');
  const d2=new Date(end+'T00:00:00');
  const from=d1<=d2?d1:d2, to=d1<=d2?d2:d1;
  const cur=new Date(from);
  while(cur<=to){ out.push(ymd(cur)); cur.setDate(cur.getDate()+1); }
  return out;
};
const rangesOverlap=(aStart,aEnd,bStart,bEnd)=>aStart<=bEnd&&aEnd>=bStart;
async function sendOrderToAdmin(payload){
  try{
    const r=await fetch(`${API_BASE}/api/orders`,{method:'POST',headers:{'Content-Type':'application/json'},body:j(payload)});
    if(!r.ok){
      let msg='';
      try{const x=await r.json(); msg=x?.error||'';}catch{}
      return {ok:false,status:r.status,message:msg};
    }
    const data=await r.json();
    return {ok:true,status:r.status,data};
  }catch{return {ok:false,status:0,message:'network_error'}}
}

function initTopActions(){
  const wrap=document.createElement('div');
  wrap.className='floating-actions';
  wrap.innerHTML="<button id='backBtn' class='secondary'>⬅ חזרה</button><button id='resetHomeBtn' class='danger'>⌂ התחלה מחדש</button>";
  document.body.appendChild(wrap);
  document.getElementById('backBtn').onclick=()=>history.back();
  document.getElementById('resetHomeBtn').onclick=()=>{localStorage.removeItem(CART_KEY);localStorage.removeItem(BOOKING_KEY);location.href='index.html';};
}

function initAdminLinkVisibility(){
  try{
    document.documentElement.classList.toggle('show-admin',localStorage.getItem(ADMIN_KEY)==='1');
  }catch{}
}

function ensureAdminFooterLink(){
  const footer=document.querySelector('.site-footer, footer');
  if(!footer) return;
  let links=footer.querySelector('.footer-links');
  if(!links){
    links=document.createElement('nav');
    links.className='footer-links';
    links.setAttribute('aria-label','Footer links');
    footer.appendChild(links);
  }
  const existing=links.querySelector('a[href="admin.html"]');
  if(existing){
    existing.classList.add('admin-link');
    existing.textContent='התחברות מנהל';
    return;
  }
  const a=document.createElement('a');
  a.href='admin.html';
  a.className='admin-link';
  a.textContent='התחברות מנהל';
  links.appendChild(a);
}

function renderCatalog(){
  const g=$('toolsGrid'); if(!g) return;
  const q=$('toolSearch');
  const draw=()=>{
    const filter=(q?.value||'').trim();
    g.innerHTML='';
    tools().filter(t=>!filter||t.name.includes(filter)).forEach((x,idx)=>{
      const d=document.createElement('article'); d.className='card';
      const isAvailable=x.status!=='maintenance';
      const mediaItems=normalizeToolMedia(x);
      const mediaHtml=mediaItems.map((url,i)=>{
        const isVideo=/\.(mp4|webm|ogg)(\?|#|$)/i.test(url);
        return `<div class='media-slide ${i===0?'active':''}' data-media-index='${i}'>${isVideo?`<video src='${url}' playsinline muted controls preload='metadata' aria-label='סרטון של ${x.name}'></video>`:`<img src='${url}' alt='${x.name} - מדיה ${i+1}'>`}</div>`;
      }).join('');
      const arrows=mediaItems.length>1?`<button class='media-arrow prev' type='button' data-dir='prev' aria-label='הקודם'>‹</button><button class='media-arrow next' type='button' data-dir='next' aria-label='הבא'>›</button>`:'';
      d.innerHTML=`<div class='card-media' data-count='${mediaItems.length}' data-current='0' data-tool='${x.id}' data-card-index='${idx}'>${mediaHtml}${arrows}</div><div class='card-content'><h3>${x.name}</h3><div class='tool-meta'><span class='price-day'>₪${x.price} ליום</span><span class='status-badge ${isAvailable?'status-available':'status-maintenance'}'>${isAvailable?'זמין':'בתחזוקה'}</span></div><p>${x.desc}</p><div class='actions'><button class='primary choose' data-id='${x.id}' ${isAvailable?'':'disabled'}>הזמן עכשיו</button></div></div>`;
      g.appendChild(d);
    });
    g.querySelectorAll('.choose').forEach(b=>b.onclick=()=>{
      saveBooking({toolId:b.dataset.id, selectedDates:[], pickupType:'בת שלמה'});
      location.href='schedule.html';
    });
    g.querySelectorAll('.media-arrow').forEach(btn=>btn.onclick=()=>{
      const wrap=btn.closest('.card-media');
      if(!wrap) return;
      const slides=Array.from(wrap.querySelectorAll('.media-slide'));
      if(slides.length<2) return;
      const current=Number(wrap.dataset.current||0);
      const next=btn.dataset.dir==='next'?(current+1)%slides.length:(current-1+slides.length)%slides.length;
      slides.forEach((s,i)=>{
        s.classList.toggle('active',i===next);
        const v=s.querySelector('video');
        if(v&&i!==next) v.pause();
      });
      wrap.dataset.current=String(next);
    });
  };
  q?.addEventListener('input',draw);
  window.addEventListener('tools-updated',draw);
  draw();
}

function renderCart(){
  const l=$('cartItems'),n=$('cartCount'); if(!l||!n)return; const ids=cart(), t=tools();
  n.textContent=`${ids.length} כלים`; l.innerHTML='';
  ids.forEach(id=>{const x=t.find(a=>a.id===id); if(!x)return; const r=document.createElement('div'); r.innerHTML=`<span>${x.name}</span><button class='secondary'>הסר</button>`; r.querySelector('button').onclick=()=>{saveCart(ids.filter(v=>v!==id));renderCart();}; l.appendChild(r);});
  if(!ids.length) l.innerHTML='<p class="small">הסל ריק</p>';
}

const ymd=(d)=>{
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const uniqueDates=arr=>Array.from(new Set((arr||[]).filter(Boolean))).sort();
const parseMediaInput=(raw='')=>Array.from(new Set(String(raw).split(/[\n,]+/).map(s=>s.trim()).filter(Boolean)));
const fileToDataUrl=(file)=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('read_failed'));r.readAsDataURL(file);});
const normalizeToolMedia=(tool)=>{
  const list=Array.isArray(tool?.media_urls)&&tool.media_urls.length?tool.media_urls.filter(Boolean):(Array.isArray(tool?.media)&&tool.media.length?tool.media.filter(Boolean):[]);
  const fallback=tool?.image?[tool.image]:[];
  return list.length?list:fallback;
};
const isVideoUrl=(url='')=>/\.(mp4|webm)(\?|#|$)/i.test(String(url));
const renderMediaPreview=(containerId,urls=[])=>{
  const el=$(containerId); if(!el) return;
  const clean=Array.from(new Set((urls||[]).map(v=>String(v||'').trim()).filter(Boolean)));
  if(!clean.length){el.innerHTML=''; return;}
  el.innerHTML=clean.map((url,i)=>`<div class='media-preview-item'>${isVideoUrl(url)?`<video src='${url}' controls preload='metadata' muted playsinline></video>`:`<img src='${url}' alt='media ${i+1}'>`}<small>${i+1}</small></div>`).join('');
};
const setUploadMsg=(id,text,color)=>{if(!$(id))return; $(id).textContent=text||''; $(id).style.color=color||'';};
const getSupabaseClient=async ()=>{
  if(supabaseClient) return supabaseClient;
  if(!SUPABASE_URL||!SUPABASE_KEY) throw new Error('supabase_config_missing');
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
  supabaseClient=mod.createClient(SUPABASE_URL,SUPABASE_KEY);
  return supabaseClient;
};
const safeFileName=(name='file')=>String(name||'file').replace(/[^\w.\-]+/g,'_');
const uploadFilesViaApiFallback=async (files=[])=>{
  const payload=await Promise.all(files.map(async f=>({name:f.name,type:f.type,dataUrl:await fileToDataUrl(f)})));
  const r=await fetch(`${API_BASE}/api/media/upload`,{method:'POST',headers:{'Content-Type':'application/json'},body:j({files:payload})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.details||data?.error||'upload_failed');
  return Array.isArray(data?.urls)?data.urls.filter(Boolean):[];
};
const uploadFilesToSupabase=async (inputId,msgId)=>{
  const input=$(inputId);
  const files=Array.from(input?.files||[]).filter(Boolean);
  if(!files.length) return [];
  const invalid=files.find(f=>!ALLOWED_MEDIA_TYPES.includes(String(f.type||'').toLowerCase()));
  if(invalid){setUploadMsg(msgId,'סוג קובץ לא נתמך. מותר: jpg/png/webp/mp4/webm','#dc3545'); return [];}
  const tooLarge=files.find(f=>(f?.size||0)>MAX_MEDIA_BYTES);
  if(tooLarge){setUploadMsg(msgId,'קובץ גדול מדי. מקסימום 20MB לקובץ.','#dc3545'); return [];}
  setUploadMsg(msgId,'מעלה קבצים...','#0d6efd');
  try{
    const sb=await getSupabaseClient();
    const uploaded=[];
    for(let i=0;i<files.length;i++){
      const f=files[i];
      const uniqueName=`${Date.now()}-${f.name}`;
      const fileName=safeFileName(uniqueName);
      const path=`tools/${fileName}`;
      const {error:uploadError}=await sb.storage.from(TOOL_MEDIA_BUCKET).upload(path,f,{upsert:false,contentType:f.type||undefined});
      if(uploadError) throw uploadError;
      const {data:pub}=sb.storage.from(TOOL_MEDIA_BUCKET).getPublicUrl(path);
      if(pub?.publicUrl) uploaded.push(pub.publicUrl);
    }
    const urls=uploaded.filter(Boolean);
    setUploadMsg(msgId,`הועלו ${urls.length} קבצים בהצלחה`,'#198754');
    return urls;
  }catch(err){
    try{
      const fallbackUrls=await uploadFilesViaApiFallback(files);
      setUploadMsg(msgId,`הועלו ${fallbackUrls.length} קבצים בהצלחה`,'#198754');
      return fallbackUrls;
    }catch{
      setUploadMsg(msgId,`שגיאת העלאה: ${err?.message||'network_error'}`,'#dc3545');
      return [];
    }
  }
};
function renderSchedule(){
  const s=$('selectedTool'),picker=$('dateRangePicker'); if(!s||!picker)return;
  $('cartSummary').textContent='בחרו תאריך לכלי הנבחר';
  const fillTools=()=>{const all=tools(); s.innerHTML=all.map(x=>`<option value='${x.id}'>${x.name}</option>`).join('');};
  fillTools();
  const b=booking(); if(b.toolId)s.value=b.toolId; $('pickupType').value=b.pickupType||'בת שלמה';
  let selectedDates = Array.isArray(b.selectedDates) ? [...b.selectedDates].sort() : [];
  let bookedRanges=[];
  let bookedDatesSet=new Set();
  let fp=null;

  const setSelectedLabel=()=>{$('selectedDatesLabel').textContent = selectedDates.length ? `${selectedDates[0]} עד ${selectedDates[selectedDates.length-1]}` : 'לא נבחר';};
  const setBookedRangesLabel=()=>{
    const lbl=$('bookedRangesLabel'); if(!lbl) return;
    lbl.textContent=bookedRanges.length?bookedRanges.map(r=>`${r.start_date} עד ${r.end_date}`).join(' | '):'אין כרגע';
  };
  const hasConflict=(dates)=>dates.some(d=>bookedDatesSet.has(d));
  const applyCalendar=()=>{
    const all=tools();
    if(!all.length) return;
    if(!s.value || !all.find(x=>x.id===s.value)) s.value=all[0].id;
    const t=all.find(x=>x.id===s.value)||all[0];
    $('toolStatus').textContent = t.status==='maintenance' ? 'בתחזוקה' : 'פנוי';
    if(fp) fp.destroy();
    fp=flatpickr(picker,{mode:'range',dateFormat:'Y-m-d',minDate:'today',disable:[d=>t.status==='maintenance'||bookedDatesSet.has(ymd(d))],defaultDate:selectedDates.length?[selectedDates[0],selectedDates[selectedDates.length-1]]:null,onDayCreate:(_d,_s,_fp,dayElem)=>{
      const key=ymd(dayElem.dateObj);
      dayElem.classList.add('day-cell');
      if(bookedDatesSet.has(key)) dayElem.classList.add('day-booked');
      else dayElem.classList.add('day-available');
    },onChange:(arr)=>{
      if(arr.length===2){
        const start=ymd(arr[0]),end=ymd(arr[1]);
        const next=expandDateRange(start,end);
        if(hasConflict(next)){
          selectedDates=[];
          setSelectedLabel();
          fp.clear();
          alert('לא ניתן לבחור טווח תאריכים החופף להזמנה קיימת.');
          return;
        }
        selectedDates=next;
      }else if(arr.length===1){
        selectedDates=[ymd(arr[0])];
      }else selectedDates=[];
      setSelectedLabel();
    }});
    setSelectedLabel();
  };
  const refreshOrdersForTool=async ()=>{
    const rows=await fetchOrdersFromServer();
    bookedRanges=rows.filter(o=>o.tool_id===s.value&&o.status!=='cancelled'&&o.start_date&&o.end_date);
    bookedDatesSet=new Set(bookedRanges.flatMap(o=>expandDateRange(o.start_date,o.end_date)));
    setBookedRangesLabel();
    applyCalendar();
  };
  s.addEventListener('change',async ()=>{selectedDates=[];setSelectedLabel();await refreshOrdersForTool();});
  $('saveSchedule').onclick=()=>{
    if(!selectedDates.length){alert('נא לבחור טווח תאריכים לפני שמירה');return;}
    if(hasConflict(selectedDates)){alert('התאריכים שנבחרו כבר תפוסים.');return;}
    saveBooking({toolId:s.value,selectedDates,pickupType:$('pickupType').value,cart:cart()});
    alert('נשמר בהצלחה');
  };
  window.addEventListener('tools-updated',()=>{fillTools();refreshOrdersForTool();});
  setInterval(async ()=>{const ok=await syncToolsFromServer(); if(ok){fillTools(); await refreshOrdersForTool();}},30000);
  refreshOrdersForTool();
}

function renderPayment(){
  if(!$('orderSummary'))return;
  const t=tools(), b=booking();
  const toolName=(t.find(x=>x.id===b.toolId)||{}).name || 'לא נבחר';
  const selectedDates = (b.selectedDates||[]).join(', ') || '-';
  $('orderSummary').textContent=`כלי: ${toolName} | תאריכים: ${selectedDates} | איסוף: ${b.pickupType||'בת שלמה'}`;
  $('confirmPayment').onclick=async ()=>{
    const req=['invoiceName','customerPhone','customerEmail'];
    if(req.some(id=>!$(id).value.trim())){ $('paymentMsg').textContent='נא למלא שם לחשבונית, טלפון ואימייל'; $('paymentMsg').style.color='#dc3545'; return; }
    if(!b.toolId || !(b.selectedDates||[]).length){ $('paymentMsg').textContent='נא לבחור כלי ותאריכים לפני אישור ההזמנה'; $('paymentMsg').style.color='#dc3545'; return; }
    const selectedSorted=uniqueDates(b.selectedDates||[]);
    const orderData={
      tool_id:b.toolId,
      start_date:selectedSorted[0],
      end_date:selectedSorted[selectedSorted.length-1],
      customer_name:$('invoiceName').value.trim(),
      customer_phone:$('customerPhone').value.trim(),
      customer_email:$('customerEmail').value.trim()
    };
    $('confirmPayment').disabled=true;
    const orders=await fetchOrdersFromServer();
    const hasOverlap=orders.some(o=>o.tool_id===b.toolId&&o.status!=='cancelled'&&rangesOverlap(selectedSorted[0],selectedSorted[selectedSorted.length-1],o.start_date,o.end_date));
    if(hasOverlap){
      $('confirmPayment').disabled=false;
      $('paymentMsg').textContent='חלק מהתאריכים כבר נתפסו על ידי הזמנה אחרת. נא לבחור תאריכים אחרים.';
      $('paymentMsg').style.color='#dc3545';
      return;
    }
    const sent=await sendOrderToAdmin(orderData);
    $('confirmPayment').disabled=false;
    if(sent.ok){
      $('paymentMsg').textContent='ההזמנה אושרה ונשלחה למנהל בהצלחה.'; $('paymentMsg').style.color='#198754';
      return;
    }
    if(sent.status===409){
      $('paymentMsg').textContent='התאריכים שנתבחרו כבר נתפסו. נא לבחור תאריכים אחרים.';
      $('paymentMsg').style.color='#dc3545';
      return;
    }
    if(sent.message){
      $('paymentMsg').textContent=`שגיאת שרת: ${sent.message}`;
      $('paymentMsg').style.color='#dc3545';
      return;
    }
    $('paymentMsg').textContent='לא ניתן היה לשלוח הזמנה כרגע. נא לנסות שוב בעוד כמה דקות.';
    $('paymentMsg').style.color='#fd7e14';
  };
}

function initContactForm(){
  const form=$('contactForm');
  if(!form) return;
  const submitBtn=$('contactSubmitBtn');
  const msg=$('contactFormMsg');
  const setMsg=(text,color)=>{ if(msg){ msg.textContent=text; msg.style.color=color||''; } };

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload={
      name:($('contactName')?.value||'').trim(),
      email:($('contactEmail')?.value||'').trim(),
      phone:($('contactPhone')?.value||'').trim(),
      message:($('contactMessage')?.value||'').trim()
    };

    if(!payload.message){
      setMsg('נא למלא הודעה לפני שליחה','#dc3545');
      return;
    }

    if(submitBtn){ submitBtn.disabled=true; submitBtn.textContent='Sending...'; }
    setMsg('');

    try{
      const r=await fetch('https://techno-rental.onrender.com/api/contact',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:j(payload)
      });
      if(!r.ok) throw new Error('request_failed');
      const data=await r.json().catch(()=>({}));
      if(!data?.ok) throw new Error('invalid_response');
      setMsg('ההודעה נשלחה! נחזור אליך בהקדם','#198754');
      form.reset();
    }catch{
      setMsg('שגיאה בשליחת ההודעה. נסו שוב בעוד מספר דקות.','#dc3545');
    }finally{
      if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent='Submit'; }
    }
  });
}

function renderAdmin(){
  if(!$('adminLoginPanel'))return;
  const mergeMediaIntoField=(fieldId,newUrls=[])=>{
    const existing=parseMediaInput($(fieldId)?.value||'');
    const merged=Array.from(new Set([...existing,...newUrls]));
    if($(fieldId)) $(fieldId).value=merged.join('\n');
    return merged;
  };
  const setAdminMsg=(text,color)=>{
    if(!$('adminActionMsg')) return;
    $('adminActionMsg').textContent=text||'';
    $('adminActionMsg').style.color=color||'';
  };
  const clearAddToolForm=()=>{
    ['newToolName','newToolPrice','newToolDeposit','newToolMaxDays','newToolCategory','newToolImage','newToolMedia','newToolDesc'].forEach(id=>{if($(id)) $(id).value='';});
    if($('newToolMediaFiles')) $('newToolMediaFiles').value='';
    renderMediaPreview('newToolMediaPreview',[]);
    setUploadMsg('newToolMediaUploadMsg','');
    if($('newToolName')) $('newToolName').focus();
  };
  const show=v=>{$('adminLoginPanel').style.display=v?'none':'block'; $('adminPanel').style.display=v?'block':'none'; $('adminToolsPanel').style.display=v?'block':'none'; if(v)renderAdminList();};
  show(localStorage.getItem(ADMIN_KEY)==='1');
  $('managerLoginBtn').onclick=()=>{if($('managerUser').value.trim()===ADMIN_USERNAME&&$('managerPass').value.trim()===ADMIN_PASSWORD){localStorage.setItem(ADMIN_KEY,'1');document.documentElement.classList.add('show-admin');show(true);}else $('adminLoginMsg').textContent='פרטים שגויים';};
  $('adminLogoutBtn').onclick=()=>{localStorage.setItem(ADMIN_KEY,'0');document.documentElement.classList.remove('show-admin');show(false)};
  let activeOrderFilter='all';
  const computeTimeStatus=(o)=>{
    const today=ymd(new Date());
    if(!o.start_date||!o.end_date) return 'upcoming';
    if(o.end_date<today) return 'completed';
    if(o.start_date>today) return 'upcoming';
    return 'active';
  };
  const passesOrderFilter=(o,timeStatus)=>{
    if(activeOrderFilter==='all') return true;
    if(activeOrderFilter==='today'){ const t=ymd(new Date()); return o.start_date<=t&&o.end_date>=t; }
    if(activeOrderFilter==='upcoming') return timeStatus==='upcoming';
    if(activeOrderFilter==='completed') return timeStatus==='completed';
    return true;
  };
  const renderOrdersTable=async ()=>{
    const body=$('ordersTableBody');
    if(!body) return;
    body.innerHTML='<tr><td colspan="7">Loading bookings...</td></tr>';
    const rows=await fetchOrdersFromServer();
    const filtered=rows.filter(o=>passesOrderFilter(o,computeTimeStatus(o)));
    const summary=$('ordersFilterSummary');
    if(summary) summary.textContent=`מציג ${filtered.length} מתוך ${rows.length} הזמנות`;
    if(!filtered.length){
      body.innerHTML='<tr><td colspan="7">No bookings found</td></tr>';
      return;
    }
    body.innerHTML='';
    filtered.forEach(o=>{
      const tr=document.createElement('tr');
      const status=o.status||'pending';
      const timeStatus=computeTimeStatus(o);
      tr.innerHTML=`<td>${o.id||'-'}</td><td>${o.customer_name||'-'}</td><td>${o.customer_phone||'-'}</td><td>${o.tool_id||'-'}</td><td>${o.start_date||'-'}</td><td>${o.end_date||'-'}</td><td><span class='badge ${timeStatus}'>${timeStatus==='upcoming'?'Upcoming':timeStatus==='active'?'Active':'Completed'}</span> <span class='small'>(${status})</span></td>`;
      body.appendChild(tr);
    });
  };
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.admin-tab').forEach(t=>t.classList.add('hidden')); $('tab-'+b.dataset.tab).classList.remove('hidden'); if(b.dataset.tab==='orders') renderOrdersTable();});
  document.querySelectorAll('[data-order-filter]').forEach(btn=>btn.onclick=()=>{activeOrderFilter=btn.dataset.orderFilter||'all'; document.querySelectorAll('[data-order-filter]').forEach(b=>b.setAttribute('aria-pressed',b===btn?'true':'false')); renderOrdersTable();});
  if($('refreshOrdersBtn')) $('refreshOrdersBtn').onclick=renderOrdersTable;
  const fill=()=>{const h=tools().map(x=>`<option value='${x.id}'>${x.name}</option>`).join(''); ['editToolSelect','availToolSelect','maintToolSelect'].forEach(id=>$(id).innerHTML=h); loadEditForm();};
  const loadEditForm=()=>{
    const t=tools().find(v=>v.id===$('editToolSelect').value) || tools()[0];
    if(!t) return;
    const media=normalizeToolMedia(t);
    $('editToolSelect').value=t.id;
    $('editToolName').value=t.name||'';
    $('editToolPrice').value=t.price||0;
    $('editToolDeposit').value=t.deposit||0;
    $('editToolMaxDays').value=t.maxDays||0;
    $('editToolCategory').value=t.category||'';
    $('editToolImage').value=t.image||'';
    $('editToolMedia').value=media.join('\n');
    renderMediaPreview('editToolMediaPreview',media);
    setUploadMsg('editToolMediaUploadMsg','');
    $('editToolStatus').value=t.status||'available';
    $('editToolBusyDates').value=(t.busyDates||[]).join(', ');
    $('editToolDesc').value=t.desc||'';
  };
  if($('newToolMedia')) $('newToolMedia').addEventListener('input',()=>renderMediaPreview('newToolMediaPreview',parseMediaInput($('newToolMedia').value||'')));
  if($('editToolMedia')) $('editToolMedia').addEventListener('input',()=>renderMediaPreview('editToolMediaPreview',parseMediaInput($('editToolMedia').value||'')));
  if($('newToolMediaFiles')) $('newToolMediaFiles').addEventListener('change',async ()=>{
    const urls=await uploadFilesToSupabase('newToolMediaFiles','newToolMediaUploadMsg');
    if($('newToolMediaFiles')) $('newToolMediaFiles').value='';
    if(urls.length){
      const merged=mergeMediaIntoField('newToolMedia',urls);
      renderMediaPreview('newToolMediaPreview',merged);
      if(!$('newToolImage').value.trim()) $('newToolImage').value=merged[0]||'';
    }
  });
  if($('editToolMediaFiles')) $('editToolMediaFiles').addEventListener('change',async ()=>{
    const urls=await uploadFilesToSupabase('editToolMediaFiles','editToolMediaUploadMsg');
    if($('editToolMediaFiles')) $('editToolMediaFiles').value='';
    if(urls.length){
      const merged=mergeMediaIntoField('editToolMedia',urls);
      renderMediaPreview('editToolMediaPreview',merged);
      if(!$('editToolImage').value.trim()) $('editToolImage').value=merged[0]||'';
    }
  });
  $('editToolSelect').onchange=loadEditForm;
  const stringifyServerError=(err)=>{
    try{return JSON.stringify(err?.body||err||{error:'unknown_error'});}catch{return '{"error":"unknown_error"}';}
  };
  $('addToolBtn').onclick=async ()=>{
    const btn=$('addToolBtn');
    const name=$('newToolName').value.trim();
    const desc=$('newToolDesc').value.trim();
    const price=+($('newToolPrice').value||0);
    if(!name||!desc||price<=0){setAdminMsg('נא למלא שם/מחיר/תיאור','#dc3545');return;}
    const media=parseMediaInput(($('newToolMedia')?.value||''));
    const image=media[0]||$('newToolImage').value||`https://picsum.photos/seed/${encodeURIComponent(name)}/600/400`;
    const newTool={
      name,
      category:$('newToolCategory').value||'כלי',
      price,
      deposit:+$('newToolDeposit').value||3000,
      maxDays:+$('newToolMaxDays').value||2,
      image_url:image,
      description:desc,
      media_urls:media.length?media:[image],
    };
    if(btn){btn.disabled=true;btn.textContent='מוסיף...';}
    try{
      await createToolOnServer(newTool);
      await syncToolsFromServer();
      fill(); renderAdminList(); clearAddToolForm();
      setAdminMsg(`הכלי "${name}" נוסף ונשמר בהצלחה לכולם. אפשר להוסיף כלי נוסף.`,'#198754');
    }catch(err){
      setAdminMsg(stringifyServerError(err),'#dc3545');
    }finally{
      if(btn){btn.disabled=false;btn.textContent='הוסף כלי';}
    }
  };
  $('saveEditToolBtn').onclick=async ()=>{
    const x=tools().find(v=>v.id===$('editToolSelect').value); if(!x)return;
    const media=parseMediaInput(($('editToolMedia')?.value||''));
    const normalizedMedia=media.length?media:normalizeToolMedia(x);
    const edited={
      ...x,
      id:x.id,
      name:$('editToolName').value.trim()||x.name,
      price:+($('editToolPrice').value||x.price||0),
      deposit:+($('editToolDeposit').value||x.deposit||0),
      maxDays:+($('editToolMaxDays').value||x.maxDays||0),
      category:$('editToolCategory').value.trim()||x.category||'כלי',
      image_url:normalizedMedia[0]||$('editToolImage').value.trim()||x.image,
      description:$('editToolDesc').value.trim()||x.desc,
      media_urls:normalizedMedia,
      busyDates:$('editToolBusyDates').value.split(',').map(s=>s.trim()).filter(Boolean),
      is_available:($('editToolStatus').value||x.status||'available')!=='maintenance',
      maintenance:($('editToolStatus').value||x.status||'available')==='maintenance',
      alerts:Array.isArray(x.alerts)?x.alerts:[]
    };
    try{
      await updateToolOnServer(x.id,edited);
      await syncToolsFromServer();
      setAdminMsg('העריכה נשמרה בהצלחה ומעודכנת לכל המשתמשים','#198754');
      renderMediaPreview('editToolMediaPreview',normalizedMedia);
      if($('editToolMediaFiles')) $('editToolMediaFiles').value='';
      fill(); renderAdminList();
    }catch(err){
      setAdminMsg(stringifyServerError(err),'#dc3545');
    }
  };
  $('saveBusyDatesBtn').onclick=async ()=>{
    const x=tools().find(v=>v.id===$('availToolSelect').value); if(!x)return;
    const edited={...x,busyDates:$('busyDates').value.split(',').map(s=>s.trim()).filter(Boolean)};
    try{
      await updateToolOnServer(x.id,edited);
      await syncToolsFromServer();
      setAdminMsg('הזמינות נשמרה בהצלחה','#198754');
      fill(); renderAdminList();
    }catch(err){
      setAdminMsg(stringifyServerError(err),'#dc3545');
    }
  };
  $('saveMaintBtn').onclick=async ()=>{
    const x=tools().find(v=>v.id===$('maintToolSelect').value); if(!x)return;
    const status=$('maintStatus').value||'available';
    const edited={...x,status,is_available:status!=='maintenance',maintenance:status==='maintenance'};
    try{
      await updateToolOnServer(x.id,edited);
      await syncToolsFromServer();
      setAdminMsg('התחזוקה נשמרה בהצלחה','#198754');
      fill(); renderAdminList();
    }catch(err){
      setAdminMsg(stringifyServerError(err),'#dc3545');
    }
  };
  renderOrdersTable();
  fill(); renderAdminList();
}
function renderAdminList(){
  const l=$('adminToolsList');
  if(!l)return;
  l.innerHTML=tools().map(t=>{
    const img=t.image||t.image_url||normalizeToolMedia(t)[0]||'';
    return `<div style='display:flex;align-items:center;gap:10px;margin-bottom:8px'><img src='${img}' alt='${t.name}' style='width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb'><div><strong>${t.name}</strong><div class='small'>₪${Number(t.price||0)} ליום | פיקדון ₪${Number(t.deposit||0)}</div></div><span style='margin-inline-start:auto'>${t.status==='maintenance'?'בתחזוקה':'זמין'}</span></div>`;
  }).join('');
}

function openStatement(){const txt='הצהרת נגישות: האתר פועל להנגשה מיטבית לכלל המשתמשים.'; const m=document.createElement('div'); m.className='modal'; m.innerHTML=`<div class='modal-content'><h3>הצהרת נגישות</h3><p>${txt}</p><button class='secondary'>סגירה</button></div>`; document.body.appendChild(m); m.querySelector('button').onclick=()=>m.remove();}
function openReport(){const m=document.createElement('div'); m.className='modal'; m.innerHTML=`<div class='modal-content'><h3>דיווח הפרה</h3><div class='form-grid'><div><label>שם</label><input id='rn'></div><div><label>טלפון</label><input id='rp'></div><div><label>סיבת פניה</label><input id='rr'></div><div style='grid-column:1/-1'><label>תוכן</label><textarea id='rc'></textarea></div></div><div class='actions'><button id='sendr' class='primary'>שליחה</button><button id='cls' class='secondary'>סגירה</button></div></div>`; document.body.appendChild(m); m.querySelector('#cls').onclick=()=>m.remove(); m.querySelector('#sendr').onclick=()=>{const body=`שם: ${m.querySelector('#rn').value}\nטלפון: ${m.querySelector('#rp').value}\nסיבה: ${m.querySelector('#rr').value}\nתוכן: ${m.querySelector('#rc').value}`; location.href=`mailto:tec_ele1@017.net.il?subject=דיווח%20הפרת%20נגישות&body=${encodeURIComponent(body)}`;};}
function initAccess(){const b=$('accessBtn'),pnl=$('accessPanel'); if(!b||!pnl)return; const opts=[['mono','מונוכרום'],['sepia','ספיה'],['hc','ניגודיות'],['statement','הצהרה'],['report','דיווח'],['reset','איפוס']]; pnl.innerHTML=opts.map(([k,t])=>`<button data-k='${k}' class='secondary'>${t}</button>`).join(''); b.onclick=()=>pnl.classList.toggle('open'); pnl.querySelectorAll('button').forEach(x=>x.onclick=()=>{const k=x.dataset.k; if(['mono','sepia','hc'].includes(k)) document.body.classList.toggle(k); else if(k==='statement') openStatement(); else if(k==='report') openReport(); else document.body.className='';});}

async function initApp(){
  const page=document.body.dataset.page||'';
  initContactForm();
  initAdminLinkVisibility();
  ensureAdminFooterLink();
  if(toolPages.has(page)){
    await syncToolsFromServer();
    if(!tools().length){
      const seeded=await bootstrapDefaultToolsIfEmpty();
      if(seeded) await syncToolsFromServer();
    }
    initToolsRealtime();
    setInterval(syncToolsFromServer,30000);
  }
  if(page==='catalog')renderCatalog();
  if(page==='schedule')renderSchedule();
  if(page==='payment')renderPayment();
  if(page==='admin')renderAdmin();
  initAccess();
  initTopActions();
}
initApp();
