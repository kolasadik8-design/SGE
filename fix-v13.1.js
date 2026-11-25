// Active Care - FIX V13.1 - Unified Fix
// Merges: 1) Meds Local+Firebase 2) Form+Unit 3) Users Local+Firebase 4) Safe Sync
// Safe: All functions prefixed ACFIX_, never overwrites old functions by force, all try/catch
(function(){
  if(window.ACFIX_LOADED) return;
  window.ACFIX_LOADED = true;

  function ACFIX_get(k, def){
    try{ return JSON.parse(localStorage.getItem(k)||JSON.stringify(def)); }catch(e){ return def; }
  }
  function ACFIX_set(k, v){
    try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){}
  }
  // Support both old keys ac_ and new keys ac13_
  function ACFIX_getMeds(){
    let a = ACFIX_get('ac13_meds', []);
    if(a.length) return a;
    let b = ACFIX_get('ac_meds', []);
    return b;
  }
  function ACFIX_getUsers(){
    let a = ACFIX_get('ac13_users', []);
    if(a.length) return a;
    let b = ACFIX_get('ac_users', []);
    return b;
  }
  function ACFIX_getRate(){
    return Number(localStorage.getItem('ac13_rate')||localStorage.getItem('ac_rate')||4500);
  }
  async function ACFIX_hash(pass, salt){
    try{
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode('activecare-v82-'+pass+'-'+(salt||'')));
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }catch(e){
      // Fallback - old system used hash without salt in some versions
      try{
        const enc2 = new TextEncoder();
        const buf2 = await crypto.subtle.digest('SHA-256', enc2.encode('activecare-v82-'+pass));
        return Array.from(new Uint8Array(buf2)).map(b=>b.toString(16).padStart(2,'0')).join('');
      }catch(e2){ return 'hash-'+pass; }
    }
  }

  // ---------- 1. CLOUD MERGE - Never overwrite ----------
  async function ACFIX_pushToCloud(){
    try{
      if(!window._db || !window._fs) return false;
      const {collection, setDoc, doc, getDoc} = window._fs;
      const ref = doc(collection(window._db,'activecare-single'),'data');
      const snap = await getDoc(ref);
      let cloud = snap.exists() ? snap.data() : {};
      // Merge: Cloud wins if exists, Local fills missing
      let localMeds = ACFIX_getMeds();
      let localUsers = ACFIX_getUsers();
      let mergedMeds = cloud.meds && cloud.meds.length ? cloud.meds : localMeds;
      let mergedUsers = cloud.users && cloud.users.length ? cloud.users : localUsers;
      // Add any local items missing in cloud (by id/username)
      localMeds.forEach(m=>{
        if(!mergedMeds.find(x=> String(x.id)===String(m.id))) mergedMeds.push(m);
      });
      localUsers.forEach(u=>{
        if(!mergedUsers.find(x=> String(x.username).toLowerCase()===String(u.username).toLowerCase())) mergedUsers.push(u);
      });
      await setDoc(ref, {...cloud, meds: mergedMeds, users: mergedUsers, version:'V14', updatedAt: new Date().toISOString()});
      return true;
    }catch(e){ console.log('ACFIX Cloud push failed', e); return false; }
  }
  window.ACFIX_pushToCloud = ACFIX_pushToCloud;

  // ---------- 2. ADD / EDIT MED - With Form + Unit + Cloud ----------
  // This wraps the old saveMed - if old saveMed exists, we call it first for Local, then push Cloud
  function ACFIX_patchSaveMed(){
    try{
      let mName = document.getElementById('mName');
      if(!mName) return;
      // Add Form + Unit fields to modal if not exist - only once
      if(!document.getElementById('acfixForm')){
        let box = mName.parentElement;
        if(box){
          let div = document.createElement('div');
          div.innerHTML = '<div style="display:flex;gap:10px"><select id="acfixForm" style="flex:1;padding:11px;border:1px solid #E2E8E6;border-radius:10px"><option value="Tablets">Tablets - حبوب</option><option value="Capsules">Capsules - كبسولات</option><option value="Syrup">Syrup - شراب</option><option value="Suspension">Suspension - معلق</option><option value="Injection">Injection - حقن</option><option value="Cream">Cream - كريم</option><option value="Ointment">Ointment - مرهم</option><option value="Drops">Drops - قطرات</option><option value="Eye Drops">Eye Drops</option><option value="Ear Drops">Ear Drops</option><option value="Spray">Spray - بخاخ</option><option value="Suppository">Suppository - تحاميل</option><option value="Sachet">Sachet - فوار</option><option value="Lotion">Lotion</option><option value="Gel">Gel</option><option value="Other">Other</option></select><select id="acfixUnit" style="flex:1;padding:11px;border:1px solid #E2E8E6;border-radius:10px"><option value="Strip">Strip - شريط</option><option value="Bottle">Bottle - قزازة</option><option value="Box">Box - علبة</option><option value="Piece">Piece - حبة</option><option value="Tube">Tube - أنبوبة</option><option value="Vial">Vial - فتيل</option><option value="Ampoule">Ampoule - أمبولة</option><option value="Pack">Pack - باكيت</option><option value="Sachet">Sachet - كيس</option></select></div><p style="font-size:11px;color:#6B7C7A">Form + Unit - Will show in Inventory & POS</p>';
          // Insert after Category input if exists, else after Name
          let cat = document.getElementById('mCategory');
          if(cat && cat.parentNode) cat.parentNode.insertBefore(div, cat.nextSibling);
          else box.insertBefore(div, mName.nextSibling);
        }
      }
      // Patch saveMed button - intercept click
      let oldSave = window.saveMed;
      if(oldSave && !window.ACFIX_saveMedPatched){
        window.ACFIX_saveMedPatched = true;
        window.saveMed = async function(){
          // 1. Capture Form/Unit before save
          let formVal = document.getElementById('acfixForm') ? document.getElementById('acfixForm').value : 'Tablets';
          let unitVal = document.getElementById('acfixUnit') ? document.getElementById('acfixUnit').value : 'Strip';
          let nameBefore = document.getElementById('mName') ? document.getElementById('mName').value.trim() : '';
          // 2. Call old save - saves Local
          await oldSave();
          // 3. After old save, attach Form/Unit to the last med with same name
          try{
            let meds13 = ACFIX_get('ac13_meds', null);
            let medsOld = ACFIX_get('ac_meds', []);
            // Update in both storages if present
            [ 'ac13_meds', 'ac_meds' ].forEach(key=>{
              try{
                let arr = JSON.parse(localStorage.getItem(key)||'[]');
                if(!arr.length) return;
                // Find last med with this name that has no form
                for(let i=arr.length-1;i>=0;i--){
                  if(arr[i].name===nameBefore && !arr[i].form){
                    arr[i].form = formVal; arr[i].unit = unitVal; break;
                  }
                }
                localStorage.setItem(key, JSON.stringify(arr));
                // Also update global window meds if exists
                if(window.meds && Array.isArray(window.meds)){
                  for(let i=window.meds.length-1;i>=0;i--){
                    if(window.meds[i].name===nameBefore && !window.meds[i].form){ window.meds[i].form=formVal; window.meds[i].unit=unitVal; break; }
                  }
                }
              }catch(e){}
            });
          }catch(e){}
          // 4. Push to Cloud with Merge
          let ok = await ACFIX_pushToCloud();
          try{
            if(typeof showToast==='function'){
              if(ok) showToast('success','Saved to Cloud','Medicine saved to Local + Firebase');
              else showToast('warning','Saved Local Only','Cloud not connected - Open Sync to push later');
            }
          }catch(e){}
        };
      }
    }catch(e){ console.log('ACFIX Med patch failed', e); }
  }

  // ---------- 3. ADD USER - Fixed ----------
  function ACFIX_patchAddUser(){
    try{
      let oldAdd = window.addUser;
      if(oldAdd && !window.ACFIX_addUserPatched){
        window.ACFIX_addUserPatched = true;
        window.addUser = async function(){
          // Fix: In old code, Cashier must be Cashier Shift, Pharmacist must be Shift 1/2/3, Admin must be All
          // If user picked wrong shift, auto-correct instead of blocking
          try{
            let roleEl = document.getElementById('uRole');
            let shiftEl = document.getElementById('uShift');
            if(roleEl && shiftEl){
              let r = roleEl.value;
              if(r==='Admin') shiftEl.value='All';
              else if(r==='Cashier') shiftEl.value='Cashier Shift';
              else if(r==='Pharmacist' && ['Shift 1','Shift 2','Shift 3'].indexOf(shiftEl.value)===-1) shiftEl.value='Shift 1';
              // Also support new role names lowercase
              if(r==='cashier') { roleEl.value='Cashier'; shiftEl.value='Cashier Shift'; }
              if(r==='pharmacist') { roleEl.value='Pharmacist'; shiftEl.value='Shift 1'; }
              if(r==='admin') { roleEl.value='Admin'; shiftEl.value='All'; }
              if(r==='manager') { roleEl.value='Pharmacist'; shiftEl.value='Shift 1'; }
            }
          }catch(e){}
          await oldAdd();
          // After old add, push to Cloud with Merge
          let ok = await ACFIX_pushToCloud();
          try{
            if(typeof showToast==='function'){
              if(ok) showToast('success','User Saved to Cloud','User saved to Local + Firebase');
            }
          }catch(e){}
        };
      }
      // Also support new add-user form if old page has different IDs (uUser vs uName)
      // If page has uUser but no addUser working, create fallback
      if(!window.addUser){
        window.addUser = async function(){
          try{
            let full = document.getElementById('uName') ? document.getElementById('uName').value.trim() : '';
            let user = document.getElementById('uUser') ? document.getElementById('uUser').value.trim().toLowerCase() : full.toLowerCase();
            let pass = document.getElementById('uPass') ? document.getElementById('uPass').value : '';
            let role = document.getElementById('uRole') ? document.getElementById('uRole').value : 'Cashier';
            let shift = document.getElementById('uShift') ? document.getElementById('uShift').value : 'Cashier Shift';
            if(!full || !user || !pass || pass.length<4){ if(typeof showToast==='function') showToast('error','Invalid Data','Fill all, password min 4'); return; }
            let users = ACFIX_getUsers();
            if(users.find(u=> String(u.username).toLowerCase()===user)){ if(typeof showToast==='function') showToast('error','Username Exists','Choose another'); return; }
            let h = await ACFIX_hash(pass, '');
            let nu = {id: Date.now(), fullName: full, username: user, passHash: h, passwordHash: h, role: role, shift: shift, phone: document.getElementById('uPhone') ? document.getElementById('uPhone').value : ''};
            users.push(nu);
            // Save to both keys to avoid key mismatch
            ACFIX_set('ac_users', users); ACFIX_set('ac13_users', users);
            if(window.users) window.users = users;
            if(typeof renderUsers==='function') renderUsers();
            await ACFIX_pushToCloud();
            if(typeof showToast==='function') showToast('success','User Added', full+' - '+role);
          }catch(e){ console.log('ACFIX addUser fallback failed', e); }
        };
      }
    }catch(e){ console.log('ACFIX User patch failed', e); }
  }

  // ---------- 4. SHOW FORM + UNIT in Inventory / POS ----------
  function ACFIX_showFormUnit(){
    try{
      // Hook renderInv if exists - after render, append Form/Unit to product names
      // We do it via MutationObserver - safe, does not overwrite renderInv
      let observer = new MutationObserver(function(){
        try{
          document.querySelectorAll('table td b').forEach(function(b){
            // Skip if already has form badge
            if(b.parentElement && b.parentElement.querySelector('.acfix-badge')) return;
            let name = b.innerText.trim();
            let meds = ACFIX_getMeds();
            let m = meds.find(x=> x.name===name);
            if(m && (m.form || m.unit)){
              let span = document.createElement('span');
              span.className='acfix-badge';
              span.style.cssText='display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;background:#E8F7F2;color:#0B6B5A;font-size:11px;font-weight:700';
              span.innerText = (m.form||'') + (m.unit ? ' • '+m.unit : '');
              b.parentElement.appendChild(span);
            }
          });
        }catch(e){}
      });
      observer.observe(document.body, {childList:true, subtree:true});
    }catch(e){}
  }

  // ---------- 5. FIX SYNC - If old sync overwrites, block it ----------
  // If index.html has syncToCloud that overwrites, we wrap it to merge
  function ACFIX_patchSync(){
    try{
      if(window.syncToCloud && !window.ACFIX_syncPatched){
        window.ACFIX_syncPatched = true;
        let oldSync = window.syncToCloud;
        window.syncToCloud = async function(){
          // Instead of old overwrite sync, do merge sync
          let ok = await ACFIX_pushToCloud();
          if(ok && typeof showToast==='function') showToast('success','Sync OK','Merged Local + Cloud - Nothing deleted');
          else if(typeof oldSync==='function'){ try{ await oldSync(); }catch(e){} }
          return ok;
        };
      }
      // Also patch syncFromCloud if exists - make it merge, not overwrite
      if(window.syncFromCloud && !window.ACFIX_syncFromPatched){
        window.ACFIX_syncFromPatched = true;
        let oldFrom = window.syncFromCloud;
        window.syncFromCloud = async function(){
          // Pull Cloud, merge with Local, don't delete Local new items
          try{
            if(window._db && window._fs){
              const {collection, doc, getDoc} = window._fs;
              const ref = doc(collection(window._db,'activecare-single'),'data');
              const snap = await getDoc(ref);
              if(snap.exists()){
                let cloud = snap.data();
                let localMeds = ACFIX_getMeds();
                let localUsers = ACFIX_getUsers();
                let mergedMeds = [...(cloud.meds||[])];
                let mergedUsers = [...(cloud.users||[])];
                localMeds.forEach(m=>{ if(!mergedMeds.find(x=>String(x.id)===String(m.id))) mergedMeds.push(m); });
                localUsers.forEach(u=>{ if(!mergedUsers.find(x=>String(x.username).toLowerCase()===String(u.username).toLowerCase())) mergedUsers.push(u); });
                ACFIX_set('ac13_meds', mergedMeds); ACFIX_set('ac_meds', mergedMeds);
                ACFIX_set('ac13_users', mergedUsers); ACFIX_set('ac_users', mergedUsers);
                if(window.meds) window.meds = mergedMeds;
                if(window.users) window.users = mergedUsers;
                if(typeof renderInv==='function') renderInv();
                if(typeof renderUsers==='function') renderUsers();
                return true;
              }
            }
          }catch(e){ console.log('ACFIX syncFrom failed', e); }
          try{ await oldFrom(); }catch(e){}
        };
      }
    }catch(e){}
  }

  // Run patches after DOM ready + after 1 sec (to catch late-loaded functions)
  function ACFIX_init(){
    ACFIX_patchSaveMed();
    ACFIX_patchAddUser();
    ACFIX_patchSync();
    ACFIX_showFormUnit();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', ACFIX_init);
  else ACFIX_init();
  setTimeout(ACFIX_init, 1000);
  setTimeout(ACFIX_init, 3000);
})();
