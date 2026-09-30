/* בחירת מדורים - שבת אחים. Vanilla JS, no build step. Data comes from js/data.js (generated). */
(function () {
  "use strict";

  var D = window.SECTIONS_DATA;
  var MAX = D.maxPerTier;
  var STORE_KEY = "shabat-achim-sections:v1";
  var TIER_LABEL = { u: "עלון אחיד", y: "שכבה צעירה (א'-ב')", o: "שכבה בוגרת (ג'-ו')" };
  var TIER_SHORT = { y: "א'-ב'", o: "ג'-ו'" };

  var byKey = {};
  D.sections.forEach(function (s) { byKey[s.key] = s; });

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------------- storage (every access guarded: private mode / blocked storage) ---------------- */
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null") || {}; } catch (e) { return {}; }
  }
  function saveStore(obj) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch (e) { /* storage unavailable: page still works */ }
  }

  /* ---------------- personal link (#s=base64url(json)) - the hash never reaches any server ---------------- */
  function b64urlEncode(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    var bin = atob(str);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function cleanKeys(arr) {
    var out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (k) {
      if (byKey[k] && out.indexOf(k) < 0 && out.length < MAX) out.push(k);
    });
    return out;
  }
  function snapshotToLink(s) {
    return { v: 1, i: s.id, s: s.school, c: s.city, n: s.contactName, r: s.role, p: s.phone,
      t: s.structure === "tiered" ? "t" : "u", u: s.u, y: s.y, o: s.o, d: s.sentAt };
  }
  function linkToSnapshot(o) {
    if (!o || o.v !== 1) return null;
    return {
      id: String(o.i || ""), school: String(o.s || ""), city: String(o.c || ""), contactName: String(o.n || ""),
      role: String(o.r || ""), phone: String(o.p || ""), structure: o.t === "t" ? "tiered" : "unified",
      u: cleanKeys(o.u), y: cleanKeys(o.y), o: cleanKeys(o.o), sentAt: String(o.d || "")
    };
  }
  function personalUrl(snapshot) {
    return location.origin + location.pathname + "#s=" + b64urlEncode(snapshotToLink(snapshot));
  }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().slice(0, 13);
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  /* ---------------- state ---------------- */
  var store = loadStore();
  var lastSent = store.lastSent || null;

  var hashMatch = location.hash.match(/^#s=([A-Za-z0-9_-]+)$/);
  if (hashMatch) {
    try {
      var fromLink = linkToSnapshot(b64urlDecode(hashMatch[1]));
      if (fromLink && fromLink.school) {
        var sameSchool = lastSent && lastSent.id === fromLink.id;
        var newer = !lastSent || !sameSchool || (fromLink.sentAt || "") >= (lastSent.sentAt || "");
        if (newer) {
          lastSent = fromLink;
          store = { lastSent: fromLink, draft: null, profile: null };
          saveStore(store);
        }
      }
    } catch (e) { /* malformed link: ignore, page works as a plain catalog */ }
  }

  var profile = store.profile || (lastSent ? {
    id: lastSent.id, school: lastSent.school, city: lastSent.city, contactName: lastSent.contactName,
    role: lastSent.role, phone: lastSent.phone
  } : { id: "", school: "", city: "", contactName: "", role: "", phone: "" });

  var base = store.draft || lastSent;
  var state = {
    structure: base && base.structure === "tiered" ? "tiered" : "unified",
    u: cleanKeys(base && base.u), y: cleanKeys(base && base.y), o: cleanKeys(base && base.o)
  };

  function persistDraft() {
    store.draft = { structure: state.structure, u: state.u.slice(), y: state.y.slice(), o: state.o.slice() };
    store.profile = profile;
    store.lastSent = lastSent;
    saveStore(store);
  }

  function activeTiers() { return state.structure === "tiered" ? ["y", "o"] : ["u"]; }
  function pickedCount() { return activeTiers().reduce(function (n, t) { return n + state[t].length; }, 0); }
  function hasChoice() { return state.structure === "tiered" || pickedCount() > 0; }

  /* ---------------- toast ---------------- */
  var toastEl = $("toast"), toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3400);
  }

  /* ---------------- catalog rendering ---------------- */
  function makePickButtons(s, forLightbox) {
    var frag = document.createDocumentFragment();
    ["u", "y", "o"].forEach(function (t) {
      var b = el("button", "pick" + (t === "y" ? " tier-young" : ""));
      b.type = "button";
      b.setAttribute("data-key", s.key);
      b.setAttribute("data-tier", t);
      b.setAttribute("aria-pressed", "false");
      var tick = el("span", "tick", "✓");
      tick.setAttribute("aria-hidden", "true");
      var label = el("span", "pick-label", t === "u" ? "בחירה" : TIER_SHORT[t]);
      b.appendChild(tick);
      b.appendChild(label);
      b.setAttribute("aria-label", t === "u" ? "בחירה: " + s.name : TIER_SHORT[t] + ": " + s.name);
      if (forLightbox) b.classList.add("in-lightbox");
      frag.appendChild(b);
    });
    return frag;
  }

  function renderCatalog() {
    var root = $("catalogGroups");
    D.groups.forEach(function (g) {
      var items = D.sections.filter(function (s) { return s.group === g.id; });
      if (!items.length) return;
      var wrap = el("section", "sec-group");
      wrap.setAttribute("aria-labelledby", "grp-" + g.id);
      var h = el("h3", "sec-group-title", g.title);
      h.id = "grp-" + g.id;
      wrap.appendChild(h);
      var grid = el("div", "sec-grid");
      items.forEach(function (s) {
        var card = el("article", "sec-card");
        card.id = "sec-" + s.key;
        card.setAttribute("data-key", s.key);

        var thumb = el("button", "sec-thumb" + (s.sizes[0][0] / s.sizes[0][1] > 1.15 ? " is-wide" : ""));
        thumb.type = "button";
        thumb.setAttribute("data-open", s.key);
        thumb.setAttribute("aria-label", "הגדלת הדוגמה למדור " + s.name);
        var img = el("img");
        img.src = "assets/sections/" + s.imgs[0] + ".webp";
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.width = s.sizes[0][0];
        img.height = s.sizes[0][1];
        thumb.appendChild(img);

        var body = el("div", "sec-body");
        var name = el("h4", "sec-name", s.name);
        if (s.recommended) name.appendChild(el("span", "sec-tag", "מומלץ"));
        body.appendChild(name);
        body.appendChild(el("p", "sec-desc", s.desc));
        if (s.imgs.length > 1) {
          var more = el("button", "sec-more", "לדוגמה נוספת");
          more.type = "button";
          more.setAttribute("data-open", s.key);
          more.setAttribute("data-idx", "1");
          body.appendChild(more);
        }
        var actions = el("div", "sec-actions");
        actions.appendChild(makePickButtons(s, false));
        body.appendChild(actions);

        card.appendChild(thumb);
        card.appendChild(body);
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
      root.appendChild(wrap);
    });
  }

  /* ---------------- sync UI with state ---------------- */
  function syncPickButton(b) {
    var key = b.getAttribute("data-key"), t = b.getAttribute("data-tier");
    var on = state[t].indexOf(key) >= 0;
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.classList.toggle("is-blocked", !on && state[t].length >= MAX);
  }

  function renderCounters() {
    var c = $("counters");
    c.innerHTML = "";
    activeTiers().forEach(function (t) {
      var n = state[t].length;
      var label = t === "u" ? "נבחרו " + n + " מתוך " + MAX + " מדורים" : TIER_SHORT[t] + ": " + n + " מתוך " + MAX;
      var pill = el("span", "counter" + (t === "y" ? " tier-young" : "") + (n >= MAX ? " is-full" : ""), label);
      c.appendChild(pill);
    });
  }

  function namesOf(keys) { return keys.map(function (k) { return byKey[k].name; }); }

  function diffText() {
    if (!lastSent) return "";
    var parts = [];
    if (lastSent.structure !== state.structure) {
      parts.push(state.structure === "tiered" ? "העלון יעבור לדירוג לפי שכבות גיל." : "העלון יחזור להיות אחיד לכל הכיתות.");
    }
    activeTiers().forEach(function (t) {
      var before = lastSent.structure === state.structure ? (lastSent[t] || []) : (lastSent.structure === "tiered" ? [] : lastSent.u || []);
      var added = state[t].filter(function (k) { return before.indexOf(k) < 0; });
      var removed = before.filter(function (k) { return state[t].indexOf(k) < 0; });
      var prefix = t === "u" ? "" : TIER_SHORT[t] + ": ";
      if (added.length) parts.push(prefix + "נוספו " + namesOf(added).join(", ") + ".");
      if (removed.length) parts.push(prefix + "הוסרו " + namesOf(removed).join(", ") + ".");
    });
    if (!parts.length) return "זו בדיוק הבחירה ששלחתם בפעם הקודמת. אפשר לשנות מדורים למעלה ולשלוח שוב.";
    return "שינויים מהבחירה הקודמת: " + parts.join(" ");
  }

  function renderSummary() {
    var box = $("summary");
    box.innerHTML = "";
    box.appendChild(el("p", "summary-title", "הבחירה שלכם"));
    var row = el("div", "summary-row");
    row.appendChild(el("span", "summary-label", "מבנה העלון: " + (state.structure === "tiered" ? D.tiers.tiered : D.tiers.unified)));
    box.appendChild(row);
    activeTiers().forEach(function (t) {
      var r = el("div", "summary-row");
      r.appendChild(el("span", "summary-label", t === "u" ? "מדורים:" : "מדורים ל" + TIER_LABEL[t] + ":"));
      if (state[t].length) {
        var ul = el("ul", "summary-chips");
        namesOf(state[t]).forEach(function (n) { ul.appendChild(el("li", null, n)); });
        r.appendChild(ul);
      } else {
        r.appendChild(el("p", "summary-empty", "עדיין לא נבחרו. אפשר לשלוח כך, ונשמח לעזור לבחור."));
      }
      box.appendChild(r);
    });
    var d = diffText();
    if (d) box.appendChild(el("p", "summary-changes", d));
  }

  var sendVisible = false;
  function renderSelbar() {
    var bar = $("selbar");
    var show = hasChoice() && !sendVisible && $("sendSuccess").hidden;
    bar.hidden = !show;
    document.body.classList.toggle("has-selbar", show);
    if (!show) return;
    var txt;
    if (state.structure === "tiered") {
      txt = TIER_SHORT.y + ": " + state.y.length + " מדורים · " + TIER_SHORT.o + ": " + state.o.length + " מדורים";
    } else {
      txt = "נבחרו " + state.u.length + " מתוך " + MAX + " מדורים";
    }
    $("selbarText").textContent = txt;
  }

  function sync() {
    document.body.classList.toggle("mode-tiered", state.structure === "tiered");
    document.body.classList.toggle("mode-unified", state.structure !== "tiered");
    document.querySelectorAll(".pick").forEach(syncPickButton);
    document.querySelectorAll(".sec-card").forEach(function (card) {
      var key = card.getAttribute("data-key");
      var picked = activeTiers().some(function (t) { return state[t].indexOf(key) >= 0; });
      card.classList.toggle("is-picked", picked);
    });
    document.querySelectorAll('input[name="structure"]').forEach(function (r) { r.checked = r.value === state.structure; });
    $("catalogLede").textContent = state.structure === "tiered"
      ? "כל הדוגמאות לקוחות מעלונים שהפקנו לבתי ספר. לחצו על תמונה כדי להגדיל אותה. בכל מדור בחרו לאיזו שכבה הוא מתאים: א'-ב', ג'-ו', או לשתיהן."
      : "כל הדוגמאות לקוחות מעלונים שהפקנו לבתי ספר. לחצו על תמונה כדי להגדיל אותה, ועל \"בחירה\" כדי לסמן מדור.";
    renderCounters();
    var choice = hasChoice();
    if ($("sendSuccess").hidden) {
      $("sendEmpty").hidden = choice;
      $("sendForm").hidden = !choice;
    }
    if (choice) renderSummary();
    renderSelbar();
  }

  function toggle(key, tier, btn) {
    var arr = state[tier];
    var i = arr.indexOf(key);
    if (i >= 0) {
      arr.splice(i, 1);
    } else {
      if (arr.length >= MAX) {
        toast((tier === "u" ? "" : "ב" + TIER_SHORT[tier] + " ") + "אפשר לבחור עד " + MAX + " מדורים. כדי להוסיף את " + byKey[key].name + ", הסירו קודם מדור אחר.");
        return;
      }
      arr.push(key);
      if (btn) {
        btn.classList.remove("just-picked");
        void btn.offsetWidth;
        btn.classList.add("just-picked");
      }
    }
    persistDraft();
    sync();
  }

  document.addEventListener("click", function (e) {
    var pick = e.target.closest(".pick");
    if (pick) {
      toggle(pick.getAttribute("data-key"), pick.getAttribute("data-tier"), pick);
      return;
    }
    var opener = e.target.closest("[data-open]");
    if (opener) openLightbox(opener.getAttribute("data-open"), parseInt(opener.getAttribute("data-idx") || "0", 10), opener);
  });

  document.querySelectorAll('input[name="structure"]').forEach(function (r) {
    r.addEventListener("change", function () {
      if (!r.checked) return;
      var prev = state.structure;
      state.structure = r.value === "tiered" ? "tiered" : "unified";
      if (prev !== "tiered" && state.structure === "tiered" && !state.y.length && !state.o.length && state.u.length) {
        state.y = state.u.slice();
        state.o = state.u.slice();
        toast("העתקנו את הבחירה שלכם לשתי השכבות. עכשיו אפשר לשנות לכל שכבה בנפרד.");
      } else if (state.structure === "unified" && !state.u.length && (state.y.length || state.o.length)) {
        state.u = cleanKeys(state.y.concat(state.o));
        toast("הבחירות מהשכבות אוחדו לעלון אחד, עד " + MAX + " מדורים.");
      }
      persistDraft();
      sync();
    });
  });

  /* ---------------- lightbox ---------------- */
  var lb = $("lightbox"), lbKey = null, lbIdx = 0, lbReturn = null;
  function drawLightbox() {
    var s = byKey[lbKey];
    $("lbTitle").textContent = "המדור " + s.name;
    var img = $("lbImg");
    img.src = "assets/sections/" + s.imgs[lbIdx] + ".webp";
    img.width = s.sizes[lbIdx][0];
    img.height = s.sizes[lbIdx][1];
    img.alt = "דוגמה " + (lbIdx + 1) + " למדור " + s.name + ": " + s.desc;
    var multi = s.imgs.length > 1;
    $("lbNav").hidden = !multi;
    $("lbCount").textContent = multi ? "דוגמה " + (lbIdx + 1) + " מתוך " + s.imgs.length : "";
    var actions = $("lbActions");
    actions.innerHTML = "";
    actions.appendChild(makePickButtons(s, true));
    actions.querySelectorAll(".pick").forEach(syncPickButton);
    lb.querySelector(".lb-stage").scrollTop = 0;
  }
  function openLightbox(key, idx, from) {
    if (!byKey[key]) return;
    lbKey = key;
    lbIdx = Math.min(Math.max(idx || 0, 0), byKey[key].imgs.length - 1);
    lbReturn = from || null;
    drawLightbox();
    if (typeof lb.showModal === "function") lb.showModal(); else lb.setAttribute("open", "");
    $("lbClose").focus();
  }
  function step(dir) {
    var n = byKey[lbKey].imgs.length;
    lbIdx = (lbIdx + dir + n) % n;
    drawLightbox();
  }
  $("lbClose").addEventListener("click", function () { lb.close(); });
  $("lbPrev").addEventListener("click", function () { step(-1); });
  $("lbNext").addEventListener("click", function () { step(1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
  lb.addEventListener("keydown", function (e) {
    if (!lbKey || byKey[lbKey].imgs.length < 2) return;
    if (e.key === "ArrowLeft") { step(1); e.preventDefault(); }   // RTL: left moves forward
    if (e.key === "ArrowRight") { step(-1); e.preventDefault(); }
  });
  lb.addEventListener("close", function () {
    if (lbReturn && document.contains(lbReturn)) lbReturn.focus();
    lbKey = null;
  });

  /* ---------------- form ---------------- */
  var form = $("sendForm");
  var FIELDS = [["school", "f_school"], ["city", "f_city"], ["contactName", "f_name"], ["role", "f_role"], ["phone", "f_phone"]];
  FIELDS.forEach(function (f) {
    var input = $(f[1]);
    input.value = profile[f[0]] || "";
    input.addEventListener("input", function () {
      profile[f[0]] = input.value;
      if (input.getAttribute("aria-invalid") === "true") validateField(input);
      persistDraft();
    });
  });

  function phoneOk(v) {
    var digits = String(v || "").replace(/\D/g, "");
    if (digits.indexOf("972") === 0) digits = "0" + digits.slice(3);
    return /^0\d{8,9}$/.test(digits);
  }
  function validateField(input) {
    var ok = input.id === "f_phone" ? phoneOk(input.value) : input.value.trim().length > 1;
    input.setAttribute("aria-invalid", ok ? "false" : "true");
    var err = $(input.id + "_err");
    if (err) err.hidden = ok;
    return ok;
  }

  function setBusy(busy) {
    var b = form.querySelector(".btn-submit");
    b.disabled = busy;
    b.textContent = busy ? "שולחים..." : "שליחת הבחירה";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    $("formError").hidden = true;
    var required = [$("f_school"), $("f_name"), $("f_phone")];
    var firstBad = null;
    required.forEach(function (i) { if (!validateField(i) && !firstBad) firstBad = i; });
    if (firstBad) { firstBad.focus(); return; }
    if (!navigator.onLine) {
      showError("נראה שאין כרגע חיבור לאינטרנט. הבחירה שמורה אצלכם, ואפשר לשלוח שוב כשהחיבור יחזור.");
      return;
    }

    if (!profile.id) profile.id = newId();
    var E = D.form.entries;
    var fd = new FormData();
    fd.append(E.school, $("f_school").value.trim());
    fd.append(E.city, $("f_city").value.trim());
    fd.append(E.contactName, $("f_name").value.trim());
    fd.append(E.role, $("f_role").value.trim());
    fd.append(E.phone, $("f_phone").value.trim());
    fd.append(E.structure, state.structure === "tiered" ? D.tiers.tiered : D.tiers.unified);
    if (state.structure === "tiered") {
      namesOf(state.y).forEach(function (n) { fd.append(E.sectionsYoung, n); });
      namesOf(state.o).forEach(function (n) { fd.append(E.sectionsOld, n); });
    } else {
      namesOf(state.u).forEach(function (n) { fd.append(E.sectionsUnified, n); });
    }
    fd.append(E.notes, $("f_notes").value.trim());
    fd.append(E.requestKind, lastSent && lastSent.sentAt ? "עדכון בחירה קודמת" : "בחירה ראשונה");
    fd.append(E.schoolId, profile.id);

    setBusy(true);
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    fetch(D.form.action, { method: "POST", mode: "no-cors", body: fd, signal: ctrl ? ctrl.signal : undefined })
      .then(function () { clearTimeout(timer); onSent(); })
      .catch(function () {
        clearTimeout(timer);
        setBusy(false);
        showError("השליחה לא הצליחה. הבחירה שמורה אצלכם. אפשר לנסות שוב בעוד רגע, או לכתוב לנו ל-abrahamgersten@gmail.com.");
      });
  });

  function showError(msg) {
    var errEl = $("formError");
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  function onSent() {
    setBusy(false);
    lastSent = {
      id: profile.id, school: $("f_school").value.trim(), city: $("f_city").value.trim(),
      contactName: $("f_name").value.trim(), role: $("f_role").value.trim(), phone: $("f_phone").value.trim(),
      structure: state.structure, u: state.u.slice(), y: state.y.slice(), o: state.o.slice(),
      sentAt: new Date().toISOString()
    };
    $("f_notes").value = "";
    store = { lastSent: lastSent, draft: null, profile: profile };
    saveStore(store);

    var url = personalUrl(lastSent);
    try { history.replaceState(null, "", "#s=" + url.split("#s=")[1]); } catch (e) { /* ignore */ }
    $("personalLink").value = url;
    $("successText").textContent = "קיבלנו את הבחירה של " + lastSent.school + ", ונעדכן את העלון בהתאם.";
    form.hidden = true;
    $("sendEmpty").hidden = true;
    $("sendSuccess").hidden = false;
    $("sendSuccess").focus();
    showWelcome();
    sync();
  }

  $("editAgainBtn").addEventListener("click", function () {
    $("sendSuccess").hidden = true;
    sync();
    document.getElementById("catalog").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  $("copyLinkBtn").addEventListener("click", function () {
    var input = $("personalLink");
    var url = input.value;
    function fallback() {
      input.select();
      try { document.execCommand("copy"); toast("הקישור הועתק. שמרו אותו במקום נוח."); } catch (e) { toast("סמנו את הקישור והעתיקו אותו ידנית."); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast("הקישור הועתק. שמרו אותו במקום נוח."); }, fallback);
    } else fallback();
  });

  $("shareLinkBtn").addEventListener("click", function () {
    var url = $("personalLink").value;
    var text = "הקישור האישי לבחירת המדורים של " + (lastSent ? lastSent.school : "בית הספר") + " בעלון שבת אחים:";
    if (navigator.share) {
      navigator.share({ title: "בחירת מדורים - שבת אחים", text: text, url: url }).catch(function () { /* user closed the sheet */ });
    } else {
      window.open("https://wa.me/?text=" + encodeURIComponent(text + "\n" + url), "_blank", "noopener");
    }
  });

  /* ---------------- welcome back ---------------- */
  function showWelcome() {
    if (!lastSent || !lastSent.school) return;
    $("welcomeSchool").textContent = lastSent.school;
    var when = "";
    try { when = new Date(lastSent.sentAt).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { /* ignore */ }
    $("welcomeText").textContent = (when ? "הבחירה ששלחתם ב-" + when : "הבחירה האחרונה ששלחתם") + " מסומנת כאן למטה. אפשר לשנות אותה ולשלוח שוב, מתי שתרצו.";
    $("welcomeBack").hidden = false;
  }

  /* ---------------- selection bar hides while the send section is on screen ---------------- */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      sendVisible = entries[0].isIntersecting;
      renderSelbar();
    }, { rootMargin: "0px 0px -35% 0px" }).observe($("send"));
  }

  /* ---------------- install as an app ---------------- */
  var installBtn = $("installBtn"), deferredPrompt = null;
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!standalone) installBtn.hidden = false;
  });
  if (isIOS && !standalone) installBtn.hidden = false;
  installBtn.addEventListener("click", function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (r) {
        if (r && r.outcome === "accepted") installBtn.hidden = true;
        deferredPrompt = null;
      });
    } else if (isIOS) {
      var d = $("iosDialog");
      if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    }
  });
  $("iosClose").addEventListener("click", function () { $("iosDialog").close(); });
  window.addEventListener("appinstalled", function () { installBtn.hidden = true; toast("האפליקציה הותקנה. אפשר לפתוח אותה ממסך הבית."); });

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { /* offline support is a bonus */ }); });
  }

  /* ---------------- boot ---------------- */
  renderCatalog();
  showWelcome();
  sync();
})();
