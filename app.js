
const STORAGE_KEY='technoTools',CART_KEY='technoCart',BOOKING_KEY='technoBooking',ADMIN_KEY='technoAdminLogged',ADMIN_USERNAME='Gal65',ADMIN_PASSWORD='Gal65$',API_BASE='/api';
const defaults=['מקדחת יהלום','מקדחת אדמה','קונגו','מכונת פוליש','שואב אבק תעשייתי','גנרטור','מחרצת בטון','אקדח מסמרים עם מדחס','רמפה לגובה 1.8 מטר משקל 1 טון','פטישון נטען','מדחס אויר','מכונה לחידוש דקים','משאבת טבילה','משאבת מים'].map((n,i)=>({id:'t'+(i+1),name:n,desc:'תיאור כלי מקצועי',price:400,deposit:3000,maxDays:2,category:'כלי עבודה',image:`https://picsum.photos/seed/${encodeURIComponent(n)}/600/400`,busyDates:[],status:'available'}));
const $=id=>document.getElementById(id), j=v=>JSON.stringify(v), p=v=>{try{return JSON.parse(v)}catch{return null}};
const tools=()=>p(localStorage.getItem(STORAGE_KEY))||defaults, saveTools=t=>localStorage.setItem(STORAGE_KEY,j(t));
const cart=()=>p(localStorage.getItem(CART_KEY))||[], saveCart=c=>localStorage.setItem(CART_KEY,j(c));
const booking=()=>p(localStorage.getItem(BOOKING_KEY))||{}, saveBooking=b=>localStorage.setItem(BOOKING_KEY,j(b));
if(!localStorage.getItem(STORAGE_KEY)) saveTools(defaults);

async function syncToolsFromServer(){
  try{
    const r=await fetch(`${API_BASE}/tools`,{headers:{'Accept':'application/json'}});
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
    const r=await fetch(`${API_BASE}/tools`,{method:'PUT',headers:{'Content-Type':'application/json'},body:j(t)});
    return r.ok;
  }catch{return false}
}
async function sendOrderToAdmin(payload){
  try{
    const r=await fetch(`${API_BASE}/orders`,{method:'POST',headers:{'Content-Type':'application/json'},body:j(payload)});
    return r.ok;
  }catch{return false}
}

function initTopActions(){
  const wrap=document.createElement('div');
  wrap.className='floating-actions';
  wrap.innerHTML="<button id='backBtn' class='secondary'>⬅ חזרה</button><button id='resetHomeBtn' class='danger'>⌂ התחלה מחדש</button>";
  document.body.appendChild(wrap);
  document.getElementById('backBtn').onclick=()=>history.back();
  document.getElementById('resetHomeBtn').onclick=()=>{localStorage.removeItem(CART_KEY);localStorage.removeItem(BOOKING_KEY);location.href='index.html';};
}

