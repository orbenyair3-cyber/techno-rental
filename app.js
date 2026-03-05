
const STORAGE_KEY='technoTools',CART_KEY='technoCart',BOOKING_KEY='technoBooking',ADMIN_KEY='technoAdminLogged',ADMIN_USERNAME='Gal65',ADMIN_PASSWORD='Gal65$',API_BASE='https://techno-rental.onrender.com';
const defaults=['מקדחת יהלום','מקדחת אדמה','קונגו','מכונת פוליש','שואב אבק תעשייתי','גנרטור','מחרצת בטון','אקדח מסמרים עם מדחס','רמפה לגובה 1.8 מטר משקל 1 טון','פטישון נטען','מדחס אויר','מכונה לחידוש דקים','משאבת טבילה','משאבת מים'].map((n,i)=>({id:'t'+(i+1),name:n,desc:'תיאור כלי מקצועי',price:400,deposit:3000,maxDays:2,category:'כלי עבודה',image:`https://picsum.photos/seed/${encodeURIComponent(n)}/600/400`,busyDates:[],status:'available'}));
const $=id=>document.getElementById(id), j=v=>JSON.stringify(v), p=v=>{try{return JSON.parse(v)}catch{return null}};
const tools=()=>p(localStorage.getItem(STORAGE_KEY))||defaults, saveTools=t=>localStorage.setItem(STORAGE_KEY,j(t));
const cart=()=>p(localStorage.getItem(CART_KEY))||[], saveCart=c=>localStorage.setItem(CART_KEY,j(c));
const booking=()=>p(localStorage.getItem(BOOKING_KEY))||{}, saveBooking=b=>localStorage.setItem(BOOKING_KEY,j(b));
if(!localStorage.getItem(STORAGE_KEY)) saveTools(defaults);

async function syncToolsFromServer(){
  try{
    const r=await fetch(`${API_BASE}/api/tools`,{headers:{'Accept':'application/json'}});
    if(!r.ok) return false;
    const serverTools=await r.json();
    if(Array.isArray(serverTools)&&serverTools.length){
      saveTools(serverTools);
      window.dispatchEvent(new Event('tools-updated'));
      return true;
    }
    return false;
  }catch{return false}
}
async function saveToolsEverywhere(t){
  saveTools(t);
  window.dispatchEvent(new Event('tools-updated'));
  try{
    const r=await fetch(`${API_BASE}/api/tools`,{method:'PUT',headers:{'Content-Type':'application/json'},body:j(t)});
    return r.ok;
  }catch{return false}
}
async function fetchOrdersFromServer(){
  try{
    const r=await fetch(`${API_BASE}/api/orders`,{headers:{'Accept':'application/json'}});
    if(!r.ok) return [];
    const rows=await r.json();
    return Array.isArray(rows)?rows:[];
  }catch{return []}
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
  if(links.querySelector('a[href="admin.html"]')) return;
  const a=document.createElement('a');
  a.href='admin.html';
  a.className='admin-link';
  a.textContent='כניסת מנהל';
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
const filesToDataUrls=async (input)=>{
  const files=Array.from(input?.files||[]).filter(Boolean);
  if(!files.length) return [];
  const out=await Promise.all(files.map(fileToDataUrl).map(p=>p.catch(()=>'')));
  return out.filter(Boolean);
};
const normalizeToolMedia=(tool)=>{
  const list=Array.isArray(tool?.media)&&tool.media.length?tool.media.filter(Boolean):[];
  const fallback=tool?.image?[tool.image]:[];
  return list.length?list:fallback;
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
    $('editToolStatus').value=t.status||'available';
    $('editToolBusyDates').value=(t.busyDates||[]).join(', ');
    $('editToolDesc').value=t.desc||'';
  };
  $('editToolSelect').onchange=loadEditForm;
  $('addToolBtn').onclick=async ()=>{const t=tools(),name=$('newToolName').value.trim(),desc=$('newToolDesc').value.trim(),price=+($('newToolPrice').value||0); if(!name||!desc||price<=0){$('adminActionMsg').textContent='נא למלא שם/מחיר/תיאור';return;} const textMedia=parseMediaInput(($('newToolMedia')?.value||'')); const uploadedMedia=await filesToDataUrls($('newToolMediaFiles')); const media=Array.from(new Set([...textMedia,...uploadedMedia])); const image=$('newToolImage').value||media[0]||`https://picsum.photos/seed/${encodeURIComponent(name)}/600/400`; t.unshift({id:'t'+Date.now(),name,desc,price,deposit:+$('newToolDeposit').value||3000,maxDays:+$('newToolMaxDays').value||2,category:$('newToolCategory').value||'כלי',image,media:media.length?media:[image],busyDates:[],status:'available'}); await saveToolsEverywhere(t); $('adminActionMsg').textContent='המוצר נוסף ונשמר בהצלחה לכולם'; if($('newToolMediaFiles')) $('newToolMediaFiles').value=''; fill(); renderAdminList();};
  $('saveEditToolBtn').onclick=async ()=>{
    const t=tools(),x=t.find(v=>v.id===$('editToolSelect').value); if(!x)return;
    const textMedia=parseMediaInput(($('editToolMedia')?.value||''));
    const uploadedMedia=await filesToDataUrls($('editToolMediaFiles'));
    const media=Array.from(new Set([...textMedia,...uploadedMedia]));
    x.name=$('editToolName').value.trim()||x.name;
    x.price=+($('editToolPrice').value||x.price||0);
    x.deposit=+($('editToolDeposit').value||x.deposit||0);
    x.maxDays=+($('editToolMaxDays').value||x.maxDays||0);
    x.category=$('editToolCategory').value.trim()||x.category||'כלי';
    x.image=$('editToolImage').value.trim()||media[0]||x.image;
    x.media=media.length?media:normalizeToolMedia(x);
    x.status=$('editToolStatus').value||x.status||'available';
    x.busyDates=$('editToolBusyDates').value.split(',').map(s=>s.trim()).filter(Boolean);
    x.desc=$('editToolDesc').value.trim()||x.desc;
    await saveToolsEverywhere(t);
    $('adminActionMsg').textContent='העריכה נשמרה בהצלחה ומעודכנת לכל המשתמשים';
    if($('editToolMediaFiles')) $('editToolMediaFiles').value='';
    fill(); renderAdminList();
  };
  $('saveBusyDatesBtn').onclick=async ()=>{const t=tools(),x=t.find(v=>v.id===$('availToolSelect').value); if(!x)return; x.busyDates=$('busyDates').value.split(',').map(s=>s.trim()).filter(Boolean); await saveToolsEverywhere(t); $('adminActionMsg').textContent='הזמינות נשמרה בהצלחה';};
  $('saveMaintBtn').onclick=async ()=>{const t=tools(),x=t.find(v=>v.id===$('maintToolSelect').value); if(!x)return; x.status=$('maintStatus').value; await saveToolsEverywhere(t); $('adminActionMsg').textContent='התחזוקה נשמרה בהצלחה'; renderAdminList();};
  renderOrdersTable();
  fill(); renderAdminList();
}
function renderAdminList(){const l=$('adminToolsList'); if(!l)return; l.innerHTML=tools().map(t=>`<div><strong>${t.name}</strong><span>${t.status==='maintenance'?'בתחזוקה':'זמין'}</span></div>`).join('');}

