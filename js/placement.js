/* בחירת מדורים - מיקום המדורים בעלון (סקיצה סכמטית + חוקי השיבוץ).
   Rules come from placement_rules.json via data.js (SECTIONS_DATA.placement); the same file is read by David's engine. */
(function () {
  "use strict";

  var D = window.SECTIONS_DATA;
  var R = D.placement;
  var byKey = {};
  D.sections.forEach(function (s) { byKey[s.key] = s; });

  var STORY_KEY = R.classes.story[0];
  var ZK_KEY = R.classes.zk[0];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function classOf(key) {
    var c = R.classes;
    for (var name in c) { if (c[name].indexOf(key) >= 0) return name; }
    return "regular";
  }

  function layoutOf(id) { return R.layouts[id] || null; }

  /* ---------- the rules ----------
     picks: { key: {pos, v} } of the OTHER sections already placed in this tier (the section being placed is not in it).
     returns { id: {ok, reason, variants:[{id,label,ok,reason}]} } for every position of the layout. */
  function evaluate(layoutId, key, picks) {
    var L = layoutOf(layoutId), out = {};
    var cls = classOf(key);
    var at = {};                       // pos -> the other pick sitting there
    Object.keys(picks).forEach(function (k) { if (picks[k] && picks[k].pos) at[picks[k].pos] = { key: k, v: picks[k].v }; });
    var st = R.story[layoutId];
    var storyAt = st && at[st.position] && at[st.position].key === STORY_KEY;       // misaviv already fills the big frame
    var longAt = layoutId === "landscape" && at.L3 && at.L3.key === ZK_KEY && at.L3.v === "long";

    Object.keys(L.positions).forEach(function (id) {
      var p = L.positions[id];
      var r = { ok: true, reason: "", variants: null, auto: null };
      var accepted = p.accepts.indexOf(cls) >= 0;
      if (!accepted) {
        r.ok = false;
        r.generic = true;
        r.reason = cls === "story" ? "מסביב לשולחן ממלא את המדור הגדול" :
          (cls === "small" || cls === "smalltorah") ? "המדור הזה קטן, ומיועד למקומות הקטנים" : "המדור הזה לא מתאים למקום הזה";
      } else if (at[id]) {
        r.ok = false;
        r.reason = "תפוס: " + byKey[at[id].key].name;
        r.occupant = at[id].key;
      }
      if (r.ok && layoutId === "landscape") {
        if (id === "L4" && storyAt) {
          r.ok = false; r.auto = "שאלות לדיון";
          r.reason = "המקום הזה מתמלא בשאלות הדיון של מסביב לשולחן";
        }
        if (id === "L3b" && (storyAt || longAt)) {
          r.ok = false;
          r.reason = "המדור הגדול כבר מלא ואין בו מקום פנוי";
        }
        if (id === "L3" && cls === "story") {
          if (at.L4) { r.ok = false; r.reason = "מסביב לשולחן ימלא גם את המדור הקטן. כדי לבחור בו, הסירו קודם את " + byKey[at.L4.key].name; }
          else if (at.L3b) { r.ok = false; r.reason = "מסביב לשולחן ממלא את כל המדור הגדול. כדי לבחור בו, הסירו קודם את " + byKey[at.L3b.key].name; }
        }
        if (id === "L3" && cls === "zk") {
          var longOk = !at.L3b;
          r.variants = [
            { id: "long", label: "הגרסה הארוכה", hint: "ממלאת את כל המדור הגדול והארוך", ok: longOk,
              reason: longOk ? "" : "כדי לבחור בה, הסירו קודם את " + byKey[at.L3b.key].name + " מתחתית המדור הגדול" },
            { id: "regular", label: "הגרסה הרגילה", hint: "תופסת מקום של מדור רגיל, ובתחתית המדור הגדול נשאר מקום למלתא דבדיחותא או לחידות בתמונות", ok: true, reason: "" }
          ];
        }
      }
      out[id] = r;
    });
    return out;
  }

  /* what a position holds automatically because of another pick (for the sketch) */
  function autoFills(layoutId, picks) {
    var fills = {};
    var st = R.story[layoutId];
    if (st && st.companion && picks[STORY_KEY] && picks[STORY_KEY].pos === st.position) {
      fills[st.companion] = "שאלות לדיון של מסביב לשולחן";
    }
    return fills;
  }

  function positionName(layoutId, id) {
    var L = layoutOf(layoutId);
    return L && L.positions[id] ? L.positions[id].name : "";
  }

  function describePick(layoutId, key, pick) {
    var base = positionName(layoutId, pick.pos);
    if (key === ZK_KEY && pick.pos === "L3") base += pick.v === "long" ? " (הגרסה הארוכה)" : " (הגרסה הרגילה)";
    return base;
  }

  /* keeps only placements that are still legal (e.g. after a layout switch or a stale personal link) */
  function cleanPlaces(layoutId, keys, places) {
    var out = {};
    if (!layoutId || !layoutOf(layoutId)) return out;
    var L = layoutOf(layoutId), used = {};
    keys.forEach(function (k) {
      var p = places && places[k];
      if (!p || !L.positions[p.pos] || used[p.pos]) return;
      used[p.pos] = true;
      out[k] = { pos: p.pos };
      if (p.v) out[k].v = p.v;
    });
    return out;
  }

  /* ---------- the sketch ---------- */
  function pct(n) { return (Math.round(n * 10000) / 100) + "%"; }

  function place(node, rect) {
    node.style.left = pct(rect[0]);
    node.style.top = pct(rect[1]);
    node.style.width = pct(rect[2]);
    node.style.height = pct(rect[3]);
  }

  /* opts: { layout, picks (other sections), current: {pos,v}|null, forKey (section being placed, or null for a read-only view),
             onPick(posId) } */
  function buildSketch(opts) {
    var L = layoutOf(opts.layout);
    var picks = opts.picks || {};
    var ev = opts.forKey ? evaluate(opts.layout, opts.forKey, picks) : null;
    var fills = autoFills(opts.layout, picks);
    var wrap = el("div", "sk sk-" + opts.layout);
    var pages = el("div", "sk-pages");
    L.pages.forEach(function (pg) {
      var col = el("div", "sk-col");
      col.appendChild(el("p", "sk-pagetitle", pg.title));
      var page = el("div", "sk-page");
      page.style.aspectRatio = L.pageAspect[0] + " / " + L.pageAspect[1];
      (pg.decor || []).forEach(function (d) {
        var n = el("div", "sk-decor sk-" + d.kind, d.label);
        n.setAttribute("aria-hidden", "true");
        place(n, d.rect);
        page.appendChild(n);
      });
      if (pg.cut) {
        var cut = el("div", "sk-cut");
        cut.appendChild(el("span", "sk-cut-name", "✂ " + pg.cut.label));
        cut.appendChild(el("span", "sk-cut-note", pg.cut.note));
        place(cut, pg.cut.rect);
        page.appendChild(cut);
      }
      // zones: a frame that sits inside another (the bottom strip of the big frame) is drawn on top of it
      Object.keys(L.positions).filter(function (id) { return L.positions[id].page === pg.id; })
        .sort(function (a, b) { return (L.positions[a].inside ? 1 : 0) - (L.positions[b].inside ? 1 : 0); })
        .forEach(function (id) {
          var p = L.positions[id];
          var other = null;
          Object.keys(picks).forEach(function (k) { if (picks[k] && picks[k].pos === id) other = k; });
          var cur = opts.current && opts.current.pos === id;
          var state = ev ? ev[id] : { ok: false, reason: "" };
          var tag = (cur || (ev && state.ok)) ? "button" : "div";
          var z = el(tag, "sk-zone");
          if (tag === "button") z.type = "button";
          place(z, p.rect);
          z.setAttribute("data-pos", id);
          var name = el("span", "sk-zname", p.name);
          var size = el("span", "sk-zsize", p.size);
          var body = el("span", "sk-zbody");
          if (cur) {
            z.classList.add("is-current");
            body.textContent = byKey[opts.forKey].name;
            z.setAttribute("aria-pressed", "true");
          } else if (other) {
            z.classList.add("is-taken");
            body.textContent = byKey[other].name;
          } else if (fills[id]) {
            z.classList.add("is-auto");
            body.textContent = fills[id];
            size.textContent = "מתמלא אוטומטית";
          } else if (ev && state.ok) {
            z.classList.add("is-open");
            body.textContent = "לחצו כאן";
            z.setAttribute("aria-pressed", "false");
          } else {
            z.classList.add("is-off");
            body.textContent = ev ? "לא זמין" : "";
          }
          if (ev && !state.ok && !cur && !other && !fills[id] && state.reason) {
            z.title = state.reason;
            z.setAttribute("data-reason", state.reason);
          }
          z.appendChild(name); z.appendChild(size); z.appendChild(body);
          if (tag === "button") {
            z.setAttribute("aria-label", p.name + " (" + p.size + ")" + (cur ? ", נבחר" : ""));
            z.addEventListener("click", function () { opts.onPick(id); });
          }
          if (id === "L3" && opts.forKey === ZK_KEY && cur && opts.current.v === "long") z.classList.add("is-long");
          page.appendChild(z);
        });
      col.appendChild(page);
      pages.appendChild(col);
    });
    wrap.appendChild(pages);
    return wrap;
  }

  /* little icon of a whole newsletter, for the orientation cards */
  function miniIcon(layoutId) {
    var L = layoutOf(layoutId);
    var box = el("span", "mini mini-" + layoutId);
    box.setAttribute("aria-hidden", "true");
    L.pages.forEach(function (pg) {
      var page = el("span", "mini-page");
      page.style.aspectRatio = L.pageAspect[0] + " / " + L.pageAspect[1];
      Object.keys(L.positions).forEach(function (id) {
        var p = L.positions[id];
        if (p.page !== pg.id || p.inside) return;
        var z = el("span", "mini-zone");
        place(z, p.rect);
        page.appendChild(z);
      });
      box.appendChild(page);
    });
    return box;
  }

  window.Placement = {
    rules: R,
    classOf: classOf,
    evaluate: evaluate,
    autoFills: autoFills,
    positionName: positionName,
    describePick: describePick,
    cleanPlaces: cleanPlaces,
    buildSketch: buildSketch,
    miniIcon: miniIcon,
    layoutLabel: function (id) { var L = layoutOf(id); return L ? L.label : ""; },
    layouts: Object.keys(R.layouts)
  };
})();
