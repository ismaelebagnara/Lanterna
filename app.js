/* Lanterna — gestore di campagne per Daggerheart (GM). Tutto offline, dati sul dispositivo. */
(function () {
  "use strict";

  // ---------------------------------------------------------------- util
  const KEY = "lanterna.v1";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nl = (s) => esc(s).replace(/\n/g, "<br>");
  const num = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
  const numOrNull = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (n) => 1 + Math.floor(Math.random() * n);

  const ROLES = ["Base", "Bruto", "Condottiero", "Controparte", "Orda", "Seguace", "Sicario", "Solitario", "Supporto", "Tiratore", "Colossale"];
  const ROLE_COST = { Controparte: 1, Supporto: 1, Orda: 2, Tiratore: 2, Sicario: 2, Base: 2, Condottiero: 3, Bruto: 4, Solitario: 5, Colossale: 5 };
  const FEAT_TYPES = ["Passiva", "Azione", "Reazione", "Privilegio di Paura"];
  const RANGES = ["Mischia", "Prossima", "Ravvicinata", "Lontana", "Remota"];
  const CONDITIONS = ["Nascosto", "Trattenuto", "Vulnerabile"];
  const ENV_TYPES = ["Esplorazione", "Contesto Sociale", "Attraversamento", "Evento"];
  const WORLD_KINDS = { png: "PNG", luogo: "Luoghi", fazione: "Fazioni", oggetto: "Oggetti", lore: "Lore" };
  const WORLD_ONE = { png: "PNG", luogo: "Luogo", fazione: "Fazione", oggetto: "Oggetto", lore: "Lore" };
  const CLOCK_KINDS = { progresso: "Progresso", conseguenza: "Conseguenza", campagna: "Campagna" };

  // ---------------------------------------------------------------- stato
  let S = load();
  function blank() { return { version: 1, activeId: null, campaigns: {}, settings: { massive: false } }; }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); return migrate(Object.assign(blank(), d)); } } catch (e) { console.error(e); }
    return blank();
  }
  function migrate(d) {
    Object.values(d.campaigns || {}).forEach((c) => {
      c.encounters = (c.encounters || []).map((e) => Object.assign({ status: "bozza", mods: {}, items: [], clocks: [], objective: "", envId: "", created: Date.now(), updated: Date.now() }, e));
      if (c.plan && c.plan.items && c.plan.items.length) c.encounters.unshift({ id: uid(), name: "Bozza da Pianifica", status: "bozza", partySize: c.plan.partySize || 4, mods: clone(c.plan.mods || {}), items: clone(c.plan.items), clocks: [], objective: "", envId: "", created: Date.now(), updated: Date.now() });
      delete c.plan;
      if (c.combat && c.combat.encId === undefined) c.combat.encId = null;
    });
    return d;
  }
  let linkVer = 0;
  function save(quiet) {
    linkVer++;
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast("Salvataggio non riuscito: " + e.message); }
    if (!quiet && window.__syncSoon) window.__syncSoon();
  }
  const C = () => S.campaigns[S.activeId];
  const SRD = window.SRD || { adversaries: [], environments: [] };
  // la libreria SRD è in italiano; il testo inglese originale è in x.en e si può scegliere nelle impostazioni
  if (S.settings.srdLang === "en") SRD.adversaries.concat(SRD.environments).forEach((x) => { if (x.en) { const it = { name: x.name }; Object.assign(x, x.en); x.en = Object.assign({}, x.en, { name: it.name }); } });
  const altName = (x) => (x && x.en && x.en.name && x.en.name !== x.name ? x.en.name : "");
  const findText = (x) => (x.name + " " + altName(x) + " " + (x.desc || "")).toLowerCase();
  const libOn = () => !S.settings.srdOff;
  const allAdv = (c) => libOn() ? c.bestiary.concat(SRD.adversaries) : c.bestiary;
  const allEnv = (c) => libOn() ? c.environments.concat(SRD.environments) : c.environments;
  const findAdv = (c, id) => c.bestiary.find((x) => x.id === id) || SRD.adversaries.find((x) => x.id === id);
  const findEnv = (c, id) => c.environments.find((x) => x.id === id) || SRD.environments.find((x) => x.id === id);
  const SOURCES = [["", "Tutte le fonti"], ["camp", "Solo campagna"], ["Manuale base", "Manuale base (SRD)"], ["SRD 2.0 (espansioni)", "SRD 2.0 · espansioni"]];
  const srcOk = (x, f) => !f || (f === "camp" ? !x.srd : x.source === f);

  function newCampaign(name, frame, pack) {
    const c = {
      id: uid(), name: name || "Nuova campagna", frame: frame || "", created: Date.now(),
      fear: 0, pcs: [], bestiary: [], environments: [], tables: [], encounters: [],
      combat: { units: [], envId: "", log: [] },
      clocks: [], world: [], sessions: [], rolls: [],
    };
    if (pack) importPack(c);
    S.campaigns[c.id] = c; S.activeId = c.id; save();
    return c;
  }
  function importPack(c) {
    const P = window.UMBRA_PACK; if (!P) return 0;
    let n = 0;
    const has = (arr, name) => arr.some((x) => x.name === name);
    P.adversaries.forEach((a) => { if (!has(c.bestiary, a.name)) { c.bestiary.push(Object.assign(clone(a), { id: uid() })); n++; } });
    P.environments.forEach((e) => { if (!has(c.environments, e.name)) { c.environments.push(Object.assign(clone(e), { id: uid() })); n++; } });
    P.tables.forEach((t) => { if (!has(c.tables, t.name)) { c.tables.push(Object.assign(clone(t), { id: uid() })); n++; } });
    return n;
  }

  // ---------------------------------------------------------------- regole
  function hpFromDamage(dmg, major, severe) {
    if (dmg <= 0) return 0;
    if (major == null) return 1;
    let m = 1;
    if (dmg >= major) m = 2;
    if (severe != null && dmg >= severe) m = 3;
    if (S.settings.massive && severe != null && dmg >= severe * 2) m = 4;
    return m;
  }
  function planCost(c, plan) {
    const party = Math.max(1, num(plan.partySize, 4));
    const ptier = num(plan.partyTier, 0);
    let spent = 0, solos = 0, big = 0, lower = false;
    const lines = [], missing = [], higher = [];
    (plan.items || []).forEach((it, idx) => {
      const a = findAdv(c, it.advId);
      if (!a) { missing.push({ missing: true, it, idx }); return; }
      const qty = Math.max(1, num(it.qty, 1));
      const cost = a.role === "Seguace" ? Math.ceil(qty / party) : (ROLE_COST[a.role] ?? 2) * qty;
      const reinf = !!it.reinf;
      if (!reinf) {
        if (a.role === "Solitario" || a.role === "Colossale") solos += qty;
        if (["Bruto", "Orda", "Condottiero", "Solitario", "Colossale"].includes(a.role)) big += qty;
        if (ptier && num(a.tier) < ptier) lower = true;
        if (ptier && num(a.tier) > ptier && !higher.includes(a.name)) higher.push(a.name);
        spent += cost;
      }
      lines.push({ a, it, idx, qty, cost, reinf, label: it.label || a.name });
    });
    const m = plan.mods || {};
    let budget = 3 * party + 2;
    const notes = [];
    if (m.easier) { budget -= 1; notes.push("−1 più facile o breve"); }
    if (m.dmg) { budget -= 2; notes.push("−2 danni +1d4 agli avversari"); }
    if (lower || m.lower) { budget += 1; notes.push("+1 avversari di rango inferiore"); }
    if (m.harder) { budget += 2; notes.push("+2 più pericoloso o lungo"); }
    if (solos >= 2) { budget -= 2; notes.push("−2 due o più Solitari"); }
    if (lines.some((l) => !l.reinf) && big === 0) { budget += 1; notes.push("+1 niente Bruti, Orde, Condottieri, Solitari"); }
    return { party, budget, spent, lines, missing, higher, notes };
  }
  function parseDice(expr) {
    const s = String(expr || "").replace(/\s+/g, "").toLowerCase();
    if (!/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(s)) return null;
    const parts = s.match(/[+-]?(\d*d\d+|\d+)/g);
    let total = 0; const shown = [];
    for (const p of parts) {
      const sign = p[0] === "-" ? -1 : 1;
      const body = p.replace(/^[+-]/, "");
      if (body.includes("d")) {
        let [n, f] = body.split("d"); n = num(n, 1); f = num(f, 6);
        if (n > 100 || f > 1000 || f < 2) return null;
        const r = Array.from({ length: n }, () => rnd(f));
        total += sign * r.reduce((x, y) => x + y, 0);
        shown.push((sign < 0 ? "−" : "") + `[${r.join(", ")}]`);
      } else { total += sign * num(body); shown.push((sign < 0 ? "−" : "+") + body); }
    }
    return { total, detail: shown.join(" ") };
  }

  // ---------------------------------------------------------------- UI base
  function toast(msg, action) {
    const t = $("#toast");
    t.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button class="toastbtn" data-a="toastAct">${esc(action.label)}</button>` : "");
    toast._act = action ? action.run : null;
    t.classList.toggle("act", !!action); t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.classList.remove("show"); toast._act = null; }, action ? 6000 : 2600);
  }
  function withUndo(msg, fn) {
    const c = C(); const snap = JSON.stringify(c);
    fn(c); save(); render();
    toast(msg, { label: "Annulla", run: () => { const old = JSON.parse(snap); S.campaigns[old.id] = old; save(); render(); toast("Ripristinato"); } });
  }
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (_) {} };
  let modalSave = null, modalOpen = false, ignorePop = false, pendingHash = null;
  function openModal(title, body, opts = {}) {
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = body;
    const foot = $("#modal-foot");
    foot.innerHTML = (opts.extra || "") + (opts.onSave ? `<button class="btn primary" data-a="modalSave">${esc(opts.saveLabel || "Salva")}</button>` : "");
    foot.hidden = !foot.innerHTML;
    modalSave = opts.onSave || null;
    $("#modal").hidden = false; $("#modal").classList.toggle("full", !!opts.full);
    document.body.classList.add("noscroll");
    if (!modalOpen) { try { history.pushState({ lm: 1 }, ""); } catch (_) {} }
    modalOpen = true;
    const f = $('#modal-body input[type="text"], #modal-body textarea');
    if (f && opts.focus !== false && !f.value) f.focus();
  }
  function closeModal(fromPop) {
    if (!modalOpen) return;
    $("#modal").hidden = true; $("#modal").classList.remove("full"); modalSave = null; modalOpen = false; document.body.classList.remove("noscroll");
    if (fromPop !== true && history.state && history.state.lm) { ignorePop = true; history.back(); }
  }
  const form = () => { const o = {}; $$("#modal-body [name]").forEach((el) => { o[el.name] = el.type === "checkbox" ? el.checked : el.value; }); return o; };

  const field = (label, name, value, type = "text", extra = "") =>
    `<label class="fld"><span>${esc(label)}</span><input type="${type}" name="${name}" value="${esc(value ?? "")}" ${extra}></label>`;
  const area = (label, name, value, rows = 4, linkable = true) =>
    `<label class="fld"><span>${esc(label)}</span><textarea name="${name}" rows="${rows}" ${linkable ? 'data-link="1"' : ""}>${esc(value ?? "")}</textarea></label>` +
    (linkable ? `<div class="areatools"><button type="button" class="chip small" data-a="linkPick" data-for="${name}">Collega [[…]]</button></div><div class="linkpanel" data-panel="${name}" hidden></div>` : "");
  const select = (label, name, value, options) =>
    `<label class="fld"><span>${esc(label)}</span><select name="${name}">${options.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(t)}</option>`; }).join("")}</select></label>`;
  const check = (label, name, value) => `<label class="chk"><input type="checkbox" name="${name}" ${value ? "checked" : ""}><span>${esc(label)}</span></label>`;

  function pips(total, filled, kind, attrs) {
    let h = `<div class="pips ${kind}">`;
    for (let i = 0; i < total; i++) h += `<button class="pip ${i < filled ? "on" : ""}" data-i="${i}" ${attrs} aria-label="${kind} ${i + 1}"></button>`;
    return h + "</div>";
  }
  const empty = (title, text, btn) => `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${btn || ""}</div>`;

  // ---------------------------------------------------------------- collegamenti e testo ricco
  const DICE_RE = /\b(\d*d\d+(?:\s*[+\-−]\s*\d+)?)\b/g;
  const KIND_LABEL = { pc: "PG", world: "Mondo", adv: "Avversari", env: "Ambienti", session: "Sessioni", clock: "Conti alla rovescia", rule: "Regole" };
  function entities(c, withSrd) {
    const out = [];
    c.pcs.forEach((x) => out.push({ kind: "pc", id: x.id, name: x.name, sub: "PG" + (x.cls ? " · " + x.cls : "") }));
    c.world.forEach((x) => out.push({ kind: "world", id: x.id, name: x.name, sub: (WORLD_ONE[x.kind] || "") + (x.subtitle ? " · " + x.subtitle : "") }));
    c.bestiary.forEach((x) => out.push({ kind: "adv", id: x.id, name: x.name, sub: `${x.role} · Rango ${x.tier}` }));
    c.environments.forEach((x) => out.push({ kind: "env", id: x.id, name: x.name, sub: `Ambiente · Rango ${x.tier}` }));
    c.sessions.forEach((x) => out.push({ kind: "session", id: x.id, name: x.title || ("Sessione " + x.num), sub: "Sessione" + (x.num ? " #" + x.num : "") }));
    c.clocks.forEach((x) => out.push({ kind: "clock", id: x.id, name: x.name, sub: "Conto alla rovescia" }));
    if (withSrd && libOn()) {
      SRD.adversaries.forEach((x) => out.push({ kind: "adv", id: x.id, name: x.name, alt: altName(x), sub: `${x.role} · Rango ${x.tier} · SRD${altName(x) ? " · " + altName(x) : ""}`, srd: true }));
      SRD.environments.forEach((x) => out.push({ kind: "env", id: x.id, name: x.name, alt: altName(x), sub: `Ambiente · Rango ${x.tier} · SRD${altName(x) ? " · " + altName(x) : ""}`, srd: true }));
    }
    return out;
  }
  function resolveLink(name) {
    const c = C(); if (!c) return null;
    const norm = (x) => x.trim().toLowerCase().replace(/^(?:(?:il|lo|la|i|gli|le|un|una|uno)\s+|l['’]\s*)/, "");
    const n = name.trim().toLowerCase(); const all = entities(c, true);
    const hit = all.find((e) => e.name.toLowerCase() === n) || all.find((e) => norm(e.name) === norm(name));
    if (hit) return hit;
    const idx = linkIndex(); const a = idx.map[n] || idx.map[norm(name)]; return a ? { kind: a.kind, id: a.id, name: a.name } : null;
  }
  // ---- collegamenti automatici: i nomi di PG, voci del Mondo, avversari e ambienti della campagna diventano link anche senza [[ ]]
  let LINKIDX = null, richSkip = null;
  const bareName = (x) => String(x || "").trim().replace(/^(?:(?:il|lo|la|i|gli|le|un|una|uno)\s+|l['’]\s*)/i, "");
  function linkIndex() {
    const c = C(); if (!c) return { rx: null, map: {} };
    if (LINKIDX && LINKIDX.v === linkVer && LINKIDX.cid === c.id) return LINKIDX;
    const map = {}; const add = (kind, id, name, label) => { const n = String(name || "").trim(); if (n.length < 3) return; const k = n.toLowerCase(); if (!map[k]) map[k] = { kind, id, name: label }; };
    const names = (x) => [x.name, bareName(x.name)].concat(String(x.aliases || "").split(",").map((s0) => s0.trim()).filter(Boolean));
    c.pcs.forEach((x) => { names(x).forEach((n) => add("pc", x.id, n, x.name)); const f = x.name.split(/\s+/)[0]; if (f.length >= 4 && f !== x.name) add("pc", x.id, f, x.name); });
    c.world.forEach((x) => { names(x).forEach((n) => add("world", x.id, n, x.name)); const f = bareName(x.name).split(/[\s,]+/)[0]; if (x.kind === "png" && f.length >= 4 && f !== x.name) add("world", x.id, f, x.name); });
    c.bestiary.forEach((x) => { add("adv", x.id, x.name, x.name); const f = x.name.split(",")[0].trim(); if (f !== x.name) add("adv", x.id, f, x.name); });
    c.environments.forEach((x) => add("env", x.id, x.name, x.name));
    const keys = Object.keys(map).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]"));
    const rx = keys.length ? new RegExp("(?<![\\p{L}\\p{N}])(" + keys.join("|") + ")(?![\\p{L}\\p{N}])", "giu") : null;
    LINKIDX = { v: linkVer, cid: c.id, rx, map }; return LINKIDX;
  }
  function mentionsIn(text) {
    const idx = linkIndex(); const out = new Set(); const t = String(text || "");
    t.replace(/\[\[([^\]\n]+)\]\]/g, (m, n) => { const h = resolveLink(n); if (h) out.add(h.kind + ":" + h.id); return m; });
    if (idx.rx) for (const m of t.matchAll(idx.rx)) { const h = idx.map[m[1].toLowerCase().replace(/’/g, "'")] || idx.map[m[1].toLowerCase()]; if (h) out.add(h.kind + ":" + h.id); }
    return out;
  }
  function rich(raw) {
    return String(raw ?? "").split(/(\[\[[^\]\n]+\]\])/).map((part) => {
      const m = part.match(/^\[\[([^\]\n]+)\]\]$/);
      if (m) { const name = m[1].trim(); return `<button class="wl ${resolveLink(name) ? "" : "missing"}" data-a="link" data-name="${esc(name)}">${esc(name)}</button>`; }
      const plainPart = (t) => esc(t).replace(DICE_RE, (d) => `<button class="dl" data-a="rollInline" data-e="${esc(d.replace(/\s/g, "").replace("−", "-"))}">${d}</button>`).replace(/\n/g, "<br>");
      const idx = S.settings.autolink === false ? null : linkIndex();
      if (!idx || !idx.rx) return plainPart(part);
      let out = "", last = 0;
      for (const m of part.matchAll(idx.rx)) {
        const h = idx.map[m[1].toLowerCase()] || idx.map[m[1].toLowerCase().replace(/’/g, "'")] || idx.map[m[1].toLowerCase().replace(/'/g, "’")];
        if (!h || (richSkip && h.id === richSkip)) continue;
        out += plainPart(part.slice(last, m.index)) + `<button class="wl auto" data-a="open" data-kind="${h.kind}" data-id="${h.id}">${esc(m[1])}</button>`; last = m.index + m[1].length;
      }
      return out + plainPart(part.slice(last));
    }).join("");
  }
  function backlinks(name) {
    const c = C(); const bare = name.toLowerCase().replace(/^(?:(?:il|lo|la|i|gli|le|un|una|uno)\s+|l['’]\s*)/, "");
    const needles = ["[[" + name.toLowerCase() + "]]", "[[" + bare + "]]"]; const out = [];
    const has = (...t) => t.some((x) => { const v = String(x || "").toLowerCase(); return needles.some((n) => v.includes(n)); });
    c.world.forEach((x) => { if (x.name !== name && has(x.notes)) out.push({ kind: "world", id: x.id, name: x.name }); });
    c.sessions.forEach((x) => { if (has(x.prep, x.summary, x.aside)) out.push({ kind: "session", id: x.id, name: (x.num ? "#" + x.num + " · " : "") + (x.title || "Sessione") }); });
    c.pcs.forEach((x) => { if (x.name !== name && has(x.notes)) out.push({ kind: "pc", id: x.id, name: x.name }); });
    c.clocks.forEach((x) => { if (has(x.notes)) out.push({ kind: "clock", id: x.id, name: x.name }); });
    c.bestiary.forEach((x) => { if (x.name !== name && has(x.desc, x.other, x.motives)) out.push({ kind: "adv", id: x.id, name: x.name }); });
    c.environments.forEach((x) => { if (x.name !== name && has(x.desc)) out.push({ kind: "env", id: x.id, name: x.name }); });
    return out;
  }
  function backlinksOf(kind, id) {
    const c = C(); const key = kind + ":" + id; const out = []; const has = (...t) => t.some((x) => mentionsIn(x).has(key));
    c.world.forEach((x) => { if (!(kind === "world" && x.id === id) && has(x.notes)) out.push({ kind: "world", id: x.id, name: x.name }); });
    c.pcs.forEach((x) => { if (!(kind === "pc" && x.id === id) && has(x.notes)) out.push({ kind: "pc", id: x.id, name: x.name }); });
    c.sessions.forEach((x) => { if (has(x.prep, x.summary, x.aside, x.plan && [x.plan.want, x.plan.opening, x.plan.cast].join(" "), (x.log || []).map((e) => e.txt).join(" "))) out.push({ kind: "session", id: x.id, name: (x.num ? "#" + x.num + " · " : "") + (x.title || "Sessione") }); });
    c.clocks.forEach((x) => { if (has(x.notes)) out.push({ kind: "clock", id: x.id, name: x.name }); });
    c.bestiary.forEach((x) => { if (!(kind === "adv" && x.id === id) && has(x.desc, x.other, x.motives)) out.push({ kind: "adv", id: x.id, name: x.name }); });
    return out;
  }
  const REL_KINDS = ["alleato", "nemico", "famiglia", "ama", "rivale", "lavora per", "comanda", "membro di", "vive a", "in debito con", "custodisce", "sa un segreto su", "cerca"];
  const entLabel = (kind, id) => { const c = C(); const x = kind === "pc" ? c.pcs.find((y) => y.id === id) : kind === "world" ? c.world.find((y) => y.id === id) : kind === "adv" ? findAdv(c, id) : kind === "env" ? findEnv(c, id) : null; return x ? x.name : null; };
  function linksBlock(kind, x) {
    const c = C(); const rels = (x.rels || []).map((r, i) => ({ r, i, name: entLabel(r.kind, r.id) })).filter((o) => o.name);
    const incoming = []; [["pc", c.pcs], ["world", c.world]].forEach(([k, arr]) => arr.forEach((y) => (y.rels || []).forEach((r) => { if (r.kind === kind && r.id === x.id && !(k === kind && y.id === x.id)) incoming.push({ kind: k, id: y.id, name: y.name, r: r.r }); })));
    const back = backlinksOf(kind, x.id).filter((b) => !rels.some((o) => o.r.kind === b.kind && o.r.id === b.id) && !incoming.some((o) => o.kind === b.kind && o.id === b.id));
    return `<div class="links"><div class="row between"><h4>Legami</h4><button class="btn small ghost" data-a="relAdd" data-kind="${kind}" data-id="${x.id}">+ Legame</button></div>
      ${rels.length || incoming.length ? `<div class="chips">${rels.map((o) => `<span class="chip rel"><button class="relgo" data-a="open" data-kind="${o.r.kind}" data-id="${o.r.id}">${o.r.r ? `<i>${esc(o.r.r)}</i> ` : ""}${esc(o.name)}</button><button class="relx" data-a="relDel" data-kind="${kind}" data-id="${x.id}" data-i="${o.i}" aria-label="Togli">×</button></span>`).join("")}${incoming.map((o) => `<button class="chip rel in" data-a="open" data-kind="${o.kind}" data-id="${o.id}">${esc(o.name)}${o.r ? ` <i>(${esc(o.r)})</i>` : ""}</button>`).join("")}</div>` : `<p class="sub">Nessun legame. Aggiungine uno, oppure scrivi i nomi negli appunti: diventano collegamenti da soli.</p>`}
      ${back.length ? `<h4>Citato in</h4><div class="chips">${back.map((e) => `<button class="chip" data-a="open" data-kind="${e.kind}" data-id="${e.id}">${esc(e.name)}</button>`).join("")}</div>` : ""}</div>`;
  }
  function relPicker(kind, id) {
    const c = C(); const src = kind === "pc" ? c.pcs.find((y) => y.id === id) : c.world.find((y) => y.id === id); if (!src) return;
    relPicker.state = { kind, id, r: "" };
    const all = entities(c, false).filter((e) => ["pc", "world", "adv", "env"].includes(e.kind) && !(e.kind === kind && e.id === id));
    openModal(`Legame di ${src.name}`, `<p class="sub">Che rapporto c'è? (facoltativo)</p><div class="chips" id="relKinds">${REL_KINDS.map((r) => `<button class="chip small" data-a="relKind" data-k="${esc(r)}">${esc(r)}</button>`).join("")}</div>
      <input type="search" id="relQ" class="search" placeholder="Cerca chi o cosa collegare"><div class="list" id="relList">${all.map((e) => `<button class="listrow mini" data-a="relPick" data-kind="${e.kind}" data-id="${e.id}" data-name="${esc(e.name.toLowerCase())}"><div><b>${esc(e.name)}</b><div class="sub">${esc(e.sub)}</div></div><span class="chev">+</span></button>`).join("")}</div>`, { focus: false });
    $("#relQ").addEventListener("input", (ev) => { const q = ev.target.value.toLowerCase(); $$("#relList .listrow").forEach((r) => { r.hidden = q && !r.dataset.name.includes(q); }); });
  }
  const backlinkBlock = (name) => { const b = backlinks(name); return b.length ? `<h4>Citato in</h4><div class="chips">${b.map((e) => `<button class="chip" data-a="open" data-kind="${e.kind}" data-id="${e.id}">${esc(e.name)}</button>`).join("")}</div>` : ""; };
  function openEntity(kind, id) {
    const el = { dataset: { id } }; const c = C();
    if (kind === "world") A.viewWorld(el);
    else if (kind === "pc") A.pcView(el);
    else if (kind === "adv") A.viewAdv(el);
    else if (kind === "env") A.viewEnv(el);
    else if (kind === "session") A.sessionView(el);
    else if (kind === "clock") clockEditor(c.clocks.find((k) => k.id === id));
    else if (kind === "rule") rulesSheet(id);
  }
  function showLinkPanel(name, query, start) {
    const panel = $(`#modal-body [data-panel="${name}"]`); if (!panel) return;
    const q = (query || "").toLowerCase();
    const list = entities(C(), true).filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => ((a.srd ? 1 : 0) - (b.srd ? 1 : 0)) || a.name.localeCompare(b.name)).slice(0, 12);
    panel.hidden = false; panel.dataset.start = start == null ? "" : String(start);
    const results = list.map((e) => `<button type="button" class="listrow mini" data-a="linkInsert" data-for="${name}" data-name="${esc(e.name)}"><div><b>${esc(e.name)}</b><div class="sub">${esc(e.sub)}</div></div></button>`).join("")
      || `<p class="sub">Nessun risultato. Puoi scrivere comunque [[Nome]]: toccando il collegamento potrai creare la voce.</p>`;
    if (start == null && $(".linkq", panel)) { $(".linkres", panel).innerHTML = results; return; }
    panel.innerHTML = `${start == null ? `<input type="search" class="linkq" placeholder="Cerca cosa collegare" value="${esc(query || "")}" data-for="${name}">` : ""}<div class="linkres">${results}</div>`;
    const qi = $(".linkq", panel); if (qi) qi.focus();
  }
  function hideLinkPanels() { $$("#modal-body .linkpanel").forEach((p) => { p.hidden = true; p.innerHTML = ""; p.dataset.start = ""; }); }
  const RULES = window.RULES || [];
  function rulesSheet(openId) {
    openModal("Schermo del GM", `${screenTabs("regole")}<input type="search" id="rq" class="search" placeholder="Cerca una regola: Paura, riposo, Vulnerabile…">
      <div id="rlist">${RULES.map((r) => `<details class="rule" data-id="${r.id}" ${r.id === openId ? "open" : ""}><summary>${esc(r.title)}</summary><div class="rbody">${r.body}</div></details>`).join("")}</div>`, { focus: false });
    const q = $("#rq"); q.addEventListener("input", () => { const v = q.value.trim().toLowerCase();
      $$("#rlist .rule").forEach((d) => { const r = RULES.find((x) => x.id === d.dataset.id); const hit = !v || (r.title + " " + r.tags + " " + d.querySelector(".rbody").textContent).toLowerCase().includes(v); d.hidden = !hit; d.open = !!v && hit; }); });
    if (openId) setTimeout(() => { const d = $(`#rlist [data-id="${openId}"]`); if (d) d.scrollIntoView({ block: "start" }); }, 50);
  }
  function searchSheet() {
    openModal("Cerca", `<input type="search" id="gq" class="search" placeholder="PG, PNG, luoghi, avversari, sessioni…"><div id="gres"></div>`);
    const run = () => {
      const q = $("#gq").value.trim().toLowerCase(); const box = $("#gres");
      if (q.length < 2) { box.innerHTML = `<p class="sub">Scrivi almeno due lettere. Cerca nei nomi di tutto e anche negli appunti del Mondo e delle sessioni.</p>`; return; }
      const c = C(); const hits = entities(c, true).filter((e) => (e.name + " " + (e.alt || "")).toLowerCase().includes(q));
      const text = [];
      c.world.forEach((x) => { if (!x.name.toLowerCase().includes(q) && String(x.notes || "").toLowerCase().includes(q)) text.push({ kind: "world", id: x.id, name: x.name, sub: "trovato negli appunti" }); });
      RULES.forEach((r) => { if ((r.title + " " + r.tags + " " + r.body.replace(/<[^>]+>/g, " ")).toLowerCase().includes(q)) text.push({ kind: "rule", id: r.id, name: r.title, sub: "Schermo del GM" }); });
      c.sessions.forEach((x) => { if ([x.prep, x.summary, x.aside].join(" ").toLowerCase().includes(q)) text.push({ kind: "session", id: x.id, name: x.title || "Sessione " + x.num, sub: "trovato nella sessione" }); });
      const groups = {};
      hits.concat(text).forEach((e) => { const k = KIND_LABEL[e.kind]; (groups[k] = groups[k] || []).push(e); });
      box.innerHTML = Object.keys(groups).length ? Object.entries(groups).map(([k, arr]) => `<h4>${k}</h4><div class="list">${arr.slice(0, 10).map((e) => `<button class="listrow mini" data-a="open" data-kind="${e.kind}" data-id="${e.id}"><div><b>${esc(e.name)}</b><div class="sub">${esc(e.sub || "")}</div></div><span class="chev">›</span></button>`).join("")}${arr.length > 10 ? `<p class="sub">…e altri ${arr.length - 10}</p>` : ""}</div>`).join("") : `<p class="sub">Nessun risultato.</p>`;
    };
    $("#gq").addEventListener("input", run); run();
  }
  function diceMax(expr) { let m = 0; String(expr).replace(/(\d*)d(\d+)/g, (_, n, f) => { m += num(n, 1) * num(f); }); return m; }

  // ---------------------------------------------------------------- router
  const TABS = [
    ["tavolo", "Tavolo", "M4 5h16v4H4zM6 9v10M18 9v10M9 13h6"],
    ["scontro", "Scontro", "M5 19 19 5M14 5h5v5M5 14l5 5M3 21l3-3"],
    ["bestiario", "Bestiario", "M12 3c4 3 6 6 6 10a6 6 0 0 1-12 0c0-4 2-7 6-10zM9 13h.01M15 13h.01"],
    ["mondo", "Mondo", "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"],
    ["mappe", "Mappe", "M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20"],
    ["diario", "Diario", "M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2zM6 19a2 2 0 0 1 2-2h11M10 8h6"],
  ];
  function route() { const h = (location.hash || "#/tavolo").slice(2).split("/"); return { tab: h[0] || "tavolo", sub: h[1] || "", id: h[2] || "" }; }
  function go(tab, sub) { const h = "#/" + tab + (sub ? "/" + sub : ""); if (ignorePop) pendingHash = h; else location.hash = h; }

  const filters = { bestQ: "", bestTier: "", bestRole: "", bestSrc: "", envQ: "", envTier: "", envSrc: "", worldQ: "", worldKind: "", encStatus: "", revSrc: "", mapQ: "", mapCat: "", drvQ: "", drvQ2: "", drvCat: "", drvGrid: false, drvLimit: 60 };

  function render() {
    const y = window.scrollY;
    const c = C();
    $("#camp-name").textContent = c ? c.name : "Lanterna";
    $("#topfear").hidden = !c; $("#searchBtn").hidden = !c; $("#rulesBtn").hidden = !c; if (c) $("#topfearN").textContent = c.fear;
    $("#nav").innerHTML = TABS.map(([id, label, d]) =>
      `<button class="navbtn ${route().tab === id ? "on" : ""}" data-a="go" data-tab="${id}"><svg viewBox="0 0 24 24"><path d="${d}"/></svg><span>${label}</span></button>`).join("");
    const main = $("#main");
    if (!c) { main.innerHTML = viewWelcome(); $("#fab").hidden = true; return; }
    $("#fab").hidden = false;
    const r = route();
    const V = { tavolo: viewTable, scontro: viewCombat, bestiario: viewBestiary, mondo: viewWorld, mappe: viewMaps, diario: viewJournal }[r.tab] || viewTable;
    main.innerHTML = V(c, r.sub, r.id); if (r.tab === "mondo" && r.sub === "mappa") atlasMount(); updateLiveUI(); syncUI(); $$("textarea.inl", main).forEach(autoGrow);
    window.scrollTo(0, y);
  }

  // ---------------------------------------------------------------- viste
  function viewWelcome() {
    return `<section class="welcome">
      <div class="sigil">${lanternSvg()}</div>
      <h1>Lanterna</h1>
      <p>Il taccuino del GM per Daggerheart. Tieni traccia di Paura, personaggi, scontri, conti alla rovescia, bestiario e appunti. Tutto resta sul tuo telefono e funziona anche senza rete.</p>
      <button class="btn primary big" data-a="newCampaign">Crea la prima campagna</button>
      <button class="btn ghost" data-a="importFile">Ripristina da un backup</button>
    </section>`;
  }

  function fearBlock(c, compact) {
    return `<section class="card fear ${compact ? "compact" : ""}">
      <div class="row between"><h2>Paura</h2><div class="fearnum">${c.fear}<small>/12</small></div></div>
      ${pips(12, c.fear, "fearpips", 'data-a="fearSet"')}
      <div class="row gap"><button class="btn" data-a="fearAdd" data-d="-1">− 1</button><button class="btn fearbtn" data-a="fearAdd" data-d="1">+ 1 Paura</button></div>
    </section>`;
  }

  function pcCard(p) {
    const scars = num(p.scars);
    const hopeMax = Math.max(0, num(p.hopeMax, 6) - scars);
    return `<article class="card pc">
      <header class="row between">
        <div><h3><button class="namebtn" data-a="pcView" data-id="${p.id}">${esc(p.name)}</button>${revTag(p)}</h3><div class="sub">${esc([[p.cls, p.subclass].filter(Boolean).join(" "), p.level ? "Liv. " + p.level : "", p.player].filter(Boolean).join(" · "))}</div></div>
        <button class="icon" data-a="editPc" data-id="${p.id}" aria-label="Modifica">✎</button>
      </header>
      <div class="stats">
        <div><b>${esc(p.evasion ?? "–")}</b><span>Evasione</span></div>
        <div><b>${esc(p.major ?? "–")}/${esc(p.severe ?? "–")}</b><span>Soglie</span></div>
        ${scars ? `<div><b>${scars}</b><span>Cicatrici</span></div>` : ""}
      </div>
      <div class="track"><span>PF</span>${pips(num(p.hpMax, 6), num(p.hp), "hp", `data-a="pcPip" data-id="${p.id}" data-f="hp"`)}</div>
      <div class="track"><span>Stress</span>${pips(num(p.stressMax, 6), num(p.stress), "stress", `data-a="pcPip" data-id="${p.id}" data-f="stress"`)}</div>
      <div class="track"><span>Speranza</span>${pips(hopeMax, Math.min(num(p.hope), hopeMax), "hope", `data-a="pcPip" data-id="${p.id}" data-f="hope"`)}</div>
      ${num(p.armorMax) ? `<div class="track"><span>Armatura</span>${pips(num(p.armorMax), num(p.armor), "armor", `data-a="pcPip" data-id="${p.id}" data-f="armor"`)}</div>` : ""}
      <div class="row gap wrap">
        <button class="btn small" data-a="pcDamage" data-id="${p.id}">Danno</button>
        ${p.notes ? `<button class="chip" data-a="pcView" data-id="${p.id}">Note</button>` : ""}
        ${CONDITIONS.map((k) => `<button class="chip ${p.conditions?.includes(k) ? "on" : ""}" data-a="pcCond" data-id="${p.id}" data-k="${k}">${k}</button>`).join("")}
      </div>
    </article>`;
  }

  function clockCard(k) {
    const done = num(k.value) >= num(k.max);
    return `<article class="card clock ${done ? "done" : ""}">
      <header class="row between"><div><h3>${esc(k.name)}${revTag(k)}</h3><div class="sub">${CLOCK_KINDS[k.kind] || ""}${k.loop ? " · ciclico" : ""}</div></div>
      <button class="icon" data-a="editClock" data-id="${k.id}" aria-label="Modifica">✎</button></header>
      ${pips(num(k.max, 4), num(k.value), "clockpips " + (k.kind || ""), `data-a="clockSet" data-id="${k.id}"`)}
      <div class="row gap"><button class="btn small" data-a="clockAdd" data-id="${k.id}" data-d="-1">−</button><button class="btn small" data-a="clockAdd" data-id="${k.id}" data-d="1">Avanza</button>${done ? `<span class="tag hot">Innescato</span>` : ""}</div>
      ${k.notes ? `<p class="notes">${rich(k.notes)}</p>` : ""}
      ${reviewBanner("clock", k)}
    </article>`;
  }

  function viewTable(c) {
    const nrev = reviewItems(c).length;
    const scene = (c.sceneMaps || []).map(mapById).filter(Boolean);
    return `${fearBlock(c)}${scene.length ? `<section class="card"><div class="row between"><h2>Mappe in scena</h2><button class="chip small" data-a="sceneClear">Svuota</button></div>${mapThumbs(c, scene)}</section>` : ""}${nrev ? `<button class="revbar" data-a="go" data-tab="mondo" data-sub="rivedi"><b>${nrev}</b> ${nrev === 1 ? "voce" : "voci"} da confermare<span class="chev">›</span></button>` : ""}
      <div class="sechead"><h2>Personaggi</h2><div class="row gap"><button class="btn small ghost" data-a="restAll">Riposo</button><button class="btn small" data-a="newPc">+ PG</button></div></div>
      ${c.pcs.length ? `<div class="grid">${c.pcs.map(pcCard).join("")}</div>` : empty("Nessun personaggio", "Aggiungi i PG del tavolo per seguire PF, Stress, Speranza e Armatura.", `<button class="btn" data-a="newPc">Aggiungi un PG</button>`)}
      <div class="sechead"><h2>Conti alla rovescia</h2><button class="btn small" data-a="newClock">+ Nuovo</button></div>
      ${c.clocks.length ? `<div class="grid">${c.clocks.map(clockCard).join("")}</div>` : empty("Nessun conto alla rovescia", "Progressi, conseguenze e fronti di campagna.", "")}`;
  }

  // ---- scontro
  function unitCard(u) {
    const down = u.minion ? u.count <= 0 : num(u.hp) >= num(u.hpMax);
    return `<article class="card unit ${down ? "down" : ""} ${u.spotlight ? "spot" : ""}">
      <header class="row between">
        <div><h3>${esc(u.name)}${u.umbra ? ' <span class="tag umbra">Umbra</span>' : ""}</h3>
        <div class="sub">${esc(u.role || "")}${u.tier ? " · Rango " + esc(u.tier) : ""} · Diff. <b>${esc(u.difficulty ?? "–")}</b>${u.major != null ? ` · Soglie <b>${u.major}/${u.severe}</b>` : ""}</div></div>
        <button class="icon ${u.spotlight ? "lit" : ""}" data-a="spot" data-uid="${u.uid}" aria-label="Protagonista">★</button>
      </header>
      ${u.minion ? `<div class="row between minion"><div class="bignum">${u.count}<small> rimasti</small></div><div class="row gap"><button class="btn small" data-a="minionAdd" data-uid="${u.uid}" data-d="-1">−1</button><button class="btn small" data-a="minionAdd" data-uid="${u.uid}" data-d="1">+1</button></div></div>
        <div class="sub">Seguace (${u.value}): ogni ${u.value} danni cade un Seguace in più.</div>`
      : `<div class="track"><span>PF</span>${pips(num(u.hpMax), num(u.hp), "hp", `data-a="unitPip" data-uid="${u.uid}" data-f="hp"`)}</div>
         <div class="track"><span>Stress</span>${pips(num(u.stressMax), num(u.stress), "stress", `data-a="unitPip" data-uid="${u.uid}" data-f="stress"`)}</div>`}
      <div class="row gap wrap">
        <button class="btn small" data-a="unitDamage" data-uid="${u.uid}">Danno</button>
        <button class="btn small" data-a="unitAttack" data-uid="${u.uid}">Attacco</button>
        <button class="btn small ghost" data-a="unitSheet" data-uid="${u.uid}">Scheda</button>
        ${CONDITIONS.map((k) => `<button class="chip ${u.conditions?.includes(k) ? "on" : ""}" data-a="unitCond" data-uid="${u.uid}" data-k="${k}">${k}</button>`).join("")}
        <button class="icon danger" data-a="unitDel" data-uid="${u.uid}" aria-label="Rimuovi">✕</button>
      </div>
    </article>`;
  }

  function viewCombat(c, sub, id) {
    const onList = sub === "scontri" || sub === "crea";
    const tabs = `<div class="segment"><button class="${!onList ? "on" : ""}" data-a="go" data-tab="scontro">In corso</button><button class="${onList ? "on" : ""}" data-a="go" data-tab="scontro" data-sub="scontri">Scontri${c.encounters.length ? ` <span class="cnt">${c.encounters.length}</span>` : ""}</button></div>`;
    if (sub === "scontri") return tabs + viewEncList(c);
    if (sub === "crea") return tabs + viewBuilder(c, encOf(c, id));
    const env = findEnv(c, c.combat.envId);
    const units = c.combat.units;
    const e = c.combat.encId ? encOf(c, c.combat.encId) : null;
    const reinf = e ? e.items.map((it, i) => [it, i, findAdv(c, it.advId)]).filter(([it, , a]) => it.reinf && a) : [];
    const banner = e ? `<section class="card encbanner">
        <div class="row between"><div class="grow"><div class="k">Scontro in corso</div><h2><button class="namebtn" data-a="encOpen" data-id="${e.id}">${esc(e.name)}</button></h2></div><button class="btn small ghost" data-a="encPreview" data-id="${e.id}">Scheda</button></div>
        ${e.objective ? `<p class="obj"><span class="k">Obiettivo</span> ${esc(e.objective)}</p>` : ""}
        ${e.motives ? `<details><summary>Tattiche</summary><p class="notes">${rich(e.motives)}</p></details>` : ""}
        ${e.exit ? `<details><summary>L'altra via</summary><p class="notes">${rich(e.exit)}</p></details>` : ""}
        ${e.mapId && mapById(e.mapId) ? mapThumbs(c, [mapById(e.mapId)]) : ""}
        ${reinf.length ? `<div class="row gap wrap"><span class="sub">Rinforzi:</span>${reinf.map(([it, i, a]) => `<button class="chip" data-a="reinfIn" data-i="${i}">+ ${esc(it.label || a.name)}${it.qty > 1 ? " ×" + it.qty : ""}${it.inScene ? ` <span class="cnt">${it.inScene}</span>` : ""}</button>`).join("")}</div>` : ""}
      </section>` : "";
    return `${tabs}${fearBlock(c, true)}${banner}
      <section class="card">
        <div class="row between"><h2>Ambiente</h2>${select("", "envPick", c.combat.envId, [["", "Nessuno"]].concat(allEnv(c).slice().sort((x, y) => x.name.localeCompare(y.name)).map((v) => [v.id, v.name + (v.srd ? "" : " ★")])))}</div>
        ${env ? `<details class="envdet" open><summary>Caratteristiche di ${esc(env.name)}</summary>${envBlock(env, true)}</details>` : `<p class="sub">Scegli un ambiente per avere le sue caratteristiche sotto mano.</p>`}
      </section>
      <div class="sechead"><h2>Avversari in scena</h2><button class="btn small" data-a="addUnit">+ Aggiungi</button></div>
      ${units.length ? `<div class="row gap wrap toolbar"><button class="chip" data-a="spotClear">Azzera ★</button><button class="chip" data-a="endCombat">Termina lo scontro</button><span class="sub">${units.filter((u) => u.minion ? u.count > 0 : u.hp < u.hpMax).length} ancora in piedi</span></div>` : ""}
      ${units.length ? `<div class="grid">${units.map(unitCard).join("")}</div>` : empty("Nessun avversario in scena", "Avvia uno scontro preparato, oppure aggiungi avversari al volo.", `<div class="row gap center-row"><button class="btn" data-a="go" data-tab="scontro" data-sub="scontri">I tuoi scontri</button><button class="btn ghost" data-a="encNew">Crea uno scontro</button></div>`)}`;
  }

  // ---------------------------------------------------------------- creatore di scontri
  const ENC_STATUS = { bozza: "Bozza", pronto: "Pronto", giocato: "Giocato" };
  const OBJECTIVES = ["Sconfiggere gli avversari", "Tenere la posizione", "Scortare o proteggere qualcuno", "Recuperare un oggetto", "Interrompere un rituale", "Fuggire o sganciarsi", "Catturare un avversario", "Raggiungere un punto", "Distruggere qualcosa", "Resistere a un'ondata", "Negoziare mentre si combatte", "Impedire che il nemico arrivi a qualcosa"];
  const STYLES = { equilibrato: "Equilibrato", boss: "Con un boss (Solitario)", orda: "Orda (tanti e deboli)", elite: "Élite (pochi e forti)" };
  const encOf = (c, id) => c.encounters.find((e) => e.id === id);
  function partyTierOf(c) {
    const lv = c.pcs.map((p) => num(p.level, 1)); if (!lv.length) return 1;
    const avg = Math.round(lv.reduce((a, b) => a + b, 0) / lv.length);
    return avg <= 1 ? 1 : avg <= 4 ? 2 : avg <= 7 ? 3 : 4;
  }
  function newEncounter(c, name) {
    const e = { id: uid(), name: name || "Nuovo scontro", status: "bozza", partySize: c.pcs.length || 4, partyTier: partyTierOf(c), mods: {}, items: [], envId: "", objective: "", purpose: "", motives: "", terrain: "", exit: "", reward: "", notes: "", outcome: "", clocks: [], created: Date.now(), updated: Date.now() };
    c.encounters.unshift(e); return e;
  }
  function normEnc(c, e) {
    return Object.assign({ status: "bozza", partySize: c.pcs.length || 4, partyTier: partyTierOf(c), mods: {}, items: [], envId: "", objective: "", purpose: "", motives: "", terrain: "", exit: "", reward: "", notes: "", outcome: "", clocks: [], created: Date.now(), updated: Date.now() }, e);
  }
  function diffLevel(spent, budget) {
    if (!spent) return { key: "vuoto", label: "Vuoto", pct: 0 };
    const r = spent / Math.max(1, budget);
    const pct = Math.min(100, Math.round(r / 1.3 * 100));
    if (r < 0.75) return { key: "facile", label: "Facile", pct };
    if (r <= 1.0) return { key: "equilibrato", label: "Equilibrato", pct };
    if (r <= 1.2) return { key: "duro", label: "Impegnativo", pct };
    return { key: "letale", label: "Pericoloso", pct };
  }

  function encCard(c, e) {
    const k = planCost(c, e); const d = diffLevel(k.spent, k.budget); const env = e.envId ? findEnv(c, e.envId) : null;
    const running = c.combat.encId === e.id && c.combat.units.length;
    return `<article class="card enc ${running ? "running" : ""}">
      <header class="row between"><div class="grow"><h3><button class="namebtn" data-a="encOpen" data-id="${e.id}">${esc(e.name)}</button>${revTag(e)}</h3>
        <div class="sub">Rango ${esc(e.partyTier)} · ${esc(e.partySize)} PG · <b>${k.spent}</b>/${k.budget} punti · <span class="lvl ${d.key}">${d.label}</span></div></div>
        <span class="status ${e.status}">${running ? "In corso" : ENC_STATUS[e.status] || ""}</span></header>
      <p class="sub">${k.lines.filter((l) => !l.reinf).map((l) => `${esc(l.label)}${l.qty > 1 ? " ×" + l.qty : ""}`).join(", ") || "Nessun avversario"}${env ? ` · <i>${esc(env.name)}</i>` : ""}</p>
      ${e.objective ? `<p class="obj"><span class="k">Obiettivo</span> ${esc(e.objective)}</p>` : ""}
      <div class="row gap wrap"><button class="btn small" data-a="encOpen" data-id="${e.id}">Apri</button><button class="btn small primary" data-a="encStart" data-id="${e.id}" ${k.lines.some((l) => !l.reinf) ? "" : "disabled"}>Avvia</button><button class="btn small ghost" data-a="encPreview" data-id="${e.id}">Anteprima</button></div>
    </article>`;
  }

  function viewEncList(c) {
    const order = { pronto: 0, bozza: 1, giocato: 2 };
    const list = c.encounters.map((e) => normEnc(c, e)).sort((a, b) => (order[a.status] - order[b.status]) || (b.updated - a.updated));
    c.encounters = list;
    const f = filters.encStatus;
    const shown = list.filter((e) => !f || e.status === f);
    return `<div class="sechead"><h2>Scontri</h2><div class="row gap"><button class="btn small ghost" data-a="encGenerate">Genera</button><button class="btn small" data-a="encNew">+ Nuovo</button></div></div>
      <div class="chips">${[["", "Tutti"]].concat(Object.entries(ENC_STATUS)).map(([k, v]) => `<button class="chip ${f === k ? "on" : ""}" data-a="encFilter" data-k="${k}">${v}${k ? ` (${list.filter((e) => e.status === k).length})` : ""}</button>`).join("")}</div>
      ${shown.length ? `<div class="grid">${shown.map((e) => encCard(c, e)).join("")}</div>`
      : empty("Nessuno scontro", "Crea uno scontro da zero oppure fatti generare una bozza equilibrata dai Punti Battaglia, poi rifiniscila.", `<div class="row gap center-row"><button class="btn" data-a="encNew">Crea uno scontro</button><button class="btn ghost" data-a="encGenerate">Genera una bozza</button></div>`)}`;
  }

  function encLine(l) {
    if (l.missing) return `<li class="missing"><div><b>Avversario non trovato</b><div class="sub">Eliminato dal bestiario o libreria disattivata.</div></div><button class="icon danger" data-a="encLineDel" data-i="${l.idx}">✕</button></li>`;
    return `<li class="${l.reinf ? "reinf" : ""}"><button class="grow textleft" data-a="encLineEdit" data-i="${l.idx}"><b>${esc(l.label)}</b>${l.label !== l.a.name ? ` <span class="sub">(${esc(l.a.name)})</span>` : ""}
        <div class="sub">${esc(l.a.role)} · Rango ${esc(l.a.tier)}${l.a.srd ? " · SRD" : ""}${l.reinf ? ' · <span class="tag">rinforzo</span>' : ""}${l.it.note ? " · " + esc(l.it.note) : ""}</div></button>
      <div class="row gap"><button class="icon" data-a="encQty" data-i="${l.idx}" data-d="-1" aria-label="Meno">−</button><span class="qty">${l.qty}</span><button class="icon" data-a="encQty" data-i="${l.idx}" data-d="1" aria-label="Più">+</button><span class="cost">${l.reinf ? "—" : l.cost + " pt"}</span></div></li>`;
  }

  function viewBuilder(c, e) {
    if (!e) return `<p class="sub">Scontro non trovato.</p><button class="btn" data-a="go" data-tab="scontro" data-sub="scontri">Torna agli scontri</button>`;
    Object.assign(e, normEnc(c, e));
    const k = planCost(c, e); const d = diffLevel(k.spent, k.budget); const left = k.budget - k.spent; const m = e.mods || {};
    const env = e.envId ? findEnv(c, e.envId) : null;
    const main = k.lines.filter((l) => !l.reinf), reinf = k.lines.filter((l) => l.reinf);
    const txt = (label, key) => e[key] ? `<div class="scene-f"><span class="k">${label}</span><p class="notes">${rich(e[key])}</p></div>` : "";
    const sceneFilled = ["purpose", "motives", "terrain", "exit", "reward", "notes"].some((key) => e[key]);
    return `<div class="row gap wrap buildertop"><button class="chip" data-a="go" data-tab="scontro" data-sub="scontri" aria-label="Torna agli scontri">‹</button><span class="grow"></span>
        <button class="chip" data-a="encPreview" data-id="${e.id}">Anteprima</button><button class="chip" data-a="encShare" data-id="${e.id}">Condividi</button><button class="chip" data-a="encDup" data-id="${e.id}">Duplica</button><button class="chip danger" data-a="encDel" data-id="${e.id}" aria-label="Elimina scontro">✕</button></div>
      ${reviewBanner("enc", e)}
      <section class="card">
        <label class="fld"><span>Nome dello scontro</span><input data-ef="name" value="${esc(e.name)}" placeholder="La Mensa del Cinabro"></label>
        <div class="chips">${Object.entries(ENC_STATUS).map(([s, v]) => `<button class="chip ${e.status === s ? "on" : ""}" data-a="encStatus" data-k="${s}">${v}</button>`).join("")}</div>
      </section>

      <section class="card">
        <div class="row between"><h2>Punti Battaglia</h2><div class="budget ${left === 0 ? "ok" : left < 0 ? "over" : ""}"><b>${k.spent}</b>/${k.budget}</div></div>
        <div class="meter ${d.key}"><span style="width:${d.pct}%"></span><i style="left:${Math.round(100 / 1.3)}%"></i></div>
        <div class="row between sub"><span class="lvl ${d.key}">${d.label}</span><span>${left > 0 ? `restano ${left} punti` : left < 0 ? `oltre di ${-left}` : "budget esatto"}</span></div>
        <div class="two">
          <label class="fld"><span>PG</span><input type="number" min="1" max="10" inputmode="numeric" data-ef="partySize" value="${esc(e.partySize)}"></label>
          <label class="fld"><span>Rango del gruppo</span><select data-ef="partyTier">${[1, 2, 3, 4].map((t) => `<option ${num(e.partyTier) === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        </div>
        <div class="chips">${[["easier", "Più facile o breve (−1)"], ["dmg", "+1d4 ai danni (−2)"], ["harder", "Più pericoloso (+2)"]].map(([key, label]) => `<button class="chip ${m[key] ? "on" : ""}" data-a="encMod" data-k="${key}">${label}</button>`).join("")}</div>
        ${k.notes.length ? `<p class="sub">Modificatori: ${k.notes.map(esc).join(" · ")}</p>` : ""}
        ${k.higher.length ? `<p class="warn">Di rango superiore al gruppo: ${k.higher.map(esc).join(", ")}. Possono essere molto più letali di quanto dicano i punti.</p>` : ""}
        ${k.lines.some((l) => num(l.a.tier) !== num(e.partyTier)) ? `<button class="btn small ghost" data-a="encAdaptAll">Adatta tutti al Rango ${esc(e.partyTier)}</button>` : ""}
      </section>

      <section class="card">
        <div class="row between"><h2>Composizione</h2><div class="row gap"><button class="btn small ghost" data-a="encFill" data-id="${e.id}">Riempi</button><button class="btn small" data-a="encAdd">+ Avversari</button></div></div>
        ${main.length || k.missing.length ? `<ul class="planlist">${main.concat(k.missing).map(encLine).join("")}</ul>` : `<p class="sub">Aggiungi avversari dal bestiario, oppure usa Riempi per completare il budget con avversari del rango giusto.</p>`}
        <h4>Rinforzi <span class="sub">(fuori budget, entrano durante lo scontro)</span></h4>
        ${reinf.length ? `<ul class="planlist">${reinf.map(encLine).join("")}</ul>` : `<p class="sub">Tocca un avversario della composizione e segnalo come rinforzo: resterà pronto da far entrare in scena.</p>`}
      </section>

      <section class="card">
        <h2>Obiettivo e ambiente</h2>
        <label class="fld"><span>Obiettivo</span><select data-ef="objectivePick"><option value="">Scegli…</option>${OBJECTIVES.map((o) => `<option ${e.objective === o ? "selected" : ""}>${esc(o)}</option>`).join("")}<option value="__custom" ${e.objective && !OBJECTIVES.includes(e.objective) ? "selected" : ""}>Personalizzato…</option></select></label>
        ${e.objective && !OBJECTIVES.includes(e.objective) || e._customObj ? `<label class="fld"><span>Obiettivo personalizzato</span><input data-ef="objective" value="${esc(e.objective)}"></label>` : ""}
        <label class="fld"><span>Ambiente</span><select data-ef="envId"><option value="">Nessuno</option>${allEnv(c).slice().sort((x, y) => (x.tier - y.tier) || x.name.localeCompare(y.name)).map((v) => `<option value="${esc(v.id)}" ${e.envId === v.id ? "selected" : ""}>${esc(v.name)} · R${esc(v.tier)}${v.srd ? "" : " ★"}</option>`).join("")}</select></label>
        ${env ? `<details class="envdet"><summary>Caratteristiche di ${esc(env.name)}</summary>${envBlock(env, true)}</details>` : ""}
        <h4>Mappa</h4>${e.mapId && mapById(e.mapId) ? `${mapThumbs(c, [mapById(e.mapId)])}<div class="row gap"><button class="btn small ghost" data-a="mapPickFor" data-for="enc" data-id="${e.id}">Cambia</button><button class="btn small ghost" data-a="encMapClear" data-id="${e.id}">Togli</button></div>` : `<button class="btn small ghost" data-a="mapPickFor" data-for="enc" data-id="${e.id}">+ Collega una mappa</button>`}
      </section>

      <section class="card">
        <div class="row between"><h2>Scena e tattiche</h2><button class="btn small" data-a="encScene" data-id="${e.id}">${sceneFilled ? "Modifica" : "Scrivi"}</button></div>
        ${sceneFilled ? txt("Funzione narrativa", "purpose") + txt("Motivazioni e tattiche", "motives") + txt("Terreno e ambiente dinamico", "terrain") + txt("L'altra via · resa · fuga", "exit") + txt("Ricompense", "reward") + txt("Note", "notes")
          : `<p class="sub">Perché esiste questo scontro, cosa vogliono gli avversari, come usano il terreno, come può finire senza sangue, cosa si guadagna. Puoi collegare PNG e luoghi con [[Nome]].</p>`}
      </section>

      <section class="card">
        <div class="row between"><h2>Conti alla rovescia dello scontro</h2><button class="btn small" data-a="encClockAdd" data-id="${e.id}">+ Aggiungi</button></div>
        ${e.clocks.length ? `<ul class="planlist">${e.clocks.map((cl, i) => `<li><div><b>${esc(cl.name)}</b><div class="sub">${CLOCK_KINDS[cl.kind] || ""} · ${esc(cl.max)} caselle</div></div><button class="icon danger" data-a="encClockDel" data-i="${i}">✕</button></li>`).join("")}</ul>` : `<p class="sub">Vengono creati sul Tavolo quando avvii lo scontro, e rimossi quando lo termini.</p>`}
      </section>

      ${e.status === "giocato" || e.outcome ? `<section class="card"><div class="row between"><h2>Esito</h2><button class="btn small" data-a="encOutcome" data-id="${e.id}">${e.outcome ? "Modifica" : "Scrivi"}</button></div>${e.outcome ? `<p class="notes">${rich(e.outcome)}</p>` : `<p class="sub">Com'è andata?</p>`}</section>` : ""}

      <div class="stickybar"><button class="btn primary big" data-a="encStart" data-id="${e.id}" ${main.length ? "" : "disabled"}>Avvia lo scontro</button></div>`;
  }

  function encPreviewHtml(c, e) {
    const k = planCost(c, e); const env = e.envId ? findEnv(c, e.envId) : null;
    const seen = new Set(); const blocks = [];
    k.lines.forEach((l) => { if (l.a && !seen.has(l.a.id)) { seen.add(l.a.id); blocks.push(statBlock(l.a)); } });
    const t = (label, key) => e[key] ? `<p><span class="k">${label}</span> ${rich(e[key])}</p>` : "";
    return `<div class="statblock"><p class="sub">Rango ${esc(e.partyTier)} · ${esc(e.partySize)} PG · ${k.spent}/${k.budget} punti · ${diffLevel(k.spent, k.budget).label}</p>
      ${e.objective ? `<p><span class="k">Obiettivo</span> ${esc(e.objective)}</p>` : ""}
      ${t("Funzione narrativa", "purpose")}${t("Motivazioni e tattiche", "motives")}${t("Terreno", "terrain")}${t("L'altra via", "exit")}${t("Ricompense", "reward")}
      <p><span class="k">Composizione</span> ${k.lines.map((l) => `${esc(l.label)} ×${l.qty}${l.reinf ? " (rinforzo)" : ""}`).join(", ") || "—"}</p>
      ${e.clocks.length ? `<p><span class="k">Conti alla rovescia</span> ${e.clocks.map((x) => `${esc(x.name)} (${esc(x.max)})`).join(", ")}</p>` : ""}</div>
      ${env ? `<h4>Ambiente</h4>${envBlock(env)}` : ""}
      <h4>Avversari</h4>${blocks.join('<hr class="sep">')}`;
  }
  function encText(c, e) {
    const k = planCost(c, e); const env = e.envId ? findEnv(c, e.envId) : null;
    const L = [`⚔ ${e.name}`, `Rango ${e.partyTier} · ${e.partySize} PG · ${k.spent}/${k.budget} Punti Battaglia (${diffLevel(k.spent, k.budget).label})`];
    if (e.objective) L.push(`Obiettivo: ${e.objective}`);
    if (env) L.push(`Ambiente: ${env.name}`);
    L.push("", "Composizione:"); k.lines.forEach((l) => L.push(`• ${l.label} ×${l.qty} — ${l.a.role} R${l.a.tier}${l.reinf ? " (rinforzo)" : ""}${l.it.note ? " — " + l.it.note : ""}`));
    [["Funzione narrativa", "purpose"], ["Motivazioni e tattiche", "motives"], ["Terreno", "terrain"], ["L'altra via", "exit"], ["Ricompense", "reward"], ["Note", "notes"]].forEach(([lab, key]) => { if (e[key]) L.push("", lab + ":", e[key]); });
    if (e.clocks.length) L.push("", "Conti alla rovescia: " + e.clocks.map((x) => `${x.name} (${x.max})`).join(", "));
    return L.join("\n");
  }

  const THEMES = { "non mort": ["undead", "skeleton", "zombie", "ghost", "ghoul", "lich", "wraith", "revenant", "necro"], "demon": ["demon", "fiend", "abyss", "infernal"], "bandit": ["bandit", "brigand", "thief", "thug", "outlaw", "jagged knife"], "brigant": ["bandit", "brigand", "thief", "thug"], "drag": ["dragon", "wyrm", "drake"], "besti": ["beast", "wolf", "bear", "boar", "rat", "spider"], "fat": ["fey", "sylvan", "faerie"], "fey": ["fey", "sylvan"], "cult": ["cult", "zealot", "acolyte", "priest"], "soldat": ["soldier", "guard", "knight", "archer", "legion"], "guardi": ["guard", "soldier", "knight"], "piant": ["plant", "tree", "vine", "treant", "moss"], "bosc": ["forest", "tree", "sylvan", "wolf", "fey"], "mare": ["sea", "water", "tide", "pirate", "kraken"], "acqu": ["water", "sea", "river", "tide"], "fuoco": ["fire", "flame", "burn", "ember"], "ghiacci": ["ice", "frost", "cold"], "costrutt": ["construct", "golem", "armor", "mech", "clockwork"], "mago": ["mage", "wizard", "sorcer", "arcane"], "stregon": ["witch", "hex", "curse"], "insett": ["insect", "spider", "swarm", "beetle"], "caos": ["chaos", "void", "outer"], "divin": ["divine", "celestial", "god", "angel"], "gigant": ["giant", "ogre", "titan"] };
  function themeTerms(theme) {
    const q = String(theme || "").trim().toLowerCase(); if (!q) return [];
    const out = new Set(q.split(/[,\s]+/).filter((w) => w.length > 2));
    out.add(q);
    Object.entries(THEMES).forEach(([k, v]) => { if (q.includes(k)) v.forEach((w) => out.add(w)); });
    return [...out];
  }
  function generatePlan(c, e, opts) {
    const tier = num(opts.tier, e.partyTier || 1);
    const terms = themeTerms(opts.theme);
    const pool = allAdv(c).filter((a) => num(a.tier) === tier && srcOk(a, opts.src));
    if (!pool.length) return 0;
    const themed = terms.length ? pool.filter((a) => { const t = [a.name, a.desc, a.motives, a.exp, (a.features || []).map((f) => f.name + " " + f.text).join(" "), a.en ? JSON.stringify(a.en) : ""].join(" ").toLowerCase(); return terms.some((w) => t.includes(w)); }) : [];
    generatePlan.themed = themed.length;
    const byRole = (roles) => { const t = themed.filter((a) => roles.includes(a.role)); return t.length ? t : pool.filter((a) => roles.includes(a.role)); };
    const pickFrom = (roles) => { const arr = byRole(roles); return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; };
    e.items = e.items.filter((it) => it.reinf);
    const add = (a, qty) => { if (!a) return; const ex = e.items.find((x) => x.advId === a.id && !x.reinf); if (ex) ex.qty += qty; else e.items.push({ advId: a.id, qty }); };
    const party = Math.max(1, num(e.partySize, 4));
    const style = opts.style || "equilibrato";
    if (style === "boss") add(pickFrom(["Solitario"]), 1);
    if (style === "equilibrato") { add(pickFrom(["Condottiero"]), 1); if (Math.random() < 0.6) add(pickFrom(["Bruto"]), 1); }
    if (style === "orda") { add(pickFrom(["Condottiero"]), 1); add(pickFrom(["Orda"]), 1); }
    if (style === "elite") { add(pickFrom(["Bruto"]), 1); add(pickFrom(["Sicario", "Tiratore"]), 1); }
    const fill = { boss: ["Seguace", "Base", "Supporto", "Seguace"], equilibrato: ["Base", "Sicario", "Tiratore", "Base", "Supporto", "Seguace"], orda: ["Seguace", "Orda", "Base", "Seguace"], elite: ["Sicario", "Tiratore", "Base", "Supporto"] }[style];
    let supports = 0;
    for (let guard = 0; guard < 40; guard++) {
      const k = planCost(c, e); const left = k.budget - k.spent;
      if (left <= 0) break;
      const roles = fill.filter((r) => (r === "Seguace" ? 1 : ROLE_COST[r]) <= left && !(r === "Supporto" && supports >= 1));
      if (!roles.length) break;
      const role = roles[Math.floor(Math.random() * roles.length)];
      const a = pickFrom([role]); if (!a) { fill.splice(fill.indexOf(role), 1); if (!fill.length) break; continue; }
      if (role === "Supporto") supports++;
      add(a, role === "Seguace" ? party : 1);
    }
    for (let guard = 0; guard < 10; guard++) {
      const k = planCost(c, e); if (k.spent <= k.budget) break;
      const i = e.items.map((x, j) => [x, j]).filter(([x]) => !x.reinf).pop(); if (!i) break;
      const it = i[0]; const a = findAdv(c, it.advId); const step = a && a.role === "Seguace" ? party : 1;
      it.qty -= step; if (it.qty <= 0) e.items.splice(i[1], 1);
    }
    return e.items.length;
  }

  function pickMany(title, tier, onAdd) {
    const c = C(); if (!allAdv(c).length) return toast("Il bestiario è vuoto");
    const counts = {};
    openModal(title, `<div class="filters picker"><input type="search" id="pmQ" placeholder="Cerca">
        <select id="pmT"><option value="">Tutti i ranghi</option>${[1, 2, 3, 4].map((t) => `<option ${t === num(tier) ? "selected" : ""}>${t}</option>`).join("")}</select>
        <select id="pmR"><option value="">Tutti i ruoli</option>${ROLES.map((r) => `<option>${r}</option>`).join("")}</select></div>
      <div class="list" id="pmList"></div>`, { focus: false, extra: `<button class="btn primary" data-a="closeModal">Fatto</button>` });
    const draw = () => {
      const q = $("#pmQ").value.toLowerCase(), t = $("#pmT").value, r = $("#pmR").value;
      const rows = allAdv(c).filter((a) => (!q || findText(a).includes(q)) && (!t || String(a.tier) === t) && (!r || a.role === r)).sort((x, y) => (x.tier - y.tier) || x.name.localeCompare(y.name)).slice(0, 80);
      $("#pmList").innerHTML = rows.map((a) => `<button class="listrow mini" data-a="pmAdd" data-id="${a.id}"><div><b>${esc(a.name)}</b><div class="sub">${esc(a.role)} · Rango ${esc(a.tier)} · Diff. ${esc(a.difficulty)} · ${esc(a.hp)} PF${a.srd ? " · SRD" : ""}</div></div><span class="badge ${counts[a.id] ? "" : "zero"}">${counts[a.id] ? "+" + counts[a.id] : "+"}</span></button>`).join("") || `<p class="sub">Nessun avversario con questi filtri.</p>`;
    };
    ["pmQ", "pmT", "pmR"].forEach((id) => $("#" + id).addEventListener(id === "pmQ" ? "input" : "change", draw));
    pickMany.cb = (a) => { counts[a.id] = (counts[a.id] || 0) + 1; onAdd(a); draw(); };
    draw();
  }
  // ---- bestiario
  function statBlock(a, inModal) {
    const minion = a.role === "Seguace";
    return `<div class="statblock">
      <div class="sb-head">${inModal ? "" : `<h3>${esc(a.name)}</h3>`}<div class="sub">${altName(a) ? `<i>${esc(altName(a))}</i> · ` : ""}${esc(a.role)} di Rango ${esc(a.tier)}${a.umbra ? ' · <span class="tag umbra">Toccato dall\'Umbra</span>' : ""}${a.source ? " · " + esc(a.source) : ""}</div></div>
      ${a.desc ? `<p class="flavor">${rich(a.desc)}</p>` : ""}
      ${a.motives ? `<p><span class="k">Motivazioni e Tattiche</span> ${esc(a.motives)}</p>` : ""}
      <div class="sb-stats">
        <div><span>Difficoltà</span><b>${esc(a.difficulty)}</b></div>
        ${minion ? "" : `<div><span>Soglie</span><b>${esc(a.major)}/${esc(a.severe)}</b></div>`}
        <div><span>PF</span><b>${esc(a.hp)}</b></div>
        <div><span>Stress</span><b>${esc(a.stress)}</b></div>
        <div><span>ATT</span><b>${num(a.atk) >= 0 ? "+" : ""}${esc(a.atk)}</b></div>
      </div>
      <p><b>${esc(a.weapon)}</b>: ${esc(a.range)} | <button class="dl strong" data-a="rollInline" data-e="${esc(String(a.dmg).replace(/\s/g, ""))}">${esc(a.dmg)}</button> ${esc(a.dmgType)}${minion && a.minion ? ` · Seguace (${esc(a.minion)})` : ""}${a.horde ? ` · Orda (${esc(a.horde)}/PF)` : ""}</p>
      ${a.exp ? `<p><span class="k">Esperienza</span> ${esc(a.exp)}</p>` : ""}
      ${(a.features || []).map((f) => `<p class="feat"><b>${esc(f.name)}</b> <i>— ${esc(f.type)}:</i> ${rich(f.text)}</p>`).join("")}
      ${a.other ? `<p class="altra"><span class="k">L'altra via</span> ${rich(a.other)}</p>` : ""}
    </div>`;
  }
  function envBlock(e, compact, inModal) {
    return `<div class="statblock env">
      ${compact ? "" : `<div class="sb-head">${inModal ? "" : `<h3>${esc(e.name)}</h3>`}<div class="sub">${altName(e) ? `<i>${esc(altName(e))}</i> · ` : ""}${esc(e.type)} di Rango ${esc(e.tier)}${e.source ? " · " + esc(e.source) : ""}</div></div>`}
      ${e.desc && !compact ? `<p class="flavor">${rich(e.desc)}</p>` : ""}
      ${e.impulses ? `<p><span class="k">Impeti</span> ${esc(e.impulses)}</p>` : ""}
      <p><span class="k">Difficoltà</span> <b>${esc(e.difficulty)}</b>${e.adversaries ? ` · <span class="k">Potenziali Avversari</span> ${esc(e.adversaries)}` : ""}</p>
      ${(e.features || []).map((f) => `<p class="feat"><b>${esc(f.name)}</b> <i>— ${esc(f.type)}:</i> ${rich(f.text)}</p>`).join("")}
    </div>`;
  }

  function viewBestiary(c, sub) {
    const tabs = `<div class="segment"><button class="${!sub ? "on" : ""}" data-a="go" data-tab="bestiario">Avversari</button><button class="${sub === "ambienti" ? "on" : ""}" data-a="go" data-tab="bestiario" data-sub="ambienti">Ambienti</button><button class="${sub === "tabelle" ? "on" : ""}" data-a="go" data-tab="bestiario" data-sub="tabelle">Tabelle</button></div>`;
    if (sub === "ambienti") {
      const eq = filters.envQ.toLowerCase();
      const envs = allEnv(c).filter((e) => (!eq || findText(e).includes(eq)) && (!filters.envTier || String(e.tier) === filters.envTier) && srcOk(e, filters.envSrc))
        .sort((x, y) => (x.tier - y.tier) || x.name.localeCompare(y.name));
      return tabs + `<div class="sechead"><h2>Ambienti</h2><button class="btn small" data-a="newEnv">+ Nuovo</button></div>
        <div class="filters">
          <input type="search" placeholder="Cerca" value="${esc(filters.envQ)}" data-a="filter" data-k="envQ">
          <select data-a="filter" data-k="envTier"><option value="">Tutti i ranghi</option>${[1, 2, 3, 4].map((t) => `<option ${filters.envTier == t ? "selected" : ""}>${t}</option>`).join("")}</select>
          <select data-a="filter" data-k="envSrc">${SOURCES.map(([v, t]) => `<option value="${esc(v)}" ${filters.envSrc === v ? "selected" : ""}>${t}</option>`).join("")}</select>
        </div>
        ${envs.length ? `<div class="list">${envs.map((e) => `<button class="listrow" data-a="viewEnv" data-id="${e.id}"><div><b>${esc(e.name)}</b><div class="sub">${esc(e.type)} · Rango ${esc(e.tier)} · Diff. ${esc(e.difficulty)} · ${e.srd ? esc(e.source) : "Campagna"}</div></div><span class="chev">›</span></button>`).join("")}</div>`
        : empty("Nessun ambiente", "Crea luoghi, eventi e attraversamenti con le loro caratteristiche, o cambia i filtri.", "")}`;
    }
    if (sub === "tabelle") {
      return tabs + `<div class="sechead"><h2>Tabelle casuali</h2><button class="btn small" data-a="newTable">+ Nuova</button></div>
        ${c.tables.length ? `<div class="list">${c.tables.map((t) => `<div class="listrow"><div><b>${esc(t.name)}</b><div class="sub">d${esc(t.die)} · ${t.entries.length} voci</div></div><div class="row gap"><button class="btn small" data-a="rollTable" data-id="${t.id}">Tira</button><button class="icon" data-a="editTable" data-id="${t.id}">✎</button></div></div>`).join("")}</div>`
        : empty("Nessuna tabella", "Incontri casuali, peggioramenti, nomi, bottini: tirali con un tocco.", "")}`;
    }
    const q = filters.bestQ.toLowerCase();
    const list = allAdv(c).filter((a) => (!q || findText(a).includes(q)) && (!filters.bestTier || String(a.tier) === filters.bestTier) && (!filters.bestRole || a.role === filters.bestRole) && srcOk(a, filters.bestSrc))
      .sort((x, y) => (x.tier - y.tier) || x.name.localeCompare(y.name));
    return tabs + `<div class="sechead"><h2>Avversari</h2><button class="btn small" data-a="newAdv">+ Nuovo</button></div>
      <div class="filters">
        <input type="search" placeholder="Cerca" value="${esc(filters.bestQ)}" data-a="filter" data-k="bestQ">
        <select data-a="filter" data-k="bestTier"><option value="">Tutti i ranghi</option>${[1, 2, 3, 4].map((t) => `<option ${filters.bestTier == t ? "selected" : ""}>${t}</option>`).join("")}</select>
        <select data-a="filter" data-k="bestRole"><option value="">Tutti i ruoli</option>${ROLES.map((r) => `<option ${filters.bestRole === r ? "selected" : ""}>${r}</option>`).join("")}</select>
        <select data-a="filter" data-k="bestSrc">${SOURCES.map(([v, t]) => `<option value="${esc(v)}" ${filters.bestSrc === v ? "selected" : ""}>${t}</option>`).join("")}</select>
      </div>
      <p class="sub count">${list.length} avversari</p>
      ${list.length ? `<div class="list">${list.map((a) => `<button class="listrow" data-a="viewAdv" data-id="${a.id}"><div><b>${esc(a.name)}</b><div class="sub">${esc(a.role)} · Rango ${esc(a.tier)} · Diff. ${esc(a.difficulty)} · ${esc(a.hp)} PF${a.umbra ? " · Umbra" : ""}${a.srd ? "" : " · ★ campagna"}</div></div><span class="chev">›</span></button>`).join("")}</div>`
      : allAdv(c).length ? empty("Nessun risultato", "Prova a cambiare i filtri.", "") : empty("Bestiario vuoto", "Crea i tuoi avversari o importa un pacchetto dal menu.", `<button class="btn" data-a="newAdv">Crea un avversario</button>`)}`;
  }

  // ---- mondo
  // ---------------------------------------------------------------- da confermare
  const REV_SRC = { manuale: "Dal manuale", nostro: "Dalle nostre chat", proposta: "Proposta da completare" };
  const REV_COLL = { world: "world", pc: "pcs", clock: "clocks", session: "sessions", enc: "encounters", adv: "bestiary", env: "environments" };
  const REV_LABEL = { pc: "PG", clock: "Conto alla rovescia", session: "Sessione", enc: "Scontro", adv: "Avversario", env: "Ambiente" };
  const revName = (t, x) => t === "session" ? (x.num ? "#" + x.num + " · " : "") + (x.title || "Sessione") : x.name;
  function reviewItems(c) {
    const out = [];
    Object.entries(REV_COLL).forEach(([t, k]) => (c[k] || []).forEach((x) => { if (x.review) out.push({ t, x, label: t === "world" ? (WORLD_ONE[x.kind] || "Voce") : REV_LABEL[t] }); }));
    return out;
  }
  const revFind = (c, t, id) => (c[REV_COLL[t]] || []).find((x) => x.id === id);
  const revTag = (x) => x && x.review ? ` <span class="tag rev">da confermare</span>` : "";
  function reviewBanner(t, x, full) {
    if (!x || !x.review) return "";
    const r = x.review;
    return `<div class="revbox"><div class="row between"><span class="revsrc ${esc(r.src || "")}">${esc(REV_SRC[r.src] || "Da confermare")}</span><span class="k">da confermare</span></div>
      ${r.q ? `<p class="revq">${rich(r.q)}</p>` : ""}
      ${full === false ? "" : `<div class="row gap wrap"><button class="btn small primary" data-a="revOk" data-t="${t}" data-id="${x.id}">✓ Conferma</button><button class="btn small" data-a="revEdit" data-t="${t}" data-id="${x.id}">✎ Modifica</button><button class="btn small ghost danger" data-a="revDel" data-t="${t}" data-id="${x.id}">✕ Elimina</button></div>`}</div>`;
  }
  function viewReview(c) {
    const all = reviewItems(c); const f = filters.revSrc;
    const list = all.filter((i) => !f || (i.x.review.src || "") === f);
    const order = ["Lore", "Luogo", "Fazione", "PNG", "Oggetto", "PG", "Conto alla rovescia", "Scontro", "Sessione", "Avversario", "Ambiente"];
    list.sort((a, b) => (order.indexOf(a.label) - order.indexOf(b.label)) || revName(a.t, a.x).localeCompare(revName(b.t, b.x)));
    const plain = (i) => { const x = i.x; const t = i.t === "session" ? [x.prep, x.summary].join(" ") : i.t === "enc" ? [x.objective, x.purpose, x.notes].join(" ") : x.notes || x.desc || ""; const s0 = String(t).replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1").replace(/\s+/g, " ").trim(); return s0.length > 240 ? s0.slice(0, 240) + "…" : s0; };
    const manual = all.filter((i) => i.x.review.src === "manuale").length;
    return `<div class="row gap wrap buildertop"><button class="chip" data-a="go" data-tab="mondo" aria-label="Torna al Mondo">‹</button><h2 class="grow">Da confermare</h2><span class="cnt big">${all.length}</span></div>
      <p class="sub">Voci ricostruite per te. Conferma quelle giuste, modifica quelle da correggere (salvando si confermano), elimina quelle sbagliate. Ogni azione si può annullare.</p>
      <div class="chips">${[["", "Tutte"]].concat(Object.entries(REV_SRC)).map(([k, v]) => `<button class="chip ${f === k ? "on" : ""}" data-a="revFilter" data-k="${k}">${v} (${k ? all.filter((i) => (i.x.review.src || "") === k).length : all.length})</button>`).join("")}</div>
      ${manual && (!f || f === "manuale") ? `<button class="btn small ghost" data-a="revOkManual">Conferma tutte le ${manual} voci prese dal manuale</button>` : ""}
      ${list.length ? `<div class="grid">${list.map((i) => `<article class="card rev">
          <header class="row between"><div class="grow"><div class="k">${esc(i.label)}${i.x.subtitle ? " · " + esc(i.x.subtitle) : ""}</div><h3><button class="namebtn" data-a="revOpen" data-t="${i.t}" data-id="${i.x.id}">${esc(revName(i.t, i.x))}</button></h3></div></header>
          ${plain(i) ? `<p class="sub">${esc(plain(i))}</p>` : ""}
          ${reviewBanner(i.t, i.x)}
        </article>`).join("")}</div>`
      : empty(all.length ? "Niente con questo filtro" : "Tutto confermato", all.length ? "Cambia filtro per vedere le altre voci." : "Non ci sono voci in attesa di conferma.", `<button class="btn" data-a="go" data-tab="mondo">Vai al Mondo</button>`)}`;
  }
  function mergePack(c, p) {
    const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(?:(?:il|lo|la|i|gli|le|un|una|uno)\s+|l'\s*)/, "").replace(/[^a-z0-9]+/g, " ").trim();
    let add = 0, skip = 0; const skipped = [];
    if (p.needsUmbraPack) importPack(c);
    const put = (arr, items, key, extra) => (items || []).forEach((x) => {
      if (arr.some((y) => key(y) === key(x))) { skip++; skipped.push(x.name || x.title); return; }
      arr.push(Object.assign(extra ? extra(x) : {}, clone(x), { id: uid() })); add++; });
    put(c.world, p.world, (x) => x.kind + "|" + norm(x.name));
    put(c.pcs, p.pcs, (x) => norm(x.name), () => ({ hp: 0, stress: 0, hope: 2, armor: 0, conditions: [], hpMax: 6, stressMax: 6, hopeMax: 6, armorMax: 3, level: 1 }));
    put(c.clocks, p.clocks, (x) => norm(x.name), () => ({ value: 0, kind: "campagna", max: 6 }));
    put(c.sessions, p.sessions, (x) => norm(x.title) + "|" + x.num);
    put(c.tables, p.tables, (x) => norm(x.name));
    put(c.bestiary, p.bestiary, (x) => norm(x.name));
    put(c.environments, p.environments, (x) => norm(x.name));
    (p.encounters || []).forEach((e0) => {
      if (c.encounters.some((y) => norm(y.name) === norm(e0.name))) { skip++; skipped.push(e0.name); return; }
      const e = normEnc(c, clone(e0)); e.id = uid(); e.created = e.updated = Date.now();
      e.items = (e0.items || []).map((it) => { const a = it.advId ? findAdv(c, it.advId) : allAdv(c).find((x) => norm(x.name) === norm(it.advName)) || c.bestiary.concat(SRD.adversaries).find((x) => norm(x.name) === norm(it.advName) || (x.en && norm(x.en.name) === norm(it.advName)));
        const o = Object.assign({}, it, { advId: a ? a.id : "missing-" + slug(it.advName || "x") }); delete o.advName; return o; });
      if (e0.envName) { const v = c.environments.concat(SRD.environments).find((x) => norm(x.name) === norm(e0.envName) || (x.en && norm(x.en.name) === norm(e0.envName))); e.envId = v ? v.id : ""; delete e.envName; }
      c.encounters.push(e); add++; });
    return { add, skip, skipped };
  }

  function viewWorld(c, sub) {
    if (sub === "rivedi") return viewReview(c);
    if (sub === "mappa") return viewAtlas(c);
    const nrev = reviewItems(c).length;
    const q = filters.worldQ.toLowerCase();
    const list = c.world.filter((w) => (!filters.worldKind || w.kind === filters.worldKind) && (!q || [w.name, w.subtitle, w.tags, w.notes].join(" ").toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
    return `${nrev ? `<button class="revbar" data-a="go" data-tab="mondo" data-sub="rivedi"><b>${nrev}</b> ${nrev === 1 ? "voce" : "voci"} da confermare<span class="chev">›</span></button>` : ""}<div class="sechead"><h2>Mondo</h2><div class="row gap"><button class="btn small ghost" data-a="go" data-tab="mondo" data-sub="mappa">🗺 Mappa</button><button class="btn small" data-a="newWorld">+ Voce</button></div></div>
      <div class="chips">${[["", "Tutto"]].concat(Object.entries(WORLD_KINDS)).map(([k, v]) => `<button class="chip ${filters.worldKind === k ? "on" : ""}" data-a="worldKind" data-k="${k}">${v}</button>`).join("")}</div>
      <div class="filters"><input type="search" placeholder="Cerca nomi, tag e appunti" value="${esc(filters.worldQ)}" data-a="filter" data-k="worldQ"></div>
      ${list.length ? `<div class="list">${list.map((w) => `<button class="listrow" data-a="viewWorld" data-id="${w.id}"><div><b>${esc(w.name)}</b>${revTag(w)}<div class="sub">${WORLD_ONE[w.kind] || ""}${w.subtitle ? " · " + esc(w.subtitle) : ""}${w.tags ? " · " + esc(w.tags) : ""}</div></div><span class="chev">›</span></button>`).join("")}</div>`
      : empty("Niente qui", "PNG, luoghi, fazioni, oggetti e lore della campagna.", "")}`;
  }

  // ---- diario
  function viewJournal(c, sub, id) {
    if (sub === "live") return viewLive(c);
    if (sub === "chiudi") return viewClose(c, id);
    if (sub === "prepara") return viewPrep(c, id);
    const list = c.sessions.slice().sort((a, b) => num(b.num) - num(a.num));
    const ls = liveSession(c);
    return `${ls ? `<button class="revbar live" data-a="go" data-tab="diario" data-sub="live"><span class="recdot"></span> Sessione in corso da ${dur(Date.now() - ls.startedAt)}<span class="chev">›</span></button>` : `<div class="row gap startrow"><button class="btn ghost big grow" data-a="prepStart">✎ Prepara</button><button class="btn primary big grow" data-a="liveStart">▶ Inizia la sessione</button></div>`}
      <div class="sechead"><h2>Sessioni</h2><button class="btn small" data-a="newSession">+ Sessione</button></div>
      ${list.length ? `<div class="grid">${list.map((s) => `<article class="card session">
        <header class="row between"><div><h3>${s.num ? "#" + esc(s.num) + " · " : ""}${esc(s.title || "Sessione")}</h3><div class="sub">${esc(s.date || "")}${s.startedAt ? ` · ${c.live && c.live.sid === s.id ? '<span class="tag hot">in corso</span>' : s.endedAt ? "giocata, " + dur(s.endedAt - s.startedAt) : ""}` : ' · <span class="tag">da giocare</span>'}</div></div><button class="icon" data-a="editSession" data-id="${s.id}">✎</button></header>
        ${reviewBanner("session", s)}${!s.startedAt ? `<div class="row gap wrap sessbtns"><button class="btn small" data-a="go" data-tab="diario" data-sub="prepara/${s.id}">✎ Prepara</button></div>` : ""}${s.plan ? `<details class="logdet" ${!s.endedAt ? "open" : ""}><summary>Preparazione</summary>${planBlock(c, s, false)}</details>` : ""}${s.plan ? sessionBody(Object.assign({}, s, { prep: "" })) : sessionBody(s)}
        ${s.endedAt ? `<div class="row gap wrap sessbtns"><button class="btn small" data-a="go" data-tab="diario" data-sub="chiudi/${s.id}">${s.closed ? "Rivedi la chiusura" : "Chiudi la sessione"}</button><button class="btn small ghost" data-a="claudeExport" data-id="${s.id}">Copia per Claude</button>${s.publicRecap ? `<button class="btn small ghost" data-a="recapShare" data-id="${s.id}">Invia al gruppo</button>` : ""}</div>` : ""}
        ${(s.log || []).length ? `<details class="logdet"><summary>Diario della serata · ${s.log.length} voci</summary><ul class="livelog">${s.log.map((e) => logLine(e, s)).join("")}</ul></details>` : ""}
      </article>`).join("")}</div>`
      : empty("Nessuna sessione", "Prepara la prossima sessione e annota cosa succede al tavolo.", `<button class="btn" data-a="newSession">Prepara una sessione</button>`)}`;
  }

  const sessionBody = (s) => `${s.prep ? `<h4>Preparazione</h4><p class="notes">${rich(s.prep)}</p>` : ""}
        ${s.summary ? `<h4>Cos'è successo</h4><p class="notes">${rich(s.summary)}</p>` : ""}
        ${s.aside ? `<h4>A parte di fine sessione</h4><blockquote>${rich(s.aside)}</blockquote>` : ""}`;

  // ---------------------------------------------------------------- editor
  function pcEditor(p) {
    const isNew = !p;
    p = p || { hpMax: 6, stressMax: 6, hopeMax: 6, hope: 2, armorMax: 3, level: 1 };
    openModal(isNew ? "Nuovo PG" : "Modifica PG",
      `<div class="two">${field("Nome", "name", p.name)}${field("Giocatore", "player", p.player)}</div>
       <div class="two">${field("Classe", "cls", p.cls)}${field("Sottoclasse", "subclass", p.subclass)}</div>
       <div class="two">${field("Origine", "ancestry", p.ancestry)}${field("Comunità", "community", p.community)}</div>
       <div class="four">${field("Livello", "level", p.level, "number")}${field("Evasione", "evasion", p.evasion, "number")}${field("Maggiore", "major", p.major, "number")}${field("Grave", "severe", p.severe, "number")}</div>
       <div class="four">${field("PF max", "hpMax", p.hpMax, "number")}${field("Stress max", "stressMax", p.stressMax, "number")}${field("Speranza max", "hopeMax", p.hopeMax, "number")}${field("Armatura", "armorMax", p.armorMax, "number")}</div>
       ${field("Cicatrici", "scars", p.scars || 0, "number")}
       ${area("Esperienze, legami, note", "notes", p.notes, 4)}
       ${isNew ? "" : `<button class="btn danger ghost" data-a="delPc" data-id="${p.id}">Elimina PG</button>`}`,
      { onSave: () => {
        const f = form(); if (!f.name.trim()) return toast("Serve un nome");
        const c = C();
        const data = { name: f.name.trim(), player: f.player, cls: f.cls, subclass: f.subclass, ancestry: f.ancestry, community: f.community,
          level: num(f.level, 1), evasion: numOrNull(f.evasion), major: numOrNull(f.major), severe: numOrNull(f.severe),
          hpMax: clamp(num(f.hpMax, 6), 1, 12), stressMax: clamp(num(f.stressMax, 6), 1, 12), hopeMax: clamp(num(f.hopeMax, 6), 0, 12), armorMax: clamp(num(f.armorMax, 0), 0, 12), scars: clamp(num(f.scars), 0, 12), notes: f.notes };
        if (isNew) c.pcs.push(Object.assign({ id: uid(), hp: 0, stress: 0, hope: 2, armor: 0, conditions: [] }, data));
        else { const x = c.pcs.find((y) => y.id === p.id); Object.assign(x, data); delete x.review; }
        save(); closeModal(); render();
      } });
  }

  function featRows(list) {
    return `<div id="feats">${(list || []).map(featRow).join("")}</div><button class="btn small ghost" data-a="featAdd">+ Caratteristica</button>`;
  }
  function featRow(f = {}) {
    return `<div class="feat-row"><div class="two">
      <label class="fld"><span>Nome</span><input class="f-name" value="${esc(f.name)}"></label>
      <label class="fld"><span>Tipo</span><select class="f-type">${FEAT_TYPES.map((t) => `<option ${t === f.type ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
      <label class="fld"><span>Testo</span><textarea class="f-text" rows="3">${esc(f.text)}</textarea></label>
      <button class="icon danger" data-a="featDel" aria-label="Rimuovi">✕</button></div>`;
  }
  const readFeats = () => $$("#feats .feat-row").map((r) => ({ name: $(".f-name", r).value.trim(), type: $(".f-type", r).value, text: $(".f-text", r).value.trim() })).filter((f) => f.name || f.text);

  function advEditor(a) {
    const isNew = !a;
    a = a || { tier: 1, role: "Base", range: "Mischia", dmgType: "fis", features: [] };
    openModal(isNew ? "Nuovo avversario" : "Modifica avversario",
      `${field("Nome", "name", a.name)}
       <div class="three">${select("Rango", "tier", a.tier, [1, 2, 3, 4])}${select("Ruolo", "role", a.role, ROLES)}${field("Seguace (X)", "minion", a.minion ?? "", "number")}</div>
       ${area("Descrizione", "desc", a.desc, 2)}${field("Motivazioni e Tattiche", "motives", a.motives)}
       <div class="three">${field("Difficoltà", "difficulty", a.difficulty, "number")}${field("Maggiore", "major", a.major ?? "", "number")}${field("Grave", "severe", a.severe ?? "", "number")}</div>
       <div class="three">${field("PF", "hp", a.hp, "number")}${field("Stress", "stress", a.stress, "number")}${field("ATT", "atk", a.atk, "number")}</div>
       <div class="two">${field("Arma", "weapon", a.weapon)}${select("Portata", "range", a.range, RANGES)}</div>
       <div class="two">${field("Danno", "dmg", a.dmg, "text", 'placeholder="2d8+3"')}${select("Tipo", "dmgType", a.dmgType, [["fis", "fisico"], ["mag", "magico"]])}</div>
       ${field("Esperienze", "exp", a.exp, "text", 'placeholder="Furtività +3, Conoscenza +2"')}
       ${check("Toccato dall'Umbra (critico con 19-20)", "umbra", a.umbra)}
       <h4>Caratteristiche</h4>${featRows(a.features)}
       ${area("L'altra via (condizione di vittoria alternativa)", "other", a.other, 2)}
       ${field("Fonte", "source", a.source)}`,
      { onSave: () => {
        const f = form(); if (!f.name.trim()) return toast("Serve un nome");
        const data = { name: f.name.trim(), tier: num(f.tier, 1), role: f.role, minion: numOrNull(f.minion), desc: f.desc, motives: f.motives,
          difficulty: num(f.difficulty, 10), major: numOrNull(f.major), severe: numOrNull(f.severe), hp: num(f.hp, 1), stress: num(f.stress, 1), atk: num(f.atk, 0),
          weapon: f.weapon, range: f.range, dmg: f.dmg, dmgType: f.dmgType, exp: f.exp, umbra: f.umbra, features: readFeats(), other: f.other, source: f.source };
        const c = C();
        if (isNew) c.bestiary.push(Object.assign({ id: uid() }, data)); else Object.assign(c.bestiary.find((x) => x.id === a.id), data);
        save(); closeModal(); render(); toast("Avversario salvato");
      } });
  }

  function envEditor(e) {
    const isNew = !e;
    e = e || { tier: 1, type: "Esplorazione", features: [] };
    openModal(isNew ? "Nuovo ambiente" : "Modifica ambiente",
      `${field("Nome", "name", e.name)}
       <div class="three">${select("Rango", "tier", e.tier, [1, 2, 3, 4])}${select("Tipo", "type", e.type, ENV_TYPES)}${field("Difficoltà", "difficulty", e.difficulty, "number")}</div>
       ${area("Descrizione", "desc", e.desc, 2)}${field("Impeti", "impulses", e.impulses)}${field("Avversari potenziali", "adversaries", e.adversaries)}
       <h4>Caratteristiche</h4>${featRows(e.features)}${field("Fonte", "source", e.source)}`,
      { onSave: () => {
        const f = form(); if (!f.name.trim()) return toast("Serve un nome");
        const data = { name: f.name.trim(), tier: num(f.tier, 1), type: f.type, difficulty: num(f.difficulty, 10), desc: f.desc, impulses: f.impulses, adversaries: f.adversaries, features: readFeats(), source: f.source };
        const c = C();
        if (isNew) c.environments.push(Object.assign({ id: uid() }, data)); else Object.assign(c.environments.find((x) => x.id === e.id), data);
        save(); closeModal(); render();
      } });
  }

  function tableEditor(t) {
    const isNew = !t;
    t = t || { die: 6, entries: [] };
    const text = t.entries.map(([a, b, s]) => (a === b ? a : a + "-" + b) + ": " + s).join("\n");
    openModal(isNew ? "Nuova tabella" : "Modifica tabella",
      `${field("Nome", "name", t.name)}${field("Dado (facce)", "die", t.die, "number")}
       ${area("Voci, una per riga: «1-2: testo» oppure «3: testo». Senza numeri, le voci vengono distribuite in ordine.", "entries", text, 10)}
       ${isNew ? "" : `<button class="btn danger ghost" data-a="delTable" data-id="${t.id}">Elimina tabella</button>`}`,
      { onSave: () => {
        const f = form(); if (!f.name.trim()) return toast("Serve un nome");
        const lines = f.entries.split("\n").map((l) => l.trim()).filter(Boolean);
        let entries = []; let auto = 1;
        lines.forEach((l) => {
          const m = l.match(/^(\d+)\s*(?:[-–]\s*(\d+))?\s*[:.)]\s*(.+)$/);
          if (m) { entries.push([num(m[1]), num(m[2] || m[1]), m[3]]); auto = num(m[2] || m[1]) + 1; }
          else { entries.push([auto, auto, l]); auto++; }
        });
        const die = Math.max(2, num(f.die, entries.length || 6));
        const data = { name: f.name.trim(), die, entries };
        const c = C();
        if (isNew) c.tables.push(Object.assign({ id: uid() }, data)); else Object.assign(c.tables.find((x) => x.id === t.id), data);
        save(); closeModal(); render();
      } });
  }

  function clockEditor(k) {
    const isNew = !k; k = k || { kind: "progresso", max: 4, value: 0 };
    openModal(isNew ? "Nuovo conto alla rovescia" : "Modifica conto alla rovescia",
      `${field("Nome", "name", k.name)}
       <div class="two">${select("Tipo", "kind", k.kind, Object.entries(CLOCK_KINDS))}${field("Caselle", "max", k.max, "number", 'min="1" max="16"')}</div>
       ${check("Ciclico (riparte quando si innesca)", "loop", k.loop)}
       ${area("Cosa succede quando si innesca", "notes", k.notes, 3)}
       ${isNew ? "" : `<button class="btn danger ghost" data-a="delClock" data-id="${k.id}">Elimina</button>`}`,
      { onSave: () => {
        const f = form(); if (!f.name.trim()) return toast("Serve un nome");
        const data = { name: f.name.trim(), kind: f.kind, max: clamp(num(f.max, 4), 1, 16), loop: f.loop, notes: f.notes };
        const c = C();
        if (isNew) c.clocks.push(Object.assign({ id: uid(), value: 0 }, data)); else { const x = c.clocks.find((y) => y.id === k.id); Object.assign(x, data); x.value = Math.min(x.value, x.max); delete x.review; }
        save(); closeModal(); render();
      } });
  }

  function worldEditor(w, kind, name) {
    const isNew = !w; w = w || { kind: kind || filters.worldKind || "png", name: name || "" };
    openModal(isNew ? "Nuova voce" : "Modifica voce",
      `${select("Tipo", "kind", w.kind, Object.entries(WORLD_KINDS))}
       ${field("Nome", "name", w.name)}${field("Altri nomi (separati da virgola)", "aliases", w.aliases, "text", 'placeholder="Mastro Ivo, il Fabbro"')}${field("Ruolo o sottotitolo", "subtitle", w.subtitle)}${field("Tag", "tags", w.tags, "text", 'placeholder="Ateneo, alleato, segreto"')}
       ${area("Appunti", "notes", w.notes, 8)}
       ${isNew ? "" : `<button class="btn danger ghost" data-a="delWorld" data-id="${w.id}">Elimina</button>`}`,
      { onSave: () => {
        const f = form(); if (!f.name.trim()) return toast("Serve un nome");
        const data = { kind: f.kind, name: f.name.trim(), aliases: f.aliases.trim(), subtitle: f.subtitle, tags: f.tags, notes: f.notes };
        const c = C();
        if (isNew) c.world.push(Object.assign({ id: uid() }, data)); else { const x = c.world.find((y) => y.id === w.id); Object.assign(x, data); if (x.review) { delete x.review; toast("Modificata e confermata"); } }
        save(); closeModal(); render();
      } });
  }

  function sessionEditor(s) {
    const c = C(); const isNew = !s;
    s = s || { num: (c.sessions.reduce((m, x) => Math.max(m, num(x.num)), 0) + 1), date: new Date().toISOString().slice(0, 10) };
    openModal(isNew ? "Nuova sessione" : "Modifica sessione",
      `<div class="three">${field("Numero", "num", s.num, "number")}${field("Data", "date", s.date, "date")}${field("Titolo", "title", s.title)}</div>
       ${area("Preparazione (scene, PNG, indizi, momenti d'azione)", "prep", s.prep, 6)}
       ${area("Cos'è successo", "summary", s.summary, 6)}
       ${area("A parte di fine sessione", "aside", s.aside, 3)}
       ${isNew ? "" : `<button class="btn danger ghost" data-a="delSession" data-id="${s.id}">Elimina sessione</button>`}`,
      { onSave: () => {
        const f = form();
        const data = { num: num(f.num), date: f.date, title: f.title, prep: f.prep, summary: f.summary, aside: f.aside };
        if (isNew) c.sessions.push(Object.assign({ id: uid() }, data)); else { const x = c.sessions.find((y) => y.id === s.id); Object.assign(x, data); delete x.review; }
        save(); closeModal(); render();
      } });
  }

  function damageDialog(title, target, apply) {
    const hasArmor = target.armorMax != null && num(target.armorMax) > 0 && num(target.armor) < num(target.armorMax);
    openModal(title,
      `<p class="sub">Soglie: Maggiore ${esc(target.major ?? "–")} · Grave ${esc(target.severe ?? "–")}</p>
       ${field("Danno ricevuto", "dmg", "", "number", 'inputmode="numeric"')}
       ${hasArmor ? check("Usa uno slot Armatura (riduce di un livello)", "armor", false) : ""}
       <div id="dmgPreview" class="sub"></div>`,
      { saveLabel: "Applica", onSave: () => {
        const f = form(); const d = num(f.dmg);
        let marks = hpFromDamage(d, target.major, target.severe);
        if (f.armor && marks > 0) marks -= 1;
        apply(marks, d, !!f.armor); closeModal(); render();
      } });
    const inp = $('#modal-body [name="dmg"]'); const ar = $('#modal-body [name="armor"]'); const out = $("#dmgPreview");
    const prev = () => {
      const d = num(inp.value); let m = hpFromDamage(d, target.major, target.severe);
      if (ar && ar.checked && m > 0) m--;
      out.textContent = d ? `Segna ${m} PF.` : "";
    };
    inp.addEventListener("input", prev); if (ar) ar.addEventListener("change", prev);
  }

  function pickAdversary(title, onPick) {
    const c = C();
    if (!allAdv(c).length) return toast("Il bestiario è vuoto");
    const rows = allAdv(c).slice().sort((x, y) => (x.tier - y.tier) || x.name.localeCompare(y.name));
    openModal(title, `<input type="search" id="pickQ" placeholder="Cerca" class="search">
      <div class="list" id="pickList">${rows.map((a) => `<button class="listrow" data-a="pick" data-id="${a.id}" data-name="${esc(findText(a))}"><div><b>${esc(a.name)}</b><div class="sub">${esc(a.role)} · Rango ${esc(a.tier)} · ${a.srd ? esc(a.source) : "Campagna"}</div></div><span class="chev">+</span></button>`).join("")}</div>`);
    pickAdversary.cb = onPick;
    $("#pickQ").addEventListener("input", (e) => { const q = e.target.value.toLowerCase(); $$("#pickList .listrow").forEach((r) => { r.hidden = q && !r.dataset.name.includes(q); }); });
  }

  function spawn(c, a, qty, label) {
    const nm = label || a.name;
    if (a.role === "Seguace") {
      c.combat.units.push({ uid: uid(), advId: a.id, name: nm, role: a.role, tier: a.tier, difficulty: a.difficulty, minion: true, count: qty, value: num(a.minion, 1) || 1, conditions: [], umbra: a.umbra });
      return;
    }
    const existing = c.combat.units.filter((u) => u.advId === a.id && !u.minion).length;
    for (let i = 0; i < qty; i++) {
      const n = qty > 1 || existing ? ` ${existing + i + 1}` : "";
      c.combat.units.push({ uid: uid(), advId: a.id, name: nm + n, role: a.role, tier: a.tier, difficulty: a.difficulty, major: a.major, severe: a.severe, hpMax: num(a.hp, 1), hp: 0, stressMax: num(a.stress, 1), stress: 0, conditions: [], spotlight: false, umbra: a.umbra });
    }
  }

  // ---------------------------------------------------------------- dadi
  function diceSheet() {
    const c = C();
    openModal("Dadi", `
      <div class="dice-duality">
        <h4>Tiro di Dualità</h4>
        <div class="three">${field("Modificatore", "mod", 0, "number")}${select("Vantaggio", "adv", "", [["", "Nessuno"], ["adv", "Vantaggio (+d6)"], ["dis", "Svantaggio (−d6)"]])}${field("Difficoltà", "diff", "", "number")}</div>
        <button class="btn primary big" data-a="rollDuality">Tira 2d12</button>
      </div>
      <div class="dice-free"><h4>Altri dadi</h4>
        <div class="row gap wrap">${[4, 6, 8, 10, 12, 20].map((d) => `<button class="btn small" data-a="rollQuick" data-d="${d}">d${d}</button>`).join("")}</div>
        <div class="row gap"><input name="expr" placeholder="3d8+4" class="grow"><button class="btn" data-a="rollExpr">Tira</button></div>
      </div>
      <div class="dice-free"><h4>Al volo</h4><div class="chips">${[["oracolo", "Oracolo"], ["png", "PNG"], ["compl", "Complicazione"], ["bottino", "Bottino"]].map(([k, v]) => `<button class="chip" data-a="gen" data-k="${k}">${v}</button>`).join("")}<button class="chip" data-a="genOpen">Tutti…</button></div></div>
      <div id="rollOut"></div>
      <h4>Ultimi tiri</h4><ul class="rolllog" id="rollLog">${rollLog(c)}</ul>`, { focus: false });
  }
  const rollLog = (c) => c.rolls.slice(0, 15).map((r) => `<li><span>${esc(r.label)}</span><b>${esc(r.result)}</b></li>`).join("") || `<li class="sub">Nessun tiro.</li>`;
  function logRoll(label, result) {
    const c = C(); c.rolls.unshift({ label, result, t: Date.now() }); c.rolls = c.rolls.slice(0, 50); save();
    const l = $("#rollLog"); if (l) l.innerHTML = rollLog(c);
  }
  function showRoll(html) { const o = $("#rollOut"); if (o) { o.innerHTML = html; o.classList.remove("pop"); void o.offsetWidth; o.classList.add("pop"); } }

  // ---------------------------------------------------------------- sincronizzazione (Google Drive, cartella nascosta dell'app)
  // Ogni campagna è un file "campagna-<id>.json" nella cartella appDataFolder del Drive dell'utente:
  // l'app vede solo i propri file, non il resto del Drive. Niente server: il browser parla direttamente con Google.
  const SYNC_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  const DRV_FILES = "https://www.googleapis.com/drive/v3/files";
  const DRV_UP = "https://www.googleapis.com/upload/drive/v3/files";
  const TOK_KEY = "lanterna.tok";
  const SY = { busy: false, timer: null, err: "", conflicts: [], gis: null, client: null, pending: null };
  const syncCfg = () => { S.sync = S.sync || { on: false, clientId: "", base: {}, deleted: [], last: 0, device: "" }; S.sync.base = S.sync.base || {}; S.sync.deleted = S.sync.deleted || []; return S.sync; };
  const syncOn = () => !!(S.sync && S.sync.on && S.sync.clientId);
  const deviceName = () => syncCfg().device || (/iphone|ipad/i.test(navigator.userAgent) ? "iPhone/iPad" : /android/i.test(navigator.userAgent) ? (/mobile/i.test(navigator.userAgent) ? "Telefono Android" : "Tablet Android") : "Computer");
  function getTok() { try { const t = JSON.parse(localStorage.getItem(TOK_KEY) || "null"); return t && t.exp > Date.now() + 60e3 ? t.t : null; } catch (_) { return null; } }
  function setTok(t, sec) { try { if (t) localStorage.setItem(TOK_KEY, JSON.stringify({ t, exp: Date.now() + (sec || 3600) * 1000 })); else localStorage.removeItem(TOK_KEY); } catch (_) {} }
  function campHash(c) { const s0 = JSON.stringify(c); let h = 0x811c9dc5; for (let i = 0; i < s0.length; i++) { h ^= s0.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ":" + s0.length; }
  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (SY.gis) return SY.gis;
    SY.gis = new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "https://accounts.google.com/gsi/client"; sc.async = true; sc.onload = () => res(); sc.onerror = () => { SY.gis = null; rej(new Error("Google non raggiungibile: sei online?")); }; document.head.appendChild(sc); });
    return SY.gis;
  }
  // chiede il permesso a Google. Va chiamata da un tocco dell'utente (il browser blocca i popup automatici).
  async function syncAuth(prompt) {
    const cfg = syncCfg(); await loadGis();
    return new Promise((res, rej) => {
      const client = google.accounts.oauth2.initTokenClient({ client_id: cfg.clientId, scope: SYNC_SCOPE,
        callback: (r) => { if (r && r.access_token) { setTok(r.access_token, r.expires_in); res(r.access_token); } else rej(new Error((r && (r.error_description || r.error)) || "Accesso non riuscito")); },
        error_callback: (e) => rej(new Error(e && e.type === "popup_closed" ? "Finestra di Google chiusa" : e && e.type === "popup_failed_to_open" ? "Il browser ha bloccato la finestra di Google" : "Accesso non riuscito")) });
      client.requestAccessToken({ prompt: prompt || "" });
    });
  }
  async function gfetch(url, opts = {}) {
    const tok = getTok(); if (!tok) { const e = new Error("Serve l'accesso"); e.auth = true; throw e; }
    const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: "Bearer " + tok }, opts.headers || {}) }));
    if (r.status === 401) { setTok(null); const e = new Error("Accesso scaduto"); e.auth = true; throw e; }
    if (!r.ok) { let m = r.status + ""; try { const j = await r.json(); m = (j.error && j.error.message) || m; } catch (_) {} throw new Error("Drive: " + m); }
    return r.status === 204 ? null : r;
  }
  async function driveListApp() {
    const out = []; let page = "";
    do { const r = await gfetch(`${DRV_FILES}?spaces=appDataFolder&pageSize=200&fields=nextPageToken,files(id,name,version,modifiedTime,appProperties)${page ? "&pageToken=" + encodeURIComponent(page) : ""}`); const j = await r.json(); out.push(...(j.files || [])); page = j.nextPageToken || ""; } while (page);
    return out;
  }
  async function driveUpload(fileId, name, obj, props) {
    const meta = fileId ? { appProperties: props } : { name, parents: ["appDataFolder"], appProperties: props };
    const b = "lanterna" + Math.random().toString(36).slice(2);
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(obj)}\r\n--${b}--`;
    const r = await gfetch(`${DRV_UP}${fileId ? "/" + fileId : ""}?uploadType=multipart&fields=id,version,modifiedTime`, { method: fileId ? "PATCH" : "POST", headers: { "Content-Type": "multipart/related; boundary=" + b }, body });
    return r.json();
  }
  const driveGet = async (id) => (await gfetch(`${DRV_FILES}/${id}?alt=media`)).json();
  const driveDel = (id) => gfetch(`${DRV_FILES}/${id}`, { method: "DELETE" }).catch((e) => { if (!/404/.test(e.message)) throw e; });

  async function pushCamp(c, f) {
    const cfg = syncCfg(); const h = campHash(c);
    const up = await driveUpload(f && f.id, `campagna-${c.id}.json`, { kind: "lanterna-campaign", version: 1, savedAt: Date.now(), device: deviceName(), campaign: c }, { cid: c.id, h, cname: String(c.name).slice(0, 90), device: deviceName().slice(0, 60) });
    cfg.base[c.id] = { fid: up.id, rh: h, hash: h, at: Date.now() };
  }
  async function pullCamp(f) {
    const cfg = syncCfg(); const d = await driveGet(f.id); const c = d.campaign; if (!c || !c.id) throw new Error("File di Drive non valido");
    migrate({ campaigns: { x: c } }); S.campaigns[c.id] = c; if (!S.activeId) S.activeId = c.id;
    cfg.base[c.id] = { fid: f.id, rh: (f.appProperties && f.appProperties.h) || "", hash: campHash(c), at: Date.now() };
    return c;
  }
  // confronta ogni campagna con l'ultima versione sincronizzata e decide chi ha ragione
  async function syncNow(opts = {}) {
    if (!syncOn() || SY.busy) return;
    if (!getTok()) { SY.err = "auth"; syncUI(); return; }
    SY.busy = true; SY.err = ""; syncUI();
    const cfg = syncCfg(); let up = 0, down = 0; const conflicts = [];
    try {
      const files = await driveListApp();
      const byCid = {}; files.forEach((f) => { const cid = (f.appProperties && f.appProperties.cid) || (f.name.match(/^campagna-(.+)\.json$/) || [])[1]; if (cid) byCid[cid] = f; });
      for (const cid of cfg.deleted.slice()) { if (byCid[cid]) await driveDel(byCid[cid].id); delete byCid[cid]; delete cfg.base[cid]; cfg.deleted = cfg.deleted.filter((x) => x !== cid); }
      for (const c of Object.values(S.campaigns)) {
        const f = byCid[c.id]; const base = cfg.base[c.id]; const localCh = !base || base.hash !== campHash(c);
        if (!f) { if (base) conflicts.push({ c, gone: true }); else { await pushCamp(c, null); up++; } continue; }
        const same = f.appProperties && f.appProperties.h === campHash(c);
        if (same) { cfg.base[c.id] = { fid: f.id, rh: f.appProperties.h, hash: campHash(c), at: Date.now() }; continue; }
        const rh = (f.appProperties && f.appProperties.h) || ""; const seen = base && (base.rh !== undefined ? base.rh : base.hash);
        const remoteCh = !base || rh !== seen;
        if (localCh && remoteCh) conflicts.push({ c, f });
        else if (localCh) { await pushCamp(c, f); up++; }
        else if (remoteCh) { await pullCamp(f); down++; }
      }
      for (const [cid, f] of Object.entries(byCid)) if (!S.campaigns[cid]) { await pullCamp(f); down++; }
      const mr = await syncMaps(files); up += mr.up; if (mr.down) { down += mr.down; Object.keys(thumbURL).forEach((k) => delete thumbURL[k]); }
      cfg.last = Date.now(); SY.conflicts = conflicts;
      save(true); if (down) render();
      if (opts.verbose || down) toast(down ? `Sincronizzato: ${down} novità da Drive` : up ? "Salvato su Drive" : "Già tutto sincronizzato");
      SY.asked = SY.asked || new Set(); const fresh = conflicts.filter((k) => !SY.asked.has(k.c.id + ":" + (k.gone ? "gone" : k.f.appProperties && k.f.appProperties.h)));
      fresh.forEach((k) => SY.asked.add(k.c.id + ":" + (k.gone ? "gone" : k.f.appProperties && k.f.appProperties.h)));
      if (conflicts.length && (opts.verbose || fresh.length)) syncConflict(); // una domanda sola: se chiudi senza scegliere, la nuvola resta rossa finché non la tocchi
    } catch (e) { SY.err = e.auth ? "auth" : e.message; if (!e.auth || opts.verbose) toast(e.auth ? "Tocca la nuvola per riconnetterti a Google" : "Sincronizzazione non riuscita: " + e.message); }
    finally { SY.busy = false; syncUI(); }
  }
  function syncConflict() {
    const k = SY.conflicts[0]; if (!k) return;
    const when = (t) => new Date(t).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    if (k.gone) return openModal(`«${k.c.name}» non è più su Drive`, `<p>Probabilmente è stata eliminata da un altro dispositivo. La elimino anche qui?</p><p class="sub">Se la tieni, la ricarico su Drive e torna su tutti i dispositivi.</p>`,
      { focus: false, extra: `<button class="btn ghost" data-a="syncKeep" data-k="local">Tienila</button><button class="btn danger" data-a="syncKeep" data-k="drop">Eliminala</button>` });
    const dev = (k.f.appProperties && k.f.appProperties.device) || "un altro dispositivo";
    openModal(`«${k.c.name}» è cambiata in due posti`, `<p>Dall'ultima sincronizzazione la campagna è stata modificata sia qui sia su <b>${esc(dev)}</b> (${when(k.f.modifiedTime)}). Quale tengo?</p>
      <p class="sub">Con «Tienile entrambe» la versione di Drive arriva come copia separata: poi confronti e cancelli quella che non serve.</p>`,
      { focus: false, extra: `<button class="btn ghost" data-a="syncKeep" data-k="both">Tienile entrambe</button><button class="btn ghost" data-a="syncKeep" data-k="remote">Quella di ${esc(dev)}</button><button class="btn primary" data-a="syncKeep" data-k="local">Questa</button>` });
  }
  async function syncResolve(kind) {
    const k = SY.conflicts.shift(); closeModal(); if (!k) return;
    SY.busy = true; syncUI();
    try {
      if (kind === "drop") { delete S.campaigns[k.c.id]; delete syncCfg().base[k.c.id]; if (S.activeId === k.c.id) S.activeId = Object.keys(S.campaigns)[0] || null; }
      else if (kind === "local") await pushCamp(k.c, k.gone ? null : k.f);
      else if (kind === "remote") await pullCamp(k.f);
      else { const d = await driveGet(k.f.id); const copy = d.campaign; copy.id = uid(); copy.name = copy.name + ` (da ${(k.f.appProperties && k.f.appProperties.device) || "Drive"})`; migrate({ campaigns: { x: copy } }); S.campaigns[copy.id] = copy; await pushCamp(k.c, k.f); }
      save(true); render(); toast("Fatto");
    } catch (e) { toast("Non riuscito: " + e.message); }
    finally { SY.busy = false; syncUI(); }
    if (SY.conflicts.length) syncConflict(); else if (kind === "both") syncNow();
  }
  // ---- mappe: immagini come file "mappa-<id>.bin", dati e segni in "mappe-indice.json", insieme alla Raccolta e alla chiave API
  const mapMeta = (m) => { const o = Object.assign({}, m); delete o.thumb; return o; };
  const mapSig = () => MAPS.map((m) => m.id + ":" + (m.updated || 0)).sort().join("|");
  const setSig = () => campHash({ lib: S.settings.mapLib || null, key: S.settings.driveKey || "" });
  async function driveUploadBlob(name, blob, props) {
    const b = "lanterna" + Math.random().toString(36).slice(2);
    const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: ["appDataFolder"], appProperties: props })}\r\n--${b}\r\nContent-Type: ${blob.type || "image/jpeg"}\r\n\r\n`, blob, `\r\n--${b}--`]);
    const r = await gfetch(`${DRV_UP}?uploadType=multipart&fields=id,version`, { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + b }, body });
    return r.json();
  }
  async function syncMaps(files) {
    if (!mapsLoaded) await loadMaps();
    const cfg = syncCfg(); cfg.mapDeleted = cfg.mapDeleted || [];
    const idxF = files.find((f) => f.name === "mappe-indice.json");
    const blobF = {}; files.forEach((f) => { const mm = f.name.match(/^mappa-(.+)\.bin$/); if (mm) blobF[mm[1]] = f; });
    const remoteCh = !!idxF && ((idxF.appProperties && idxF.appProperties.h) || "") !== cfg.mapRh;
    const localCh = mapSig() !== cfg.mapSig || setSig() !== cfg.setSig || cfg.mapDeleted.length > 0;
    if (!remoteCh && !localCh && (idxF || !MAPS.length)) return { up: 0, down: 0 };
    const R = idxF ? await driveGet(idxF.id) : {}; R.kind = "lanterna-maps-sync"; R.maps = R.maps || {}; R.deleted = R.deleted || [];
    let changed = !idxF, up = 0, down = 0;
    for (const id of cfg.mapDeleted) { if (!R.deleted.includes(id)) R.deleted.push(id); delete R.maps[id]; if (blobF[id]) { await driveDel(blobF[id].id); delete blobF[id]; } changed = true; }
    cfg.mapDeleted = [];
    for (const id of R.deleted) if (mapById(id)) { await idbDel("maps", id); await idbDel("blobs", id); MAPS = MAPS.filter((x) => x.id !== id); down++; }
    const todo = MAPS.filter((m) => !blobF[m.id]); let n = 0;
    for (const m of MAPS.slice()) {
      const r = R.maps[m.id];
      if (!blobF[m.id]) { const b = await idbGet("blobs", m.id); if (!b) continue; if (todo.length > 2) toast(`Carico le mappe su Drive: ${++n} di ${todo.length}`); await driveUploadBlob(`mappa-${m.id}.bin`, b, { mid: m.id }); R.maps[m.id] = mapMeta(m); changed = true; up++; }
      else if (!r || (m.updated || 0) > (r.updated || 0)) { R.maps[m.id] = mapMeta(m); changed = true; up++; }
      else if ((r.updated || 0) > (m.updated || 0)) { Object.assign(m, r); await idbPut("maps", m); down++; }
    }
    const news = Object.keys(R.maps).filter((id) => !mapById(id) && blobF[id]); n = 0;
    for (const id of news) {
      if (news.length > 2) toast(`Scarico le mappe da Drive: ${++n} di ${news.length}`);
      const blob = await (await gfetch(`${DRV_FILES}/${blobF[id].id}?alt=media`)).blob();
      let thumb = null; try { const bmp = await bitmapOf(blob); thumb = await toBlob(canvasOf(bmp, 480), 0.72); if (bmp.close) bmp.close(); } catch (_) {}
      const m = Object.assign({}, R.maps[id], { thumb }); await idbPut("blobs", blob, id); await idbPut("maps", m); MAPS.unshift(m); down++;
    }
    const first = cfg.setSig === undefined; const RS = R.settings || {};
    if (first && (RS.mapLib || RS.driveKey)) { S.settings.mapLib = S.settings.mapLib || RS.mapLib || null; S.settings.driveKey = S.settings.driveKey || RS.driveKey || ""; DRV.cache = {}; cfg.setSig = R.setSig; down++; }
    else if (first && !S.settings.mapLib && !S.settings.driveKey) cfg.setSig = setSig();
    const ls = setSig();
    if (ls !== cfg.setSig) { R.settings = { mapLib: S.settings.mapLib || null, driveKey: S.settings.driveKey || "" }; R.setSig = ls; changed = true; }
    else if (R.setSig && R.setSig !== cfg.setSig && R.settings) { S.settings.mapLib = R.settings.mapLib; S.settings.driveKey = R.settings.driveKey; DRV.cache = {}; down++; }
    cfg.setSig = setSig();
    if (changed) { const h = campHash(R); await driveUpload(idxF && idxF.id, "mappe-indice.json", R, { kind: "maps", h }); cfg.mapRh = h; } else cfg.mapRh = (idxF.appProperties && idxF.appProperties.h) || "";
    cfg.mapSig = mapSig();
    return { up, down };
  }
  // dopo ogni salvataggio: carica su Drive dopo qualche secondo di calma
  function syncSoon() { if (!syncOn()) return; clearTimeout(SY.timer); SY.timer = setTimeout(() => { if (getTok()) syncNow(); else syncUI(); }, 6000); }
  function syncDirty() { const cfg = syncCfg(); return cfg.deleted.length > 0 || Object.values(S.campaigns).some((c) => { const b = cfg.base[c.id]; return !b || b.hash !== campHash(c); }); }
  function syncUI() {
    const b = $("#syncBtn"); if (!b) return; b.hidden = !syncOn(); if (!syncOn()) return;
    const need = !getTok(); const st = SY.busy ? "busy" : SY.conflicts.length ? "err" : need ? "need" : SY.err ? "err" : "ok";
    b.className = "topicon sync " + st; if (st === "ok" && C() && C().live) b.hidden = true; // in sessione la barra è piena: compare solo se serve

    b.setAttribute("aria-label", { busy: "Sincronizzo…", err: "Problema di sincronizzazione", need: "Tocca per sincronizzare", ok: "Sincronizzato" }[st]);
  }
  async function syncTap(verbose) {
    if (SY.conflicts.length) return syncConflict();
    if (!getTok()) { try { await syncAuth(""); } catch (e) { toast(e.message); return; } }
    await syncNow({ verbose: verbose !== false });
  }
  function syncPanel() {
    const cfg = syncCfg();
    const last = cfg.last ? new Date(cfg.last).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "mai";
    return `<h4>Più dispositivi</h4>
      <p class="sub">Facoltativo. Accedi con Google e le campagne restano uguali su telefono, tablet e computer: l'app le salva in una cartella nascosta del tuo Drive, che può vedere solo Lanterna. Si sincronizzano anche le mappe (immagini, segni e nebbia), la Raccolta e la chiave API.</p>
      ${cfg.on ? `<p class="sub">Questo dispositivo: <b>${esc(deviceName())}</b> · ultima sincronizzazione: <b>${last}</b>${SY.err && SY.err !== "auth" ? ` · <span class="tag hot">${esc(SY.err)}</span>` : ""}</p>
        <div class="row gap wrap"><button class="btn" data-a="syncTap">☁ Sincronizza ora</button><button class="btn ghost" data-a="syncDevice">Nome dispositivo</button><button class="btn ghost" data-a="syncOff">Disattiva qui</button></div>`
      : `${field("ID client di Google (vedi LEGGIMI)", "syncClient", cfg.clientId, "text", 'placeholder="123…apps.googleusercontent.com" autocomplete="off" spellcheck="false"')}
        <button class="btn" data-a="syncStart">Accedi con Google e sincronizza</button>`}`;
  }
  async function syncStart() {
    const cfg = syncCfg(); const inp = $('#modal-body [name="syncClient"]'); const id = (inp ? inp.value : cfg.clientId).trim();
    if (!/\.apps\.googleusercontent\.com$/.test(id)) return toast("L'ID client finisce con .apps.googleusercontent.com");
    cfg.clientId = id; save(true);
    try { await syncAuth("consent"); } catch (e) { toast(e.message); return; }
    cfg.on = true; save(true); closeModal(); syncUI(); toast("Collegato a Google: sincronizzo…");
    await syncNow({ verbose: true });
  }
  window.__syncSoon = syncSoon;

  // ---------------------------------------------------------------- menu
  function menu() {
    const list = Object.values(S.campaigns).sort((a, b) => b.created - a.created);
    openModal("Campagne e impostazioni", `
      <div class="list">${list.map((c) => `<div class="listrow ${c.id === S.activeId ? "active" : ""}"><button class="grow textleft" data-a="switchCamp" data-id="${c.id}"><b>${esc(c.name)}</b><div class="sub">${esc(c.frame || "")} · ${c.pcs.length} PG · ${c.sessions.length} sessioni</div></button><button class="icon" data-a="renameCamp" data-id="${c.id}">✎</button></div>`).join("")}</div>
      <button class="btn" data-a="newCampaign">+ Nuova campagna</button>
      <h4>Contenuti</h4>
      ${window.UMBRA_PACK ? `<button class="btn ghost" data-a="importPack">Importa il pacchetto Era di Umbra (homebrew)</button>` : ""}
      <h4>Backup</h4>
      <p class="sub">I dati sono salvati solo su questo dispositivo. Esporta un backup ogni tanto: se cancelli i dati del browser o cambi telefono, è l'unico modo per non perderli.</p>
      <div class="row gap wrap"><button class="btn" data-a="exportAll">Esporta tutto</button><button class="btn ghost" data-a="exportCamp">Esporta questa campagna</button><button class="btn ghost" data-a="importFile">Importa backup</button></div>
      ${syncPanel()}
      <h4>Regole e contenuti</h4>
      ${check("Regola opzionale: danno pari al doppio della soglia Grave segna 4 PF", "massive", S.settings.massive)}
      ${check("Tieni lo schermo acceso mentre l'app è aperta", "wake", S.settings.wake)}
      ${check("Libreria SRD in inglese (testo originale)", "srdEn", S.settings.srdLang === "en")}
      ${check("Collega da soli i nomi scritti negli appunti", "autolink", S.settings.autolink !== false)}
      ${check("Testo più grande", "big", S.settings.big)}
      ${check(`Mostra i contenuti SRD nel bestiario (${SRD.adversaries.length} avversari, ${SRD.environments.length} ambienti)`, "srdOn", !S.settings.srdOff)}
      <h4>Aggiornamento</h4>
      <p class="sub">Versione in uso: <b id="swVer">…</b>. Se dopo aver aggiornato i file vedi ancora cose vecchie, premi qui: scarica di nuovo l'app senza toccare campagne e mappe.</p>
      <button class="btn ghost" data-a="appRefresh">Aggiorna l'app</button>
      <h4>Zona pericolosa</h4>
      <button class="btn danger ghost" data-a="delCamp">Elimina la campagna attiva</button>
      <p class="sub foot">Lanterna è uno strumento non ufficiale, non affiliato né approvato da Critical Role o Darrington Press. Include materiali dal Daggerheart System Reference Document 2.0, © Critical Role, LLC, secondo i termini della Darrington Press Community Gaming License (DPCGL); testi tradotti in italiano dallo SRD inglese, con nomi e termini allineati all'edizione italiana del manuale (il testo inglese resta disponibile). Maggiori informazioni su daggerheart.com.</p>`, { focus: false });
    const m = $('#modal-body [name="massive"]'); if (m) m.addEventListener("change", () => { S.settings.massive = m.checked; save(); });
    const wk = $('#modal-body [name="wake"]'); if (wk) wk.addEventListener("change", () => { S.settings.wake = wk.checked; save(); applyWake(); });
    const bg = $('#modal-body [name="big"]'); if (bg) bg.addEventListener("change", () => { S.settings.big = bg.checked; save(); applyPrefs(); });
    const al = $('#modal-body [name="autolink"]'); if (al) al.addEventListener("change", () => { S.settings.autolink = al.checked; save(); render(); });
    const sl = $('#modal-body [name="srdEn"]'); if (sl) sl.addEventListener("change", () => { S.settings.srdLang = sl.checked ? "en" : "it"; save(); toast("Ricarico la libreria…"); setTimeout(() => location.reload(), 500); });
    swVersion().then((v) => { const el = $("#swVer"); if (el) el.textContent = v; });
    const so = $('#modal-body [name="srdOn"]'); if (so) so.addEventListener("change", () => { S.settings.srdOff = !so.checked; save(); render(); });
  }

  function swVersion() {
    return new Promise((res) => {
      const ctl = navigator.serviceWorker && navigator.serviceWorker.controller; if (!ctl) return res("non installata (sito aperto nel browser)");
      const t = setTimeout(() => res("sconosciuta"), 1500);
      navigator.serviceWorker.addEventListener("message", function h(e) { if (e.data && e.data.version) { clearTimeout(t); navigator.serviceWorker.removeEventListener("message", h); res(e.data.version.replace("lanterna-", "")); } });
      ctl.postMessage("version");
    });
  }
  function download(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campagna";
  const today = () => new Date().toISOString().slice(0, 10);

  function importData(obj) {
    if (obj && obj.campaigns) {
      migrate(obj); let n = 0;
      Object.values(obj.campaigns).forEach((c) => { if (S.campaigns[c.id]) c.id = uid(); S.campaigns[c.id] = c; n++; });
      if (!S.activeId || !S.campaigns[S.activeId]) S.activeId = Object.keys(S.campaigns)[0];
      save(); toast(`${n} campagne importate`);
    } else if (obj && obj.kind === "lanterna-campaign" && obj.campaign) {
      migrate({ campaigns: { x: obj.campaign } }); const c = obj.campaign; if (S.campaigns[c.id]) c.id = uid();
      S.campaigns[c.id] = c; S.activeId = c.id; save(); toast("Campagna importata");
    } else if (obj && obj.kind === "lanterna-maps" && obj.lib) {
      const old = S.settings.mapLib; S.settings.mapLib = obj.lib; if (old && old.folders) old.folders.forEach((f) => { if (!obj.lib.folders.some((x) => x.id === f.id)) obj.lib.folders.push(f); });
      save(); closeModal(); go("mappe", "raccolta"); render(); toast(`Raccolta collegata: ${obj.lib.folders.length} categorie`); return;
    } else if (obj && obj.kind === "lanterna-pack") {
      const n = ["world", "pcs", "clocks", "encounters", "sessions", "bestiary", "environments", "tables"].reduce((t, k) => t + (obj[k] || []).length, 0) + (obj.atlas ? (obj.atlas.pins || []).length : 0);
      const cur = C();
      const run = async (c) => { const r = mergePack(c, obj); if (obj.atlas) { closeModal(); toast("Salvo la mappa…"); try { const q = await importAtlas(c, obj.atlas); r.add += q.made; toast(`Mappa del mondo pronta: ${q.put} luoghi segnati${q.made ? `, ${q.made} nuovi da confermare` : ""}`); } catch (e) { toast("Mappa non importata: " + e.message); } save(); go("mondo", "mappa"); render(); return; } save(); closeModal(); if ((obj.world || []).length) go("mondo", "rivedi"); else if ((obj.bestiary || []).length) go("bestiario"); render();
        toast(`${r.add} voci aggiunte${r.skip ? `, ${r.skip} già presenti (saltate)` : ""}`); };
      openModal(obj.name || "Pacchetto di contenuti", `<p>${esc(obj.desc || "")}</p><p class="sub">${n} voci. Quelle con un nome già presente vengono saltate, niente viene sovrascritto.</p>`,
        { focus: false, extra: `<button class="btn ghost" data-a="packNew">In una nuova campagna</button>${cur ? `<button class="btn primary" data-a="packHere">Aggiungi a «${esc(cur.name)}»</button>` : ""}` });
      A.packHere = () => run(C());
      A.packNew = () => { closeModal(); const c = newCampaign(obj.campaignName || "Nuova campagna", obj.frame || ""); run(c); };
      return;
    } else throw new Error("File non riconosciuto");
    closeModal(); render();
  }

  // ---------------------------------------------------------------- mappe
  const MAP_CATS = [
    ["citta", "Città e strade", "street city town road alley market plaza square district slum sewer urban"],
    ["interni", "Taverne, negozi e case", "tavern inn shop store house home manor mansion bakery smith forge library room interior bar hall kitchen cellar"],
    ["villaggio", "Villaggi e accampamenti", "village camp hideout farm hamlet outpost tent caravan settlement wagon mill"],
    ["castello", "Castelli e fortezze", "castle fort keep tower wall gate throne barracks prison citadel palace dungeon-keep"],
    ["dungeon", "Dungeon, cripte e templi", "dungeon crypt tomb catacomb temple shrine church cathedral altar vault ruin sanctum mausoleum ossuary"],
    ["grotta", "Grotte e miniere", "cave cavern mine underground grotto tunnel underdark lair"],
    ["foresta", "Foreste, paludi e fiumi", "forest wood swamp marsh bog jungle grove glade tree river lake mushroom fey waterfall"],
    ["montagna", "Montagne e rocce", "mountain rock rocky cliff canyon pass hill volcano lava crater quarry"],
    ["deserto", "Deserto", "desert dune oasis sand wasteland"],
    ["neve", "Neve e ghiaccio", "winter snow ice frozen glacier tundra frost"],
    ["mare", "Mare, porti e navi", "ship boat sea ocean beach coast port harbor harbour dock pirate island shore reef underwater"],
    ["ponte", "Ponti e passerelle", "bridge walkway rope chasm"],
    ["arena", "Arene e fosse", "arena pit colosseum"],
    ["giardino", "Giardini e cortili", "garden park courtyard greenhouse"],
    ["spaventoso", "Luoghi spaventosi", "spooky scary haunted graveyard cemetery ghost blood horror necro gallows"],
    ["scifi", "Sci-fi e altro", "scifi sci-fi space station lab spaceship cyber"],
    ["regione", "Regioni e mondo", "world region continent kingdom overland hex"],
  ];
  const CAT_NAME = Object.fromEntries(MAP_CATS.map(([k, v]) => [k, v]));
  const IT_EN = { palude: "swamp marsh bog", paludi: "swamp marsh bog", taverna: "tavern inn", locanda: "inn tavern", osteria: "tavern inn", cripta: "crypt", tomba: "tomb", cimitero: "graveyard cemetery", rovine: "ruin", rovina: "ruin", grotta: "cave cavern", caverna: "cave cavern", miniera: "mine", foresta: "forest wood", bosco: "forest wood", fiume: "river", lago: "lake", cascata: "waterfall", ponte: "bridge", nave: "ship boat", barca: "boat", porto: "port harbor dock", spiaggia: "beach", isola: "island", castello: "castle", fortezza: "fort keep", torre: "tower", mura: "wall", tempio: "temple", chiesa: "church", cattedrale: "cathedral", santuario: "shrine sanctum", altare: "altar", biblioteca: "library", mercato: "market", piazza: "plaza square", strada: "street road", via: "street road", vicolo: "alley", fogne: "sewer", fogna: "sewer", accampamento: "camp", campo: "camp", covo: "hideout lair", villaggio: "village", fattoria: "farm", mulino: "mill", neve: "snow winter", inverno: "winter snow", ghiaccio: "ice frozen", deserto: "desert", oasi: "oasis", montagna: "mountain", roccia: "rock", rocce: "rock", scogliera: "cliff", canyon: "canyon", vulcano: "volcano lava", arena: "arena", fossa: "pit", prigione: "prison", trono: "throne", palazzo: "palace", villa: "manor mansion", casa: "house home", negozio: "shop store", bottega: "shop", fabbro: "smith forge", stalla: "stable", faro: "lighthouse", albero: "tree", funghi: "mushroom", notte: "night", pioggia: "rain", nebbia: "fog mist", fuoco: "fire", sangue: "blood", carro: "wagon cart caravan", carovana: "caravan wagon", pirati: "pirate", sotterraneo: "underground dungeon", laboratorio: "lab", giardino: "garden", cortile: "courtyard", rifugio: "hideout shelter", ossario: "ossuary crypt catacomb", catacombe: "catacomb", mausoleo: "mausoleum", città: "city town", citta: "city town", sala: "hall room", cucina: "kitchen", cantina: "cellar" };
  const guessCat = (text) => { const t = String(text || "").toLowerCase(); for (const [k, , kw] of MAP_CATS) if (kw.split(" ").some((w) => t.includes(w))) return k; return ""; };
  const isGridded = (name) => { const n = name.toLowerCase(); return /grid/.test(n) && !/gridless|no[\s_-]?grid|ungrid|without[\s_-]?grid/.test(n); };

  // ---- IndexedDB (le immagini non stanno nel localStorage)
  let dbp = null;
  function idb() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open("lanterna-mappe", 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore("maps", { keyPath: "id" }); d.createObjectStore("blobs"); d.createObjectStore("index", { keyPath: "id" }); d.createObjectStore("inbox", { autoIncrement: true }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await idb();
    return new Promise((res, rej) => { const t = d.transaction(store, mode); const st = t.objectStore(store); let out; const r = fn(st); if (r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  }
  const idbGet = (s, k) => tx(s, "readonly", (st) => st.get(k));
  const idbAll = (s) => tx(s, "readonly", (st) => st.getAll());
  const idbPut = (s, v, k) => tx(s, "readwrite", (st) => (k === undefined ? st.put(v) : st.put(v, k)));
  const idbDel = (s, k) => tx(s, "readwrite", (st) => st.delete(k));
  const idbClear = (s) => tx(s, "readwrite", (st) => st.clear());
  const idbPutMany = (s, arr) => tx(s, "readwrite", (st) => { arr.forEach((v) => st.put(v)); });

  let MAPS = []; let mapsLoaded = false; const thumbURL = {};
  const mapById = (id) => MAPS.find((m) => m.id === id);
  const turl = (m) => { if (!m || !m.thumb) return ""; if (!thumbURL[m.id]) thumbURL[m.id] = URL.createObjectURL(m.thumb); return thumbURL[m.id]; };
  async function loadMaps() { try { MAPS = (await idbAll("maps")) || []; } catch (e) { console.error(e); MAPS = []; } mapsLoaded = true; }
  async function saveMapMeta(m) { m.updated = Date.now(); await idbPut("maps", m); const i = MAPS.findIndex((x) => x.id === m.id); if (i >= 0) MAPS[i] = m; else MAPS.unshift(m);
    if (S.sync && S.sync.mapDeleted) S.sync.mapDeleted = S.sync.mapDeleted.filter((x) => x !== m.id); if (window.__syncSoon) window.__syncSoon(); }

  // ---- immagini
  async function bitmapOf(blob) {
    if (window.createImageBitmap) { try { return await createImageBitmap(blob); } catch (_) {} }
    const url = URL.createObjectURL(blob); const img = new Image(); img.src = url; await img.decode(); return img;
  }
  function canvasOf(src, max) {
    const w0 = src.width, h0 = src.height; const k = Math.min(1, max / Math.max(w0, h0));
    const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
    cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height); return cv;
  }
  const toBlob = (cv, q = 0.86) => new Promise((res) => cv.toBlob((b) => res(b), "image/jpeg", q));
  async function addMapFromBlob(blob, name, extra) {
    const bmp = await bitmapOf(blob);
    const w = bmp.width, h = bmp.height;
    let full = blob;
    if (Math.max(w, h) > 4096 || blob.size > 8e6 || !/^image\/(jpeg|png|webp)$/.test(blob.type)) full = await toBlob(canvasOf(bmp, 4096), 0.88);
    const thumb = await toBlob(canvasOf(bmp, 480), 0.72);
    const clean = String(name || "Mappa").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
    const m = Object.assign({ id: uid(), name: clean, cat: guessCat(clean), tags: "", caption: "", place: "", notes: "", w, h, marks: [], fogAll: false, thumb, created: Date.now(), updated: Date.now() }, extra || {});
    await idbPut("blobs", full, m.id); await saveMapMeta(m);
    if (bmp.close) bmp.close();
    return m;
  }

  // disegna i segni (coordinate 0..1) su un canvas; gm = nebbia semitrasparente
  function paintMarks(ctx, m, W, H, gm) {
    const marks = m.marks || []; const U = Math.min(W, H);
    const fogOn = m.fogAll || marks.some((k) => k.t === "hide");
    if (fogOn) {
      const f = document.createElement("canvas"); f.width = W; f.height = H; const g = f.getContext("2d");
      g.fillStyle = "#0b0907"; if (m.fogAll) g.fillRect(0, 0, W, H);
      g.lineCap = g.lineJoin = "round";
      marks.forEach((k) => { if (k.t !== "hide" && k.t !== "reveal") return; g.globalCompositeOperation = k.t === "reveal" ? "destination-out" : "source-over"; g.strokeStyle = "#0b0907"; g.lineWidth = k.w * U; stroke(g, k.pts, W, H); });
      ctx.save(); ctx.globalAlpha = gm ? 0.62 : 1; ctx.drawImage(f, 0, 0); ctx.restore();
    }
    ctx.lineCap = ctx.lineJoin = "round";
    marks.forEach((k) => {
      if (k.t === "pen") { ctx.strokeStyle = k.c || "#e8402a"; ctx.lineWidth = k.w * U; stroke(ctx, k.pts, W, H); }
      if (k.t === "pin") { const r = 0.03 * U; const x = k.x * W, y = k.y * H;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = k.c || "#d4583a"; ctx.fill(); ctx.lineWidth = r * 0.18; ctx.strokeStyle = "#fff"; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.round(r * 1.15)}px Georgia, serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(k.n, x, y + r * 0.05); }
    });
  }
  function stroke(g, pts, W, H) { if (!pts || !pts.length) return; g.beginPath(); g.moveTo(pts[0][0] * W, pts[0][1] * H); if (pts.length === 1) g.lineTo(pts[0][0] * W + 0.1, pts[0][1] * H); pts.forEach(([x, y]) => g.lineTo(x * W, y * H)); g.stroke(); }

  async function composeMap(m, max = 2048) {
    const blob = await idbGet("blobs", m.id); if (!blob) throw new Error("Immagine non trovata sul dispositivo");
    const bmp = await bitmapOf(blob); const cv = canvasOf(bmp, max); if (bmp.close) bmp.close();
    if ((m.marks && m.marks.length) || m.fogAll) paintMarks(cv.getContext("2d"), m, cv.width, cv.height, false);
    return toBlob(cv, 0.85);
  }

  // ---- invio (WhatsApp e altre app) con Web Share
  async function shareFile(blob, name, text) {
    const file = new File([blob], slug(name || "mappa") + ".jpg", { type: "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share(Object.assign({ files: [file], title: name }, text ? { text } : {})); if (logEv(`Mappa inviata: ${name}`)) save(); return "ok"; }
      catch (e) { if (e && e.name === "AbortError") return "abort"; if (e && e.name === "NotAllowedError") return "late"; throw e; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("Condivisione diretta non disponibile: immagine scaricata"); return "download";
  }
  // prepara il file; se ci mette troppo il gesto dell'utente scade, quindi chiede un secondo tocco
  async function sendFlow(prepare, name, text) {
    const t0 = Date.now(); toast("Preparo l'immagine…");
    let blob; try { blob = await prepare(); } catch (e) { return toast("Invio non riuscito: " + e.message); }
    const go2 = async () => { const r = await shareFile(blob, name, text); if (r === "ok") toast("Inviata"); };
    if (Date.now() - t0 < 3500) { try { const r = await shareFile(blob, name, text); if (r !== "late") { if (r === "ok") toast("Inviata"); return; } } catch (e) { return toast("Invio non riuscito: " + e.message); } }
    sendFlow.ready = go2;
    openModal("Immagine pronta", `<p class="sub">${esc(name)} · ${(blob.size / 1e6).toFixed(1)} MB</p><p>Tocca Invia e scegli WhatsApp e il gruppo.</p>`, { focus: false, extra: `<button class="btn primary big" data-a="sendReady">Invia</button>` });
  }
  const mapCaption = (m) => [m.caption].filter(Boolean).join("\n");

  // ---- vista Mappe
  function viewMaps(c, sub, id) {
    if (!mapsLoaded) { loadMaps().then(render); return `<p class="sub">Carico le mappe…</p>`; }
    const tabs = `<div class="segment"><button class="${sub !== "raccolta" && sub !== "drive" && sub !== "cerca" ? "on" : ""}" data-a="go" data-tab="mappe">Le mie${MAPS.length ? ` <span class="cnt">${MAPS.length}</span>` : ""}</button><button class="${sub === "raccolta" || sub === "drive" || sub === "cerca" ? "on" : ""}" data-a="go" data-tab="mappe" data-sub="raccolta">Raccolta</button></div>`;
    if (sub === "raccolta") return tabs + viewMapLib(c);
    if (sub === "drive") return tabs + viewDrive(c, id);
    if (sub === "cerca") return tabs + viewDriveSearch(c);
    const q = filters.mapQ.toLowerCase(); const fc = filters.mapCat;
    const scene = c.sceneMaps || [];
    const list = MAPS.filter((m) => (!fc || (fc === "__scena" ? scene.includes(m.id) : m.cat === fc)) && (!q || [m.name, m.tags, m.place, m.notes, CAT_NAME[m.cat]].join(" ").toLowerCase().includes(q)))
      .sort((a, b) => (scene.includes(b.id) - scene.includes(a.id)) || (b.created - a.created));
    const cats = MAP_CATS.filter(([k]) => MAPS.some((m) => m.cat === k));
    return `${tabs}
      <div class="sechead"><h2>Le mie mappe</h2><button class="btn small" data-a="mapAdd">+ Aggiungi</button></div>
      ${MAPS.length ? `<div class="filters"><input type="search" placeholder="Cerca per nome, tag, luogo" value="${esc(filters.mapQ)}" data-a="filter" data-k="mapQ"></div>
      <div class="chips scrollx">${[["", "Tutte"], ["__scena", `In scena (${scene.length})`]].concat(cats.map(([k, v]) => [k, v])).map(([k, v]) => `<button class="chip ${fc === k ? "on" : ""}" data-a="mapCat" data-k="${k}">${esc(v)}</button>`).join("")}</div>
      ${list.length ? `<div class="mapgrid">${list.map((m) => mapTile(c, m)).join("")}</div>` : `<p class="sub">Nessuna mappa con questo filtro.</p>`}`
      : empty("Nessuna mappa sul telefono", "Aggiungi immagini dalla galleria o dai file, oppure prendile dalla Raccolta. Restano sul telefono e funzionano anche offline.", `<div class="row gap center-row"><button class="btn" data-a="mapAdd">Aggiungi dal telefono</button><button class="btn ghost" data-a="go" data-tab="mappe" data-sub="raccolta">Apri la Raccolta</button></div>`)}`;
  }
  function mapTile(c, m) {
    const inScene = (c.sceneMaps || []).includes(m.id);
    return `<article class="maptile ${inScene ? "scene" : ""}">
      <button class="mapimg" data-a="mapOpen" data-id="${m.id}"><img src="${turl(m)}" alt="" loading="lazy">${(m.marks && m.marks.length) || m.fogAll ? `<span class="mk" title="Con segni">✎</span>` : ""}</button>
      <div class="mapmeta"><b>${esc(m.name)}</b><span class="sub">${esc(CAT_NAME[m.cat] || "Senza categoria")}${m.place ? " · " + esc(m.place) : ""}</span></div>
      <div class="row gap"><button class="btn small primary grow" data-a="mapSend" data-id="${m.id}">Invia</button><button class="icon ${inScene ? "lit" : ""}" data-a="mapScene" data-id="${m.id}" aria-label="In scena">★</button></div>
    </article>`;
  }
  function mapThumbs(c, list, empty2) {
    if (!list.length) return empty2 || "";
    return `<div class="mapstrip">${list.map((m) => `<div class="mapmini"><button class="mapimg" data-a="mapOpen" data-id="${m.id}"><img src="${turl(m)}" alt=""></button><div class="row gap"><span class="grow sub one">${esc(m.name)}</span><button class="btn small primary" data-a="mapSend" data-id="${m.id}">Invia</button></div></div>`).join("")}</div>`;
  }

  function openMap(m) {
    const c = C(); const inScene = (c.sceneMaps || []).includes(m.id);
    openModal(m.name, `<button class="mapbig" data-a="mapView" data-id="${m.id}"><img src="${turl(m)}" alt=""><span class="chip">Tocca per ingrandire e disegnare</span></button>
      <div class="sub">${esc(CAT_NAME[m.cat] || "Senza categoria")} · ${m.w}×${m.h}${m.place ? ` · luogo: ${esc(m.place)}` : ""}${m.tags ? " · " + esc(m.tags) : ""}</div>
      ${m.caption ? `<p class="notes"><span class="k">Didascalia</span> ${esc(m.caption)}</p>` : ""}${m.notes ? `<p class="notes">${rich(m.notes)}</p>` : ""}
      <div class="row gap wrap"><button class="btn small" data-a="mapScene" data-id="${m.id}">${inScene ? "★ Togli dalla scena" : "☆ Metti in scena"}</button><button class="btn small ghost" data-a="mapEdit" data-id="${m.id}">Modifica</button>${(m.marks && m.marks.length) || m.fogAll ? `<button class="btn small ghost" data-a="mapSendClean" data-id="${m.id}">Invia senza segni</button>` : ""}<button class="btn small ghost danger" data-a="mapDel" data-id="${m.id}">Elimina</button></div>`,
      { focus: false, extra: `<button class="btn primary big" data-a="mapSend" data-id="${m.id}">Invia</button>` });
  }
  function mapEditor(m) {
    const c = C(); const places = [["", "Nessuno"]].concat(c.world.filter((w) => w.kind === "luogo").map((w) => [w.name, w.name]).sort((a, b) => a[1].localeCompare(b[1])));
    openModal("Modifica mappa", `${field("Nome", "name", m.name)}
      <div class="two">${select("Categoria", "cat", m.cat, [["", "Senza categoria"]].concat(MAP_CATS.map(([k, v]) => [k, v])))}${select("Luogo del Mondo", "place", m.place, places)}</div>
      ${field("Tag", "tags", m.tags, "text", 'placeholder="notte, Ambraterra, rovine"')}
      ${field("Didascalia per il gruppo (facoltativa)", "caption", m.caption, "text", 'placeholder="Il Cinabro, poco prima dell\'alba"')}
      ${area("Note per te", "notes", m.notes, 3)}`,
      { onSave: async () => { const f = form(); Object.assign(m, { name: f.name.trim() || m.name, cat: f.cat, place: f.place, tags: f.tags, caption: f.caption.trim(), notes: f.notes }); await saveMapMeta(m); closeModal(); render(); toast("Mappa salvata"); } });
  }

  // ---- visore a tutto schermo con zoom e disegno
  const VW = { m: null, tool: "move", color: "#e8402a", pinN: 1, s: 1, x: 0, y: 0, undo: [] };
  async function openViewer(m) {
    const blob = await idbGet("blobs", m.id); if (!blob) return toast("Immagine non trovata");
    if (VW.url) URL.revokeObjectURL(VW.url);
    VW.url = URL.createObjectURL(blob); VW.m = m; VW.tool = "move"; VW.s = 1; VW.x = 0; VW.y = 0; VW.undo = [];
    VW.pinN = 1 + (m.marks || []).filter((k) => k.t === "pin").length;
    const tools = [["move", "✋", "Muovi"], ["pen", "✎", "Penna"], ["hide", "▓", "Copri"], ["reveal", "◌", "Rivela"], ["pin", "①", "Segnaposto"]];
    openModal(m.name, `<div class="stage" id="stage"><div class="layer" id="layer"><img id="vimg" src="${VW.url}" alt="" draggable="false"><canvas id="vcv"></canvas></div></div>
      <div class="vtools">${tools.map(([k, i, l]) => `<button class="vt ${k === "move" ? "on" : ""}" data-a="vTool" data-k="${k}"><b>${i}</b><span>${l}</span></button>`).join("")}</div>
      <div class="vtools two">
        <button class="vt" data-a="vFogAll"><b>◼</b><span id="fogLbl">${m.fogAll ? "Togli nebbia" : "Nebbia su tutto"}</span></button>
        <button class="vt" data-a="vColor"><b id="vcol" style="color:${VW.color}">●</b><span>Colore</span></button>
        <button class="vt" data-a="vUndo"><b>↶</b><span>Annulla</span></button>
        <button class="vt" data-a="vClear"><b>✕</b><span>Pulisci</span></button>
        <button class="vt" data-a="vFit"><b>⤢</b><span>Adatta</span></button>
      </div>
      <p class="sub center">Due dita per zoom e spostamento. La nebbia la vedi velata, i giocatori la ricevono nera.</p>`,
      { focus: false, full: true, extra: `<button class="btn primary big" data-a="mapSend" data-id="${m.id}">Invia ai giocatori</button>` });
    const img = $("#vimg"); await img.decode().catch(() => {});
    const cv = $("#vcv"); const k = Math.min(1, 2048 / Math.max(m.w, m.h)); cv.width = Math.round(m.w * k); cv.height = Math.round(m.h * k);
    vFit(); vPaint(); vBind();
  }
  function vApply() { const L = $("#layer"); if (L) L.style.transform = `translate(${VW.x}px, ${VW.y}px) scale(${VW.s})`; }
  function vFit() {
    const st = $("#stage"), img = $("#vimg"); if (!st || !img) return;
    const bw = st.clientWidth, bh = st.clientHeight; const k = Math.min(bw / VW.m.w, bh / VW.m.h);
    const L = $("#layer"); L.style.width = VW.m.w * k + "px"; L.style.height = VW.m.h * k + "px";
    VW.base = k; VW.s = 1; VW.x = (bw - VW.m.w * k) / 2; VW.y = (bh - VW.m.h * k) / 2; vApply();
  }
  function vPaint(extra) {
    const cv = $("#vcv"); if (!cv) return; const g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height);
    const m = extra ? Object.assign({}, VW.m, { marks: (VW.m.marks || []).concat([extra]) }) : VW.m;
    paintMarks(g, m, cv.width, cv.height, true);
  }
  function vBind() {
    const st = $("#stage"); const P = new Map(); let cur = null, pinch = null, pan = null;
    const pt = (e) => { const r = $("#vcv").getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
    st.addEventListener("pointerdown", (e) => {
      st.setPointerCapture(e.pointerId); P.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (P.size === 2) { cur = null; vPaint(); const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: VW.s, x: VW.x, y: VW.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; pan = null; return; }
      if (VW.tool === "move") { pan = { x: e.clientX, y: e.clientY, ox: VW.x, oy: VW.y }; return; }
      if (VW.tool === "pin") { const [x, y] = pt(e); VW.m.marks = (VW.m.marks || []).concat([{ t: "pin", x, y, n: String(VW.pinN++), c: VW.color }]); VW.undo = []; vPaint(); vSave(); return; }
      const w = VW.tool === "pen" ? 0.007 : 0.09 / VW.s;
      cur = { t: VW.tool, w, c: VW.color, pts: [pt(e)] }; vPaint(cur);
    });
    st.addEventListener("pointermove", (e) => {
      if (!P.has(e.pointerId)) return; P.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && P.size >= 2) { const [a, b] = [...P.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const s = clamp(pinch.s * d / pinch.d, 1, 8);
        const r = st.getBoundingClientRect(); const cx = pinch.cx - r.left, cy = pinch.cy - r.top; const ncx = (a.x + b.x) / 2 - r.left, ncy = (a.y + b.y) / 2 - r.top;
        VW.x = ncx - (cx - pinch.x) * s / pinch.s; VW.y = ncy - (cy - pinch.y) * s / pinch.s; VW.s = s; vApply(); return; }
      if (pan) { VW.x = pan.ox + e.clientX - pan.x; VW.y = pan.oy + e.clientY - pan.y; vApply(); return; }
      if (cur) { cur.pts.push(pt(e)); vPaint(cur); }
    });
    const up = (e) => { P.delete(e.pointerId); if (P.size < 2) pinch = null; if (!P.size) pan = null;
      if (cur && !P.size) { if (cur.pts.length) { VW.m.marks = (VW.m.marks || []).concat([cur]); VW.undo = []; vSave(); } cur = null; vPaint(); } };
    st.addEventListener("pointerup", up); st.addEventListener("pointercancel", up);
    st.addEventListener("dblclick", () => { if (VW.tool !== "move") return; if (VW.s > 1) vFit(); else { const r = st.getBoundingClientRect(); VW.s = 2.5; VW.x = r.width / 2 - (r.width / 2 - VW.x) * 2.5; VW.y = r.height / 2 - (r.height / 2 - VW.y) * 2.5; vApply(); } });
    st.addEventListener("wheel", (e) => { e.preventDefault(); const r = st.getBoundingClientRect(); const s = clamp(VW.s * (e.deltaY < 0 ? 1.15 : 0.87), 1, 8); const cx = e.clientX - r.left, cy = e.clientY - r.top; VW.x = cx - (cx - VW.x) * s / VW.s; VW.y = cy - (cy - VW.y) * s / VW.s; VW.s = s; vApply(); }, { passive: false });
  }
  let vSaveT = null;
  function vSave() { clearTimeout(vSaveT); vSaveT = setTimeout(() => saveMapMeta(VW.m).then(() => render()), 300); }

  // ---- atlante: la mappa del mondo con i luoghi della campagna
  const AT = { s: 1, x: 0, y: 0, sel: null, place: null, url: null, urlId: null, key: "", focus: null, allKinds: false };
  const atlasMap = (c) => (c.atlas && c.atlas.mapId ? mapById(c.atlas.mapId) : null);
  const plainNotes = (t, n = 170) => { const s0 = String(t || "").replace(/\[\[([^\]\n]+)\]\]/g, "$1").replace(/\s+/g, " ").trim(); return s0.length > n ? s0.slice(0, n).replace(/\s\S*$/, "") + "…" : s0; };
  function atlasLinks(c, w) {
    const out = []; const seen = new Set(); const add = (kind, id, name, r) => { const k = kind + ":" + id; if (seen.has(k) || (kind === "world" && id === w.id)) return; seen.add(k); out.push({ kind, id, name, r: r || "" }); };
    (w.rels || []).forEach((r) => { const n = entLabel(r.kind, r.id); if (n) add(r.kind, r.id, n, r.r); });
    [["pc", c.pcs], ["world", c.world]].forEach(([k, arr]) => arr.forEach((y) => (y.rels || []).forEach((r) => { if (r.kind === "world" && r.id === w.id) add(k, y.id, y.name, r.r); })));
    mentionsIn(w.notes).forEach((key) => { const [kind, id] = key.split(":"); const n = entLabel(kind, id); if (n) add(kind, id, n, ""); });
    backlinksOf("world", w.id).forEach((b) => add(b.kind, b.id, b.name, ""));
    return out;
  }
  const pinHtml = (w, p) => `<button class="apin k-${w.kind} ${AT.sel === w.id ? "on" : ""}" data-pin="${w.id}" style="left:${(p[0] * 100).toFixed(3)}%;top:${(p[1] * 100).toFixed(3)}%"><i></i><span>${esc(bareName(w.name))}</span></button>`;
  function atlasInfo(c) {
    const w = AT.sel && c.world.find((x) => x.id === AT.sel);
    if (!w) return `<p class="sub center">Tocca un luogo sulla mappa per vedere chi e cosa è collegato.</p>`;
    const pins = (c.atlas && c.atlas.pins) || {};
    const links = atlasLinks(c, w);
    const ms = MAPS.filter((m) => (m.place || "").toLowerCase() === w.name.toLowerCase() && m.id !== c.atlas.mapId);
    return `<article class="card atinfo"><header class="row between"><div><h3>${esc(w.name)}</h3><div class="sub">${WORLD_ONE[w.kind] || ""}${w.subtitle ? " · " + esc(w.subtitle) : ""}</div></div><button class="btn small" data-a="viewWorld" data-id="${w.id}">Scheda</button></header>
      ${w.notes ? `<p class="sub">${esc(plainNotes(w.notes))}</p>` : ""}
      ${links.length ? `<h4>Collegati</h4><div class="chips">${links.map((o) => `<button class="chip ${o.kind === "world" && pins[o.id] ? "onmap" : ""}" data-a="atlasGo" data-kind="${o.kind}" data-id="${o.id}">${o.r ? `<i>${esc(o.r)}</i> ` : ""}${esc(o.name)}</button>`).join("")}</div>` : `<p class="sub">Ancora nessun collegamento. Aggiungi un Legame dalla scheda, o nomina il luogo negli appunti di PNG e sessioni.</p>`}
      ${ms.length ? `<h4>Mappe del luogo</h4><div class="chips">${ms.map((m) => `<button class="chip" data-a="mapView" data-id="${m.id}">🗺 ${esc(m.name)}</button>`).join("")}</div>` : ""}
      <div class="row gap wrap"><button class="btn small ghost" data-a="atlasPlace" data-id="${w.id}">Sposta</button><button class="btn small ghost" data-a="atlasUnpin" data-id="${w.id}">Togli dalla mappa</button></div></article>`;
  }
  function viewAtlas(c) {
    const head = `<div class="sechead"><h2>Mappa del mondo</h2><button class="btn small ghost" data-a="go" data-tab="mondo">☰ Elenco</button></div>`;
    if (!mapsLoaded) { loadMaps().then(render); return head + `<p class="sub center">Carico la mappa…</p>`; }
    const at = c.atlas; const m = atlasMap(c);
    if (!m) return head + `<section class="empty"><h3>${at && at.mapId ? "Immagine non trovata" : "La mappa della campagna"}</h3><p>${at && at.mapId
      ? "L'immagine della mappa non è su questo telefono: i backup salvano i luoghi ma non le immagini. Caricala di nuovo e i luoghi tornano dove li avevi messi."
      : "Carica la mappa dell'ambientazione, anche una foto, e appoggiaci sopra i luoghi del Mondo. Toccando un luogo vedi chi e cosa vi è collegato."}</p>
      <div class="row gap center-row"><button class="btn primary" data-a="atlasUpload">Carica un'immagine</button>${MAPS.length ? `<button class="btn" data-a="atlasPickMap">Scegli dalle mie mappe</button>` : ""}</div></section>`;
    const pins = at.pins || {};
    const placed = c.world.filter((w) => pins[w.id]);
    const todo = c.world.filter((w) => !pins[w.id] && (AT.allKinds || w.kind === "luogo")).sort((a, b) => bareName(a.name).localeCompare(bareName(b.name)));
    const pw = AT.place && c.world.find((x) => x.id === AT.place);
    return head + `<div class="stage at ${pw ? "placing" : ""}" id="atStage"><div class="layer" id="atLayer"><img id="atImg" src="${AT.urlId === m.id ? AT.url : ""}" alt="" draggable="false"><svg id="atLines" viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg>${placed.map((w) => pinHtml(w, pins[w.id])).join("")}</div>
        <button class="atfit" data-a="atlasFit" title="Adatta">⤢</button></div>
      ${pw ? `<div class="placebar"><span>Tocca la mappa dove si trova <b>${esc(pw.name)}</b></span><button class="btn small ghost" data-a="atlasCancel">Annulla</button></div>` : ""}
      <div id="atInfo">${atlasInfo(c)}</div>
      <div class="sechead"><h3>Da mettere sulla mappa</h3><button class="btn small ghost" data-a="atlasNewPlace">+ Luogo</button></div>
      ${todo.length ? `<div class="chips">${todo.map((w) => `<button class="chip ${AT.place === w.id ? "on" : ""}" data-a="atlasPlace" data-id="${w.id}">${esc(w.name)}</button>`).join("")}</div>` : `<p class="sub">${placed.length ? "Tutti i luoghi sono sulla mappa." : "Nessun luogo nel Mondo: creane uno con «+ Luogo»."}</p>`}
      <label class="chk"><input type="checkbox" data-a="atlasKinds" ${AT.allKinds ? "checked" : ""}> Mostra anche PNG, fazioni, oggetti e lore</label>
      <details class="logdet"><summary>Immagine della mappa</summary><div class="row gap wrap">
        <button class="btn small" data-a="mapView" data-id="${m.id}">Apri e invia ai giocatori</button>
        <button class="btn small ghost" data-a="atlasUpload">Cambia immagine</button>
        <button class="btn small ghost" data-a="atlasRemove">Togli la mappa</button></div>
        <p class="sub">Inviando la mappa i segnaposto dei luoghi non compaiono: decidi tu cosa mostrare con penna e nebbia.</p></details>`;
  }
  function atlasApply() {
    const L = $("#atLayer"); if (!L) return;
    L.style.transform = `translate(${AT.x}px, ${AT.y}px) scale(${AT.s})`; L.style.setProperty("--inv", (1 / AT.s).toFixed(4));
  }
  function atlasFit() {
    const c = C(); const m = atlasMap(c); const st = $("#atStage"); if (!m || !st) return;
    const bw = st.clientWidth; const bh = Math.round(Math.min(window.innerHeight * 0.62, bw * m.h / m.w)); st.style.height = bh + "px";
    const k = Math.min(bw / m.w, bh / m.h); const L = $("#atLayer"); L.style.width = m.w * k + "px"; L.style.height = m.h * k + "px";
    AT.lw = m.w * k; AT.lh = m.h * k; AT.bw = bw; AT.bh = bh; AT.s = 1; AT.x = (bw - AT.lw) / 2; AT.y = (bh - AT.lh) / 2; atlasApply();
  }
  function atlasLines() {
    const svg = $("#atLines"); if (!svg) return; const c = C(); const pins = (c.atlas && c.atlas.pins) || {};
    const w = AT.sel && c.world.find((x) => x.id === AT.sel); const p0 = w && pins[w.id];
    $$("#atLayer .apin").forEach((b) => { b.classList.toggle("on", b.dataset.pin === AT.sel); b.classList.remove("rel"); });
    if (!p0) { svg.innerHTML = ""; return; }
    const ends = atlasLinks(c, w).filter((o) => o.kind === "world" && pins[o.id]);
    ends.forEach((o) => { const b = $(`#atLayer .apin[data-pin="${o.id}"]`); if (b) b.classList.add("rel"); });
    svg.innerHTML = ends.map((o) => { const p = pins[o.id]; return `<line x1="${p0[0] * 1000}" y1="${p0[1] * 1000}" x2="${p[0] * 1000}" y2="${p[1] * 1000}" vector-effect="non-scaling-stroke"/>`; }).join("");
  }
  function atlasSelect(id) {
    AT.sel = id; const box = $("#atInfo"); if (box) box.innerHTML = atlasInfo(C()); atlasLines();
  }
  function atlasCenter(id) {
    const c = C(); const p = c.atlas && c.atlas.pins && c.atlas.pins[id]; if (!p || !AT.lw) return;
    const s = Math.max(AT.s, 2.2); AT.s = s; AT.x = AT.bw / 2 - p[0] * AT.lw * s; AT.y = AT.bh / 2 - p[1] * AT.lh * s; atlasApply();
  }
  function atlasMount() {
    const c = C(); const m = atlasMap(c); const st = $("#atStage"); if (!m || !st) return;
    const img = $("#atImg");
    if (AT.urlId !== m.id) idbGet("blobs", m.id).then((b) => { if (!b) return; if (AT.url) URL.revokeObjectURL(AT.url); AT.url = URL.createObjectURL(b); AT.urlId = m.id; const i = $("#atImg"); if (i) i.src = AT.url; });
    const key = m.id + "|" + st.clientWidth;
    if (AT.key !== key) { AT.key = key; atlasFit(); }
    else { const L = $("#atLayer"); st.style.height = AT.bh + "px"; L.style.width = AT.lw + "px"; L.style.height = AT.lh + "px"; atlasApply(); }
    if (AT.focus) { AT.sel = AT.focus; atlasCenter(AT.focus); AT.focus = null; const box = $("#atInfo"); if (box) box.innerHTML = atlasInfo(c); setTimeout(() => window.scrollTo(0, 0), 80); }
    atlasLines(); void img;
    const P = new Map(); let pinch = null, pan = null, down = null;
    st.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".atfit")) return;
      st.setPointerCapture(e.pointerId); P.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: AT.s, x: AT.x, y: AT.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; pan = null; down = null; return; }
      pan = { x: e.clientX, y: e.clientY, ox: AT.x, oy: AT.y }; down = { x: e.clientX, y: e.clientY, t: Date.now(), el: e.target };
    });
    st.addEventListener("pointermove", (e) => {
      if (!P.has(e.pointerId)) return; P.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && P.size >= 2) { const [a, b] = [...P.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const s = clamp(pinch.s * d / pinch.d, 1, 10);
        const r = st.getBoundingClientRect(); const cx = pinch.cx - r.left, cy = pinch.cy - r.top; const ncx = (a.x + b.x) / 2 - r.left, ncy = (a.y + b.y) / 2 - r.top;
        AT.x = ncx - (cx - pinch.x) * s / pinch.s; AT.y = ncy - (cy - pinch.y) * s / pinch.s; AT.s = s; atlasApply(); return; }
      if (pan) { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down = null; AT.x = pan.ox + e.clientX - pan.x; AT.y = pan.oy + e.clientY - pan.y; atlasApply(); }
    });
    const up = (e) => {
      const tap = down && P.size === 1 && Date.now() - down.t < 600 ? down : null;
      P.delete(e.pointerId); if (P.size < 2) pinch = null; if (!P.size) pan = null; down = null;
      if (!tap) return;
      const pinEl = tap.el.closest && tap.el.closest(".apin");
      if (AT.place) {
        const r = $("#atImg").getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) return;
        const id = AT.place; const cc = C(); cc.atlas.pins = cc.atlas.pins || {}; cc.atlas.pins[id] = [+x.toFixed(4), +y.toFixed(4)];
        AT.place = null; AT.sel = id; save(); render(); return;
      }
      if (pinEl) atlasSelect(pinEl.dataset.pin === AT.sel ? null : pinEl.dataset.pin); else if (AT.sel) atlasSelect(null);
    };
    st.addEventListener("pointerup", up); st.addEventListener("pointercancel", (e) => { down = null; up(e); });
    st.addEventListener("wheel", (e) => { e.preventDefault(); const r = st.getBoundingClientRect(); const s = clamp(AT.s * (e.deltaY < 0 ? 1.15 : 0.87), 1, 10); const cx = e.clientX - r.left, cy = e.clientY - r.top; AT.x = cx - (cx - AT.x) * s / AT.s; AT.y = cy - (cy - AT.y) * s / AT.s; AT.s = s; atlasApply(); }, { passive: false });
  }
  async function atlasSetImage(c, blob, name) {
    const m = await addMapFromBlob(blob, name || "Mappa del mondo", { cat: "regione", caption: "Mappa del mondo" });
    c.atlas = { mapId: m.id, pins: (c.atlas && c.atlas.pins) || {} }; AT.key = ""; save(); return m;
  }
  // pacchetto con mappa: { atlas: { name, image: "data:image/jpeg;base64,…", pins: [{ name, aliases, x, y, subtitle }] } }
  async function importAtlas(c, A0) {
    const blob = await (await fetch(A0.image)).blob();
    await atlasSetImage(c, blob, A0.name);
    const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(?:(?:il|lo|la|i|gli|le|un|una|uno)\s+|l['’]\s*)/, "").replace(/[^a-z0-9]+/g, " ").trim();
    let made = 0, put = 0;
    (A0.pins || []).forEach((p) => {
      const keys = [p.name].concat(p.aliases || []).map(norm);
      let w = c.world.find((x) => [x.name].concat(String(x.aliases || "").split(",")).some((n) => keys.includes(norm(n))));
      if (!w) { w = { id: uid(), kind: p.kind || "luogo", name: p.name, subtitle: p.subtitle || "", tags: "", notes: p.notes || "", review: { src: "manuale", q: "Segnato sulla mappa del manuale: tienilo, completalo o eliminalo." } }; c.world.push(w); made++; }
      if (!c.atlas.pins[w.id]) { c.atlas.pins[w.id] = [p.x, p.y]; put++; }
    });
    save(); return { made, put };
  }

  // ---- raccolta (link del PDF + Google Drive)
  const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
  const lib = () => S.settings.mapLib || null;
  const driveKey = () => (S.settings.driveKey || "").trim();
  const driveThumb = (id, w = 400) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}`;
  const driveFolderUrl = (id) => `https://drive.google.com/drive/folders/${id}`;
  const DRV = { cache: {}, names: {}, idx: null, indexing: null };
  async function driveList(folderId) {
    if (DRV.cache[folderId]) return DRV.cache[folderId];
    const out = []; let token = "";
    do {
      const u = `${DRIVE_API}?q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&pageSize=1000&orderBy=folder,name&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=${encodeURIComponent("nextPageToken,files(id,name,mimeType,size,thumbnailLink)")}&key=${encodeURIComponent(driveKey())}${token ? "&pageToken=" + encodeURIComponent(token) : ""}`;
      const r = await fetch(u); const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j.error && j.error.message) || "Drive ha risposto " + r.status);
      (j.files || []).forEach((f) => out.push(f)); token = j.nextPageToken || "";
    } while (token);
    DRV.cache[folderId] = out; out.forEach((f) => { DRV.names[f.id] = f.name; });
    return out;
  }
  async function driveBlob(id) {
    const r = await fetch(`${DRIVE_API}/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(driveKey())}`);
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j.error && j.error.message) || "Download non riuscito (" + r.status + ")"); }
    return r.blob();
  }
  async function driveShareBlob(id) { const b = await driveBlob(id); const bmp = await bitmapOf(b); const cv = canvasOf(bmp, 2048); if (bmp.close) bmp.close(); return toBlob(cv, 0.85); }
  const isImg = (f) => /^image\//.test(f.mimeType || "");
  const isFolder = (f) => f.mimeType === "application/vnd.google-apps.folder";

  function viewMapLib(c) {
    const L = lib(); const key = driveKey(); const info = S.settings.mapIndexInfo;
    if (!L) return `<div class="card"><h2>Collega la tua raccolta</h2>
      <p>Importa il file <b>mappe-raccolta.json</b> (menu della campagna → Importa backup): contiene le 15 categorie del tuo pacchetto da 12.500 mappe, con i link alle cartelle Drive.</p>
      <p class="sub">I link restano solo sul tuo telefono, non finiscono nel sito pubblico. Puoi anche aggiungere una cartella Drive a mano.</p>
      <div class="row gap wrap"><button class="btn" data-a="importFile">Importa il file</button><button class="btn ghost" data-a="libAddFolder">Aggiungi una cartella Drive</button></div></div>`;
    const folders = (L.folders || []);
    return `${key ? `<div class="card">
        <div class="searchrow"><input type="search" id="drvQ" placeholder="Cerca in tutta la raccolta: palude, taverna, cripta…" value="${esc(filters.drvQ)}" ${info ? "" : "disabled"}><button class="btn small" data-a="drvSearch" ${info ? "" : "disabled"}>Cerca</button></div>
        <p class="sub">${info ? `Indice: ${info.count.toLocaleString("it-IT")} mappe in ${info.folders} cartelle, aggiornato il ${new Date(info.date).toLocaleDateString("it-IT")}. <button class="linkbtn" data-a="drvIndex">Aggiorna</button>` : `Per cercare in tutte le cartelle con parole italiane, crea prima l'indice (una volta sola, un paio di minuti). <button class="btn small" data-a="drvIndex">Crea l'indice</button>`}</p>
        <div id="idxProg" class="sub"></div></div>` : `<div class="card warnbox"><b>Per sfogliare e inviare le mappe senza uscire dall'app</b><p class="sub">Aggiungi una chiave API di Google Drive, gratuita (istruzioni nel file LEGGIMI). Senza chiave, le categorie si aprono nell'app Drive: da lì puoi condividere su WhatsApp, oppure condividere l'immagine con Lanterna per salvarla qui.</p><button class="btn small" data-a="drvKey">Inserisci la chiave API</button></div>`}
      <div class="sechead"><h2>${esc(L.name || "Raccolta")}</h2>${key ? `<button class="btn small ghost" data-a="drvKey">Chiave API</button>` : ""}</div>
      <div class="list">${folders.map((f) => `<div class="listrow"><button class="grow textleft" data-a="${key ? "drvOpen" : "extOpen"}" data-id="${esc(f.id)}" data-url="${esc(driveFolderUrl(f.id))}"><b>${esc(f.it || f.name)}</b><div class="sub">${esc(f.name)}${f.cat ? " · " + esc(CAT_NAME[f.cat] || "") : ""}</div></button><a class="icon" href="${esc(driveFolderUrl(f.id))}" target="_blank" rel="noopener" aria-label="Apri in Drive">↗</a></div>`).join("")}</div>
      <div class="row gap wrap">${L.rootId && key ? `<button class="btn ghost" data-a="drvOpen" data-id="${esc(L.rootId)}">Sfoglia il pacchetto completo</button>` : ""}${L.restId && key ? `<button class="btn ghost" data-a="drvOpen" data-id="${esc(L.restId)}">Sfoglia le altre categorie</button>` : ""}${L.rootId ? `<a class="btn ghost" href="${esc(driveFolderUrl(L.rootId))}" target="_blank" rel="noopener">Tutto il pacchetto su Drive ↗</a>` : ""}${L.restId ? `<a class="btn ghost" href="${esc(driveFolderUrl(L.restId))}" target="_blank" rel="noopener">Altre categorie ↗</a>` : ""}${L.gridsId ? `<a class="btn ghost" href="${esc(driveFolderUrl(L.gridsId))}" target="_blank" rel="noopener">Griglie ↗</a>` : ""}</div>
      <div class="row gap wrap"><button class="btn small ghost" data-a="libAddFolder">+ Cartella Drive</button><button class="btn small ghost danger" data-a="libRemove">Scollega la raccolta</button></div>`;
  }

  function driveGrid(files) {
    return `<div class="mapgrid">${files.map((f) => `<article class="maptile">
        <button class="mapimg" data-a="drvPreview" data-id="${esc(f.id)}"><img src="${esc(driveThumb(f.id))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;${f.thumbnailLink ? `this.src='${esc(f.thumbnailLink)}'` : "this.classList.add('broken')"}"></button>
        <div class="mapmeta"><b>${esc(f.name.replace(/\.[a-z0-9]{2,5}$/i, ""))}</b>${f.path ? `<span class="sub one">${esc(f.path)}</span>` : ""}</div>
        <div class="row gap"><button class="btn small primary grow" data-a="drvSend" data-id="${esc(f.id)}">Invia</button><button class="icon" data-a="drvSave" data-id="${esc(f.id)}" aria-label="Salva nelle mie">⤓</button></div>
      </article>`).join("")}</div>`;
  }
  function viewDrive(c, id) {
    if (!driveKey()) return viewMapLib(c);
    const st = DRV.cache[id];
    if (!st) { driveList(id).then(render).catch((e) => { DRV.err = e.message; render(); }); return `<p class="sub">${DRV.err ? "Errore: " + esc(DRV.err) : "Carico la cartella da Drive…"}</p>${DRV.err ? `<button class="btn" data-a="drvRetry" data-id="${esc(id)}">Riprova</button>` : ""}`; }
    DRV.err = null;
    const q = filters.drvQ2.toLowerCase(); const grid = filters.drvGrid;
    const folders = st.filter(isFolder); const imgs = st.filter(isImg).filter((f) => (!q || f.name.toLowerCase().includes(q)) && (grid || !isGridded(f.name)));
    const hiddenGrid = st.filter(isImg).filter((f) => isGridded(f.name)).length;
    const shown = imgs.slice(0, filters.drvLimit);
    return `<div class="row gap wrap buildertop"><button class="chip" data-a="drvBack">‹</button><h2 class="grow one">${esc(DRV.names[id] || (lib().folders.find((f) => f.id === id) || {}).it || "Cartella")}</h2><a class="icon" href="${esc(driveFolderUrl(id))}" target="_blank" rel="noopener">↗</a></div>
      ${folders.length ? `<div class="chips">${folders.map((f) => `<button class="chip" data-a="drvOpen" data-id="${esc(f.id)}">📁 ${esc(f.name)}</button>`).join("")}</div>` : ""}
      ${st.filter(isImg).length ? `<div class="filters"><input type="search" placeholder="Filtra in questa cartella" value="${esc(filters.drvQ2)}" data-a="filter" data-k="drvQ2"></div>
      <div class="chips">${hiddenGrid ? `<button class="chip ${grid ? "on" : ""}" data-a="drvGrid">${grid ? "Griglia: mostrate" : `Griglia: nascoste (${hiddenGrid})`}</button>` : ""}<span class="sub">${imgs.length} immagini</span></div>
      ${driveGrid(shown)}${imgs.length > shown.length ? `<button class="btn ghost" data-a="drvMore">Mostra altre ${Math.min(60, imgs.length - shown.length)}</button>` : ""}` : (folders.length ? "" : `<p class="sub">Cartella vuota.</p>`)}`;
  }

  async function buildIndex() {
    const L = lib(); if (!L) return;
    const roots = L.folders.map((f) => ({ id: f.id, path: f.it || f.name }));
    if (L.restId) roots.push({ id: L.restId, path: "Altre categorie" }); if (L.rootId) roots.push({ id: L.rootId, path: "Pacchetto completo" });
    const seen = new Set(); const dup = new Set(); const items = []; let nf = 0; const queue = roots.slice();
    const prog = (t) => { const el = $("#idxProg"); if (el) el.textContent = t; };
    DRV.indexing = true;
    try {
      while (queue.length) {
        const f = queue.shift(); if (seen.has(f.id)) continue; seen.add(f.id); nf++;
        prog(`Indicizzo: ${nf} cartelle, ${items.length.toLocaleString("it-IT")} mappe… (${f.path})`);
        const list = await driveList(f.id);
        list.forEach((x) => { if (isFolder(x)) queue.push({ id: x.id, path: f.path + " / " + x.name }); else if (isImg(x) && !dup.has(x.name + "|" + (x.size || "")) && dup.add(x.name + "|" + (x.size || ""))) items.push({ id: x.id, name: x.name, path: f.path, thumbnailLink: x.thumbnailLink || "", cat: guessCat(x.name + " " + f.path) }); });
      }
      await idbClear("index"); for (let i = 0; i < items.length; i += 2000) await idbPutMany("index", items.slice(i, i + 2000));
      DRV.idx = items; S.settings.mapIndexInfo = { count: items.length, folders: nf, date: Date.now() }; save();
      toast(`Indice pronto: ${items.length.toLocaleString("it-IT")} mappe`);
    } catch (e) { toast("Indice interrotto: " + e.message); }
    DRV.indexing = false; render();
  }
  function expandQuery(q) {
    return q.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 1).map((w) => {
      const alt = new Set([w]); (IT_EN[w] || "").split(" ").filter(Boolean).forEach((x) => alt.add(x));
      if (w.endsWith("e") || w.endsWith("i")) { const sg = IT_EN[w.slice(0, -1) + "a"] || IT_EN[w.slice(0, -1) + "o"]; if (sg) sg.split(" ").forEach((x) => alt.add(x)); }
      return [...alt];
    });
  }
  function viewDriveSearch(c) {
    if (!DRV.idx) { idbAll("index").then((a) => { DRV.idx = a || []; render(); }); return `<p class="sub">Apro l'indice…</p>`; }
    const groups = expandQuery(filters.drvQ); const fc = filters.drvCat; const grid = filters.drvGrid;
    const hits = DRV.idx.filter((x) => { const t = (x.name + " " + x.path).toLowerCase(); return groups.every((g) => g.some((w) => t.includes(w))) && (!fc || x.cat === fc) && (grid || !isGridded(x.name)); });
    const cats = MAP_CATS.filter(([k]) => hits.some((x) => x.cat === k) || fc === k);
    return `<div class="row gap wrap buildertop"><button class="chip" data-a="go" data-tab="mappe" data-sub="raccolta">‹</button><div class="searchrow grow"><input type="search" id="drvQ" value="${esc(filters.drvQ)}" placeholder="palude, taverna notte…"><button class="btn small" data-a="drvSearch">Cerca</button></div></div>
      <p class="sub">${hits.length.toLocaleString("it-IT")} risultati${groups.length ? ` · cerco anche: ${esc(groups.map((g) => g.slice(1).join("/")).filter(Boolean).join(", ") || "—")}` : ""}</p>
      <div class="chips scrollx"><button class="chip ${grid ? "on" : ""}" data-a="drvGrid">${grid ? "Griglia: mostrate" : "Griglia: nascoste"}</button>${[["", "Tutte"]].concat(cats.map(([k, v]) => [k, v])).map(([k, v]) => `<button class="chip ${fc === k ? "on" : ""}" data-a="drvCat" data-k="${k}">${esc(v)}</button>`).join("")}</div>
      ${driveGrid(hits.slice(0, filters.drvLimit))}${hits.length > filters.drvLimit ? `<button class="btn ghost" data-a="drvMore">Mostra altre</button>` : ""}`;
  }

  async function processInbox() {
    let items = []; try { items = await tx("inbox", "readonly", (st) => st.getAll()); } catch (_) { return; }
    if (!items || !items.length) return;
    await idbClear("inbox"); let n = 0;
    for (const it of items) { try { await addMapFromBlob(it.file, it.name || "Mappa condivisa", it.text ? { caption: "" , notes: it.text } : null); n++; } catch (e) { console.error(e); } }
    if (n) { filters.mapCat = ""; go("mappe"); render(); toast(n === 1 ? "Mappa ricevuta e salvata" : `${n} mappe ricevute e salvate`); }
  }

  // ---------------------------------------------------------------- sessione dal vivo
  const NOTE_TAGS = [["", "Nota"], ["ricorda", "Da ricordare"], ["png", "PNG"], ["promessa", "Promessa o debito"], ["indizio", "Indizio"], ["oggetto", "Oggetto"], ["domanda", "Domanda aperta"], ["segreto", "Segreto (solo GM)"]];
  const TAG_LABEL = Object.fromEntries(NOTE_TAGS);
  let noteTagSel = "";
  const liveSession = (c) => { c = c || C(); return c && c.live ? c.sessions.find((s) => s.id === c.live.sid) : null; };
  const hhmm = (t) => new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const dur = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`; };
  const shortDur = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };

  function logEv(txt, opts = {}) {
    const c = C(); const s = liveSession(c); if (!s) return null;
    s.log = s.log || []; const now = Date.now(); const last = s.log[s.log.length - 1];
    if (opts.key && last && last.key === opts.key && now - last.t < (opts.window || 120000)) { last.txt = txt; last.t2 = now; return last; }
    const e = { id: uid(), t: now, k: opts.k || "auto", txt, key: opts.key || "", tag: opts.tag || "" };
    s.log.push(e); return e;
  }

  // fotografia dello stato prima di un'azione, per scrivere da solo il diario
  function liveSnap() {
    const c = C(); if (!liveSession(c)) return null;
    return { fear: c.fear, enc: c.combat.encId || null, nUnits: c.combat.units.length,
      pcs: Object.fromEntries(c.pcs.map((p) => [p.id, { hp: num(p.hp), st: num(p.stress), hope: num(p.hope) }])),
      clocks: Object.fromEntries(c.clocks.map((k) => [k.id, num(k.value)])),
      units: Object.fromEntries(c.combat.units.map((u) => [u.uid, u.minion ? { n: u.count } : { hp: num(u.hp) }])) };
  }
  function liveDiff(b) {
    if (!b) return; const c = C(); const s = liveSession(c); if (!s) return; let changed = false;
    const L = (txt, o) => { if (logEv(txt, o)) changed = true; };
    if (c.fear !== b.fear) { const last = (s.log || [])[s.log.length - 1]; const from = last && last.key === "fear" && Date.now() - last.t < 180000 ? last.from : b.fear;
      const e = logEv(`Paura ${from} → ${c.fear}`, { key: "fear", window: 180000 }); if (e) { e.from = from; changed = true; } }
    c.pcs.forEach((p) => { const o = b.pcs[p.id]; if (!o) return;
      const hp = num(p.hp), mx = num(p.hpMax, 6);
      if (hp > o.hp && hp >= mx) L(`${p.name} ha segnato l'ultimo PF: mossa della morte`, { k: "imp" });
      else if (hp !== o.hp) { const last = s.log && s.log[s.log.length - 1]; const from = last && last.key === "hp" + p.id && Date.now() - last.t < 90000 ? last.from : o.hp; const e = logEv(`${p.name}: PF ${from} → ${hp}/${mx}`, { key: "hp" + p.id, window: 90000 }); if (e) { e.from = from; changed = true; } }
      if (num(p.stress) > o.st && num(p.stress) >= num(p.stressMax, 6)) L(`${p.name} ha lo Stress al massimo`, { k: "imp" });
    });
    c.clocks.forEach((k) => { const o = b.clocks[k.id]; if (o === undefined) return; const v = num(k.value);
      if (v !== o) { if (v >= num(k.max) && o < num(k.max)) L(`«${k.name}» si è innescato`, { k: "imp" }); else L(`Conto «${k.name}»: ${v}/${k.max}`, { key: "clk" + k.id, window: 180000 }); } });
    c.combat.units.forEach((u) => { const o = b.units[u.uid]; if (!o) return;
      if (u.minion ? (o.n > 0 && u.count <= 0) : (o.hp < num(u.hpMax) && num(u.hp) >= num(u.hpMax))) L(`Sconfitto: ${u.name}`); });
    const encName = (id) => (encOf(c, id) || {}).name || "scontro";
    if (c.combat.encId && c.combat.encId !== b.enc) L(`Scontro iniziato: ${encName(c.combat.encId)}`, { k: "imp" });
    if (b.enc && !c.combat.encId) L(`Scontro terminato: ${encName(b.enc)}`, { k: "imp" });
    else if (!b.enc && !c.combat.encId && b.nUnits && !c.combat.units.length) L("Scontro terminato");
    if (changed) { save(); updateLiveUI(); if (route().tab === "diario" && route().sub === "live") render(); }
  }

  function updateLiveUI() {
    const c = C(); const s = liveSession(c);
    const pill = $("#liveBtn"), nb = $("#noteBtn"); if (!pill) return;
    pill.hidden = nb.hidden = !s; document.body.classList.toggle("is-live", !!s);
    if (s) pill.querySelector("b").textContent = shortDur(Date.now() - s.startedAt);
  }
  setInterval(updateLiveUI, 20000);

  function spotInfo(c, s) {
    const now = Date.now(); const sp = s.spot || {};
    return c.pcs.map((p) => { const arr = sp[p.id] || []; const last = arr.length ? arr[arr.length - 1] : s.startedAt; return { p, n: arr.length, since: now - last }; })
      .sort((a, b) => b.since - a.since);
  }

  function viewLive(c) {
    const s = liveSession(c);
    if (!s) return `<div class="card"><h2>Nessuna sessione in corso</h2><p class="sub">Avvia la sessione dal Diario: da quel momento l'app scrive da sola il diario della serata.</p><button class="btn primary" data-a="liveStart">Inizia la sessione</button></div>`;
    const log = (s.log || []).slice().reverse();
    const sp = spotInfo(c, s);
    const pe = planOf(s).encIds; const ready = c.encounters.filter((e) => (e.status === "pronto" || pe.includes(e.id)) && e.status !== "giocato" && c.combat.encId !== e.id).sort((a, b) => pe.includes(b.id) - pe.includes(a.id));
    const running = c.combat.encId ? encOf(c, c.combat.encId) : null;
    const scene = (c.sceneMaps || []).map(mapById).filter(Boolean);
    const hot = c.clocks.filter((k) => !k.encId || true).filter((k) => num(k.value) >= num(k.max) - 1 && num(k.value) < num(k.max));
    return `<section class="card live">
        <div class="row between"><div class="grow"><div class="k"><span class="recdot"></span> In corso da ${dur(Date.now() - s.startedAt)}</div><h2>${s.num ? "#" + esc(s.num) + " · " : ""}${esc(s.title || "Sessione")}</h2></div><button class="btn small ghost" data-a="liveEnd">Termina</button></div>
        <div class="noterow"><textarea id="liveNote" rows="2" placeholder="Nota veloce: cosa è successo, chi ha promesso cosa…"></textarea>
          <div class="row gap wrap"><div class="chips tight">${NOTE_TAGS.map(([k, v]) => `<button class="chip small ${k === (noteTagSel) ? "on" : ""}" data-a="noteTag" data-k="${k}">${v}</button>`).join("")}</div></div>
          <div class="row gap">${SpeechRec ? `<button class="btn ghost mic" data-a="dictate" data-for="liveNote" aria-label="Detta">🎤 Detta</button>` : ""}<button class="btn primary grow" data-a="noteAdd">Aggiungi al diario</button></div></div>
      </section>
      ${c.pcs.length ? `<section class="card"><div class="row between"><h2>Riflettori</h2><span class="sub">tocca chi è al centro della scena</span></div>
        <div class="spotgrid">${sp.map(({ p, n, since }) => `<button class="spotpc ${since > 30 * 60000 ? "cold" : since < 5 * 60000 && n ? "hot" : ""}" data-a="spotPc" data-id="${p.id}"><b>${esc(p.name.split(" ")[0])}</b><span>${n ? `${n}× · ${dur(since)} fa` : since > 60000 ? `non ancora · ${dur(since)}` : "non ancora"}</span></button>`).join("")}</div>
        ${sp[0] && sp[0].since > 30 * 60000 ? `<p class="sub">Da un po' non tocca a <b>${esc(sp[0].p.name.split(" ")[0])}</b>: dagli la scena.</p>` : ""}</section>` : ""}
      ${running ? `<section class="card"><div class="row between"><div><div class="k">Scontro in corso</div><h3>${esc(running.name)}</h3></div><button class="btn small" data-a="go" data-tab="scontro">Apri</button></div></section>` : ""}
      ${ready.length ? `<section class="card"><h2>Scontri pronti</h2><ul class="planlist">${ready.map((e) => `<li><div class="grow"><b>${esc(e.name)}</b>${e.objective ? `<div class="sub">${esc(e.objective)}</div>` : ""}</div><button class="btn small primary" data-a="encStart" data-id="${e.id}">Avvia</button></li>`).join("")}</ul></section>` : ""}
      ${scene.length ? `<section class="card"><h2>Mappe in scena</h2>${mapThumbs(c, scene)}</section>` : ""}
      ${hot.length ? `<section class="card"><h2>Conti alla rovescia vicini</h2>${hot.map((k) => `<div class="row between"><span><b>${esc(k.name)}</b> <span class="sub">${k.value}/${k.max}</span></span><button class="btn small" data-a="clockAdd" data-id="${k.id}" data-d="1">Avanza</button></div>`).join("")}</section>` : ""}
      ${(() => { const pb = planBlock(c, s, true); return pb ? `<details class="card" open><summary><h2 class="inline">Scaletta</h2></summary>${pb}</details>` : ""; })()}
      <section class="card"><div class="row between"><h2>Diario della serata</h2><span class="sub">${log.length} voci</span></div>
        ${log.length ? `<ul class="livelog">${log.map((e) => logLine(e, s)).join("")}</ul>` : `<p class="sub">Qui compare da solo quello che fai nell'app: Paura, danni ai PG, scontri, avversari sconfitti, conti alla rovescia, mappe inviate. Aggiungi tu il resto con le note.</p>`}</section>`;
  }
  const logLine = (e, s) => `<li class="${e.k}"><button class="grow textleft" data-a="logEdit" data-id="${e.id}"><span class="lt">${hhmm(e.t)}</span><span class="lx">${e.tag ? `<span class="tag">${esc(TAG_LABEL[e.tag] || e.tag)}</span> ` : ""}${e.k === "nota" ? rich(e.txt) : esc(e.txt)}</span></button></li>`;

  // dettatura con il riconoscimento vocale del browser (gratis su Chrome Android, serve la rete)
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let rec = null;
  function dictateInto(ta, btn) {
    if (!SpeechRec) return toast("Dettatura non disponibile in questo browser");
    if (rec) { rec.stop(); return; }
    rec = new SpeechRec(); rec.lang = "it-IT"; rec.interimResults = true; rec.continuous = false;
    const base = ta.value ? ta.value.replace(/\s*$/, " ") : "";
    rec.onresult = (ev) => { let t = ""; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; ta.value = base + t.charAt(0).toUpperCase() + t.slice(1); };
    rec.onerror = (ev) => { toast(ev.error === "not-allowed" ? "Consenti il microfono per dettare" : "Dettatura interrotta"); };
    rec.onend = () => { rec = null; if (btn) btn.classList.remove("on"); };
    if (btn) btn.classList.add("on"); rec.start();
  }

  function liveStartDialog() {
    const c = C(); if (liveSession(c)) return go("diario", "live");
    const open = c.sessions.filter((s) => !s.endedAt).sort((a, b) => num(b.num) - num(a.num));
    const next = c.sessions.reduce((m, x) => Math.max(m, num(x.num)), 0) + 1;
    openModal("Inizia la sessione", `${open.length ? select("Quale sessione", "sid", open[0].id, open.map((s) => [s.id, `${s.num ? "#" + s.num + " · " : ""}${s.title || "Sessione preparata"}`]).concat([["__new", `Nuova sessione #${next}`]])) : `<p>Creo la sessione #${next} con la data di oggi.</p>`}
      ${field("Titolo (facoltativo)", "title", "", "text", 'placeholder="lo puoi scrivere anche alla fine"')}
      <p class="sub">Da ora l'app annota da sola Paura, danni, scontri, conti alla rovescia e mappe inviate. Tu aggiungi le note con il pulsante ✎ in alto, anche a voce.</p>`,
      { saveLabel: "Inizia", focus: false, onSave: () => { const f = form(); let s = f.sid && f.sid !== "__new" ? c.sessions.find((x) => x.id === f.sid) : null;
        if (!s) { s = { id: uid(), num: next, date: new Date().toISOString().slice(0, 10), title: "", prep: "", summary: "", aside: "" }; c.sessions.push(s); }
        if (f.title.trim()) s.title = f.title.trim();
        s.startedAt = Date.now(); s.date = new Date().toISOString().slice(0, 10); s.log = s.log || []; s.spot = s.spot || {};
        s.startState = { fear: c.fear, clocks: Object.fromEntries(c.clocks.map((k) => [k.id, num(k.value)])) };
        const pm = planOf(s).mapIds.filter((id) => mapById(id)); if (pm.length) c.sceneMaps = pm.concat((c.sceneMaps || []).filter((x) => !pm.includes(x)));
        c.live = { sid: s.id }; logEv("Sessione iniziata", { k: "imp" }); save(); closeModal(); go("diario", "live"); render(); updateLiveUI(); } });
  }
  function quickNote() {
    const c = C(); if (!liveSession(c)) return liveStartDialog();
    
    openModal("Nota veloce", `<textarea id="qNote" rows="3" placeholder="Cosa è successo? Chi, cosa, dove…" data-link="1" name="qn"></textarea>
      <div class="chips">${NOTE_TAGS.map(([k, v]) => `<button class="chip small ${k === noteTagSel ? "on" : ""}" data-a="noteTag" data-k="${k}">${v}</button>`).join("")}</div>`,
      { focus: false, extra: `${SpeechRec ? `<button class="btn ghost mic" data-a="dictate" data-for="qNote">🎤 Detta</button>` : ""}<button class="btn primary" data-a="noteAdd" data-from="qNote">Aggiungi</button>` });
    setTimeout(() => { const t = $("#qNote"); if (t) t.focus(); }, 60);
  }

  // ---------------------------------------------------------------- chiusura della sessione
  const PUBLIC_SKIP = /^(Paura |Conto «|«.*» si è innescato|Sessione (iniziata|terminata)|Riflettori su)/;
  const logFor = (s) => (s.log || []).filter((e) => e.k !== "spot");
  function draftSummary(c, s) {
    const L = logFor(s).filter((e) => (e.k === "nota" || e.k === "imp" || /^Sconfitto/.test(e.txt)) && !/^Sessione (iniziata|terminata)/.test(e.txt) && !/^Mappa inviata/.test(e.txt) && !/^Scontro terminato/.test(e.txt));
    const lines = L.map((e) => { let t = e.txt.replace(/^Scontro iniziato: /, "Scontro: ").replace(/^Esito di «[^»]+»: /, "   esito: "); return (t.startsWith("   ") ? "" : "• ") + (e.tag ? `[${TAG_LABEL[e.tag]}] ` : "") + t; });
    const st = s.startState || {}; const tail = [];
    if (s.startedAt && s.endedAt) tail.push(`Durata ${dur(s.endedAt - s.startedAt)}.`);
    if (st.fear != null) tail.push(`Paura da ${st.fear} a ${c.fear}.`);
    return lines.join("\n") + (tail.length ? "\n\n" + tail.join(" ") : "");
  }
  function draftPublic(c, s) {
    // solo le note scritte dal GM (niente eventi automatici: nomi di schede e scontri possono essere segreti)
    const L = logFor(s).filter((e) => e.k === "nota" && e.tag !== "segreto");
    return L.map((e) => "• " + plain(e.txt.replace(/^Esito di «[^»]+»: /, ""))).join("\n");
  }
  const threadTags = ["ricorda", "png", "promessa", "indizio", "oggetto", "domanda"];
  const plain = (t) => String(t || "").replace(/\[\[([^\]]+)\]\]/g, "$1");

  function viewClose(c, sid) {
    const s = c.sessions.find((x) => x.id === sid); if (!s) return `<p class="sub">Sessione non trovata.</p>`;
    if (s.summary == null || s.summary === "") s.summary = draftSummary(c, s);
    if (!s.publicRecap) s.publicRecap = draftPublic(c, s);
    const cand = (s.log || []).filter((e) => e.k === "nota" && threadTags.includes(e.tag) && !/^Rivelato:/.test(e.txt));
    s.threadPick = s.threadPick || Object.fromEntries(cand.map((e) => [e.id, true]));
    const st = (s.startState || {}).clocks || {};
    const clocks = c.clocks.filter((k) => !k.encId);
    const spots = spotInfo(c, Object.assign({ startedAt: s.startedAt || Date.now() }, s)).map(({ p, n }) => `${esc(p.name.split(" ")[0])} ${n}`).join(" · ");
    return `<div class="row gap wrap buildertop"><button class="chip" data-a="go" data-tab="diario">‹</button><h2 class="grow">Chiudi la sessione</h2></div>
      <p class="sub">#${esc(s.num || "")} ${esc(s.title || "")} · ${s.startedAt && s.endedAt ? dur(s.endedAt - s.startedAt) : ""} · ${(s.log || []).length} voci nel diario${spots ? " · riflettori: " + spots : ""}</p>
      <section class="card claude"><h2>Fallo scrivere a Claude</h2><p class="sub">Copia tutto il materiale della serata (diario, PG, scontri, conti alla rovescia, fili aperti, PNG e luoghi citati) con le istruzioni già pronte. Incollalo in una chat con Claude: ti restituisce il resoconto scritto bene, il testo per il gruppo, gli "a parte" e una bozza della prossima sessione.</p>
        <div class="row gap wrap"><button class="btn primary" data-a="claudeExport" data-id="${s.id}">Copia per Claude</button><button class="btn ghost" data-a="claudeShare" data-id="${s.id}">Condividi</button></div></section>
      <section class="card"><h2>1 · Cos'è successo</h2><p class="sub">Bozza fatta dal diario della serata: correggi, togli, aggiungi. È per te, può contenere segreti.</p>
        <label class="fld"><span>Titolo</span><input data-sf="title" value="${esc(s.title || "")}" placeholder="Cenere a Cantocenere"></label>
        <label class="fld"><span>Resoconto</span><textarea data-sf="summary" rows="9">${esc(s.summary)}</textarea></label></section>
      ${cand.length ? `<section class="card"><h2>2 · Fili da portare avanti</h2><p class="sub">Le note con un'etichetta. Quelle spuntate restano aperte e le ritrovi quando prepari la prossima sessione.</p>
        <ul class="checklist">${cand.map((e) => `<li><label class="chk"><input type="checkbox" data-a="threadPick" data-id="${e.id}" ${s.threadPick[e.id] ? "checked" : ""}><span><span class="tag">${esc(TAG_LABEL[e.tag])}</span> ${esc(plain(e.txt))}</span></label></li>`).join("")}</ul></section>` : ""}
      ${clocks.length ? `<section class="card"><h2>${cand.length ? 3 : 2} · Conti alla rovescia</h2><p class="sub">Fai avanzare quelli che si muovono tra una sessione e l'altra.</p>
        ${clocks.map((k) => { const was = st[k.id]; return `<div class="row between clockrow"><div><b>${esc(k.name)}</b><div class="sub">${k.value}/${k.max}${was != null && was !== num(k.value) ? ` · era ${was}` : ""}${num(k.value) >= num(k.max) ? " · innescato" : ""}</div></div><div class="row gap"><button class="icon" data-a="clockAdd" data-id="${k.id}" data-d="-1">−</button><button class="icon" data-a="clockAdd" data-id="${k.id}" data-d="1">+</button></div></div>`; }).join("")}</section>` : ""}
      <section class="card"><h2>A parte di fine sessione</h2><p class="sub">Il monologo di una fazione. Se vuoi, fallo scrivere a Claude con il pulsante qui sotto.</p>
        <textarea data-sf="aside" rows="3" placeholder="Intanto, nel Cinabro…">${esc(s.aside || "")}</textarea></section>
      <section class="card"><h2>Per il gruppo</h2><p class="sub">Senza segreti: sono escluse le note con l'etichetta Segreto, i conti alla rovescia e la Paura. Controlla e manda.</p>
        <textarea data-sf="publicRecap" rows="6">${esc(s.publicRecap)}</textarea>
        <div class="row gap wrap"><button class="btn" data-a="recapShare" data-id="${s.id}">Invia al gruppo</button></div></section>

      <div class="stickybar"><button class="btn primary big" data-a="closeSave" data-id="${s.id}">Salva e chiudi</button></div>`;
  }

  // PNG, luoghi e avversari della campagna citati nel testo, con [[collegamento]] o semplicemente per nome
  function linkedContext(c, texts) {
    const all = texts.map((t) => String(t || "")).join("\n"); const low = all.toLowerCase(); const seen = new Set(); const out = [];
    const short = (n) => n.split(",")[0].replace(/^(il|lo|la|i|gli|le|l'|un|una)\s+/i, "").trim().toLowerCase();
    const found = (n, min = 4) => { const k = short(n); return k.length >= min && new RegExp("(^|[^\\p{L}])" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^\\p{L}])", "iu").test(low); };
    const first = (w) => { const t = short(w.name).split(/\s+/)[0]; return w.kind === "png" && t.length >= 3 && short(w.name).includes(" ") ? t : null; };
    c.world.forEach((w) => { if (out.length < 18 && !seen.has(short(w.name)) && (found(w.name) || (first(w) && found(first(w), 3)))) { seen.add(short(w.name)); out.push(`- ${w.name}${w.subtitle ? " (" + w.subtitle + ")" : ""}: ${plain(w.notes).replace(/\s+/g, " ").slice(0, 380)}`); } });
    c.bestiary.forEach((a) => { if (out.length < 24 && !seen.has(short(a.name)) && found(a.name)) { seen.add(short(a.name)); out.push(`- ${a.name} (scheda avversario: ${a.role}, rango ${a.tier}): ${a.desc || ""}`); } });
    return out;
  }
  function claudeText(c, s) {
    const T = []; const P = (x) => T.push(x);
    const pcs = c.pcs.map((p) => `- ${p.name}${[p.cls, p.subclass].filter(Boolean).length ? " (" + [p.cls, p.subclass].filter(Boolean).join(" ") + ")" : ""}${p.level ? ", livello " + p.level : ""}${p.player ? ", giocato da " + p.player : ""}: PF segnati ${num(p.hp)}/${num(p.hpMax, 6)}, Stress ${num(p.stress)}/${num(p.stressMax, 6)}, Speranza ${num(p.hope)}${num(p.scars) ? ", cicatrici " + p.scars : ""}`);
    const log = (s.log || []).filter((e) => e.k !== "spot").map((e) => `${hhmm(e.t)} ${e.tag ? "[" + TAG_LABEL[e.tag] + "] " : ""}${plain(e.txt)}`);
    const spots = s.startedAt ? spotInfo(c, s).map(({ p, n }) => `${p.name} ${n}`).join(", ") : "";
    const encs = c.encounters.filter((e) => (s.log || []).some((x) => x.txt.includes("«" + e.name + "»") || x.txt.endsWith(": " + e.name)));
    const st = (s.startState || {}).clocks || {};
    const clocks = c.clocks.filter((k) => !k.encId).map((k) => `- ${k.name} (${CLOCK_KINDS[k.kind] || ""}): ${k.value}/${k.max}${st[k.id] != null && st[k.id] !== num(k.value) ? `, a inizio sessione era ${st[k.id]}` : ""}${k.notes ? ". " + plain(k.notes).replace(/\s+/g, " ").slice(0, 200) : ""}`);
    const threads = (c.threads || []).filter((t) => t.open && t.from !== s.id).map((t) => `- [${TAG_LABEL[t.tag] || "Filo"}] ${plain(t.txt)}`);
    const secrets = (c.secrets || []).filter((x) => !x.revealed).map((x) => `- ${plain(x.txt)}`);
    const ctx = linkedContext(c, [s.prep, s.summary, s.aside].concat((s.log || []).map((e) => e.txt)));
    P(`Sono il GM di una campagna di Daggerheart, «${c.name}»${c.frame ? " (frame: " + c.frame + ")" : ""}. Qui sotto trovi il materiale della sessione ${s.num ? "#" + s.num + " " : ""}«${s.title || "senza titolo"}» del ${s.date || ""}${s.startedAt && s.endedAt ? ", durata " + dur(s.endedAt - s.startedAt) : ""}.`);
    P(""); P("Scrivimi, in italiano:");
    P("1. Il resoconto della sessione in prosa, per me: chiaro, in ordine, con i segreti.");
    P("2. Il riassunto per i giocatori da mandare su WhatsApp: «Nella puntata precedente…», al massimo 150 parole, senza segreti, senza le note marcate [Segreto (solo GM)], senza Paura e conti alla rovescia.");
    P("3. Gli \"a parte\" di fine sessione: un breve monologo per ogni fazione toccata stasera. Non rivelare mai ai giocatori ciò che è segreto, nemmeno per allusione esplicita.");
    P("4. Una bozza della prossima sessione: apertura forte, 3-4 scene possibili, 6-8 segreti e indizi, PNG, possibili scontri, partendo dai fili aperti e dai conti alla rovescia. Il mio gruppo preferisce l'azione alle indagini sociali.");
    P("Se qualcosa nel diario è ambiguo, fammi al massimo tre domande prima di scrivere.");
    P(""); P("## PG"); P(pcs.join("\n") || "-");
    { const pb = [s.plan && s.plan.opening ? "Apertura: " + s.plan.opening : "", s.plan && s.plan.scenes.length ? "Scene: " + s.plan.scenes.map((x) => (x.done ? "[giocata] " : "[non giocata] ") + x.txt).join("; ") : "", s.plan && s.plan.cast ? "Luoghi e PNG: " + s.plan.cast : "", s.prep || ""].filter(Boolean).join("\n");
      if (pb) { P(""); P("## Preparazione della sessione"); P(plain(pb)); } }
    { const rv = (c.secrets || []).filter((x) => x.revealedIn === s.id); if (rv.length) { P(""); P("## Segreti rivelati stasera"); rv.forEach((x) => P("- " + plain(x.txt))); } }
    P(""); P("## Diario della serata (in automatico dall'app più le mie note)"); P(log.join("\n") || "-");
    if (spots) { P(""); P("## Riflettori (quante volte ogni PG è stato al centro della scena)"); P(spots); }
    if (s.summary && s.summary.trim() !== draftSummary(c, s).trim()) { P(""); P("## Il mio resoconto a caldo"); P(plain(s.summary)); }
    if (encs.length) { P(""); P("## Scontri giocati"); encs.forEach((e) => P(`- ${e.name}${e.objective ? " (obiettivo: " + e.objective + ")" : ""}${e.outcome ? ": " + plain(e.outcome) : ""}`)); }
    if (clocks.length) { P(""); P("## Conti alla rovescia"); P(clocks.join("\n")); }
    if (threads.length) { P(""); P("## Fili aperti"); P(threads.join("\n")); }
    if (secrets.length) { P(""); P("## Segreti e indizi non ancora rivelati"); P(secrets.join("\n")); }
    if (ctx.length) { P(""); P("## PNG, luoghi e fazioni citati (dalle mie note)"); P(ctx.join("\n")); }
    if (s.aside) { P(""); P("## A parte già scritto"); P(plain(s.aside)); }
    return T.join("\n");
  }
  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg); return true; }
    catch (_) { openModal("Copia il testo", `<p class="sub">Tieni premuto nel riquadro, Seleziona tutto e Copia.</p><textarea rows="14" readonly class="sharetext">${esc(text)}</textarea>`, { focus: false }); return false; }
  }
  async function shareText(text, title) {
    if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    copyText(text, "Copiato: incollalo dove vuoi");
  }
  function commitThreads(c, s) {
    c.threads = c.threads || [];
    (s.log || []).filter((e) => e.k === "nota" && threadTags.includes(e.tag) && !/^Rivelato:/.test(e.txt)).forEach((e) => {
      const ex = c.threads.find((t) => t.logId === e.id);
      if (s.threadPick && s.threadPick[e.id]) { if (!ex) c.threads.push({ id: uid(), logId: e.id, txt: e.txt, tag: e.tag, from: s.id, open: true, created: e.t }); }
      else if (ex && ex.from === s.id) c.threads = c.threads.filter((t) => t !== ex);
    });
  }

  // ---------------------------------------------------------------- preparazione guidata
  const planOf = (s) => (s.plan = Object.assign({ want: "", opening: "", scenes: [], cast: "", rewards: "", encIds: [], mapIds: [] }, s.plan || {}));
  const openSecrets = (c) => (c.secrets || []).filter((x) => !x.revealed);
  const openThreads = (c) => (c.threads || []).filter((t) => t.open);
  const lastPlayed = (c, not) => c.sessions.filter((x) => x.endedAt && x.id !== not).sort((a, b) => b.endedAt - a.endedAt)[0];
  const nextSessionNum = (c) => c.sessions.reduce((m, x) => Math.max(m, num(x.num)), 0) + 1;

  function viewPrep(c, sid) {
    const s = c.sessions.find((x) => x.id === sid); if (!s) return `<p class="sub">Sessione non trovata.</p>`;
    const P = planOf(s); const last = lastPlayed(c, s.id);
    const secrets = openSecrets(c); const threads = openThreads(c);
    const hot = c.clocks.filter((k) => !k.encId && num(k.value) >= num(k.max) - 2);
    const step = (n, t, sub) => `<h2><span class="stepn">${n}</span>${t}</h2>${sub ? `<p class="sub">${sub}</p>` : ""}`;
    const encs = c.encounters.filter((e) => e.status !== "giocato" || P.encIds.includes(e.id));
    return `<div class="row gap wrap buildertop"><button class="chip" data-a="go" data-tab="diario">‹</button><h2 class="grow">Prepara la sessione</h2></div>
      <section class="card"><div class="three"><label class="fld"><span>Numero</span><input type="number" data-sf="num" value="${esc(s.num || "")}"></label><label class="fld"><span>Data</span><input type="date" data-sf="date" value="${esc(s.date || "")}"></label><label class="fld"><span>Titolo</span><input data-sf="title" value="${esc(s.title || "")}" placeholder="facoltativo"></label></div></section>
      <section class="card claude"><h2>Fatti aiutare da Claude</h2><p class="sub">Copia il riassunto della campagna (ultime sessioni, fili aperti, segreti, conti alla rovescia, PG) con le istruzioni per preparare la sessione. Incolla la risposta qui sotto con "Incolla la risposta": riempio io i campi.</p>
        <div class="row gap wrap"><button class="btn primary" data-a="prepClaude" data-id="${s.id}">Copia per Claude</button><button class="btn ghost" data-a="prepPaste" data-id="${s.id}">Incolla la risposta</button></div></section>
      ${last || hot.length ? `<section class="card recap"><h2>L'ultima volta</h2>
        ${last ? `<p class="sub">#${esc(last.num || "")} ${esc(last.title || "")} · ${esc(last.date || "")}</p>${last.summary ? `<p class="notes clamp">${rich(last.summary)}</p>` : ""}` : ""}
        ${hot.length ? `<p><span class="k">Conti alla rovescia vicini</span> ${hot.map((k) => `${esc(k.name)} ${k.value}/${k.max}`).join(" · ")}</p>` : ""}</section>` : ""}
      <section class="card">${step(1, "I personaggi", "Cosa vogliono stasera? Chi ha bisogno di una scena?")}
        <div class="pcrow">${c.pcs.map((p) => { const t = threads.filter((x) => x.txt.toLowerCase().includes(p.name.split(" ")[0].toLowerCase())).length; const ls = last && last.spot ? (last.spot[p.id] || []).length : null;
          return `<button class="chip" data-a="pcView" data-id="${p.id}">${esc(p.name.split(" ")[0])}${ls !== null ? ` · ${ls}★` : ""}${t ? ` · ${t} fili` : ""}</button>`; }).join("")}</div>
        <textarea data-pf="want" rows="3" data-link="1" name="pf_want" placeholder="Kaiser vuole sapere di Ezio; Karluzan non ha avuto scene l'ultima volta…">${esc(P.want)}</textarea></section>
      <section class="card">${step(2, "Apertura forte", "La prima scena: parti nel mezzo dell'azione.")}
        <textarea data-pf="opening" rows="3" data-link="1" name="pf_opening" placeholder="Un'esplosione al mercato di Cantocenere…">${esc(P.opening)}</textarea></section>
      <section class="card">${step(3, "Scene possibili", "Non una trama: situazioni che puoi usare o saltare.")}
        <ul class="planlist">${P.scenes.map((x) => `<li><textarea class="grow inl" rows="1" data-scene="${x.id}">${esc(x.txt)}</textarea><button class="icon danger" data-a="sceneDel" data-id="${x.id}">✕</button></li>`).join("")}</ul>
        <div class="searchrow"><input id="newScene" placeholder="Aggiungi una scena"><button class="btn small" data-a="sceneAdd">+</button></div></section>
      <section class="card">${step(4, "Segreti e indizi", `Cose che i PG possono scoprire, non legate a una scena precisa. Quelli non rivelati restano per le sessioni dopo. ${secrets.length}/10`)}
        <ul class="planlist">${secrets.map((x) => `<li><textarea class="grow inl" rows="1" data-secret="${x.id}">${esc(x.txt)}</textarea><button class="icon" data-a="secretReveal" data-id="${x.id}" aria-label="Rivelato">✓</button><button class="icon danger" data-a="secretDel" data-id="${x.id}">✕</button></li>`).join("")}</ul>
        <div class="searchrow"><input id="newSecret" placeholder="Aggiungi un segreto o un indizio"><button class="btn small" data-a="secretAdd">+</button></div>
        ${(c.secrets || []).some((x) => x.revealed) ? `<details><summary class="sub">Già rivelati (${c.secrets.filter((x) => x.revealed).length})</summary><ul class="planlist dim">${c.secrets.filter((x) => x.revealed).map((x) => `<li><span class="grow">${esc(x.txt)}</span><button class="chip small" data-a="secretReveal" data-id="${x.id}">riapri</button></li>`).join("")}</ul></details>` : ""}</section>
      ${threads.length ? `<section class="card">${step("↻", "Fili aperti", "Promesse, domande e indizi rimasti in sospeso nelle sessioni precedenti.")}
        <ul class="planlist">${threads.map((t) => `<li><div class="grow"><span class="tag">${esc(TAG_LABEL[t.tag] || "Filo")}</span> ${rich(t.txt)}</div><button class="chip small" data-a="threadToScene" data-id="${t.id}">→ scena</button><button class="icon" data-a="threadClose" data-id="${t.id}" aria-label="Chiuso">✓</button></li>`).join("")}</ul></section>` : ""}
      <section class="card">${step(5, "Luoghi e PNG", "Scrivi [[Nome]] per collegare le schede del Mondo.")}
        <textarea data-pf="cast" rows="4" data-link="1" name="pf_cast" placeholder="[[Nome PNG]]: offre un accordo…">${esc(P.cast)}</textarea></section>
      <section class="card">${step(6, "Scontri", "Tocca per portarli nella sessione: li ritrovi pronti durante il gioco.")}
        <div class="chips">${encs.map((e) => `<button class="chip ${P.encIds.includes(e.id) ? "on" : ""}" data-a="prepEnc" data-id="${e.id}">${esc(e.name)}</button>`).join("") || `<span class="sub">Nessuno scontro.</span>`}<button class="chip" data-a="prepEncNew" data-id="${s.id}">+ Nuovo</button></div></section>
      <section class="card">${step(7, "Mappe", "Quelle scelte vanno in scena quando inizi la sessione.")}
        ${MAPS.length ? `<div class="mapstrip">${MAPS.slice().sort((a, b) => (P.mapIds.includes(b.id) - P.mapIds.includes(a.id)) || (b.created - a.created)).slice(0, 30).map((m) => `<button class="mapmini pickable ${P.mapIds.includes(m.id) ? "on" : ""}" data-a="prepMap" data-id="${m.id}"><span class="mapimg"><img src="${turl(m)}" alt=""></span><span class="sub one">${esc(m.name)}</span></button>`).join("")}</div>` : `<p class="sub">Nessuna mappa sul telefono.</p>`}</section>
      <section class="card">${step(8, "Ricompense", "Oggetti, informazioni, alleati, avanzamenti.")}
        <textarea data-pf="rewards" rows="2" data-link="1" name="pf_rewards">${esc(P.rewards)}</textarea></section>
      <section class="card"><h2>Altre note</h2><textarea data-sf="prep" rows="3" data-link="1" name="prep">${esc(s.prep || "")}</textarea></section>
      <div class="stickybar"><button class="btn primary big" data-a="prepDone" data-id="${s.id}">Fatto</button></div>`;
  }

  function autoGrow(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
  function planBlock(c, s, live) {
    const P = planOf(s); const parts = [];
    if (P.opening) parts.push(`<h4>Apertura</h4><p class="notes">${rich(P.opening)}</p>`);
    if (P.scenes.length) parts.push(`<h4>Scene</h4><ul class="planlist scenes">${P.scenes.map((x) => live ? `<li class="${x.done ? "done" : ""}"><button class="grow textleft" data-a="sceneDone" data-id="${x.id}"><span class="box">${x.done ? "✓" : ""}</span> ${rich(x.txt)}</button></li>` : `<li class="${x.done ? "done" : ""}"><span class="grow">${x.done ? "✓ " : "• "}${rich(x.txt)}</span></li>`).join("")}</ul>`);
    const sec = openSecrets(c);
    if (live && sec.length) parts.push(`<h4>Segreti e indizi</h4><ul class="planlist">${sec.map((x) => `<li><span class="grow">${rich(x.txt)}</span><button class="chip small" data-a="secretReveal" data-id="${x.id}">Rivela</button></li>`).join("")}</ul>`);
    if (P.cast) parts.push(`<h4>Luoghi e PNG</h4><p class="notes">${rich(P.cast)}</p>`);
    if (P.want) parts.push(`<h4>I personaggi</h4><p class="notes">${rich(P.want)}</p>`);
    if (P.rewards) parts.push(`<h4>Ricompense</h4><p class="notes">${rich(P.rewards)}</p>`);
    if (s.prep) parts.push(`<h4>Note</h4><p class="notes">${rich(s.prep)}</p>`);
    return parts.join("");
  }

  function prepClaudeText(c, s) {
    const T = []; const P = (x) => T.push(x);
    const played = c.sessions.filter((x) => x.endedAt || x.summary).sort((a, b) => num(a.num) - num(b.num)).slice(-3);
    P(`Sono il GM di una campagna di Daggerheart, «${c.name}»${c.frame ? " (frame: " + c.frame + ")" : ""}. Aiutami a preparare la sessione ${s.num ? "#" + s.num : ""} con il metodo "Return of the Lazy DM", adattato a Daggerheart. Il mio gruppo preferisce l'azione alle indagini sociali; lascia spazio alle scelte dei giocatori e usa gli scontri come prove con condizioni di vittoria alternative.`);
    P(""); P("Rispondi ESATTAMENTE con queste sezioni, in italiano, ogni voce su una riga che inizia con «- » (così l'app le importa da sola):");
    P("## Personaggi\n- cosa può volere o ricevere ogni PG stasera");
    P("## Apertura\n- una sola apertura forte, nel mezzo dell'azione");
    P("## Scene\n- 3-5 scene possibili");
    P("## Segreti\n- 8-10 segreti e indizi, brevi, scopribili in modi diversi");
    P("## Luoghi e PNG\n- luoghi e PNG con una riga su cosa vogliono");
    P("## Scontri\n- idee di scontro con avversari, obiettivo e l'altra via");
    P("## Ricompense\n- ricompense possibili");
    P(""); P("## PG"); c.pcs.forEach((p) => P(`- ${p.name}${p.cls ? " (" + p.cls + ")" : ""}${p.level ? ", livello " + p.level : ""}${p.notes ? ": " + plain(p.notes).replace(/\s+/g, " ").slice(0, 300) : ""}`));
    played.forEach((x) => { P(""); P(`## Sessione ${x.num ? "#" + x.num : ""} «${x.title || ""}»`); P(plain(x.summary || "").slice(0, 2500) || "(nessun resoconto)"); });
    const th = openThreads(c); if (th.length) { P(""); P("## Fili aperti"); th.forEach((t) => P(`- [${TAG_LABEL[t.tag] || "Filo"}] ${plain(t.txt)}`)); }
    const se = openSecrets(c); if (se.length) { P(""); P("## Segreti già preparati e non ancora rivelati (riusali se servono)"); se.forEach((x) => P("- " + plain(x.txt))); }
    const cl = c.clocks.filter((k) => !k.encId); if (cl.length) { P(""); P("## Conti alla rovescia"); cl.forEach((k) => P(`- ${k.name}: ${k.value}/${k.max}${k.notes ? ". " + plain(k.notes).replace(/\s+/g, " ").slice(0, 160) : ""}`)); }
    const pl = planOf(s); const mine = [pl.want, pl.opening, pl.cast, s.prep].filter(Boolean).join("\n"); if (mine) { P(""); P("## Le mie idee per questa sessione"); P(plain(mine)); }
    const ctx = linkedContext(c, [mine, th.map((t) => t.txt).join("\n"), played.map((x) => x.summary).join("\n")]); if (ctx.length) { P(""); P("## PNG, luoghi e fazioni citati"); P(ctx.join("\n")); }
    return T.join("\n");
  }
  // legge la risposta di Claude e la mette nei campi
  function parsePrep(text) {
    const map = { personaggi: "want", apertura: "opening", scene: "scenes", segreti: "secrets", "luoghi e png": "cast", png: "cast", luoghi: "cast", scontri: "encs", ricompense: "rewards" };
    const out = {}; let cur = null;
    String(text).split(/\r?\n/).forEach((line) => {
      const h = line.match(/^\s*#{1,4}\s*(?:\d+[.)]\s*)?\**([^*#]+?)\**\s*:?\s*$/);
      if (h) { const k = h[1].toLowerCase().replace(/[^a-zà-ù ]/g, "").trim(); cur = map[k] || Object.entries(map).find(([n]) => k.startsWith(n))?.[1] || null; if (cur) out[cur] = out[cur] || []; return; }
      if (!cur) return;
      const b = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      const t = (b ? b[1] : line).replace(/\*\*/g, "").trim(); if (!t) return;
      if (b || !out[cur].length) out[cur].push(t); else out[cur][out[cur].length - 1] += " " + t;
    });
    return out;
  }


  // ---------------------------------------------------------------- generatori al volo
  const GEN = window.GEN || null;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const GEN_GROUPS = [
    ["Persone", [["png", "PNG"], ["nome", "Nomi"]]],
    ["Luoghi", [["luogo", "Luogo"], ["locanda", "Locanda"], ["evento", "Viaggio"], ["trappola", "Trappola"]]],
    ["Storia", [["aggancio", "Incarico"], ["oracolo", "Oracolo"], ["compl", "Complicazione"], ["partenza", "Inizio forte"], ["segreto", "Segreto"], ["diceria", "Diceria"]]],
    ["Tesori", [["bottino", "Bottino"], ["consumabile", "Consumabile"]]],
  ];
  const GEN_KINDS = GEN_GROUPS.flatMap((g) => g[1]);
  const ORACLE = [["prob", "Probabile", 10], ["incerto", "Incerto", 13], ["improb", "Improbabile", 16]];
  const TRAP_DMG = { 1: "1d10+3", 2: "2d10+4", 3: "3d10+5", 4: "4d10+12" };
  const PNG_BOND = ["gli deve un favore", "l'ha visto fare qualcosa che non doveva", "è un parente lontano", "lo scambia per qualcun altro", "ha sentito parlare di lui, e non bene", "gli ha venduto qualcosa di difettoso", "lo ammira in segreto", "ha perso qualcuno per colpa sua"];
  const partyTier = () => { const c = C(); const ls = c ? c.pcs.map((p) => num(p.level, 1)) : []; const l = ls.length ? Math.round(ls.reduce((x, y) => x + y, 0) / ls.length) : 1; return l <= 1 ? 1 : l <= 4 ? 2 : l <= 7 ? 3 : 4; };
  const pickN = (arr, n) => { const a0 = arr.slice(); const out = []; while (out.length < n && a0.length) out.push(a0.splice(Math.floor(Math.random() * a0.length), 1)[0]); return out; };
  const RARITY = [["comune", "Comune", 1], ["noncomune", "Non comune", 2], ["raro", "Raro", 3], ["leggendario", "Leggendario", 4]];
  const genState = { kind: "png", culture: "", rarity: "comune", table: "tutte", odds: "incerto", place: "", tier: 0, arch: "", env: "", job: "", last: null };
  const LOOT_TABLES = [["tutte", "Tutte"], ["base", "Manuale base"], ["agg", "Aggiuntiva SRD 2.0"]];
  const genName = (cult) => { const cs = Object.keys(GEN.cultures); const k = cult || pick(cs); return { name: pick(GEN.cultures[k].names) + (Math.random() < 0.55 ? " " + pick(GEN.epithets) : ""), culture: GEN.cultures[k].label.replace(/ \(.*\)$/, "") }; };
  const advByName = (n) => SRD.adversaries.find((x) => x.name === n) || null;
  // tra i nomi suggeriti, gli avversari più vicini al rango del gruppo
  function nearTier(names, tier, k) { const L = names.map(advByName).filter(Boolean); return L.sort((x, y) => Math.abs(num(x.tier) - tier) - Math.abs(num(y.tier) - tier) || Math.random() - 0.5).slice(0, k); }
  const cap = (s0) => s0 ? s0[0].toUpperCase() + s0.slice(1) : s0;
  function genRoll(kind) {
    const c = C(); const tier = genState.tier || partyTier(); const D = { 1: 11, 2: 14, 3: 17, 4: 20 }[tier];
    if (kind === "png" && GEN.archetipi) {
      const A0 = GEN.archetipi.find((x) => x.id === genState.arch) || pick(GEN.archetipi);
      const n = genName(genState.culture || pick(A0.cult)); const pcs = c ? c.pcs : [];
      const lines = [["Aspetto", cap(pick(A0.aspetto))], ["Dice", pick(A0.battuta)], ["Vuole dai PG", cap(pick(A0.vuole))], ["Può offrire", cap(pick(A0.offre))], ["Segreto", cap(pick(A0.segreto)), "gm"]];
      if (pcs.length && Math.random() < 0.6) { const pc = pick(pcs); lines.push(["Legame", `Con ${pc.name}: ${pick(PNG_BOND)}`]); }
      return { kind, title: n.name, sub: `${A0.label} · ${n.culture}`, read: `${bareName(n.name).split(" ")[0]} ${pick(A0.chi)}.`, lines, advs: nearTier(A0.stat, tier, 1), arch: A0.label };
    }
    if (kind === "luogo" && GEN.ambienti3) {
      const E = GEN.ambienti3.find((x) => x.id === genState.env) || pick(GEN.ambienti3); const dmg = TRAP_DMG[tier];
      const feats = pickN(E.feat, 2).map(([name, type, text]) => ({ name, type, text: text.replace(/\{D\}/g, D).replace(/\{DMG\}/g, dmg) }));
      const imp = pickN(E.impulsi, 2).join(", ");
      return { kind, title: pick(E.nomi), sub: `${E.label} · ${E.tipo} · Rango ${tier} · Difficoltà ${D}`, read: pick(E.desc),
        lines: [["Impeti", cap(imp)]].concat(feats.map((f) => [`${f.name} — ${f.type}`, f.text])).concat([["Chiedete ai giocatori", pick(E.domande)]]),
        advs: nearTier(E.avv, tier, 3), env: { tipo: E.tipo, imp, feats, D, tier } };
    }
    if (kind === "aggancio" && GEN.incarichi3) {
      const J = GEN.incarichi3.find((x) => x.id === genState.job) || pick(GEN.incarichi3);
      const pngs = c ? c.world.filter((w) => w.kind === "png") : []; const fromWorld = pngs.length && Math.random() < 0.45 ? pick(pngs) : null;
      const chi = fromWorld ? fromWorld.name : pick(J.chi);
      return { kind, title: "Incarico: " + J.label.toLowerCase(), sub: fromWorld ? "il committente viene dal vostro Mondo" : "", read: `${cap(chi)} vi chiede di ${pick(J.cosa)}.`, lines: [["Ma", cap(pick(J.ma)), "gm"], ["In cambio", cap(pick(J.premio))]] };
    }
    if (kind === "locanda" && GEN.locande3) {
      const L = GEN.locande3; const [a0, g] = pick(L.a); const oste = GEN.archetipi.find((x) => x.id === "oste"); const n = genName(pick(oste.cult));
      const tono = pick(L.tono); const fort = /fortificata/.test(tono); const fact = pick(oste.chi.filter((x) => fort || !/fortezza/.test(x)));
      return { kind, title: `${a0} ${pick(L.b[g])}`, read: `Una locanda ${tono}.`, lines: [["Oste", `${n.name}, che ${fact}`], ["Dice", pick(oste.battuta)], ["Da mangiare", cap(pick(L.specialita))], ["Stasera c'è", cap(pick(L.stasera))], ["Segreto della casa", cap(pick(oste.segreto)), "gm"]] };
    }
    if (kind === "evento") return { kind, title: "In viaggio", read: pick(GEN.tempo), lines: [["Lungo la strada", pick(GEN.eventi)], ["Se va storto", pick(GEN.complicazioni.filter((x) => ["Ambiente", "Persone", "Tempo", "Nemici"].includes(x[0])))[1], "gm"]] };
    return genRollOld(kind);
  }
  function genRollOld(kind) {
    const N = GEN.npc;
    if (kind === "png") { const n = genName(genState.culture); const c = C(); const pc = c && c.pcs.length ? pick(c.pcs) : null; const P2 = GEN.png2 || { tic: [], frase: [] };
      return { kind, title: n.name, lines: [["Chi è", `${N.mestiere[Math.floor(Math.random() * N.mestiere.length)]} (${n.culture})`], ["Aspetto", pick(N.aspetto)], ["Come parla", pick(N.voce)], P2.tic.length ? ["Tic", pick(P2.tic)] : null, P2.frase.length ? ["Frase tipica", pick(P2.frase)] : null, ["Vuole", pick(N.vuole)], ["Nasconde", pick(N.nasconde)], ["Verso i PG", pick(N.verso)], pc ? ["Legame", `con ${pc.name}: ${pick(PNG_BOND)}`] : null].filter(Boolean) }; }
    if (kind === "tasca") return { kind, title: "Cosa ha in tasca", lines: pickN(GEN.tasche, 3).map((t) => ["", t]) };
    if (kind === "oracolo") {
      const o = ORACLE.find((x) => x[0] === genState.odds) || ORACLE[1]; const h = rnd(12), f = rnd(12), tot = h + f; const yes = tot >= o[2];
      const crit = h === f; const title = crit ? (yes ? "Sì, e molto di più!" : "No, ma succede qualcosa d'inatteso") : yes ? (h > f ? "Sì, e…" : "Sì, ma…") : (h > f ? "No, ma…" : "No, e…");
      const mean = crit ? "Dadi uguali: una svolta. Usate l'ispirazione qui sotto." : yes ? (h > f ? "Va bene, con un vantaggio in più." : "Va bene, ma con un costo o una complicazione.") : (h > f ? "Non va, ma resta uno spiraglio o un indizio." : "Non va, e la situazione peggiora.");
      return { kind, title, sub: `${o[1]} (serve ${o[2]}+) · Speranza ${h} + Paura ${f} = ${tot}`, lines: [["Cosa significa", mean], crit || (!yes && f > h) ? ["Ispirazione", `${pick(GEN.azioni)} ${pick(GEN.temi)}`] : null].filter(Boolean) };
    }
    if (kind === "ispira") return { kind, title: `${pick(GEN.azioni)} ${pick(GEN.temi)}`, sub: "Azione + tema: leggetelo come «chi vuole fare cosa»", lines: [["Oppure", `${pick(GEN.azioni)} ${pick(GEN.temi)}`], ["Oppure", `${pick(GEN.azioni)} ${pick(GEN.temi)}`]] };
    if (kind === "compl") { const [cat, t] = pick(GEN.complicazioni); return { kind, title: "Cosa va storto", sub: cat + " · ottima dopo un tiro con Paura, o spendendo una Paura", lines: [["", t]] }; }
    if (kind === "partenza") { const ks = Object.keys(GEN.partenze); const k = genState.place && GEN.partenze[genState.place] ? genState.place : pick(ks); return { kind, title: "Inizio forte", sub: k + " · partite da qui, nel mezzo dell'azione", lines: [["", pick(GEN.partenze[k])]] }; }
    if (kind === "luogo") { const L = GEN.luoghi; return { kind, title: `${pick(L.nomi.a)} ${pick(L.nomi.b)}`, lines: pickN(L.aspetti, 3).map((t) => ["Si vede", t]).concat([["Si sente", pick(L.sensi)], ["Segreto", pick(L.segreti)]]) }; }
    if (kind === "trappola") { const T = GEN.trappole; const tier = genState.tier || partyTier(); const d = { 1: 11, 2: 14, 3: 17, 4: 20 }[tier];
      const m = pick(T.meccanismi); const el = pick(T.elementi);
      return { kind, title: "Trappola: " + m, sub: `Rango ${tier} · Difficoltà ${d}`, lines: [["Scatta con", pick(T.inneschi)], ["Elemento", el], ["Indizio", pick(T.indizi)], ["Effetto", `Tiro Reazione di Agilità (${d}): in caso di fallimento ${TRAP_DMG[tier]} danni ${/ombra/.test(el) ? "magici" : "fisici"}, in caso di successo la metà.`]] };
    }
    if (kind === "aggancio") { const G = GEN.agganci; return { kind, title: "Incarico", lines: [["Chi lo chiede", pick(G.chi)], ["Cosa", pick(G.cosa)], ["Dove", pick(G.dove)], ["Ma", pick(G.ma)], ["In cambio", pick(G.premio)]] }; }
    if (kind === "segreto") {
      const c = C(); const W = c ? c.world : []; const by = (k) => W.filter((w) => w.kind === k).map((w) => w.name);
      const png = by("png"), loc = by("luogo"), fac = by("fazione"); const usedCamp = png.length >= 2;
      const A0 = png.length ? pickN(png, 2) : []; const fill = { A: A0[0] || pick(["il mercante", "la guardia anziana", "l'oste"]), B: A0[1] || pick(["il sindaco", "una guaritrice", "un forestiero"]), L: loc.length ? pick(loc) : pick(["il vecchio mulino", "la cripta", "il mercato"]), F: fac.length ? pick(fac) : pick(["la gilda", "il culto", "la milizia"]) };
      const mid = (n) => String(n).replace(/^(Il|Lo|La|I|Gli|Le|L['’])(?=\s|['’]|$)/, (m) => m.toLowerCase());
      const t = pick(GEN.segreti).replace(/\be (?=\{[ABLF]\})/g, "e ").replace(/(^|.)\{([ABLF])\}/g, (m, pre, k) => pre + (pre === "" || pre === "«" ? fill[k] : mid(fill[k])));
      const t2 = t.replace(/ e (?=[EÈ])/g, " ed "); void t2;
      return { kind, title: "Segreto o indizio", sub: usedCamp ? "con i nomi della vostra campagna" : "aggiungi PNG e luoghi nel Mondo per segreti con i vostri nomi", lines: [["", (t2[0].toUpperCase() + t2.slice(1))]], secret: t2[0].toUpperCase() + t2.slice(1) };
    }
    if (kind === "nome") { const arr = Array.from({ length: 6 }, () => genName(genState.culture)); return { kind, title: "Nomi", lines: arr.map((n) => [n.culture, n.name]) }; }
    if (kind === "diceria") return { kind, title: "Diceria", lines: [["Si dice che…", pick(GEN.dicerie)]] };
    if (kind === "evento") return { kind, title: "Evento lungo la strada", lines: [["", pick(GEN.eventi)]] };
    if (kind === "tempo") return { kind, title: "Il tempo di oggi", lines: [["", pick(GEN.tempo)]] };
    if (kind === "locanda") return { kind, title: `${pick(GEN.locande.a)} ${pick(GEN.locande.b)}`, lines: [["Oste", genName("").name], ["Specialità", pick(["zuppa di radici", "birra scura di palude", "pane nero e cipolle", "stufato di non chiedete cosa", "vino annacquato", "focaccia alle erbe amare"])], ["Chi c'è stasera", pick(N.mestiere)]] };
    if (kind === "bottino" || kind === "consumabile") {
      const r = RARITY.find((x) => x[0] === genState.rarity) || RARITY[0]; const dice = Array.from({ length: r[2] }, () => rnd(12)); const tot = dice.reduce((a, b) => a + b, 0);
      // due tabelle con gli stessi tiri: con "Tutte" una moneta sceglie quale usare
      const hasAgg = !!(GEN.loot.oggetti2 && GEN.loot.consumabili2);
      const agg = hasAgg && (genState.table === "agg" || (genState.table === "tutte" && Math.random() < 0.5));
      const tab = kind === "bottino" ? (agg ? GEN.loot.oggetti2 : GEN.loot.oggetti) : (agg ? GEN.loot.consumabili2 : GEN.loot.consumabili); const it = tab.find((x) => x.roll === tot) || tab[0];
      return { kind, title: it.name, sub: `${r[1]} · ${r[2]}d12 = ${dice.join(" + ")}${r[2] > 1 ? " = " + tot : ""} · ${it.en} · ${agg ? "tabella aggiuntiva SRD 2.0" : "manuale base"}`, lines: [["", it.text]] };
    }
  }
  function genSheet(kind) {
    if (!GEN) return toast("Generatori non disponibili");
    if (kind) genState.kind = kind;
    const res = genState.last && genState.last.kind === genState.kind ? genState.last : (genState.last = genRoll(genState.kind));
    const optRow = (o, list, label) => `<div class="chips scrollx">${[["", label]].concat(list).map(([k, v]) => `<button class="chip small ${genState[o] === k ? "on" : ""}" data-a="genOpt" data-o="${o}" data-k="${esc(k)}">${esc(v)}</button>`).join("")}</div>`;
    const opts = genState.kind === "png" ? optRow("arch", GEN.archetipi.map((x) => [x.id, x.label]), "Qualsiasi")
      : genState.kind === "luogo" ? optRow("env", GEN.ambienti3.map((x) => [x.id, x.label]), "Qualsiasi")
      : genState.kind === "aggancio" ? optRow("job", GEN.incarichi3.map((x) => [x.id, x.label]), "Qualsiasi")
      : genState.kind === "nome" ? `<div class="chips">${[["", "Qualsiasi"]].concat(Object.entries(GEN.cultures).map(([k, v]) => [k, v.label])).map(([k, v]) => `<button class="chip small ${genState.culture === k ? "on" : ""}" data-a="genCult" data-k="${k}">${esc(v)}</button>`).join("")}</div>`
      : genState.kind === "oracolo" ? `<div class="chips">${ORACLE.map(([k, v]) => `<button class="chip small ${genState.odds === k ? "on" : ""}" data-a="genOpt" data-o="odds" data-k="${k}">${v}</button>`).join("")}</div>`
      : genState.kind === "partenza" ? `<div class="chips">${[["", "Qualsiasi"]].concat(Object.keys(GEN.partenze).map((k) => [k, k])).map(([k, v]) => `<button class="chip small ${genState.place === k ? "on" : ""}" data-a="genOpt" data-o="place" data-k="${esc(k)}">${esc(v)}</button>`).join("")}</div>`
      : genState.kind === "trappola" ? `<div class="chips">${[0, 1, 2, 3, 4].map((k) => `<button class="chip small ${genState.tier === k ? "on" : ""}" data-a="genOpt" data-o="tier" data-k="${k}">${k ? "Rango " + k : "Rango del gruppo"}</button>`).join("")}</div>`
      : genState.kind === "bottino" || genState.kind === "consumabile" ? `<div class="chips">${RARITY.map(([k, v, n]) => `<button class="chip small ${genState.rarity === k ? "on" : ""}" data-a="genRar" data-k="${k}">${v} (${n}d12)</button>`).join("")}</div>
        <div class="chips">${LOOT_TABLES.map(([k, v]) => `<button class="chip small ${genState.table === k ? "on" : ""}" data-a="genTab" data-k="${k}">${v}</button>`).join("")}</div>` : "";
    openModal("Schermo del GM", `${screenTabs("volo")}<div class="chips scrollx genkinds">${GEN_GROUPS.map(([g, ks]) => `<span class="gsep">${g}</span>${ks.map(([k, v]) => `<button class="chip small ${genState.kind === k ? "on" : ""}" data-a="genKind" data-k="${k}">${v}</button>`).join("")}`).join("")}</div>${opts}
      <div class="genres"><h3>${esc(res.title)}</h3>${res.sub ? `<div class="sub">${esc(res.sub)}</div>` : ""}${res.read ? `<p class="genread">${esc(res.read)}</p>` : ""}
        <dl>${res.lines.map(([k, v, f]) => `${k ? `<dt class="${f === "gm" ? "gmonly" : ""}">${esc(k)}${f === "gm" ? " · solo GM" : ""}</dt>` : ""}<dd>${esc(v)}</dd>`).join("")}</dl>
        ${res.advs && res.advs.length ? `<div class="genadv"><span>${res.kind === "png" ? "Se si combatte" : "Avversari possibili"}</span><div class="chips">${res.advs.map((x) => `<button class="chip small" data-a="viewAdv" data-id="${x.id}">${esc(x.name)} · R${esc(x.tier)}</button>`).join("")}</div></div>` : ""}</div>
      <div class="row gap wrap">${res.kind === "png" || res.kind === "luogo" ? `<button class="btn small" data-a="genSave">Salva nel Mondo</button>` : ""}${res.env ? `<button class="btn small" data-a="genEnv">Salva come ambiente</button>` : ""}${res.secret ? `<button class="btn small" data-a="genSecret">Tra i segreti</button>` : ""}${liveSession() ? `<button class="btn small ghost" data-a="genLog">Nel diario</button>` : ""}<button class="btn small ghost" data-a="genCopy">Copia</button></div>`,
      { focus: false, extra: `<button class="btn primary big" data-a="genAgain">Rilancia</button>` });
  }
  // lo Schermo del GM ha due pagine: le regole da consultare e i generatori "al volo"
  const screenTabs = (on) => `<div class="segment screentabs"><button class="${on === "regole" ? "on" : ""}" data-a="rules">📖 Regole</button><button class="${on === "volo" ? "on" : ""}" data-a="genOpen">🎲 Al volo</button></div>`;
  const genText = (r) => [r.title, r.sub || "", r.read || ""].concat(r.lines.map(([k, v]) => (k ? k + ": " : "") + v)).concat(r.advs && r.advs.length ? [(r.kind === "png" ? "Se si combatte: " : "Avversari possibili: ") + r.advs.map((x) => x.name).join(", ")] : []).filter(Boolean).join("\n");


  // ---------------------------------------------------------------- adattare un avversario a un altro rango
  // Tabella "Statistiche improvvisate per rango" del manuale; i valori si spostano mantenendo la posizione relativa dell'avversario.
  const TIER_STATS = { 1: { atk: 1, diff: 11, maj: 7, sev: 12, lo: 5.5, hi: 10.5, minion: 4 }, 2: { atk: 2, diff: 14, maj: 10, sev: 20, lo: 10, hi: 17, minion: 7 }, 3: { atk: 3, diff: 17, maj: 20, sev: 32, lo: 16.5, hi: 24.5, minion: 11 }, 4: { atk: 4, diff: 20, maj: 25, sev: 45, lo: 28, hi: 38, minion: 14 } };
  const DICE_RX = /(\d*)d(\d+)(?:\s*([+\-−]\s*\d+))?/;
  const avgOf = (n, y, z) => n * (y + 1) / 2 + z;
  function parseDmg(str) { const m = String(str || "").match(DICE_RX); if (!m) return null; return { n: num(m[1], 1) || 1, y: num(m[2]), z: m[3] ? num(m[3].replace(/[\s−]/g, (x) => (x === "−" ? "-" : ""))) : 0 }; }
  const fmtDmg = (n, y, z) => `${n}d${y}${z > 0 ? "+" + z : z < 0 ? String(z) : ""}`;
  function scaleDice(d, from, to, main) {
    const A0 = TIER_STATS[from], A1 = TIER_STATS[to]; const avg = avgOf(d.n, d.y, d.z);
    const pos = main ? clamp((avg - A0.lo) / (A0.hi - A0.lo), 0, 1.2) : null;
    // attacco base: stessa posizione nella fascia del nuovo rango; danni delle caratteristiche: si sposta di quanto si sposta la media del rango
    const target = main ? A1.lo + pos * (A1.hi - A1.lo) : Math.max(1, avg + ((A1.lo + A1.hi) - (A0.lo + A0.hi)) / 2);
    const n = main ? clamp(to, 1, 4) : clamp(d.n + (to - from), 1, 6); const y = Math.max(4, d.y);
    const z = Math.max(0, Math.round(target - n * (y + 1) / 2));
    return fmtDmg(n, y, z);
  }
  function scaleAdv(src, to) {
    const from = clamp(num(src.tier, 1), 1, 4); to = clamp(num(to, from), 1, 4);
    const a = clone(src); a.id = uid(); delete a.srd; a.tier = to;
    a.en = src.en ? { name: src.en.name } : undefined; if (!a.en) delete a.en;
    a.source = (src.srd ? src.source : src.source || "Campagna") + ` (adattato dal rango ${from})`;
    a.name = src.name.replace(/\s*\(Rango \d\)$/, "") + ` (Rango ${to})`;
    if (from === to) return a;
    const S0 = TIER_STATS[from], S1 = TIER_STATS[to];
    a.difficulty = num(src.difficulty, S0.diff) + (S1.diff - S0.diff);
    a.atk = num(src.atk) + (S1.atk - S0.atk);
    if (src.major != null && src.major !== "") a.major = Math.max(1, Math.round(num(src.major) * S1.maj / S0.maj));
    if (src.severe != null && src.severe !== "") a.severe = Math.max(num(a.major) + 1, Math.round(num(src.severe) * S1.sev / S0.sev));
    if ((from <= 2) !== (to <= 2)) { const up = to > from ? 1 : -1; if (src.role !== "Seguace") a.hp = Math.max(1, num(src.hp) + 2 * up); a.stress = Math.max(1, num(src.stress) + up); }
    if (src.role === "Seguace") {
      const k = (S1.lo + S1.hi) / (S0.lo + S0.hi);
      if (/^\d+$/.test(String(src.dmg))) a.dmg = String(Math.max(1, Math.round(num(src.dmg) * k)));
      if (src.minion) a.minion = Math.max(1, Math.round(num(src.minion) * S1.minion / S0.minion));
    } else { const d = parseDmg(src.dmg); if (d) a.dmg = scaleDice(d, from, to, true); }
    const fixText = (t) => String(t || "").replace(new RegExp(DICE_RX.source + "(?=\\s*danni)", "g"), (m) => { const d = parseDmg(m); return d ? scaleDice(d, from, to, false) : m; })
      .replace(/Seguace \((\d+)\)/g, () => `Seguace (${a.minion || ""})`).replace(/Per ogni (\d+) danni/g, (m, v) => (src.role === "Seguace" && a.minion ? `Per ogni ${a.minion} danni` : m)).replace(/(infliggono|infligge) (\d+) danni/g, (m, v, n) => src.role === "Seguace" ? `${v} ${a.dmg} danni` : m);
    a.features = (src.features || []).map((f) => ({ name: f.name.replace(/Orda \(([^)]+)\)/, (m, x) => { const d = parseDmg(x); return d ? `Orda (${scaleDice(d, from, to, false)})` : m; }).replace(/Seguace \(\d+\)/, `Seguace (${a.minion || ""})`), type: f.type, text: fixText(f.text) }));
    a.adapted = { from, to, src: src.id };
    return a;
  }
  function adaptPreview(src, to) {
    const a = scaleAdv(src, to); const row = (lab, x, y) => `<tr><td>${lab}</td><td>${esc(x ?? "–")}</td><td><b>${esc(y ?? "–")}</b></td></tr>`;
    const diffFeat = (src.features || []).map((f, i) => [f, a.features[i]]).filter(([f, g]) => f.text !== g.text || f.name !== g.name);
    return `<table class="rt"><tr><th></th><th>Rango ${esc(src.tier)}</th><th>Rango ${esc(a.tier)}</th></tr>
      ${row("Difficoltà", src.difficulty, a.difficulty)}${row("Soglie", src.major != null ? src.major + "/" + src.severe : "–", a.major != null ? a.major + "/" + a.severe : "–")}${row("PF", src.hp, a.hp)}${row("Stress", src.stress, a.stress)}${row("ATT", (src.atk >= 0 ? "+" : "") + src.atk, (a.atk >= 0 ? "+" : "") + a.atk)}${row("Danno", src.dmg, a.dmg)}${src.minion ? row("Seguace", src.minion, a.minion) : ""}</table>
      ${diffFeat.length ? `<p class="sub">Caratteristiche con danni ritoccati: ${diffFeat.map(([f, g]) => esc(g.name)).join(", ")}.</p>` : `<p class="sub">Le caratteristiche restano uguali.</p>`}
      <p class="sub">Valori dalla tabella del manuale "Statistiche improvvisate per rango". Il manuale consiglia anche di aggiungere una caratteristica quando si sale di rango (o toglierne una quando si scende): dopo la copia puoi modificarla.</p>`;
  }
  function adaptDialog(id, after) {
    const c = C(); const src = findAdv(c, id); if (!src) return;
    let to = clamp(num(src.tier) + 1, 1, 4); if (after && after.to) to = after.to;
    const draw = () => openModal("Adatta al rango", `<p><b>${esc(src.name)}</b> · ${esc(src.role)} di Rango ${esc(src.tier)}</p>
      <div class="chips">${[1, 2, 3, 4].map((t) => `<button class="chip ${t === to ? "on" : ""}" data-a="adaptTo" data-t="${t}" ${t === num(src.tier) ? "disabled" : ""}>Rango ${t}</button>`).join("")}</div>
      <div id="adPrev">${adaptPreview(src, to)}</div>`, { focus: false, extra: `<button class="btn primary" data-a="adaptSave">Crea la copia adattata</button>` });
    adaptDialog.state = { src, get to() { return to; }, set to(v) { to = v; }, draw, after };
    draw();
  }

  // ---------------------------------------------------------------- azioni
  const prepActions = {
    prepStart: () => { const c = C(); let s = c.sessions.filter((x) => !x.startedAt && !x.endedAt).sort((a, b) => num(b.num) - num(a.num))[0];
      if (!s) { s = { id: uid(), num: nextSessionNum(c), date: "", title: "", prep: "", summary: "", aside: "" }; c.sessions.push(s); save(); }
      go("diario", "prepara/" + s.id); },
    sceneAdd: () => { const c = C(); const s = c.sessions.find((x) => x.id === route().id); const i = $("#newScene"); const t = i && i.value.trim(); if (!s || !t) return;
      planOf(s).scenes.push({ id: uid(), txt: t, done: false }); save(); render(); const n = $("#newScene"); if (n) n.focus(); },
    sceneDel: (el) => { const s = C().sessions.find((x) => x.id === route().id); const P = planOf(s); const old = P.scenes.slice(); P.scenes = P.scenes.filter((x) => x.id !== el.dataset.id); save(); render();
      toast("Scena tolta", { label: "Annulla", run: () => { P.scenes = old; save(); render(); } }); },
    sceneDone: (el) => { const s = liveSession(); if (!s) return; const x = planOf(s).scenes.find((y) => y.id === el.dataset.id); if (!x) return;
      x.done = !x.done; if (x.done) logEv(`Scena: ${plain(x.txt)}`, { k: "imp" });
      const t = x.thread && (C().threads || []).find((y) => y.id === x.thread); if (t) { t.open = !x.done; if (x.done) toast("Filo chiuso: la scena l'ha risolto", { label: "Tienilo aperto", run: () => { t.open = true; save(); } }); }
      save(); render(); },
    secretAdd: () => { const c = C(); const i = $("#newSecret"); const t = i && i.value.trim(); if (!t) return;
      (c.secrets = c.secrets || []).push({ id: uid(), txt: t, created: Date.now(), revealed: false, from: route().id }); save(); render(); const n = $("#newSecret"); if (n) n.focus(); },
    secretDel: (el) => withUndo("Segreto eliminato", (c) => { c.secrets = (c.secrets || []).filter((x) => x.id !== el.dataset.id); }),
    secretReveal: (el) => { const c = C(); const x = (c.secrets || []).find((y) => y.id === el.dataset.id); if (!x) return; const live = liveSession(c);
      x.revealed = !x.revealed; x.revealedIn = x.revealed ? (live ? live.id : null) : null; x.revealedAt = x.revealed ? Date.now() : null;
      if (x.revealed && live) logEv(`Rivelato: ${plain(x.txt)}`, { k: "nota", tag: "indizio", key: "rev" + x.id, window: 1 });
      save(); render(); toast(x.revealed ? "Segnato come rivelato" : "Di nuovo da rivelare", { label: "Annulla", run: () => { x.revealed = !x.revealed; save(); render(); } }); },
    threadClose: (el) => { const t = (C().threads || []).find((x) => x.id === el.dataset.id); if (!t) return; t.open = false; t.closedAt = Date.now(); save(); render();
      toast("Filo chiuso", { label: "Annulla", run: () => { t.open = true; save(); render(); } }); },
    threadToScene: (el) => { const c = C(); const t = (c.threads || []).find((x) => x.id === el.dataset.id); const s = c.sessions.find((x) => x.id === route().id); if (!t || !s) return;
      planOf(s).scenes.push({ id: uid(), txt: plain(t.txt), done: false, thread: t.id }); save(); render(); toast("Aggiunto alle scene"); },
    prepEnc: (el) => { const s = C().sessions.find((x) => x.id === route().id); const P = planOf(s); const id = el.dataset.id;
      P.encIds = P.encIds.includes(id) ? P.encIds.filter((x) => x !== id) : P.encIds.concat([id]); save(); render(); },
    prepEncNew: (el) => { const c = C(); const s = c.sessions.find((x) => x.id === el.dataset.id); const e = newEncounter(c, "Scontro della sessione " + (s.num || "")); planOf(s).encIds.push(e.id); save(); go("scontro", "crea/" + e.id); },
    prepMap: (el) => { const s = C().sessions.find((x) => x.id === route().id); const P = planOf(s); const id = el.dataset.id;
      P.mapIds = P.mapIds.includes(id) ? P.mapIds.filter((x) => x !== id) : P.mapIds.concat([id]); save(); render(); },
    prepDone: () => { save(); go("diario"); toast("Preparazione salvata"); },
    prepClaude: async (el) => { const c = C(); const s = c.sessions.find((x) => x.id === el.dataset.id); if (!s) return;
      if (await copyText(prepClaudeText(c, s), "Copiato")) toast("Copiato: incollalo in una chat con Claude", { label: "Apri Claude", run: () => window.open("https://claude.ai/new", "_blank", "noopener") }); },
    prepPaste: (el) => { const c = C(); const s = c.sessions.find((x) => x.id === el.dataset.id);
      openModal("Incolla la risposta di Claude", `<p class="sub">Incolla tutta la risposta: riconosco le sezioni (Personaggi, Apertura, Scene, Segreti, Luoghi e PNG, Scontri, Ricompense) e le aggiungo ai campi, senza cancellare quello che hai già scritto.</p><textarea name="txt" rows="12"></textarea>`,
        { saveLabel: "Importa", onSave: () => { const r = parsePrep(form().txt); const P = planOf(s); let n = 0;
          const addTxt = (k, arr, bullet) => { if (!arr || !arr.length) return; const t = arr.map((x) => (bullet ? "- " : "") + x).join("\n"); P[k] = P[k] ? P[k] + "\n\n" + t : t; n += arr.length; };
          addTxt("want", r.want, true); addTxt("opening", r.opening, false); addTxt("cast", r.cast, true); addTxt("rewards", r.rewards, true);
          (r.scenes || []).forEach((t) => { P.scenes.push({ id: uid(), txt: t, done: false }); n++; });
          (r.secrets || []).forEach((t) => { (c.secrets = c.secrets || []).push({ id: uid(), txt: t, created: Date.now(), revealed: false, from: s.id }); n++; });
          if (r.encs && r.encs.length) { s.prep = (s.prep ? s.prep + "\n\n" : "") + "Idee di scontro:\n" + r.encs.map((x) => "- " + x).join("\n"); n += r.encs.length; }
          if (!n) return toast("Non trovo le sezioni: controlla che la risposta abbia i titoli ## Apertura, ## Scene…");
          save(); closeModal(); render(); toast(`${n} voci importate`); } }); },
  };
  const liveActions = {
    liveStart: () => liveStartDialog(),
    quickNote: () => quickNote(),
    noteTag: (el) => { noteTagSel = noteTagSel === el.dataset.k ? "" : el.dataset.k; $$('[data-a="noteTag"]').forEach((b) => b.classList.toggle("on", b.dataset.k === noteTagSel)); },
    dictate: (el) => { const ta = $("#" + el.dataset.for); if (ta) dictateInto(ta, el); },
    noteAdd: (el) => { const id = el.dataset.from || "liveNote"; const ta = $("#" + id); const txt = ta ? ta.value.trim() : "";
      if (!txt) return toast("Scrivi o detta la nota");
      if (rec) rec.stop();
      logEv(txt, { k: "nota", tag: noteTagSel }); noteTagSel = ""; ta.value = ""; save();
      if (id === "qNote") closeModal(); render(); toast("Nota aggiunta al diario"); },
    spotPc: (el) => { const c = C(); const s = liveSession(c); if (!s) return; const p = c.pcs.find((x) => x.id === el.dataset.id);
      s.spot = s.spot || {}; (s.spot[p.id] = s.spot[p.id] || []).push(Date.now()); logEv(`Riflettori su ${p.name}`, { k: "spot" }); save(); render(); },
    logEdit: (el) => { const c = C(); const s = c.sessions.find((x) => (x.log || []).some((e) => e.id === el.dataset.id)); if (!s) return; const e = s.log.find((x) => x.id === el.dataset.id);
      openModal("Voce del diario · " + hhmm(e.t), `${area("Testo", "txt", e.txt, 3)}${select("Tipo", "tag", e.tag || "", NOTE_TAGS)}`,
        { extra: `<button class="btn ghost danger" data-a="logDel" data-id="${e.id}">Elimina</button>`, onSave: () => { const f = form(); e.txt = f.txt.trim() || e.txt; e.tag = f.tag; if (e.k === "auto" && f.tag) e.k = "nota"; save(); closeModal(); render(); } }); },
    logDel: (el) => { closeModal(); withUndo("Voce eliminata dal diario", (c) => { c.sessions.forEach((s) => { if (s.log) s.log = s.log.filter((e) => e.id !== el.dataset.id); }); }); },
    liveEnd: () => { const c = C(); const s = liveSession(c); if (!s) return;
      const notes = (s.log || []).filter((e) => e.k === "nota").length;
      openModal("Termina la sessione", `<p>${dur(Date.now() - s.startedAt)} di gioco, ${(s.log || []).length} voci nel diario (${notes} note tue).</p><p class="sub">Il diario resta nella sessione: lo trovi nel Diario.</p>`,
        { saveLabel: "Termina e chiudi", focus: false, onSave: () => { logEv("Sessione terminata", { k: "imp" }); s.endedAt = Date.now(); c.live = null; save(); closeModal(); go("diario", "chiudi/" + s.id); updateLiveUI(); } }); },
    recapShare: (el) => { const s = C().sessions.find((x) => x.id === el.dataset.id); if (!s) return; const txt = `📜 ${s.num ? "Sessione " + s.num + " · " : ""}${s.title || ""}\n\n${plain(s.publicRecap || "")}`.trim(); shareText(txt, s.title || "Riassunto"); },
    claudeExport: async (el) => { const c = C(); const s = c.sessions.find((x) => x.id === el.dataset.id); if (!s) return;
      if (await copyText(claudeText(c, s), "Copiato per Claude")) toast("Copiato: incollalo in una chat con Claude", { label: "Apri Claude", run: () => window.open("https://claude.ai/new", "_blank", "noopener") }); },
    claudeShare: (el) => { const c = C(); const s = c.sessions.find((x) => x.id === el.dataset.id); if (s) shareText(claudeText(c, s), "Sessione " + (s.num || "")); },
    closeSave: (el) => { const c = C(); const s = c.sessions.find((x) => x.id === el.dataset.id); if (!s) return; commitThreads(c, s); s.closed = true; save(); go("diario"); toast("Sessione chiusa e salvata"); },
  };
  const driveName = (id) => DRV.names[id] || ((DRV.idx || []).find((x) => x.id === id) || {}).name || "Mappa";
  const drivePath = (id) => ((DRV.idx || []).find((x) => x.id === id) || {}).path || "";
  const VCOLORS = ["#e8402a", "#f2c14e", "#4fb3a6", "#ffffff", "#a17ae0"];
  const mapActions = {
    mapAdd: () => {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
      inp.addEventListener("change", async () => {
        const files = [...inp.files]; if (!files.length) return; let last = null, n = 0;
        for (const f of files) { toast(`Salvo ${++n} di ${files.length}…`); try { last = await addMapFromBlob(f, f.name); } catch (e) { toast("Immagine non leggibile: " + f.name); } }
        render(); if (files.length === 1 && last) { mapEditor(last); toast("Mappa salvata: dagli un nome e una categoria"); } else toast(`${n} mappe salvate`);
      });
      inp.click();
    },
    mapCat: (el) => { filters.mapCat = el.dataset.k; render(); },
    mapOpen: (el) => { const m = mapById(el.dataset.id); if (m) openMap(m); else toast("Mappa non più sul telefono"); },
    mapView: (el) => { const m = mapById(el.dataset.id); if (m) openViewer(m); },
    mapEdit: (el) => { const m = mapById(el.dataset.id); if (m) mapEditor(m); },
    mapDel: async (el) => { const m = mapById(el.dataset.id); if (!m) return; const blob = await idbGet("blobs", m.id);
      await idbDel("maps", m.id); await idbDel("blobs", m.id); MAPS = MAPS.filter((x) => x !== m); if (S.sync && S.sync.on) { S.sync.mapDeleted = (S.sync.mapDeleted || []).concat([m.id]); save(); } closeModal(); render();
      toast(`«${m.name}» eliminata`, { label: "Annulla", run: async () => { await idbPut("blobs", blob, m.id); await saveMapMeta(m); render(); toast("Ripristinata"); } }); },
    mapScene: (el) => { const c = C(); const id = el.dataset.id; c.sceneMaps = c.sceneMaps || [];
      if (c.sceneMaps.includes(id)) c.sceneMaps = c.sceneMaps.filter((x) => x !== id); else c.sceneMaps.unshift(id);
      save(); render(); const m = mapById(id); if (modalOpen && m && $("#modal-title").textContent === m.name && !$("#modal").classList.contains("full")) openMap(m);
      toast(c.sceneMaps.includes(id) ? "In scena: la trovi anche sul Tavolo" : "Tolta dalla scena"); },
    sceneClear: () => withUndo("Scena svuotata", (c) => { c.sceneMaps = []; }),
    mapSend: (el) => { const m = mapById(el.dataset.id); if (!m) return toast("Mappa non trovata"); sendFlow(() => composeMap(m), m.name, mapCaption(m)); },
    mapSendClean: (el) => { const m = mapById(el.dataset.id); if (!m) return; sendFlow(() => composeMap(Object.assign({}, m, { marks: [], fogAll: false })), m.name, mapCaption(m)); },
    sendReady: () => { closeModal(); if (sendFlow.ready) sendFlow.ready(); },
    vTool: (el) => { VW.tool = el.dataset.k; $$(".vtools .vt[data-a='vTool']").forEach((b) => b.classList.toggle("on", b.dataset.k === VW.tool)); },
    vColor: () => { VW.color = VCOLORS[(VCOLORS.indexOf(VW.color) + 1) % VCOLORS.length]; const b = $("#vcol"); if (b) b.style.color = VW.color; },
    vFogAll: () => { VW.m.fogAll = !VW.m.fogAll; const l = $("#fogLbl"); if (l) l.textContent = VW.m.fogAll ? "Togli nebbia" : "Nebbia su tutto"; if (VW.m.fogAll && VW.tool !== "reveal") A.vTool({ dataset: { k: "reveal" } }); vPaint(); vSave(); },
    vUndo: () => { const mk = VW.m.marks || []; if (!mk.length) return toast("Niente da annullare"); const k = mk.pop(); if (k.t === "pin") VW.pinN = Math.max(1, VW.pinN - 1); vPaint(); vSave(); },
    vClear: () => { const old = { marks: VW.m.marks || [], fogAll: VW.m.fogAll, pin: VW.pinN }; const m = VW.m; m.marks = []; m.fogAll = false; VW.pinN = 1; vPaint(); vSave(); const l = $("#fogLbl"); if (l) l.textContent = "Nebbia su tutto";
      toast("Segni cancellati", { label: "Annulla", run: () => { m.marks = old.marks; m.fogAll = old.fogAll; VW.pinN = old.pin; if (VW.m === m) vPaint(); saveMapMeta(m).then(render); } }); },
    vFit: () => vFit(),
    extOpen: (el) => { window.open(el.dataset.url, "_blank", "noopener"); },
    drvKey: () => openModal("Chiave API di Google Drive", `<p class="sub">Serve per sfogliare, cercare e inviare le mappe della raccolta senza uscire dall'app. È gratuita: le istruzioni sono nel file LEGGIMI. Resta solo su questo telefono.</p>${field("Chiave API", "key", S.settings.driveKey || "", "text", 'autocomplete="off" spellcheck="false" placeholder="AIza…"')}`,
      { onSave: async () => { const k = form().key.trim(); S.settings.driveKey = k; save(); DRV.cache = {}; closeModal(); render();
        if (!k) return toast("Chiave rimossa"); const L = lib(); if (!L || !L.folders.length) return toast("Chiave salvata");
        try { await driveList(L.folders[0].id); toast("Chiave funzionante"); render(); } catch (e) { toast("Drive: " + e.message); } } }),
    drvOpen: (el) => { const id = el.dataset.id; const cur = route(); if (cur.sub === "drive" && cur.id && cur.id !== id) DRV.parent = Object.assign(DRV.parent || {}, { [id]: cur.id }); filters.drvQ2 = ""; filters.drvLimit = 60; go("mappe", "drive/" + id); },
    drvBack: () => { const id = route().id; const p = (DRV.parent || {})[id]; filters.drvQ2 = ""; filters.drvLimit = 60; if (p) go("mappe", "drive/" + p); else go("mappe", "raccolta"); },
    drvRetry: (el) => { delete DRV.cache[el.dataset.id]; DRV.err = null; render(); },
    drvGrid: () => { filters.drvGrid = !filters.drvGrid; render(); },
    drvMore: () => { filters.drvLimit += 60; render(); },
    drvCat: (el) => { filters.drvCat = el.dataset.k; filters.drvLimit = 60; render(); },
    drvSearch: () => { const i = $("#drvQ"); filters.drvQ = i ? i.value.trim() : filters.drvQ; filters.drvLimit = 60; filters.drvCat = ""; if (route().sub === "cerca") render(); else go("mappe", "cerca"); },
    drvIndex: () => { if (DRV.indexing) return toast("Sto già indicizzando"); if (!driveKey()) return A.drvKey(); buildIndex(); },
    drvPreview: (el) => { const id = el.dataset.id; const nm = driveName(id);
      openModal(nm.replace(/\.[a-z0-9]{2,5}$/i, ""), `<div class="mapbig"><img src="${esc(driveThumb(id, 1600))}" alt="" referrerpolicy="no-referrer"></div><p class="sub">${esc(drivePath(id))}</p>
        <div class="row gap wrap"><button class="btn small" data-a="drvSave" data-id="${esc(id)}">⤓ Salva nelle mie (per disegnarci e usarla offline)</button><a class="btn small ghost" href="https://drive.google.com/file/d/${esc(id)}/view" target="_blank" rel="noopener">Apri in Drive ↗</a></div>`,
        { focus: false, extra: `<button class="btn primary big" data-a="drvSend" data-id="${esc(id)}">Invia</button>` }); },
    drvSend: (el) => { const id = el.dataset.id; sendFlow(() => driveShareBlob(id), driveName(id).replace(/\.[a-z0-9]{2,5}$/i, "")); },
    drvSave: async (el) => { const id = el.dataset.id; const ex = MAPS.find((m) => m.drive === id); if (ex) return toast("È già tra le tue mappe", { label: "Apri", run: () => openMap(ex) });
      toast("Scarico da Drive…"); try { const nm = driveName(id); const m = await addMapFromBlob(await driveBlob(id), nm, { drive: id, cat: guessCat(nm + " " + drivePath(id)) }); render();
        toast("Salvata tra le tue mappe", { label: "Apri", run: () => openMap(m) }); } catch (e) { toast("Non riuscito: " + e.message); } },
    libAddFolder: () => openModal("Aggiungi una cartella Drive", `${field("Nome", "name", "", "text", 'placeholder="Mappe di Ambraterra"')}${field("Link della cartella", "url", "", "url", 'placeholder="https://drive.google.com/drive/folders/…"')}${select("Categoria", "cat", "", [["", "Mista"]].concat(MAP_CATS.map(([k, v]) => [k, v])))}`,
      { onSave: () => { const f = form(); const m = String(f.url).match(/folders\/([\w-]{10,})/) || String(f.url).match(/[?&]id=([\w-]{10,})/) || String(f.url).match(/^([\w-]{20,})$/);
        if (!m) return toast("Link della cartella non riconosciuto"); const L = S.settings.mapLib || (S.settings.mapLib = { name: "Le mie cartelle Drive", folders: [] });
        if (L.folders.some((x) => x.id === m[1])) return toast("Cartella già presente");
        L.folders.push({ id: m[1], name: f.name.trim() || "Cartella", it: f.name.trim() || "Cartella", cat: f.cat }); save(); closeModal(); go("mappe", "raccolta"); render(); toast("Cartella aggiunta"); } }),
    libRemove: () => { const old = S.settings.mapLib; S.settings.mapLib = null; save(); render(); toast("Raccolta scollegata", { label: "Annulla", run: () => { S.settings.mapLib = old; save(); render(); } }); },
    mapPickFor: (el) => { const kind = el.dataset.for, id = el.dataset.id;
      if (!MAPS.length) return toast("Nessuna mappa sul telefono: aggiungila da Mappe");
      openModal("Scegli una mappa", `<input type="search" id="mpQ" class="search" placeholder="Cerca"><div class="mapgrid" id="mpList">${MAPS.map((m) => `<button class="maptile pick" data-a="mapPicked" data-m="${m.id}" data-for="${esc(kind)}" data-id="${esc(id)}" data-name="${esc(m.name.toLowerCase())}"><span class="mapimg"><img src="${turl(m)}" alt=""></span><span class="mapmeta"><b>${esc(m.name)}</b></span></button>`).join("")}</div>`, { focus: false });
      $("#mpQ").addEventListener("input", (e) => { const q = e.target.value.toLowerCase(); $$("#mpList .maptile").forEach((b) => { b.hidden = q && !b.dataset.name.includes(q); }); }); },
    mapPicked: async (el) => { const m = mapById(el.dataset.m); const c = C(); const kind = el.dataset.for, id = el.dataset.id;
      if (kind === "place") { const w = c.world.find((x) => x.id === id); m.place = w.name; await saveMapMeta(m); closeModal(); A.viewWorld({ dataset: { id } }); toast("Mappa collegata al luogo"); }
      if (kind === "enc") { const e = encOf(c, id); e.mapId = m.id; e.updated = Date.now(); save(); closeModal(); render(); toast("Mappa collegata allo scontro"); } },
    encMapClear: (el) => { const e = encOf(C(), el.dataset.id); e.mapId = ""; save(); render(); },
  };
  const A = {
    go: (el) => { closeModal(); go(el.dataset.tab, el.dataset.sub); },
    modalSave: () => modalSave && modalSave(),
    closeModal,
    menu,
    newCampaign: () => openModal("Nuova campagna",
      `${field("Nome", "name", "")}${field("Ambientazione o modello di campagna", "frame", "", "text", 'placeholder="Era di Umbra, Il Mondo Nuovo, homebrew…"')}
       ${window.UMBRA_PACK ? check("Includi il pacchetto homebrew Era di Umbra (avversari, ambienti, tabelle)", "pack", false) : ""}`,
      { saveLabel: "Crea", onSave: () => { const f = form(); newCampaign(f.name.trim(), f.frame.trim(), f.pack); closeModal(); go("tavolo"); render(); toast("Campagna creata"); } }),
    switchCamp: (el) => { S.activeId = el.dataset.id; save(); closeModal(); go("tavolo"); render(); },
    renameCamp: (el) => { const c = S.campaigns[el.dataset.id];
      openModal("Campagna", `${field("Nome", "name", c.name)}${field("Ambientazione", "frame", c.frame)}`, { onSave: () => { const f = form(); c.name = f.name.trim() || c.name; c.frame = f.frame; save(); closeModal(); render(); } }); },
    delCamp: () => { const c = C(); if (!c) return;
      if (!confirm(`Eliminare definitivamente «${c.name}»? Esporta un backup prima, se ti serve.`)) return;
      if (S.sync && S.sync.base && S.sync.base[c.id]) S.sync.deleted = (S.sync.deleted || []).concat([c.id]);
      delete S.campaigns[c.id]; S.activeId = Object.keys(S.campaigns)[0] || null; save(); closeModal(); render(); },
    appRefresh: async () => { toast("Aggiorno l'app…");
      try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); } catch (_) {}
      setTimeout(() => location.reload(), 400); },
    importPack: () => { const n = importPack(C()); save(); closeModal(); render(); toast(n ? `${n} elementi aggiunti` : "Già tutto presente"); },
    exportAll: () => download(`lanterna-backup-${today()}.json`, S),
    exportCamp: () => { const c = C(); download(`lanterna-${slug(c.name)}-${today()}.json`, { kind: "lanterna-campaign", version: 1, campaign: c }); },
    importFile: () => $("#fileIn").click(),

    fearAdd: (el) => { const c = C(); c.fear = clamp(c.fear + num(el.dataset.d), 0, 12); save(); render(); },
    fearSet: (el) => { const c = C(); const i = num(el.dataset.i); c.fear = c.fear === i + 1 ? i : i + 1; save(); render(); },

    newPc: () => pcEditor(null),
    editPc: (el) => pcEditor(C().pcs.find((p) => p.id === el.dataset.id)),
    delPc: (el) => { closeModal(); withUndo("PG eliminato", (c) => { c.pcs = c.pcs.filter((p) => p.id !== el.dataset.id); }); },
    pcPip: (el) => { const p = C().pcs.find((x) => x.id === el.dataset.id); const f = el.dataset.f; const i = num(el.dataset.i); p[f] = num(p[f]) === i + 1 ? i : i + 1; save(); render(); },
    pcView: (el) => { const p = C().pcs.find((x) => x.id === el.dataset.id); if (!p) return; richSkip = p.id;
      openModal(p.name, `${reviewBanner("pc", p)}<div class="sub">${esc([p.ancestry, p.community, p.cls, p.subclass].filter(Boolean).join(" · "))}${p.level ? " · Liv. " + esc(p.level) : ""}${p.player ? " · " + esc(p.player) : ""}</div>
        <div class="sb-stats"><div><span>Evasione</span><b>${esc(p.evasion ?? "–")}</b></div><div><span>Soglie</span><b>${esc(p.major ?? "–")}/${esc(p.severe ?? "–")}</b></div><div><span>PF</span><b>${num(p.hp)}/${num(p.hpMax)}</b></div><div><span>Stress</span><b>${num(p.stress)}/${num(p.stressMax)}</b></div><div><span>Speranza</span><b>${num(p.hope)}</b></div></div>
        <p class="notes">${rich(p.notes || "Nessuna nota.")}</p>${linksBlock("pc", p)}`, { focus: false, extra: `<button class="btn primary" data-a="editPc" data-id="${p.id}">Modifica</button>` }); richSkip = null; },
    pcHopeAdd: (el) => { const p = C().pcs.find((x) => x.id === el.dataset.id); const mx = Math.max(0, num(p.hopeMax, 6) - num(p.scars)); p.hope = Math.min(mx, num(p.hope) + 1); save(); render(); toast(`${p.name}: Speranza ${p.hope}`); },
    pcCrit: (el) => { const p = C().pcs.find((x) => x.id === el.dataset.id); const mx = Math.max(0, num(p.hopeMax, 6) - num(p.scars)); p.hope = Math.min(mx, num(p.hope) + 1); p.stress = Math.max(0, num(p.stress) - 1); save(); render(); toast(`${p.name}: +1 Speranza, −1 Stress`); },
    sessionView: (el) => { const s = C().sessions.find((x) => x.id === el.dataset.id); if (!s) return;
      openModal((s.num ? "#" + s.num + " · " : "") + (s.title || "Sessione"), `${reviewBanner("session", s)}<div class="sub">${esc(s.date || "")}</div>${sessionBody(s).trim() || "<p class='sub'>Vuota.</p>"}`, { focus: false, extra: `<button class="btn primary" data-a="editSession" data-id="${s.id}">Modifica</button>` }); },
    open: (el) => openEntity(el.dataset.kind, el.dataset.id),

    syncTap: () => syncTap(true),
    syncStart: () => syncStart(),
    syncKeep: (el) => syncResolve(el.dataset.k),
    syncOff: () => { if (!confirm("Smettere di sincronizzare questo dispositivo? Le campagne restano qui e su Drive.")) return; const cfg = syncCfg(); cfg.on = false; cfg.base = {}; setTok(null); save(true); closeModal(); syncUI(); toast("Sincronizzazione disattivata su questo dispositivo"); },
    syncDevice: () => openModal("Nome di questo dispositivo", `${field("Nome", "dev", deviceName())}<p class="sub">Compare negli avvisi quando la stessa campagna è stata modificata in due posti.</p>`, { onSave: () => { syncCfg().device = form().dev.trim(); save(true); closeModal(); menu(); } }),

    atlasUpload: () => {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
      inp.addEventListener("change", async () => { const f = inp.files[0]; if (!f) return; toast("Salvo la mappa…");
        try { await atlasSetImage(C(), f, f.name); render(); toast("Mappa del mondo pronta: ora appoggia i luoghi"); } catch (e) { toast("Immagine non leggibile"); } });
      inp.click();
    },
    atlasPickMap: () => openModal("Scegli la mappa del mondo", `<div class="mapgrid">${MAPS.map((m) => `<button class="maptile" data-a="atlasUseMap" data-id="${m.id}"><img src="${turl(m)}" alt=""><span>${esc(m.name)}</span></button>`).join("")}</div>`, { focus: false }),
    atlasUseMap: (el) => { const c = C(); c.atlas = { mapId: el.dataset.id, pins: (c.atlas && c.atlas.pins) || {} }; AT.key = ""; save(); closeModal(); render(); },
    atlasRemove: () => withUndo("Mappa del mondo tolta (l'immagine resta nelle tue mappe)", (c) => { delete c.atlas; AT.sel = null; AT.place = null; }),
    atlasFit: () => { atlasFit(); },
    atlasKinds: () => { AT.allKinds = !AT.allKinds; render(); },
    atlasPlace: (el) => { const id = el.dataset.id; closeModal(); AT.place = AT.place === id ? null : id; const r = route(); if (r.tab === "mondo" && r.sub === "mappa") { render(); if (AT.place) setTimeout(() => { const st = $("#atStage"); if (st) st.scrollIntoView({ block: "center", behavior: "smooth" }); }, 30); } else go("mondo", "mappa"); },
    atlasCancel: () => { AT.place = null; render(); },
    atlasShow: (el) => { closeModal(); AT.focus = el.dataset.id; const r = route(); if (r.tab === "mondo" && r.sub === "mappa") render(); else go("mondo", "mappa"); },
    atlasUnpin: (el) => { const id = el.dataset.id; withUndo("Tolto dalla mappa", (c) => { if (c.atlas && c.atlas.pins) delete c.atlas.pins[id]; }); AT.sel = null; },
    atlasGo: (el) => { const c = C(); const k = el.dataset.kind, id = el.dataset.id;
      if (k === "world" && c.atlas && c.atlas.pins && c.atlas.pins[id]) { atlasSelect(id); atlasCenter(id); } else openEntity(k, id); },
    atlasNewPlace: () => { const before = new Set(C().world.map((x) => x.id)); worldEditor(null, "luogo");
      const t = setInterval(() => { if ($("#modal") && !$("#modal").hidden) return; clearInterval(t); const nw = C().world.find((x) => !before.has(x.id)); if (nw) { AT.place = nw.id; render(); toast("Ora tocca la mappa dove si trova"); } }, 300); },
    link: (el) => { const name = el.dataset.name; const hit = resolveLink(name);
      if (hit) return openEntity(hit.kind, hit.id);
      openModal(name, `<p>«${esc(name)}» non esiste ancora nella campagna. Vuoi crearlo nel Mondo?</p><div class="chips">${Object.entries(WORLD_ONE).map(([k, v]) => `<button class="chip" data-a="linkCreate" data-kind="${k}" data-name="${esc(name)}">${v}</button>`).join("")}</div>`, { focus: false }); },
    linkCreate: (el) => worldEditor(null, el.dataset.kind, el.dataset.name),
    linkPick: (el) => { const p = $(`#modal-body [data-panel="${el.dataset.for}"]`); if (p && !p.hidden) return hideLinkPanels(); showLinkPanel(el.dataset.for, "", null); },
    linkInsert: (el) => {
      const ta = $(`#modal-body textarea[name="${el.dataset.for}"]`); const panel = $(`#modal-body [data-panel="${el.dataset.for}"]`);
      const tok = "[[" + el.dataset.name + "]]";
      const caret = ta.dataset.caret != null && ta.dataset.caret !== "" ? num(ta.dataset.caret) : ta.value.length;
      const start = panel && panel.dataset.start !== "" ? num(panel.dataset.start) : caret;
      ta.value = ta.value.slice(0, start) + tok + ta.value.slice(caret);
      const pos = start + tok.length; ta.focus(); ta.setSelectionRange(pos, pos); ta.dataset.caret = pos; hideLinkPanels();
    },
    rollInline: (el) => { const e = el.dataset.e; const r = parseDice(e); if (!r) return; buzz(); logRoll(e, String(r.total)); toast(`${e} → ${r.total}   ${r.detail}`); },
    unitAttack: (el) => { const c = C(); const u = unit(el); const a = findAdv(c, u.advId); if (!a) return toast("Scheda non trovata");
      const d20 = rnd(20); const crit = d20 === 20 || (a.umbra && d20 >= 19); const tot = d20 + num(a.atk);
      const dm = parseDice(a.dmg); const extra = crit ? diceMax(a.dmg) : 0; const dmg = dm ? dm.total + extra : null;
      logRoll(`${u.name}: attacco`, crit ? `Critico ${tot}` : String(tot));
      openModal(`Attacco: ${u.name}`, `<div class="duality ${crit ? "crit" : ""}"><div class="tot">${tot}</div><div class="kind">${crit ? "Successo critico" : "contro l'Evasione del bersaglio"}</div>
        <div class="sub">d20 (${d20}) ${num(a.atk) >= 0 ? "+" : "−"} ${Math.abs(num(a.atk))}${a.umbra ? " · Toccato dall'Umbra: critico con 19-20" : ""}</div>
        <p><b>${esc(a.weapon || "Attacco")}</b> · ${esc(a.range || "")}</p>
        ${dmg != null ? `<div class="rollbig">${dmg}<small>${esc(a.dmg)} ${esc(a.dmgType || "")}${crit && extra ? ` + ${extra} (critico: massimo dei dadi)` : ""}${dm ? " · " + esc(dm.detail) : ""}</small></div>` : ""}
        ${u.minion ? `<p class="sub">Attacco di gruppo: ogni Seguace che colpisce infligge questo danno.</p>` : ""}</div>`,
        { focus: false, extra: `<button class="btn primary" data-a="unitAttack" data-uid="${u.uid}">Tira ancora</button>` }); },
    search: searchSheet,
    relAdd: (el) => relPicker(el.dataset.kind, el.dataset.id),
    relKind: (el) => { const st = relPicker.state; st.r = st.r === el.dataset.k ? "" : el.dataset.k; $$("#relKinds .chip").forEach((b) => b.classList.toggle("on", b.dataset.k === st.r)); },
    relPick: (el) => { const st = relPicker.state; const c = C(); const src = st.kind === "pc" ? c.pcs.find((y) => y.id === st.id) : c.world.find((y) => y.id === st.id); if (!src) return;
      src.rels = src.rels || []; if (!src.rels.some((r) => r.kind === el.dataset.kind && r.id === el.dataset.id && r.r === st.r)) src.rels.push({ kind: el.dataset.kind, id: el.dataset.id, r: st.r });
      save(); openEntity(st.kind, st.id); toast("Legame aggiunto"); },
    relDel: (el) => { const c = C(); const kind = el.dataset.kind, id = el.dataset.id; const src = kind === "pc" ? c.pcs.find((y) => y.id === id) : c.world.find((y) => y.id === id); if (!src || !src.rels) return;
      const old = src.rels.slice(); src.rels.splice(num(el.dataset.i), 1); save(); openEntity(kind, id);
      toast("Legame tolto", { label: "Annulla", run: () => { src.rels = old; save(); openEntity(kind, id); } }); },
    gen: (el) => { genState.last = null; genSheet(el.dataset.k); },
    genKind: (el) => { genState.kind = el.dataset.k; genState.last = null; genSheet(); },
    genCult: (el) => { genState.culture = el.dataset.k; genState.last = null; genSheet(); },
    genTab: (el) => { genState.table = el.dataset.k; genState.last = null; genSheet(); },
    genRar: (el) => { genState.rarity = el.dataset.k; genState.last = null; genSheet(); },
    genAgain: () => { genState.last = null; genSheet(); },
    genCopy: () => { if (genState.last) copyText(genText(genState.last), "Copiato"); },
    genLog: () => { const r = genState.last; if (!r) return; logEv(`${r.kind === "png" ? "PNG" : r.title}: ${r.kind === "png" ? r.title + " — " + r.lines.map((l) => l[1]).join("; ") : r.lines.map((l) => l[1]).join("; ")}`, { k: "nota", tag: r.kind === "png" ? "png" : "" }); save(); toast("Aggiunto al diario della serata"); },
    genOpt: (el) => { const o = el.dataset.o; genState[o] = o === "tier" ? num(el.dataset.k, 0) : el.dataset.k; genState.last = null; genSheet(); },
    genEnv: () => { const r = genState.last; if (!r || !r.env) return; const c = C(); const e = r.env;
      const env = { id: uid(), name: r.title, tier: e.tier, type: e.tipo, desc: r.read, impulses: cap(e.imp), adversaries: (r.advs || []).map((x) => x.name).join(", "), difficulty: e.D,
        features: e.feats.concat([{ name: "Domanda ai giocatori", type: "Passiva", text: (r.lines.find((l) => l[0] === "Chiedete ai giocatori") || ["", ""])[1] }]), source: "Al volo" };
      c.environments.push(env); save(); toast("Ambiente salvato nel bestiario", { label: "Apri", run: () => A.viewEnv({ dataset: { id: env.id } }) }); },
    genSecret: () => { const r = genState.last; if (!r || !r.secret) return; const c = C(); (c.secrets = c.secrets || []).push({ id: uid(), txt: r.secret, created: Date.now(), revealed: false }); save(); toast("Aggiunto ai segreti: lo trovi nella preparazione della sessione"); },
    genSave: () => { const r = genState.last; if (!r) return; const c = C(); const isPlace = r.kind === "luogo";
      const body = (r.read ? r.read + "\n" : "") + r.lines.map(([k, v]) => `${k}: ${v}`).join("\n") + (r.advs && r.advs.length ? `\n${isPlace ? "Avversari possibili" : "Se si combatte"}: ${r.advs.map((x) => `[[${x.name}]]`).join(", ")}` : "");
      const w = isPlace ? { id: uid(), kind: "luogo", name: r.title, subtitle: (r.sub || "").split(" · ")[0], tags: "al volo", notes: body } : { id: uid(), kind: "png", name: r.title, subtitle: r.arch || "", tags: "al volo", notes: body };
      c.world.push(w); save(); closeModal(); render(); toast(isPlace ? "Luogo salvato nel Mondo" : "PNG salvato nel Mondo", { label: "Apri", run: () => A.viewWorld({ dataset: { id: w.id } }) }); },
    rules: () => rulesSheet(),
    genOpen: () => genSheet(),
    toastAct: () => { const f = toast._act; toast._act = null; $("#toast").classList.remove("show"); if (f) f(); },

    pcCond: (el) => { const p = C().pcs.find((x) => x.id === el.dataset.id); toggleIn(p, "conditions", el.dataset.k); save(); render(); },
    pcDamage: (el) => { const p = C().pcs.find((x) => x.id === el.dataset.id);
      damageDialog("Danno a " + p.name, p, (m, d, usedArmor) => { p.hp = clamp(num(p.hp) + m, 0, num(p.hpMax, 6)); if (usedArmor) p.armor = num(p.armor) + 1; save(); toast(`${p.name}: ${m} PF`); }); },
    restAll: () => openModal("Riposo", `<p>Il riposo breve e quello lungo cambiano cose diverse, e ogni PG sceglie le proprie mosse di interludio. Qui puoi azzerare in blocco ciò che vuoi.</p>
      ${check("Azzera PF segnati", "hp", false)}${check("Azzera Stress", "stress", false)}${check("Ripara l'Armatura", "armor", true)}${check("Rimuovi le condizioni", "cond", true)}`,
      { saveLabel: "Applica a tutti", onSave: () => { const f = form(); C().pcs.forEach((p) => { if (f.hp) p.hp = 0; if (f.stress) p.stress = 0; if (f.armor) p.armor = 0; if (f.cond) p.conditions = []; }); save(); closeModal(); render(); } }),

    newClock: () => clockEditor(null),
    editClock: (el) => clockEditor(C().clocks.find((k) => k.id === el.dataset.id)),
    delClock: (el) => { closeModal(); withUndo("Conto alla rovescia eliminato", (c) => { c.clocks = c.clocks.filter((k) => k.id !== el.dataset.id); }); },
    clockAdd: (el) => { const k = C().clocks.find((x) => x.id === el.dataset.id); advanceClock(k, num(el.dataset.d)); save(); render(); },
    clockSet: (el) => { const k = C().clocks.find((x) => x.id === el.dataset.id); const i = num(el.dataset.i); k.value = k.value === i + 1 ? i : i + 1; if (k.value >= k.max) toast(`«${k.name}» si innesca`); save(); render(); },

    addUnit: () => pickAdversary("Aggiungi allo scontro", (a) => { const c = C(); spawn(c, a, a.role === "Seguace" ? Math.max(1, c.pcs.length || 4) : 1); save(); closeModal(); render(); toast(a.name + " in scena"); }),
    pick: (el) => { const a = findAdv(C(), el.dataset.id); if (a && pickAdversary.cb) pickAdversary.cb(a); },
    endCombat: () => { const c0 = C(); const encId = c0.combat.encId;
      withUndo("Scontro terminato", (c) => { c.combat.units = []; c.clocks = c.clocks.filter((x) => !x.encId);
        const e = encId && encOf(c, encId); if (e) { e.status = "giocato"; e.updated = Date.now(); e.items.forEach((it) => { delete it.inScene; }); } c.combat.encId = null; });
      if (encId && encOf(C(), encId)) setTimeout(() => A.encOutcome({ dataset: { id: encId } }), 50); },
    spotClear: () => { C().combat.units.forEach((u) => { u.spotlight = false; }); save(); render(); },
    spot: (el) => { const u = unit(el); u.spotlight = !u.spotlight; save(); render(); },
    unitPip: (el) => { const u = unit(el); const f = el.dataset.f; const i = num(el.dataset.i); u[f] = num(u[f]) === i + 1 ? i : i + 1; save(); render(); },
    unitCond: (el) => { const u = unit(el); toggleIn(u, "conditions", el.dataset.k); save(); render(); },
    unitDel: (el) => withUndo("Rimosso dalla scena", (c) => { c.combat.units = c.combat.units.filter((u) => u.uid !== el.dataset.uid); }),
    minionAdd: (el) => { const u = unit(el); u.count = Math.max(0, u.count + num(el.dataset.d)); save(); render(); },
    unitDamage: (el) => { const u = unit(el);
      if (u.minion) {
        openModal("Danno a " + u.name, `${field("Danno inflitto", "dmg", "", "number", 'inputmode="numeric"')}<p class="sub">Il bersaglio cade; ogni ${u.value} danni ne cade un altro entro portata.</p>`,
          { saveLabel: "Applica", onSave: () => { const d = num(form().dmg); if (d <= 0) return closeModal(); const k = 1 + Math.floor(d / u.value); u.count = Math.max(0, u.count - k); save(); closeModal(); render(); toast(`${k} Seguaci sconfitti`); } });
        return;
      }
      damageDialog("Danno a " + u.name, u, (m) => { u.hp = clamp(num(u.hp) + m, 0, u.hpMax); save(); toast(`${u.name}: ${m} PF${u.hp >= u.hpMax ? " — sconfitto" : ""}`); }); },
    unitSheet: (el) => { const u = unit(el); const a = findAdv(C(), u.advId); if (a) openModal(a.name, statBlock(a, true), { focus: false }); else toast("Scheda non più nel bestiario"); },

    encFilter: (el) => { filters.encStatus = el.dataset.k; render(); },
    encNew: () => { const c = C(); const e = newEncounter(c); save(); go("scontro", "crea/" + e.id); },
    encOpen: (el) => { closeModal(); go("scontro", "crea/" + el.dataset.id); },
    encGenerate: () => { const c = C();
      openModal("Genera una bozza", `<p class="sub">Riempie il budget di Punti Battaglia con avversari del rango scelto. Poi puoi rifinire tutto a mano.</p>
        <div class="three">${field("PG", "party", c.pcs.length || 4, "number")}${select("Rango", "tier", partyTierOf(c), [1, 2, 3, 4])}${select("Fonte", "src", "", SOURCES)}</div>
        ${select("Stile", "style", "equilibrato", Object.entries(STYLES))}
        ${field("Tema (facoltativo)", "theme", "", "text", 'placeholder="demone, non morto, bandito, drago…"')}`,
        { saveLabel: "Genera", focus: false, onSave: () => { const f = form(); const e = newEncounter(c, "Scontro generato");
          e.partySize = clamp(num(f.party, 4), 1, 10); e.partyTier = num(f.tier, 1);
          const n = generatePlan(c, e, { tier: e.partyTier, src: f.src, style: f.style, theme: f.theme });
          if (!n) { c.encounters = c.encounters.filter((x) => x !== e); return toast("Nessun avversario adatto con questi filtri"); }
          if (f.theme) e.name = "Scontro: " + f.theme; save(); closeModal(); go("scontro", "crea/" + e.id); toast(f.theme && !generatePlan.themed ? "Nessun avversario a tema: bozza generica" : "Bozza generata"); } }); },
    encFill: (el) => { const c = C(); const e = encOf(c, el.dataset.id);
      openModal("Riempi il budget", `<p class="sub">Aggiunge avversari del rango ${esc(e.partyTier)} finché il budget è pieno. Gli avversari già presenti vengono sostituiti; i rinforzi restano.</p>
        ${select("Stile", "style", "equilibrato", Object.entries(STYLES))}${select("Fonte", "src", "", SOURCES)}${field("Tema (facoltativo)", "theme", "", "text", 'placeholder="demone, non morto, bandito…"')}`,
        { saveLabel: "Riempi", focus: false, onSave: () => { const f = form(); const snap = JSON.stringify(e.items);
          const n = generatePlan(c, e, { tier: e.partyTier, src: f.src, style: f.style, theme: f.theme }); e.updated = Date.now(); save(); closeModal(); render();
          toast(!n ? "Nessun avversario adatto" : f.theme && !generatePlan.themed ? "Nessun avversario a tema: composizione generica" : "Composizione generata", n ? { label: "Annulla", run: () => { e.items = JSON.parse(snap); save(); render(); } } : null); } }); },
    encStatus: (el) => { const e = encOf(C(), route().id); e.status = el.dataset.k; e.updated = Date.now(); save(); render(); },
    encMod: (el) => { const e = encOf(C(), route().id); e.mods = e.mods || {}; e.mods[el.dataset.k] = !e.mods[el.dataset.k]; e.updated = Date.now(); save(); render(); },
    encAdd: () => { const c = C(); const e = encOf(c, route().id);
      pickMany("Aggiungi avversari", e.partyTier, (a) => { const ex = e.items.find((x) => x.advId === a.id && !x.reinf); const step = a.role === "Seguace" ? Math.max(1, num(e.partySize, 4)) : 1;
        if (ex) ex.qty += step; else e.items.push({ advId: a.id, qty: step }); e.updated = Date.now(); save(); render(); }); },
    pmAdd: (el) => { const a = findAdv(C(), el.dataset.id); if (a && pickMany.cb) { buzz(); pickMany.cb(a); } },
    encQty: (el) => { const c = C(); const e = encOf(c, route().id); const it = e.items[num(el.dataset.i)]; const a = findAdv(c, it.advId);
      const step = a && a.role === "Seguace" ? Math.max(1, num(e.partySize, 4)) : 1; it.qty += num(el.dataset.d) * step;
      if (it.qty <= 0) { const snap = JSON.stringify(e.items); e.items.splice(num(el.dataset.i), 1); toast("Rimosso", { label: "Annulla", run: () => { e.items = JSON.parse(snap); save(); render(); } }); }
      e.updated = Date.now(); save(); render(); },
    encLineDel: (el) => { const e = encOf(C(), route().id); e.items.splice(num(el.dataset.i), 1); save(); render(); },
    encLineEdit: (el) => { const c = C(); const e = encOf(c, route().id); const i = num(el.dataset.i); const it = e.items[i]; const a = findAdv(c, it.advId);
      openModal(a ? a.name : "Voce", `${field("Nome in scena (per esempio un reskin)", "label", it.label || "", "text", `placeholder="${esc(a ? a.name : "")}"`)}
        ${field("Nota breve", "note", it.note || "", "text", 'placeholder="sui ballatoi, protegge Ossilde…"')}
        ${check("Rinforzo: fuori budget, entra durante lo scontro", "reinf", it.reinf)}
        ${field("Quantità", "qty", it.qty, "number")}`,
        { focus: false, extra: `${a && num(a.tier) !== num(e.partyTier) ? `<button class="btn ghost" data-a="encLineAdapt" data-i="${i}">Adatta al Rango ${esc(e.partyTier)}</button>` : ""}${a ? `<button class="btn ghost" data-a="viewAdv" data-id="${a.id}">Scheda</button>` : ""}<button class="btn ghost danger" data-a="encLineRemove" data-i="${i}">Rimuovi</button>`,
          onSave: () => { const f = form(); it.label = f.label.trim(); it.note = f.note.trim(); it.reinf = f.reinf; it.qty = Math.max(1, num(f.qty, 1)); e.updated = Date.now(); save(); closeModal(); render(); } }); },
    encLineRemove: (el) => { const e = encOf(C(), route().id); const snap = JSON.stringify(e.items); e.items.splice(num(el.dataset.i), 1); save(); closeModal(); render();
      toast("Rimosso dalla composizione", { label: "Annulla", run: () => { e.items = JSON.parse(snap); save(); render(); } }); },
    encScene: (el) => { const e = encOf(C(), el.dataset.id);
      openModal("Scena e tattiche", `${area("Funzione narrativa: perché esiste questo scontro", "purpose", e.purpose, 3)}${area("Motivazioni e tattiche degli avversari", "motives", e.motives, 3)}
        ${area("Terreno e ambiente dinamico", "terrain", e.terrain, 3)}${area("L'altra via: resa, fuga, negoziato, condizioni di vittoria alternative", "exit", e.exit, 3)}
        ${area("Ricompense e conseguenze", "reward", e.reward, 2)}${area("Note", "notes", e.notes, 3)}`,
        { focus: false, onSave: () => { const f = form(); ["purpose", "motives", "terrain", "exit", "reward", "notes"].forEach((k) => { e[k] = f[k]; }); e.updated = Date.now(); save(); closeModal(); render(); } }); },
    encOutcome: (el) => { const e = encOf(C(), el.dataset.id);
      openModal("Esito dello scontro", `${area("Com'è andata? Chi è caduto, cosa hanno ottenuto, cosa è cambiato", "outcome", e.outcome, 5)}`,
        { focus: false, onSave: () => { e.outcome = form().outcome; e.updated = Date.now(); if (e.outcome.trim()) logEv(`Esito di «${e.name}»: ${e.outcome.trim()}`, { k: "nota" }); save(); closeModal(); render(); } }); },
    encClockAdd: (el) => { const e = encOf(C(), el.dataset.id);
      openModal("Conto alla rovescia dello scontro", `${field("Nome", "name", "")}<div class="two">${select("Tipo", "kind", "conseguenza", Object.entries(CLOCK_KINDS))}${field("Caselle", "max", 4, "number")}</div>`,
        { onSave: () => { const f = form(); if (!f.name.trim()) return toast("Serve un nome"); e.clocks.push({ name: f.name.trim(), kind: f.kind, max: clamp(num(f.max, 4), 1, 16) }); save(); closeModal(); render(); } }); },
    encClockDel: (el) => { const e = encOf(C(), route().id); e.clocks.splice(num(el.dataset.i), 1); save(); render(); },
    encDup: (el) => { const c = C(); const src = encOf(c, el.dataset.id); const e = normEnc(c, clone(src)); e.id = uid(); e.name += " (copia)"; e.status = "bozza"; e.outcome = ""; e.created = e.updated = Date.now(); c.encounters.unshift(e); save(); go("scontro", "crea/" + e.id); toast("Scontro duplicato"); },
    encDel: (el) => { const id = el.dataset.id; go("scontro", "scontri"); withUndo("Scontro eliminato", (c) => { c.encounters = c.encounters.filter((x) => x.id !== id); }); },
    encPreview: (el) => { const c = C(); const e = encOf(c, el.dataset.id); openModal(e.name, encPreviewHtml(c, e), { focus: false, extra: `<button class="btn primary" data-a="encStart" data-id="${e.id}">Avvia</button>` }); },
    encShare: async (el) => { const c = C(); const e = encOf(c, el.dataset.id); const text = encText(c, e);
      try { if (navigator.share) { await navigator.share({ title: e.name, text }); return; } } catch (_) { return; }
      try { await navigator.clipboard.writeText(text); toast("Copiato negli appunti"); }
      catch (_) { openModal("Testo dello scontro", `<textarea rows="14" readonly class="sharetext">${esc(text)}</textarea>`, { focus: false }); } },
    encStart: (el) => { const c = C(); const e = encOf(c, el.dataset.id); const k = planCost(c, e);
      if (!k.lines.some((l) => !l.reinf)) return toast("Aggiungi almeno un avversario");
      closeModal();
      withUndo(`«${e.name}» avviato`, (cc) => {
        cc.combat.units = []; cc.clocks = cc.clocks.filter((x) => !x.encId);
        k.lines.filter((l) => !l.reinf).forEach((l) => spawn(cc, l.a, l.qty, l.it.label));
        cc.combat.encId = e.id; if (e.envId) cc.combat.envId = e.envId;
        e.clocks.forEach((x) => cc.clocks.push({ id: uid(), name: x.name, kind: x.kind, max: x.max, value: 0, notes: "Scontro: " + e.name, encId: e.id }));
        if (e.status === "bozza") e.status = "pronto"; e.updated = Date.now();
      });
      go("scontro"); },
    reinfIn: (el) => { const c = C(); const e = encOf(c, c.combat.encId); const it = e && e.items[num(el.dataset.i)]; const a = it && findAdv(c, it.advId); if (!a) return;
      spawn(c, a, it.qty, it.label); it.inScene = (it.inScene || 0) + 1; save(); render(); toast(`${it.label || a.name} entra in scena`); },

    newAdv: () => advEditor(null),
    viewAdv: (el) => { const a = findAdv(C(), el.dataset.id);
      openModal(a.name, statBlock(a, true) + backlinkBlock(a.name), { focus: false, extra: `${a.srd ? "" : `<button class="btn ghost" data-a="advDel" data-id="${a.id}">Elimina</button>`}<button class="btn ghost" data-a="advAdapt" data-id="${a.id}">Adatta al rango</button><button class="btn ghost" data-a="advDup" data-id="${a.id}">${a.srd ? "Copia e modifica" : "Duplica"}</button>${a.srd ? "" : `<button class="btn ghost" data-a="advEdit" data-id="${a.id}">Modifica</button>`}<button class="btn primary" data-a="advSpawn" data-id="${a.id}">In scena</button>` }); },
    advEdit: (el) => advEditor(C().bestiary.find((x) => x.id === el.dataset.id)),
    advAdapt: (el) => adaptDialog(el.dataset.id),
    adaptTo: (el) => { const st = adaptDialog.state; st.to = num(el.dataset.t); st.draw(); },
    adaptSave: () => { const st = adaptDialog.state; const c = C(); const a = scaleAdv(st.src, st.to);
      const ex = c.bestiary.find((x) => x.adapted && x.adapted.src === st.src.id && x.adapted.to === a.tier);
      const res = ex || a; if (!ex) c.bestiary.push(a);
      if (st.after && st.after.enc) { const e = encOf(c, st.after.enc); const it = e && e.items[st.after.i]; if (it) { it.advId = res.id; e.updated = Date.now(); } }
      save(); closeModal(); render(); toast(ex ? "Esisteva già: uso la copia adattata" : `Creato «${res.name}»`, { label: "Apri", run: () => A.viewAdv({ dataset: { id: res.id } }) }); },
    encAdaptAll: () => { const c = C(); const e = encOf(c, route().id); if (!e) return; let n = 0;
      e.items.forEach((it) => { const a = findAdv(c, it.advId); if (!a || num(a.tier) === num(e.partyTier)) return;
        let res = c.bestiary.find((x) => x.adapted && x.adapted.src === a.id && x.adapted.to === num(e.partyTier));
        if (!res) { res = scaleAdv(a, e.partyTier); c.bestiary.push(res); } it.advId = res.id; n++; });
      e.updated = Date.now(); save(); render(); toast(n ? `${n} ${n === 1 ? "avversario adattato" : "avversari adattati"} al Rango ${e.partyTier}` : "Tutti già del rango giusto"); },
    encLineAdapt: (el) => { const c = C(); const e = encOf(c, route().id); const i = num(el.dataset.i); const a = findAdv(c, e.items[i].advId); if (!a) return; adaptDialog(a.id, { enc: e.id, i, to: num(e.partyTier) }); },
    advDup: (el) => { const c = C(); const src = findAdv(c, el.dataset.id); const a = clone(src); a.id = uid(); delete a.srd; a.source = src.srd ? src.source + " (modificato)" : a.source; a.name += src.srd ? "" : " (copia)"; c.bestiary.push(a); save(); advEditor(a); },
    advDel: (el) => { closeModal(); withUndo("Avversario eliminato", (c) => { c.bestiary = c.bestiary.filter((x) => x.id !== el.dataset.id); }); },
    advSpawn: (el) => { const c = C(); const a = findAdv(c, el.dataset.id); spawn(c, a, a.role === "Seguace" ? Math.max(1, c.pcs.length || 4) : 1); save(); closeModal(); go("scontro"); render(); toast(a.name + " in scena"); },
    featAdd: () => { $("#feats").insertAdjacentHTML("beforeend", featRow()); },
    featDel: (el) => el.closest(".feat-row").remove(),

    newEnv: () => envEditor(null),
    viewEnv: (el) => { const e = findEnv(C(), el.dataset.id);
      openModal(e.name, envBlock(e, false, true) + backlinkBlock(e.name), { focus: false, extra: `${e.srd ? "" : `<button class="btn ghost" data-a="envDel" data-id="${e.id}">Elimina</button>`}<button class="btn ghost" data-a="envEdit" data-id="${e.id}">${e.srd ? "Copia e modifica" : "Modifica"}</button><button class="btn primary" data-a="envUse" data-id="${e.id}">Usa nello scontro</button>` }); },
    envEdit: (el) => { const c = C(); const e = findEnv(c, el.dataset.id);
      if (e.srd) { const k = clone(e); k.id = uid(); delete k.srd; k.source = e.source + " (modificato)"; c.environments.push(k); save(); envEditor(k); } else envEditor(e); },
    envDel: (el) => { closeModal(); withUndo("Ambiente eliminato", (c) => { c.environments = c.environments.filter((x) => x.id !== el.dataset.id); if (c.combat.envId === el.dataset.id) c.combat.envId = ""; }); },
    envUse: (el) => { C().combat.envId = el.dataset.id; save(); closeModal(); go("scontro"); render(); },

    newTable: () => tableEditor(null),
    editTable: (el) => tableEditor(C().tables.find((x) => x.id === el.dataset.id)),
    delTable: (el) => { closeModal(); withUndo("Tabella eliminata", (c) => { c.tables = c.tables.filter((x) => x.id !== el.dataset.id); }); },
    rollTable: (el) => { const t = C().tables.find((x) => x.id === el.dataset.id); const r = rnd(t.die);
      const e = t.entries.find(([a, b]) => r >= a && r <= b); logRoll(t.name, `${r}`);
      openModal(t.name, `<div class="rollbig">${r}<small>d${t.die}</small></div><p class="tableres">${e ? rich(e[2]) : "Nessuna voce per questo risultato."}</p>`, { focus: false, extra: `<button class="btn primary" data-a="rollTable" data-id="${t.id}">Tira ancora</button>` }); },

    revFilter: (el) => { filters.revSrc = el.dataset.k; render(); },
    revOpen: (el) => { const t = el.dataset.t, id = el.dataset.id;
      if (t === "enc") return go("scontro", "crea/" + id);
      if (t === "clock") return clockEditor(revFind(C(), t, id));
      openEntity({ world: "world", pc: "pc", session: "session", adv: "adv", env: "env" }[t], id); },
    revOk: (el) => { const c = C(); const x = revFind(c, el.dataset.t, el.dataset.id); if (!x) return; const old = x.review; delete x.review; save(); closeModal(); render();
      toast(`«${revName(el.dataset.t, x)}» confermata`, { label: "Annulla", run: () => { x.review = old; save(); render(); } }); },
    revOkManual: () => withUndo("Voci del manuale confermate", (c) => { reviewItems(c).forEach((i) => { if (i.x.review.src === "manuale") delete i.x.review; }); }),
    revEdit: (el) => { const t = el.dataset.t, x = revFind(C(), t, el.dataset.id); if (!x) return;
      if (t === "world") worldEditor(x); else if (t === "pc") pcEditor(x); else if (t === "clock") clockEditor(x); else if (t === "session") sessionEditor(x);
      else if (t === "enc") { closeModal(); go("scontro", "crea/" + x.id); } else if (t === "adv") advEditor(x); else if (t === "env") envEditor(x); },
    revDel: (el) => { const t = el.dataset.t, id = el.dataset.id; const x = revFind(C(), t, id); if (!x) return; closeModal();
      withUndo(`«${revName(t, x)}» eliminata`, (c) => { c[REV_COLL[t]] = c[REV_COLL[t]].filter((y) => y.id !== id); }); },
    newWorld: () => worldEditor(null),
    worldKind: (el) => { filters.worldKind = el.dataset.k; render(); },
    viewWorld: (el) => { const w = C().world.find((x) => x.id === el.dataset.id); if (!w) return; richSkip = w.id;
      openModal(w.name, `${reviewBanner("world", w)}<div class="sub">${WORLD_ONE[w.kind] || ""}${w.subtitle ? " · " + esc(w.subtitle) : ""}</div>${w.tags ? `<div class="chips">${w.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>` : ""}<p class="notes">${rich(w.notes || "Nessun appunto.")}</p>${w.kind === "luogo" ? (() => { const ms = MAPS.filter((m) => (m.place || "").toLowerCase() === w.name.toLowerCase()); return `<h4>Mappe</h4>${mapThumbs(C(), ms, `<p class="sub">Nessuna mappa collegata.</p>`)}<button class="btn small ghost" data-a="mapPickFor" data-for="place" data-id="${w.id}">+ Collega una mappa</button>`; })() : ""}${linksBlock("world", w)}`,
        { focus: false, extra: `${(() => { const n = w.name.toLowerCase(); const a = allAdv(C()).find((x) => { const m = x.name.toLowerCase(); return m === n || m.startsWith(n + ",") || m.startsWith(n + " ("); }); return a ? `<button class="btn ghost" data-a="viewAdv" data-id="${a.id}">Scheda avversario</button>` : ""; })()}${C().atlas && C().atlas.pins && C().atlas.pins[w.id] ? `<button class="btn ghost" data-a="atlasShow" data-id="${w.id}">🗺 Sulla mappa</button>` : C().atlas && w.kind === "luogo" ? `<button class="btn ghost" data-a="atlasPlace" data-id="${w.id}">🗺 Metti sulla mappa</button>` : ""}<button class="btn primary" data-a="editWorld" data-id="${w.id}">Modifica</button>` }); richSkip = null; },
    editWorld: (el) => worldEditor(C().world.find((x) => x.id === el.dataset.id)),
    delWorld: (el) => { closeModal(); withUndo("Voce eliminata", (c) => { c.world = c.world.filter((x) => x.id !== el.dataset.id); }); },

    newSession: () => sessionEditor(null),
    editSession: (el) => sessionEditor(C().sessions.find((x) => x.id === el.dataset.id)),
    delSession: (el) => { closeModal(); withUndo("Sessione eliminata", (c) => { c.sessions = c.sessions.filter((x) => x.id !== el.dataset.id); }); },

    dice: diceSheet,
    rollDuality: () => {
      const f = form(); const h = rnd(12), fe = rnd(12); const mod = num(f.mod);
      let adv = 0, advTxt = "";
      if (f.adv === "adv") { adv = rnd(6); advTxt = ` +d6(${adv})`; } else if (f.adv === "dis") { adv = -rnd(6); advTxt = ` −d6(${-adv})`; }
      const total = h + fe + mod + adv; const diff = numOrNull(f.diff);
      let kind, cls;
      if (h === fe) { kind = "Successo critico"; cls = "crit"; }
      else if (h > fe) { kind = "con Speranza"; cls = "hope"; } else { kind = "con Paura"; cls = "fear"; }
      let outcome = "";
      if (h === fe) outcome = "Successo critico: il PG ottiene una Speranza e rimuove uno Stress.";
      else if (diff != null) outcome = (total >= diff ? "Successo " : "Fallimento ") + kind + (total >= diff ? "" : "") + ` (Difficoltà ${diff}).`;
      showRoll(`<div class="duality ${cls}"><div class="dd"><div><span class="die hope">${h}</span><small>Speranza</small></div><div><span class="die fear">${fe}</span><small>Paura</small></div></div>
        <div class="tot">${h === fe ? "Critico" : total}</div><div class="kind">${h === fe ? "Speranza e Paura uguali" : kind}</div>
        <div class="sub">${h} + ${fe}${mod ? (mod > 0 ? " + " : " − ") + Math.abs(mod) : ""}${advTxt}</div>
        ${outcome ? `<p>${esc(outcome)}</p>` : ""}
        ${cls === "fear" ? `<button class="btn fearbtn small" data-a="fearAdd" data-d="1">+1 Paura al GM</button>` : ""}
        ${cls !== "fear" && C().pcs.length ? `<div class="sub">${cls === "crit" ? "Critico: +1 Speranza e −1 Stress a" : "+1 Speranza a"}</div><div class="chips center-chips">${C().pcs.map((p) => `<button class="chip" data-a="${cls === "crit" ? "pcCrit" : "pcHopeAdd"}" data-id="${p.id}">${esc(p.name.split(" ")[0])}</button>`).join("")}</div>` : ""}</div>`);
      logRoll("Dualità" + (mod ? ` ${mod > 0 ? "+" : ""}${mod}` : ""), h === fe ? "Critico" : `${total} ${kind}`);
    },
    rollQuick: (el) => { const d = num(el.dataset.d); const r = rnd(d); showRoll(`<div class="rollbig">${r}<small>d${d}</small></div>`); logRoll("d" + d, String(r)); },
    rollExpr: () => { const e = $('#modal-body [name="expr"]').value; const r = parseDice(e);
      if (!r) return toast("Formato: 2d6+3, d20, 3d8-1"); showRoll(`<div class="rollbig">${r.total}<small>${esc(e)}</small></div><div class="sub center">${esc(r.detail)}</div>`); logRoll(e, String(r.total)); },
  };

  function unit(el) { return C().combat.units.find((u) => u.uid === el.dataset.uid); }
  function toggleIn(o, k, v) { o[k] = o[k] || []; const i = o[k].indexOf(v); if (i >= 0) o[k].splice(i, 1); else o[k].push(v); }
  function advanceClock(k, d) {
    k.value = clamp(num(k.value) + d, 0, num(k.max));
    if (d > 0 && k.value >= k.max) { toast(`«${k.name}» si innesca`); if (k.loop) setTimeout(() => { k.value = 0; save(); render(); }, 1200); }
  }

  // ---------------------------------------------------------------- eventi
  Object.assign(A, mapActions, liveActions, prepActions);
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-a]"); if (!el || el.tagName === "INPUT" || el.tagName === "SELECT") return;
    if (el.classList.contains("pip") || el.dataset.a === "fearAdd") buzz();
    if (!el.closest(".linkpanel") && el.dataset.a !== "linkPick") hideLinkPanels();
    const fn = A[el.dataset.a]; if (fn) { e.preventDefault(); const snap = liveSnap(); fn(el, e); if (snap) setTimeout(() => liveDiff(snap), 0); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("[data-a]") && !e.target.closest(".linkpanel") && !e.target.matches("textarea[data-link]")) hideLinkPanels(); });
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches && t.matches("textarea[data-link]")) {
      t.dataset.caret = t.selectionStart;
      const before = t.value.slice(0, t.selectionStart); const m = before.match(/\[\[([^\]\n]*)$/);
      if (m) showLinkPanel(t.name, m[1], t.selectionStart - m[0].length);
      else { const p = $(`#modal-body [data-panel="${t.name}"]`); if (p && p.dataset.start) hideLinkPanels(); }
    }
    if (t.classList && t.classList.contains("linkq")) showLinkPanel(t.dataset.for, t.value, null);
  });
  ["keyup", "click", "select"].forEach((ev) => document.addEventListener(ev, (e) => { const t = e.target; if (t.matches && t.matches("textarea[data-link]")) t.dataset.caret = t.selectionStart; }));
  window.addEventListener("popstate", () => {
    if (ignorePop) { ignorePop = false; if (pendingHash) { const h = pendingHash; pendingHash = null; location.hash = h; } return; }
    if (modalOpen) { closeModal(true); return; }
    if (history.state && history.state.lm) history.back();
  });
  let wakeLock = null;
  async function applyWake() {
    try {
      if (S.settings.wake && document.visibilityState === "visible" && "wakeLock" in navigator) { if (!wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } }
      else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (_) { wakeLock = null; }
  }
  function applyPrefs() { document.documentElement.classList.toggle("big", !!S.settings.big); }
  document.addEventListener("visibilitychange", applyWake);
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.ef && el.tagName === "INPUT" && el.type !== "number") encField(el, false);
    if (el.classList && el.classList.contains("inl")) autoGrow(el);
    if (el.dataset.pf || el.dataset.scene || el.dataset.secret) { const c = C(); const r = route(); const s = c.sessions.find((x) => x.id === r.id);
      if (el.dataset.pf && s) planOf(s)[el.dataset.pf] = el.value;
      if (el.dataset.scene && s) { const x = planOf(s).scenes.find((y) => y.id === el.dataset.scene); if (x) x.txt = el.value; }
      if (el.dataset.secret) { const x = (c.secrets || []).find((y) => y.id === el.dataset.secret); if (x) x.txt = el.value; }
      clearTimeout(encField.t); encField.t = setTimeout(save, 400); }
    if (el.dataset.sf) { const r = route(); const s = C().sessions.find((x) => x.id === r.id); if (s) { s[el.dataset.sf] = el.value; clearTimeout(encField.t); encField.t = setTimeout(save, 400); } }
    if (el.dataset.a === "filter") { filters[el.dataset.k] = el.value; const pos = el.selectionStart; render(); const n = $(`[data-a="filter"][data-k="${el.dataset.k}"]`); if (n && n.type === "search") { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } }
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.ef) encField(el, true);
    if (el.dataset.sf || el.dataset.pf || el.dataset.scene || el.dataset.secret) save();
    if (el.dataset.a === "threadPick") { const s = C().sessions.find((x) => x.id === route().id); if (s) { s.threadPick = s.threadPick || {}; s.threadPick[el.dataset.id] = el.checked; save(); } }
    if (el.name === "envPick" && !el.closest("#modal")) { C().combat.envId = el.value; save(); render(); }
    if (el.tagName === "SELECT" && el.dataset.a === "filter") { filters[el.dataset.k] = el.value; render(); }
  });
  function encField(el, commit) {
    const c = C(); const e = c && encOf(c, route().id); if (!e) return;
    const k = el.dataset.ef, v = el.value;
    if (k === "name") { e.name = v.trim() || "Scontro senza nome"; }
    else if (k === "objective") { e.objective = v; }
    else if (!commit) return;
    else if (k === "partySize") e.partySize = clamp(num(v, 4), 1, 10);
    else if (k === "partyTier") e.partyTier = clamp(num(v, 1), 1, 4);
    else if (k === "envId") e.envId = v;
    else if (k === "objectivePick") { if (v === "__custom") { e._customObj = true; if (OBJECTIVES.includes(e.objective)) e.objective = ""; } else { e._customObj = false; e.objective = v; } }
    e.updated = Date.now(); save();
    if (commit && k !== "name" && k !== "objective") render();
  }
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  applyPrefs(); applyWake();
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
  $("#fileIn").addEventListener("change", async (e) => {
    const file = e.target.files[0]; e.target.value = ""; if (!file) return;
    try { importData(JSON.parse(await file.text())); } catch (err) { toast("Import non riuscito: " + err.message); }
  });
  window.addEventListener("hashchange", () => { window.scrollTo(0, 0); render(); });

  function lanternSvg() {
    return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M26 8h12M32 8V4M22 14h20l-3 6H25z"/><path d="M24 20h16v26a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z"/><path d="M32 42c-4-3-4-8 0-12 4 4 4 9 0 12z" fill="currentColor" opacity=".35"/><path d="M26 50h12l-2 6h-8z"/></svg>`;
  }

  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  window.__lanterna = { get state() { return S; }, render, get maps() { return MAPS; }, get links() { return linkIndex(); } };
  render();
  loadMaps().then(() => { render(); processInbox(); syncUI(); if (syncOn() && getTok()) syncNow(); });
  document.addEventListener("visibilitychange", () => { if (!syncOn() || !getTok()) { syncUI(); return; } if (document.visibilityState === "hidden") { if (syncDirty()) { clearTimeout(SY.timer); syncNow(); } } else syncNow(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") processInbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "drvQ") { e.preventDefault(); A.drvSearch(); } });
})();