function openStatement(){const txt='הצהרת נגישות: האתר פועל להנגשה מיטבית לכלל המשתמשים.'; const m=document.createElement('div'); m.className='modal'; m.innerHTML=`<div class='modal-content'><h3>הצהרת נגישות</h3><p>${txt}</p><button class='secondary'>סגירה</button></div>`; document.body.appendChild(m); m.querySelector('button').onclick=()=>m.remove();}
function openReport(){const m=document.createElement('div'); m.className='modal'; m.innerHTML=`<div class='modal-content'><h3>דיווח הפרה</h3><div class='form-grid'><div><label>שם</label><input id='rn'></div><div><label>טלפון</label><input id='rp'></div><div><label>סיבת פניה</label><input id='rr'></div><div style='grid-column:1/-1'><label>תוכן</label><textarea id='rc'></textarea></div></div><div class='actions'><button id='sendr' class='primary'>שליחה</button><button id='cls' class='secondary'>סגירה</button></div></div>`; document.body.appendChild(m); m.querySelector('#cls').onclick=()=>m.remove(); m.querySelector('#sendr').onclick=()=>{const body=`שם: ${m.querySelector('#rn').value}\nטלפון: ${m.querySelector('#rp').value}\nסיבה: ${m.querySelector('#rr').value}\nתוכן: ${m.querySelector('#rc').value}`; location.href=`mailto:tec_ele1@017.net.il?subject=דיווח%20הפרת%20נגישות&body=${encodeURIComponent(body)}`;};}
function initAccess(){const b=$('accessBtn'),pnl=$('accessPanel'); if(!b||!pnl)return; const opts=[['mono','מונוכרום'],['sepia','ספיה'],['hc','ניגודיות'],['statement','הצהרה'],['report','דיווח'],['reset','איפוס']]; pnl.innerHTML=opts.map(([k,t])=>`<button data-k='${k}' class='secondary'>${t}</button>`).join(''); b.onclick=()=>pnl.classList.toggle('open'); pnl.querySelectorAll('button').forEach(x=>x.onclick=()=>{const k=x.dataset.k; if(['mono','sepia','hc'].includes(k)) document.body.classList.toggle(k); else if(k==='statement') openStatement(); else if(k==='report') openReport(); else document.body.className='';});}

if(document.body.dataset.page==='catalog')renderCatalog();
if(document.body.dataset.page==='schedule')renderSchedule();
if(document.body.dataset.page==='payment')renderPayment();
if(document.body.dataset.page==='admin')renderAdmin();
initContactForm();
initAdminLinkVisibility();
ensureAdminFooterLink();
syncToolsFromServer();
initAccess();
initTopActions();
