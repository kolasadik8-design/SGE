// Active Care - FIX V14.2 for V13.1 - All English - Add User + Odoo Inventory + Pro Thermal Print
// Compatible with index.html V13.1 - No changes to index.html needed except 1 script line
(function(){
  if(window.ACFIX142_LOADED) return;
  window.ACFIX142_LOADED = true;

  function getArr(k){ try{ return JSON.parse(localStorage.getItem(k)||'[]'); }catch(e){ return []; } }
  function setArr(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function getMeds(){ let a=getArr('ac13_meds'); if(a.length) return a; return getArr('ac_meds'); }
  function getUsers(){ let a=getArr('ac13_users'); if(a.length) return a; return getArr('ac_users'); }
  function getSales(){ let a=getArr('ac13_sales'); if(a.length) return a; return getArr('ac_sales'); }
  function fmt(n){ return Number(n||0).toLocaleString() + ' SSP'; }
  function todayStr(){ let d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  async function hashPass(p){
    try{
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('activecare-v82-'+p));
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }catch(e){ return 'h-'+p; }
  }
  async function hashPassV13(p, salt){
    try{
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p + salt));
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }catch(e){ return await hashPass(p); }
  }
  async function pushCloud(){
    try{
      if(!window._db || !window._fs) return false;
      const {collection, setDoc, doc, getDoc} = window._fs;
      const ref = doc(collection(window._db,'activecare-single'),'data');
      const snap = await getDoc(ref);
      let cloud = snap.exists() ? snap.data() : {};
      let meds = getMeds(); let users = getUsers();
      let mMeds = cloud.meds && cloud.meds.length ? cloud.meds : meds;
      let mUsers = cloud.users && cloud.users.length ? cloud.users : users;
      meds.forEach(m=>{ if(!mMeds.find(x=>String(x.id)===String(m.id))) mMeds.push(m); });
      users.forEach(u=>{ if(!mUsers.find(x=>String(x.username).toLowerCase()===String(u.username).toLowerCase())) mUsers.push(u); });
      await setDoc(ref, {...cloud, meds: mMeds, users: mUsers, version:'V13.1', updatedAt: new Date().toISOString()});
      return true;
    }catch(e){ console.log('ACFIX Cloud fail', e); return false; }
  }

  // ========== 1. ADD USER - V13.1 - Replaces old completely ==========
  window.addUser = async function(){
    let fullEl = document.getElementById('uName');
    let userEl = document.getElementById('uUser') || document.getElementById('uUsername');
    let passEl = document.getElementById('uPass');
    let roleEl = document.getElementById('uRole');
    let shiftEl = document.getElementById('uShift');
    let phoneEl = document.getElementById('uPhone');

    let full = fullEl ? fullEl.value.trim() : '';
    let username = userEl ? userEl.value.trim().toLowerCase() : '';
    let pass = passEl ? passEl.value : '';
    let roleRaw = roleEl ? roleEl.value : 'Cashier';

    let role = 'Cashier';
    if(/admin/i.test(roleRaw)) role='Admin';
    else if(/pharm/i.test(roleRaw)) role='Pharmacist';
    else if(/manager/i.test(roleRaw)) role='Pharmacist';
    else role='Cashier';

    let shift = 'Cashier Shift';
    if(role==='Admin') shift='All';
    else if(role==='Pharmacist') shift='Shift 1';
    else shift='Cashier Shift';
    if(shiftEl && shiftEl.value) shift = shiftEl.value;
    if(role==='Admin') shift='All';
    if(role==='Cashier') shift='Cashier Shift';

    if(!full){ alert('Enter Full Name'); return; }
    if(!username){ alert('Enter Username'); return; }
    if(username.includes(' ')){ alert('Username cannot have spaces. Use ahmed_ali'); return; }
    if(!pass || pass.length < 4){ alert('Password must be 4 chars or more. You entered: ' + (pass ? pass.length : 0)); return; }

    let users = getUsers();
    if(users.find(u=> String(u.username||'').toLowerCase()===username)){
      alert('Username "'+username+'" already exists! Choose another one.\nExisting: ' + users.map(u=>u.username).join(', '));
      return;
    }

    let salt = Math.random().toString(36).slice(2,10);
    let hV13 = await hashPassV13(pass, salt);
    let hOld = await hashPass(pass);

    let newUser = {
      id: Date.now(),
      username: username,
      fullName: full || username,
      passwordHash: hV13,
      salt: salt,
      passHash: hOld,
      role: role.toLowerCase(),
      Role: role,
      shift: shift,
      phone: phoneEl ? phoneEl.value.trim() : '',
      active: true,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    setArr('ac_users', users);
    setArr('ac13_users', users);
    if(window.users) window.users = users;

    if(fullEl) fullEl.value='';
    if(userEl) userEl.value='';
    if(passEl) passEl.value='';
    if(phoneEl) phoneEl.value='';

    try{ if(typeof renderUsers==='function') renderUsers(); }catch(e){}
    setTimeout(()=>{
      try{
        let list = document.getElementById('userList');
        if(list && !list.innerHTML.includes(username)){
          list.innerHTML = '<div style="padding:12px;background:#D1FAE5;border-radius:10px;margin-top:10px"><b>New User Added: '+username+' - '+role+' - '+shift+'</b><br>Users: '+users.map(u=>u.username+' ('+u.role+')').join(', ')+'</div>' + list.innerHTML;
        }
      }catch(e){}
    }, 300);

    let cloudOk = await pushCloud();
    let msg = 'SUCCESS! User "'+username+'" - '+role+' - '+shift+' added. Total: '+users.length;
    if(cloudOk) msg += ' - Saved to Local + Cloud';
    else msg += ' - Saved Local Only (Cloud offline)';
    alert(msg);
  };

  setTimeout(()=>{
    try{
      document.querySelectorAll('button').forEach(btn=>{
        if(btn.textContent && btn.textContent.includes('Add User')){
          btn.type='button';
          btn.onclick = function(e){ e.preventDefault(); window.addUser(); };
        }
      });
    }catch(e){}
  }, 1000);

  // ========== 2. MED - Form + Unit ==========
  function patchMedModal(){
    try{
      let mName = document.getElementById('mName');
      if(!mName) return;
      if(document.getElementById('acfixForm')) return;
      let cat = document.getElementById('mCategory');
      let div = document.createElement('div');
      div.innerHTML = '<div style="display:flex;gap:10px"><select id="acfixForm" style="flex:1;padding:11px;border:1px solid #E2E8E6;border-radius:10px"><option value="Tablets">Tablets</option><option value="Capsules">Capsules</option><option value="Syrup">Syrup</option><option value="Suspension">Suspension</option><option value="Injection">Injection</option><option value="Cream">Cream</option><option value="Ointment">Ointment</option><option value="Drops">Drops</option><option value="Eye Drops">Eye Drops</option><option value="Ear Drops">Ear Drops</option><option value="Spray">Spray</option><option value="Suppository">Suppository</option><option value="Sachet">Sachet</option><option value="Lotion">Lotion</option><option value="Gel">Gel</option><option value="Other">Other</option></select><select id="acfixUnit" style="flex:1;padding:11px;border:1px solid #E2E8E6;border-radius:10px"><option value="Strip">Strip</option><option value="Bottle">Bottle</option><option value="Box">Box</option><option value="Piece">Piece</option><option value="Tube">Tube</option><option value="Vial">Vial</option><option value="Ampoule">Ampoule</option><option value="Pack">Pack</option><option value="Sachet">Sachet</option></select></div><p style="font-size:11px;color:#6B7C7A">Form + Unit - Shows in Inventory & POS</p>';
      if(cat && cat.parentNode) cat.parentNode.insertBefore(div, cat.nextSibling);
      else mName.parentNode.insertBefore(div, mName.nextSibling);
    }catch(e){}
  }
  function patchSaveMed(){
    try{
      patchMedModal();
      let oldSave = window.saveMed;
      if(oldSave && !window.ACFIX_saveMedPatched){
        window.ACFIX_saveMedPatched = true;
        window.saveMed = async function(){
          let formVal = document.getElementById('acfixForm') ? document.getElementById('acfixForm').value : 'Tablets';
          let unitVal = document.getElementById('acfixUnit') ? document.getElementById('acfixUnit').value : 'Strip';
          let nameBefore = document.getElementById('mName') ? document.getElementById('mName').value.trim() : '';
          await oldSave();
          try{
            ['ac13_meds','ac_meds'].forEach(key=>{
              try{
                let arr = JSON.parse(localStorage.getItem(key)||'[]');
                if(!arr.length) return;
                for(let i=arr.length-1;i>=0;i--){
                  if(arr[i].name===nameBefore && !arr[i].form){ arr[i].form=formVal; arr[i].unit=unitVal; break; }
                }
                localStorage.setItem(key, JSON.stringify(arr));
              }catch(e){}
            });
            if(window.meds){
              for(let i=window.meds.length-1;i>=0;i--){
                if(window.meds[i].name===nameBefore && !window.meds[i].form){ window.meds[i].form=formVal; window.meds[i].unit=unitVal; break; }
              }
            }
          }catch(e){}
          let ok = await pushCloud();
          try{ if(typeof showToast==='function' && ok) showToast('success','Saved to Cloud','Medicine saved to Local + Firebase'); }catch(e){}
        };
      }
    }catch(e){}
  }

  // ========== 3. ODOO INVENTORY ==========
  if(!document.getElementById('acfix-odoo-css')){
    let s = document.createElement('style');
    s.id='acfix-odoo-css';
    s.innerHTML = `
    .odoo-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#fff;padding:10px 12px;border-radius:12px;border:1px solid #E2E8E6;margin:12px 0}
    .odoo-filter{padding:8px 14px;border-radius:20px;background:#F1F5F4;font-weight:700;font-size:13px;border:none;cursor:pointer}
    .odoo-filter.active{background:#0F2A2E;color:#fff}
    .odoo-view{padding:8px 12px;border-radius:8px;background:#EAF2F0;font-weight:700;font-size:13px;border:none;cursor:pointer}
    .odoo-view.active{background:#0B6B5A;color:#fff}
    .odoo-table{width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:12px;overflow:hidden}
    .odoo-table th{text-align:left;padding:12px;background:#F2F7F5;border-bottom:1px solid #E2E8E6;white-space:nowrap;color:#0F2A2E;font-size:12px;text-transform:uppercase}
    .odoo-table td{padding:11px;border-bottom:1px solid #E2E8E6;vertical-align:middle}
    .odoo-prod{display:flex;align-items:center;gap:10px}
    .odoo-icon{width:42px;height:42px;border-radius:10px;background:#E8F7F2;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
    .odoo-kanban{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .odoo-card{background:#fff;border:1px solid #E2E8E6;border-radius:14px;padding:14px;cursor:pointer}
    .odoo-card:hover{box-shadow:0 8px 20px rgba(11,107,90,.15);transform:translateY(-2px)}
    .odoo-badge{padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap}
    .odoo-green{background:#D1FAE5;color:#065F46}.odoo-red{background:#FEE2E2;color:#991B1B}.odoo-orange{background:#FEF3C7;color:#92400E}.odoo-blue{background:#DBEAFE;color:#1E40AF}
    @media(max-width:900px){.odoo-kanban{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }
  function odooIcon(cat){
    let c=(cat||'').toLowerCase();
    if(c.includes('antibiotic')) return '💊';
    if(c.includes('vitamin')) return '🍊';
    if(c.includes('skin')||c.includes('cream')) return '🧴';
    if(c.includes('baby')) return '👶';
    if(c.includes('syrup')||c.includes('susp')) return '🧪';
    return '💊';
  }
  function odooStatus(m){
    if(m.qty<=0) return '<span class="odoo-badge odoo-red">Out of Stock</span>';
    if(m.qty<= (m.min||5)) return '<span class="odoo-badge odoo-orange">Low Stock</span>';
    return '<span class="odoo-badge odoo-green">In Stock</span>';
  }
  function odooExpiry(m){
    if(!m.expiry) return '-';
    let d = Math.ceil((new Date(m.expiry)-new Date())/86400000);
    if(d<0) return '<span class="odoo-badge odoo-red">Expired</span>';
    if(d<=30) return '<span class="odoo-badge odoo-red">Critical '+d+'d</span>';
    if(d<=90) return '<span class="odoo-badge odoo-orange">Warning '+d+'d</span>';
    return '<span class="odoo-badge odoo-green">Safe</span>';
  }
  window.ACFIX_odooFilter = 'all';
  window.ACFIX_odooView = 'list';
  window.ACFIX_setOdooFilter = function(f){ window.ACFIX_odooFilter=f; window.ACFIX_renderOdooInv(); };
  window.ACFIX_setOdooView = function(v){ window.ACFIX_odooView=v; window.ACFIX_renderOdooInv(); };
  window.ACFIX_renderOdooInv = function(){
    try{
      let invTable = document.getElementById('invTable');
      let invKanban = document.getElementById('invKanban');
      if(!invTable) return;
      let meds = getMeds();
      let q = '';
      let searchEl = document.getElementById('invSearch');
      if(searchEl) q = searchEl.value.toLowerCase();
      let list = meds.filter(m=> !q || m.name.toLowerCase().includes(q) || (m.category||'').toLowerCase().includes(q) || (m.supplier||'').toLowerCase().includes(q));
      if(window.ACFIX_odooFilter==='low') list = list.filter(m=> m.qty <= (m.min||5) && m.qty>0);
      if(window.ACFIX_odooFilter==='out') list = list.filter(m=> m.qty<=0);
      if(window.ACFIX_odooFilter==='expiring') list = list.filter(m=>{ let d=(new Date(m.expiry)-new Date())/86400000; return d<=90 && d>=0; });
      if(window.ACFIX_odooFilter==='expired') list = list.filter(m=> new Date(m.expiry) < new Date());
      let lowCount = meds.filter(m=> m.qty <= (m.min||5) && m.qty>0).length;
      let outCount = meds.filter(m=> m.qty<=0).length;
      let expCount = meds.filter(m=>{ let d=(new Date(m.expiry)-new Date())/86400000; return d<=90 && d>=0; }).length;
      let stockVal = meds.reduce((a,m)=> a + (m.qty||0)*(m.cost||0), 0);
      let toolbar = `<div class="odoo-top">
        <button class="odoo-filter ${window.ACFIX_odooFilter==='all'?'active':''}" onclick="ACFIX_setOdooFilter('all')">All (${meds.length})</button>
        <button class="odoo-filter ${window.ACFIX_odooFilter==='low'?'active':''}" onclick="ACFIX_setOdooFilter('low')">Low Stock (${lowCount})</button>
        <button class="odoo-filter ${window.ACFIX_odooFilter==='out'?'active':''}" onclick="ACFIX_setOdooFilter('out')">Out of Stock (${outCount})</button>
        <button class="odoo-filter ${window.ACFIX_odooFilter==='expiring'?'active':''}" onclick="ACFIX_setOdooFilter('expiring')">Expiring 90d (${expCount})</button>
        <button class="odoo-filter ${window.ACFIX_odooFilter==='expired'?'active':''}" onclick="ACFIX_setOdooFilter('expired')">Expired</button>
        <div style="flex:1"></div>
        <span style="font-size:12px;color:#6B7C7A">Stock Value: <b style="color:#0F2A2E">${stockVal.toLocaleString()} SSP</b></span>
        <button class="odoo-view ${window.ACFIX_odooView==='list'?'active':''}" onclick="ACFIX_setOdooView('list')">List</button>
        <button class="odoo-view ${window.ACFIX_odooView==='kanban'?'active':''}" onclick="ACFIX_setOdooView('kanban')">Kanban</button>
        <button class="odoo-view" onclick="ACFIX_printStockThermal()" style="background:#0F2A2E;color:#fff">Print Stock - Thermal</button>
      </div>`;
      if(!document.getElementById('acfix-odoo-toolbar')){
        let div = document.createElement('div');
        div.id='acfix-odoo-toolbar';
        div.innerHTML = toolbar;
        invTable.parentNode.insertBefore(div, invTable);
      } else {
        document.getElementById('acfix-odoo-toolbar').innerHTML = toolbar;
      }
      if(window.ACFIX_odooView==='kanban'){
        if(invTable) invTable.style.display='none';
        if(invKanban){ invKanban.classList.remove('hidden'); invKanban.style.display='grid'; }
        if(invKanban){
          invKanban.className='odoo-kanban';
          invKanban.innerHTML = list.map(m=>{
            let margin = m.price>0 ? Math.round(((m.price-m.cost)/m.price)*100) : 0;
            return `<div class="odoo-card" onclick="if(typeof editMed==='function') editMed(${m.id})">
              <div style="display:flex;gap:10px"><div class="odoo-icon">${odooIcon(m.category)}</div><div><b>${m.name}</b><br><small style="color:#6B7C7A">${m.category||''} | ${m.supplier||''}</small><br><span class="odoo-badge odoo-blue">${m.form||'Tablets'} - ${m.unit||'Strip'}</span></div></div>
              <div style="margin-top:12px;font-size:13px;line-height:1.8">
                On Hand: <b style="font-size:18px">${m.qty}</b> | Min: ${m.min||5}<br>
                Cost: <b>${(m.cost||0).toLocaleString()} SSP</b> | Price: <b>${(m.price||0).toLocaleString()} SSP</b><br>
                Margin: <span class="odoo-badge ${margin>=30?'odoo-green':margin>=15?'odoo-orange':'odoo-red'}">${margin}%</span> | Valuation: <b>${((m.qty||0)*(m.cost||0)).toLocaleString()} SSP</b><br>
                Expiry: ${m.expiry||'-'} ${odooExpiry(m)}<br>
                ${odooStatus(m)} | Barcode: ${m.barcode||'-'}
              </div>
              <div style="display:flex;gap:8px;margin-top:10px"><button class="odoo-view" onclick="event.stopPropagation(); if(typeof editMed==='function') editMed(${m.id})">Edit</button><button class="odoo-view" onclick="event.stopPropagation(); if(typeof goToMedicinePurchase==='function') goToMedicinePurchase(${m.id})">+ Restock</button><button class="odoo-view" onclick="event.stopPropagation(); ACFIX_printOneMed(${m.id})">Print Label</button></div>
            </div>`;
          }).join('') || '<p>No products</p>';
        }
      } else {
        if(invTable) invTable.style.display='block';
        if(invKanban) invKanban.style.display='none';
        invTable.innerHTML = `<table class="odoo-table"><tr><th>Product</th><th>Internal Ref</th><th>On Hand</th><th>Forecasted</th><th>Cost</th><th>Sales Price</th><th>Margin</th><th>Valuation</th><th>Expiry</th><th>Status</th></tr>` + list.map(m=>{
          let margin = m.price>0 ? Math.round(((m.price-m.cost)/m.price)*100) : 0;
          let val = (m.qty||0)*(m.cost||0);
          return `<tr style="cursor:pointer" onclick="if(typeof editMed==='function') editMed(${m.id})"><td><div class="odoo-prod"><div class="odoo-icon">${odooIcon(m.category)}</div><div><b>${m.name}</b><br><small style="color:#6B7C7A">${m.category||''} - ${m.form||'Tablets'} - ${m.unit||'Strip'}</small></div></div></td><td>${m.barcode||'-'}<br><small>${m.supplier||''}</small></td><td><b>${m.qty}</b><br><small>Min ${m.min||5}</small></td><td><b>${m.qty}</b></td><td>${(m.cost||0).toLocaleString()}</td><td><b>${(m.price||0).toLocaleString()}</b></td><td><span class="odoo-badge ${margin>=30?'odoo-green':margin>=15?'odoo-orange':'odoo-red'}">${margin}%</span></td><td><b>${val.toLocaleString()}</b></td><td>${m.expiry||'-'}<br>${odooExpiry(m)}</td><td>${odooStatus(m)}</td></tr>`;
        }).join('') + `</table>`;
      }
    }catch(e){ console.log('ACFIX Odoo render fail', e); }
  };
  let oldRenderInv = window.renderInv;
  if(oldRenderInv && !window.ACFIX_renderInvPatched){
    window.ACFIX_renderInvPatched = true;
    window.renderInv = function(){
      try{ oldRenderInv(); }catch(e){}
      setTimeout(()=>{ try{ window.ACFIX_renderOdooInv(); }catch(e){} }, 100);
    };
  }
  setTimeout(()=>{
    let s = document.getElementById('invSearch');
    if(s) s.addEventListener('input', ()=>{ setTimeout(()=>window.ACFIX_renderOdooInv(), 150); });
  }, 1500);

  // ========== 4. PROFESSIONAL THERMAL PRINT - 80mm - NO PAPER WASTE ==========
  // Inject print CSS - thermal only, hides everything else, no blank pages
  if(!document.getElementById('acfix-print-css')){
    let st = document.createElement('style');
    st.id='acfix-print-css';
    st.innerHTML = `
    @media print{
      body *{visibility:hidden !important}
      #acfix-print-area, #acfix-print-area *{visibility:visible !important}
      #acfix-print-area{display:block !important;position:absolute !important;left:0 !important;top:0 !important;width:80mm !important;margin:0 !important;padding:0 !important;background:#fff !important}
      @page{size:80mm auto;margin:0mm}
    }
    `;
    document.head.appendChild(st);
  }
  function escHtml(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function doThermalPrint(html){
    let old = document.getElementById('acfix-print-area');
    if(old) old.remove();
    let div = document.createElement('div');
    div.id='acfix-print-area';
    div.style.cssText='display:none';
    div.innerHTML = html;
    document.body.appendChild(div);
    // Show only print area for print, then restore
    div.style.display='block';
    // Use printArea if system uses it, else use our div
    try{
      let pa = document.getElementById('printArea');
      if(pa){ pa.innerHTML = html; pa.style.display='block'; }
    }catch(e){}
    window.print();
    setTimeout(()=>{ try{ div.remove(); let pa2=document.getElementById('printArea'); if(pa2) pa2.innerHTML=''; }catch(e){} }, 500);
  }
  function thermalStyle(){
    return `<style>
      .th{width:80mm;margin:0 auto;font-family:'Courier New',monospace;color:#000;font-size:12px;line-height:1.3;text-align:center}
      .th h1{font-size:16px;margin:0;letter-spacing:1px}
      .th .sub{font-size:11px;margin:1px 0}
      .th .line{border-top:1px dashed #000;margin:5px 0}
      .th table{width:100%;font-size:12px;text-align:left;border-collapse:collapse}
      .th td{padding:2px 0;vertical-align:top}
      .th .r{display:flex;justify-content:space-between;font-size:12px;padding:1px 0}
      .th .total{display:flex;justify-content:space-between;font-size:15px;font-weight:900;border-top:2px solid #000;border-bottom:2px solid #000;padding:4px 0;margin:4px 0}
      .th .small{font-size:11px}
      .th .cut{height:12px}
    </style>`;
  }
  function thermalHeader(title){
    let user = '';
    try{ user = window.currentUser ? window.currentUser.fullName : ''; }catch(e){}
    return `<div class="th">${thermalStyle()}
      <h1>ACTIVE CARE PHARMACY</h1>
      <div class="sub">Juba, South Sudan</div>
      <div class="sub">${escHtml(title)} | ${todayStr()} ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
      <div class="sub">By: ${escHtml(user)}</div>
      <div class="line"></div>`;
  }

  // 4A. Receipt - Compact, no waste
  window.ACFIX_printReceipt = function(sale){
    try{
      if(!sale){
        // Try last sale from global
        if(window.lastSale) sale = window.lastSale;
        else { alert('No receipt to print'); return; }
      }
      let rows = (sale.items||[]).map(i=>{
        return `<tr><td>${escHtml(i.name)}<br><small>${i.qty} x ${Number(i.price||0).toLocaleString()}</small></td><td style="text-align:right"><b>${Number((i.price||0)*i.qty).toLocaleString()}</b></td></tr>`;
      }).join('');
      let html = thermalHeader('RECEIPT #' + sale.id) + `
      <div style="text-align:left;font-size:12px">Customer: ${escHtml(sale.customer||'Walk-in')}<br>Pay: ${escHtml(sale.pay||'Cash')} | Shift: ${escHtml(sale.shift||'')}</div>
      <div class="line"></div>
      <table>${rows}</table>
      <div class="line"></div>
      <div class="total"><span>TOTAL</span><span>${Number(sale.total||0).toLocaleString()} SSP</span></div>
      <div class="small">Points: ${Math.floor((sale.total||0)/1000)} pts</div>
      <div class="line"></div>
      <div><b>THANK YOU - GET WELL SOON</b></div>
      <div class="small">Please come again</div>
      <div class="cut"></div>
      </div>`;
      doThermalPrint(html);
    }catch(e){ console.log('Print receipt fail', e); }
  };

  // 4B. Stock Report - Thermal, compact, only low + total, not full A4
  window.ACFIX_printStockThermal = function(){
    try{
      let meds = getMeds();
      let low = meds.filter(m=> m.qty <= (m.min||5));
      let val = meds.reduce((a,m)=> a + (m.qty||0)*(m.cost||0), 0);
      let rows = meds.map(m=>{
        let flag = m.qty<=0 ? ' OUT' : (m.qty <= (m.min||5) ? ' LOW' : '');
        return `<div class="r"><span>${escHtml(m.name).substring(0,22)}${flag} (${m.qty})</span><span>${Number((m.qty||0)*(m.cost||0)).toLocaleString()}</span></div>`;
      }).join('');
      let html = thermalHeader('STOCK REPORT') + `
      <div style="text-align:left">Items: ${meds.length} | Low: ${low.length}<br>Stock Value: <b>${val.toLocaleString()} SSP</b></div>
      <div class="line"></div>
      <div style="text-align:left">${rows}</div>
      <div class="line"></div>
      <div class="r"><b>Total Value</b><b>${val.toLocaleString()}</b></div>
      <div class="cut"></div>
      </div>`;
      doThermalPrint(html);
    }catch(e){ console.log('Print stock fail', e); }
  };

  // 4C. Daily Report - Thermal, 1 slip
  window.ACFIX_printDailyThermal = function(){
    try{
      let sales = getSales();
      let today = todayStr();
      let day = sales.filter(s=> s.date===today);
      let total = day.reduce((a,s)=> a + (s.total||0), 0);
      let cash = day.filter(s=> s.pay==='Cash').reduce((a,s)=> a + (s.total||0), 0);
      let bank = day.filter(s=> s.pay!=='Cash' && s.pay!=='Debt').reduce((a,s)=> a + (s.total||0), 0);
      let debt = day.filter(s=> s.pay==='Debt').reduce((a,s)=> a + (s.total||0), 0);
      let cogs = 0;
      day.forEach(s=>{ (s.items||[]).forEach(i=>{ cogs += (i.costAtSale||i.cost||0)*i.qty; }); });
      let html = thermalHeader('DAILY REPORT - ' + today) + `
      <div style="text-align:left">
      <div class="r"><span>Transactions</span><span>${day.length}</span></div>
      <div class="r"><span>Total Sales</span><b>${total.toLocaleString()}</b></div>
      <div class="r"><span>Cash</span><span>${cash.toLocaleString()}</span></div>
      <div class="r"><span>Bank / Mobile</span><span>${bank.toLocaleString()}</span></div>
      <div class="r"><span>Debt</span><span>${debt.toLocaleString()}</span></div>
      <div class="r"><span>COGS</span><span>${cogs.toLocaleString()}</span></div>
      <div class="r"><span>Gross Profit</span><b>${(total-cogs).toLocaleString()}</b></div>
      </div>
      <div class="line"></div>
      <div style="text-align:left;font-size:11px">${day.slice(-10).map(s=> `<div class="r"><span>#${s.id} ${escHtml(s.customer||'')}</span><span>${Number(s.total||0).toLocaleString()}</span></div>`).join('')}</div>
      <div class="line"></div>
      <div><b>END OF DAY</b></div>
      <div class="cut"></div>
      </div>`;
      doThermalPrint(html);
    }catch(e){ console.log('Print daily fail', e); }
  };

  // 4D. Z-Report / Close Shift - Thermal, 1 slip
  window.ACFIX_printZReport = function(){
    try{
      let sales = getSales();
      let today = todayStr();
      let shift = 'Shift 1';
      try{ if(window.currentShift) shift = window.currentShift; }catch(e){}
      let day = sales.filter(s=> s.date===today && (!s.shift || s.shift===shift));
      let total = day.reduce((a,s)=> a + (s.total||0), 0);
      let cash = day.filter(s=> s.pay==='Cash').reduce((a,s)=> a + (s.total||0), 0);
      let bank = day.filter(s=> s.pay!=='Cash' && s.pay!=='Debt').reduce((a,s)=> a + (s.total||0), 0);
      let html = thermalHeader('Z-REPORT - ' + shift) + `
      <div style="text-align:left">
      <div class="r"><span>Total Sales</span><b>${total.toLocaleString()}</b></div>
      <div class="r"><span>Cash Expected</span><span>${cash.toLocaleString()}</span></div>
      <div class="r"><span>Bank / Mobile</span><span>${bank.toLocaleString()}</span></div>
      <div class="r"><span>Transactions</span><span>${day.length}</span></div>
      </div>
      <div class="line"></div>
      <div style="text-align:left">Counted: __________<br>Diff: __________<br>Handed To: __________</div>
      <div class="line"></div>
      <div>Sign: __________</div>
      <div class="cut"></div>
      </div>`;
      doThermalPrint(html);
    }catch(e){ console.log('Print Z fail', e); }
  };

  // 4E. Single Product Label - Small, saves paper
  window.ACFIX_printOneMed = function(id){
    try{
      let m = getMeds().find(x=> String(x.id)===String(id));
      if(!m) return;
      let html = thermalHeader('PRICE LABEL') + `
      <div style="font-size:16px"><b>${escHtml(m.name)}</b></div>
      <div>${escHtml(m.form||'')} - ${escHtml(m.unit||'')} | ${escHtml(m.category||'')}</div>
      <div class="line"></div>
      <div style="font-size:20px"><b>${Number(m.price||0).toLocaleString()} SSP</b></div>
      <div class="small">Exp: ${m.expiry||'-'} | Stock: ${m.qty} | Barcode: ${m.barcode||'-'}</div>
      <div class="cut"></div>
      </div>`;
      doThermalPrint(html);
    }catch(e){}
  };

  // 4F. Override old print functions to use thermal - saves paper
  // Keep old functions as backup, but route buttons to thermal
  setTimeout(()=>{
    try{
      // Add thermal buttons to Daily / Shifts pages if not exist
      let dailyBtns = document.querySelectorAll('button');
      dailyBtns.forEach(b=>{
        if(b.textContent && b.textContent.includes('Print Daily Report')){
          b.onclick = function(e){ e.preventDefault(); window.ACFIX_printDailyThermal(); };
        }
        if(b.textContent && b.textContent.includes('Print Z-Report')){
          b.onclick = function(e){ e.preventDefault(); window.ACFIX_printZReport(); };
        }
        if(b.textContent && b.textContent.includes('Reprint Last Receipt')){
          b.onclick = function(e){ e.preventDefault(); window.ACFIX_printReceipt(); };
        }
        if(b.textContent && b.textContent.includes('Print Stock Report')){
          b.onclick = function(e){ e.preventDefault(); window.ACFIX_printStockThermal(); };
        }
      });
    }catch(e){}
  }, 2000);

  // Override buildReceiptHTML if exists - make it thermal
  let oldBuild = window.buildReceiptHTML;
  if(oldBuild && !window.ACFIX_buildPatched){
    window.ACFIX_buildPatched = true;
    window.buildReceiptHTML = function(sale){ window.ACFIX_printReceipt(sale); };
  }

  function init(){ patchSaveMed(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setTimeout(init, 1000);
  setTimeout(init, 3000);
  console.log('ACFIX 14.2 for V13.1 Loaded - All English - Thermal Print Ready');
})();