function renderCatalog(){
  const g=$('toolsGrid'); if(!g) return;
  const q=$('toolSearch');
  const draw=()=>{
    const filter=(q?.value||'').trim();
    g.innerHTML='';
    tools().filter(t=>!filter||t.name.includes(filter)).forEach(x=>{
      const d=document.createElement('article'); d.className='card';
      d.innerHTML=`<img src='${x.image}' alt='${x.name}'><div class='card-content'><h3>${x.name}</h3><p>${x.desc}</p><span class='pill'>${x.price} ש"ח</span><div class='actions'><button class='primary choose' data-id='${x.id}'>בחירה והמשך לזמינות</button></div></div>`;
      g.appendChild(d);
    });
    g.querySelectorAll('.choose').forEach(b=>b.onclick=()=>{
      saveBooking({toolId:b.dataset.id, selectedDates:[], pickupType:'בת שלמה'});
      location.href='schedule.html';
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
function renderSchedule(){
  const s=$('selectedTool'),cg=$('calendarGrid'); if(!s||!cg)return;
  $('cartSummary').textContent='בחרו תאריך לכלי הנבחר';
  const fillTools=()=>{const all=tools(); s.innerHTML=all.map(x=>`<option value='${x.id}'>${x.name}</option>`).join('');};
  fillTools();
  const b=booking(); if(b.toolId)s.value=b.toolId; $('pickupType').value=b.pickupType||'בת שלמה';
  const buildRange=(start,end)=>{
    if(!start||!end) return [];
    const out=[];
    const d1=new Date(start+'T00:00:00');
    const d2=new Date(end+'T00:00:00');
    const from=d1<=d2?d1:d2, to=d1<=d2?d2:d1;
    const cur=new Date(from);
    while(cur<=to){ out.push(ymd(cur)); cur.setDate(cur.getDate()+1); }
    return out;
  };
  let selectedDates = Array.isArray(b.selectedDates) ? [...b.selectedDates].sort() : [];
  let rangeStart = selectedDates[0] || null;
  let rangeEnd = selectedDates[selectedDates.length-1] || null;

  const paint=()=>{
    const all=tools();
    if(!all.length){ cg.innerHTML='<p class="small">אין כלים זמינים</p>'; return; }
    if(!s.value || !all.find(x=>x.id===s.value)) s.value=all[0].id;
    const t=all.find(x=>x.id===s.value)||all[0];
    $('toolStatus').textContent = t.status==='maintenance' ? 'בתחזוקה' : 'פנוי';
    cg.innerHTML='';
    const start=new Date();
    for(let i=0;i<42;i++){
      const d=new Date(start); d.setDate(start.getDate()+i); const key=ymd(d);
      const c=document.createElement('button'); c.type='button'; c.className='cal-day'; c.textContent=`${d.getDate()}/${d.getMonth()+1}`;
      if(t.status==='maintenance') c.classList.add('cal-maint');
      if((t.busyDates||[]).includes(key)) c.classList.add('cal-busy');
      if(selectedDates.includes(key)) c.classList.add('cal-selected');
      c.disabled = (t.status==='maintenance') || (t.busyDates||[]).includes(key);
      c.onclick=()=>{
        if(!rangeStart){
          rangeStart=key; rangeEnd=key;
        }else if(rangeStart && rangeEnd && rangeStart===rangeEnd){
          rangeEnd=key;
        }else{
          rangeStart=key; rangeEnd=key;
        }
        selectedDates = buildRange(rangeStart, rangeEnd);
        paint();
      };
      cg.appendChild(c);
    }
    $('selectedDatesLabel').textContent = selectedDates.length ? `${selectedDates[0]} עד ${selectedDates[selectedDates.length-1]}` : 'לא נבחר';
  };
  s.addEventListener('change',paint);
  $('saveSchedule').onclick=()=>{saveBooking({toolId:s.value,selectedDates,pickupType:$('pickupType').value,cart:cart()}); alert('נשמר בהצלחה');};
  window.addEventListener('tools-updated',()=>{fillTools();paint();});
  setInterval(async ()=>{const ok=await syncToolsFromServer(); if(ok){fillTools(); paint();}},30000);
  paint();
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
    const orderData={
      invoiceName:$('invoiceName').value.trim(),
      customerPhone:$('customerPhone').value.trim(),
      customerEmail:$('customerEmail').value.trim(),
      toolName,
      selectedDates:(b.selectedDates||[]),
      pickupType:b.pickupType||'בת שלמה',
      subject:'הזמנה חדשה - אתר השכרה'
    };
    $('confirmPayment').disabled=true;
    await syncToolsFromServer();
    const allTools=tools();
    const tool=allTools.find(x=>x.id===b.toolId);
    if(!tool){
      $('confirmPayment').disabled=false;
      $('paymentMsg').textContent='הכלי שנבחר לא נמצא כרגע. נא לחזור לבחירת כלי.';
      $('paymentMsg').style.color='#dc3545';
      return;
    }
    const reqDates=uniqueDates(b.selectedDates||[]);
    const conflicts=reqDates.filter(d=>(tool.busyDates||[]).includes(d));
    if(conflicts.length){
      $('confirmPayment').disabled=false;
      $('paymentMsg').textContent='חלק מהתאריכים כבר נתפסו על ידי הזמנה אחרת. נא לבחור תאריכים אחרים.';
      $('paymentMsg').style.color='#dc3545';
      return;
    }
    tool.busyDates=uniqueDates([...(tool.busyDates||[]),...reqDates]);
    const savedForAll=await saveToolsEverywhere(allTools);
    if(!savedForAll){
      $('confirmPayment').disabled=false;
      $('paymentMsg').textContent='ההזמנה לא נשמרה לכולם כרגע (שרת לא זמין). נסה שוב בעוד כמה דקות.';
      $('paymentMsg').style.color='#dc3545';
      return;
    }

    const sent=await sendOrderToAdmin(orderData);
    $('confirmPayment').disabled=false;
    if(sent){
      $('paymentMsg').textContent='ההזמנה אושרה ונשלחה למנהל בהצלחה.'; $('paymentMsg').style.color='#198754';
      return;
    }
    $('paymentMsg').textContent='ההזמנה נשמרה לכל המשתמשים, אך לא ניתן היה לשלוח אוטומטית למנהל כרגע. נא לנסות שוב בעוד כמה דקות.';
    $('paymentMsg').style.color='#fd7e14';
  };
}

function renderAdmin(){
  if(!$('adminLoginPanel'))return;
  const show=v=>{$('adminLoginPanel').style.display=v?'none':'block'; $('adminPanel').style.display=v?'block':'none'; $('adminToolsPanel').style.display=v?'block':'none'; if(v)renderAdminList();};
  show(localStorage.getItem(ADMIN_KEY)==='1');
  $('managerLoginBtn').onclick=()=>{if($('managerUser').value.trim()===ADMIN_USERNAME&&$('managerPass').value.trim()===ADMIN_PASSWORD){localStorage.setItem(ADMIN_KEY,'1');show(true);}else $('adminLoginMsg').textContent='פרטים שגויים';};
  $('adminLogoutBtn').onclick=()=>{localStorage.setItem(ADMIN_KEY,'0');show(false)};
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.admin-tab').forEach(t=>t.classList.add('hidden')); $('tab-'+b.dataset.tab).classList.remove('hidden');});
  const fill=()=>{const h=tools().map(x=>`<option value='${x.id}'>${x.name}</option>`).join(''); ['editToolSelect','availToolSelect','maintToolSelect'].forEach(id=>$(id).innerHTML=h); loadEditForm();};
  const loadEditForm=()=>{
    const t=tools().find(v=>v.id===$('editToolSelect').value) || tools()[0];
    if(!t) return;
    $('editToolSelect').value=t.id;
    $('editToolName').value=t.name||'';
    $('editToolPrice').value=t.price||0;
    $('editToolDeposit').value=t.deposit||0;
    $('editToolMaxDays').value=t.maxDays||0;
    $('editToolCategory').value=t.category||'';
    $('editToolImage').value=t.image||'';
    $('editToolStatus').value=t.status||'available';
    $('editToolBusyDates').value=(t.busyDates||[]).join(', ');
    $('editToolDesc').value=t.desc||'';
  };
  $('editToolSelect').onchange=loadEditForm;
  $('addToolBtn').onclick=async ()=>{const t=tools(),name=$('newToolName').value.trim(),desc=$('newToolDesc').value.trim(),price=+($('newToolPrice').value||0); if(!name||!desc||price<=0){$('adminActionMsg').textContent='נא למלא שם/מחיר/תיאור';return;} t.unshift({id:'t'+Date.now(),name,desc,price,deposit:+$('newToolDeposit').value||3000,maxDays:+$('newToolMaxDays').value||2,category:$('newToolCategory').value||'כלי',image:$('newToolImage').value||`https://picsum.photos/seed/${encodeURIComponent(name)}/600/400`,busyDates:[],status:'available'}); await saveToolsEverywhere(t); $('adminActionMsg').textContent='המוצר נוסף ונשמר בהצלחה לכולם'; fill(); renderAdminList();};
  $('saveEditToolBtn').onclick=async ()=>{
    const t=tools(),x=t.find(v=>v.id===$('editToolSelect').value); if(!x)return;
    x.name=$('editToolName').value.trim()||x.name;
    x.price=+($('editToolPrice').value||x.price||0);
    x.deposit=+($('editToolDeposit').value||x.deposit||0);
    x.maxDays=+($('editToolMaxDays').value||x.maxDays||0);
    x.category=$('editToolCategory').value.trim()||x.category||'כלי';
    x.image=$('editToolImage').value.trim()||x.image;
    x.status=$('editToolStatus').value||x.status||'available';
    x.busyDates=$('editToolBusyDates').value.split(',').map(s=>s.trim()).filter(Boolean);
    x.desc=$('editToolDesc').value.trim()||x.desc;
    await saveToolsEverywhere(t);
    $('adminActionMsg').textContent='העריכה נשמרה בהצלחה ומעודכנת לכל המשתמשים';
    fill(); renderAdminList();
  };
  $('saveBusyDatesBtn').onclick=async ()=>{const t=tools(),x=t.find(v=>v.id===$('availToolSelect').value); if(!x)return; x.busyDates=$('busyDates').value.split(',').map(s=>s.trim()).filter(Boolean); await saveToolsEverywhere(t); $('adminActionMsg').textContent='הזמינות נשמרה בהצלחה';};
  $('saveMaintBtn').onclick=async ()=>{const t=tools(),x=t.find(v=>v.id===$('maintToolSelect').value); if(!x)return; x.status=$('maintStatus').value; await saveToolsEverywhere(t); $('adminActionMsg').textContent='התחזוקה נשמרה בהצלחה'; renderAdminList();};
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
syncToolsFromServer();
initAccess();
initTopActions();
