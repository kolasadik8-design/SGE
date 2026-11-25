// Active Care - FIX V14.1 for V13.1 - Force Add User + Odoo Inventory + Form/Unit + Safe Sync
(function(){
  if(window.ACFIX141_LOADED) return;
  window.ACFIX141_LOADED = true;

  function getArr(k){ try{ return JSON.parse(localStorage.getItem(k)||'[]'); }catch(e){ return []; } }
  function setArr(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function getMeds(){ let a=getArr('ac13_meds'); if(a.length) return a; return getArr('ac_meds'); }
  function getUsers(){ let a=getArr('ac13_users'); if(a.length) return a; return getArr('ac_users'); }
  async function hashPass(p){
    try{
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('activecare-v82-'+p));
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }catch(e){ return 'h-'+p; }
  }
  async function hashPassV13(p, salt){
    try{
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(p + salt));
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
    console.log('ACFIX 14.1 addUser called - V13.1');
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

    // V13.1 hash: SHA-256(pass + salt) + also save old passHash for compatibility
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
          list.innerHTML = '<div style="padding:12px;background:#D1FAE5;border-radius:10px;margin-top:10px"><b>New User Added: '+username+' - '+role+' - '+shift+'</b><br>Users now: '+users.map(u=>u.username+' ('+u.role+')').join(', ')+'</div>' + list.innerHTML;
        }
      }catch(e){}
    }, 300);

    let cloudOk = await pushCloud();
    let msg = 'SUCCESS! User "'+username+'" - '+role+' - '+shift+' added. Total: '+users.length;
    if(cloudOk) msg += ' - Saved to Local + Cloud';
    else msg += ' - Saved Local Only (Cloud offline)';
    console.log(msg);
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

  // ========== 2. MED - Add Form + Unit fields to modal ==========
  function patchMedModal(){
    try{
      let mName = document.getElementById('mName');
      if(!mName) return;
      if(document.getElementById('acfixForm')) return;
      let cat = document.getElementById('mCategory');
      let div = document.createElement('div');
      div.innerHTML = '<div style="display:flex;gap:10px"><select id="acfixForm" style="flex:1;padding:11px;border:1px solid #E2E8E6;border-radius:10px"><option value="Tablets">Tablets - حبوب</option><option value="Capsules">Capsules - كبسولات</option><option value="Syrup">Syrup - شراب</option><option value="Suspension">Suspension - معلق</option><option value="Injection">Injection - حقن</option><option value="Cream">Cream - كريم</option><option value="Ointment">Ointment - مرهم</option><option value="Drops">Drops - قطرات</option><option value="Eye Drops">Eye Drops</option><option value="Ear Drops">Ear Drops</option><option value="Spray">Spray - بخاخ</option><option value="Suppository">Suppository - تحاميل</option><option value="Sachet">Sachet - فوار</option><option value="Lotion">Lotion</option><option value="Gel">Gel</option><option value="Other">Other</option></select><select id="acfixUnit" style="flex:1;padding:11px;border:1px solid #E2E8E6;border-radius:10px"><option value="Strip">Strip - شريط</option><option value="Bottle">Bottle - قزازة</option><option value="Box">Box - علبة</option><option value="Piece">Piece - حبة</option><option value="Tube">Tube - أنبوبة</option><option value="Vial">Vial - فتيل</option><option value="Ampoule">Ampoule - أمبولة</option><option value="Pack">Pack - باكيت</option><option value="Sachet">Sachet - كيس</option></select></div><p style="font-size:11px;color:#6B7C7A">Form + Unit - Will show in Inventory & POS</p>';
      if(cat && cat.parentNode) cat.parentNode.insertBefore(div, cat.nextSibling);
      else mName.parentNode.insertBefore(div, mName.nextSibling);
    }catch(e){}
  }

  // Wrap saveMed to attach Form/Unit + push Cloud
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
          try{ if(typeof showToast==='function'){ if(ok) showToast('success','Saved to Cloud','Medicine saved to Local + Firebase'); } }catch(e){}
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
    if(m.qty<= (m.min||5)) return '<span class="odoo-badge odoo-orange">Low Stock - Reorder</span>';
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
              <div style="display:flex;gap:10px"><div class="odoo-icon">${odooIcon(m.category)}</div><div><b>${m.name}</b><br><small style="color:#6B7C7A">${m.category||''} | ${m.supplier||''}</small><br><span class="odoo-badge odoo-blue">${m.form||'Tablets'} • ${m.unit||'Strip'}</span></div></div>
              <div style="margin-top:12px;font-size:13px;line-height:1.8">
                On Hand: <b style="font-size:18px">${m.qty}</b> | Min: ${m.min||5}<br>
                Cost: <b>${(m.cost||0).toLocaleString()} SSP</b> | Price: <b>${(m.price||0).toLocaleString()} SSP</b><br>
                Margin: <span class="odoo-badge ${margin>=30?'odoo-green':margin>=15?'odoo-orange':'odoo-red'}">${margin}%</span> | Valuation: <b>${((m.qty||0)*(m.cost||0)).toLocaleString()} SSP</b><br>
                Expiry: ${m.expiry||'-'} ${odooExpiry(m)}<br>
                ${odooStatus(m)} | Barcode: ${m.barcode||'-'}
              </div>
              <div style="display:flex;gap:8px;margin-top:10px"><button class="odoo-view" onclick="event.stopPropagation(); if(typeof editMed==='function') editMed(${m.id})">Edit</button><button class="odoo-view" onclick="event.stopPropagation(); if(typeof goToMedicinePurchase==='function') goToMedicinePurchase(${m.id})">+ Restock</button></div>
            </div>`;
          }).join('') || '<p>No products</p>';
        }
      } else {
        if(invTable) invTable.style.display='block';
        if(invKanban) invKanban.style.display='none';
        invTable.innerHTML = `<table class="odoo-table"><tr><th>Product</th><th>Internal Ref / Barcode</th><th>On Hand</th><th>Forecasted</th><th>Cost</th><th>Sales Price</th><th>Margin</th><th>Valuation</th><th>Expiry</th><th>Status</th></tr>` + list.map(m=>{
          let margin = m.price>0 ? Math.round(((m.price-m.cost)/m.price)*100) : 0;
          let val = (m.qty||0)*(m.cost||0);
          return `<tr style="cursor:pointer" onclick="if(typeof editMed==='function') editMed(${m.id})"><td><div class="odoo-prod"><div class="odoo-icon">${odooIcon(m.category)}</div><div><b>${m.name}</b><br><small style="color:#6B7C7A">${m.category||''} • ${m.form||'Tablets'} • ${m.unit||'Strip'}</small></div></div></td><td>${m.barcode||'-'}<br><small>${m.supplier||''}</small></td><td><b>${m.qty}</b><br><small>Min ${m.min||5}</small></td><td><b>${m.qty}</b></td><td>${(m.cost||0).toLocaleString()}</td><td><b>${(m.price||0).toLocaleString()}</b></td><td><span class="odoo-badge ${margin>=30?'odoo-green':margin>=15?'odoo-orange':'odoo-red'}">${margin}%</span></td><td><b>${val.toLocaleString()}</b></td><td>${m.expiry||'-'}<br>${odooExpiry(m)}</td><td>${odooStatus(m)}</td></tr>`;
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

  function init(){
    patchSaveMed();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setTimeout(init, 1000);
  setTimeout(init, 3000);
  console.log('ACFIX 14.1 for V13.1 Loaded');
})();
