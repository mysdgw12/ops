/* ============================================================
   行动档案 OPERATIONS · 核心逻辑
   纯前端 / 离线 / 本地存储 / 无账号
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  const APP_VER = '1.0.0';
  const KEY = 'ops.archive.v1';

  const PRI = [
    { id: 0, name: '紧急', en: 'CRITICAL' },
    { id: 1, name: '高', en: 'HIGH' },
    { id: 2, name: '中', en: 'NORMAL' },
    { id: 3, name: '低', en: 'LOW' }
  ];
  const REP = { daily: '每天', weekdays: '工作日', weekly: '每周', monthly: '每月' };
  const VIEW_META = {
    archive: { t: 'OPERATIONS', s: '事件档案' },
    schedule: { t: 'SCHEDULE', s: '今日日程' },
    stats: { t: 'REPORT', s: '作战统计' },
    settings: { t: 'SYSTEM', s: '系统设置' }
  };
  const WEEK_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  /* ---------- 图标 ---------- */
  const I = {
    check: '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4.6l3 1.9"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2.2L23.2 21.4H0.8L12 2.2zm0 5.6L4.4 19.8h15.2L12 7.8zM11 10.2h2v5.1h-2v-5.1zm0 6.1h2v2h-2v-2z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    empty: '<svg viewBox="0 0 64 64"><path d="M10 16h44v36H10z"/><path d="M10 26h44M22 16v-4h20v4"/><path d="M20 36h14M20 43h22"/></svg>'
  };

  /* ---------- 工具 ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad2 = n => String(n).padStart(2, '0');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------- 日期 ---------- */
  function parseDue(s) {
    if (!s) return null;
    const parts = String(s).split('T');
    const d = (parts[0] || '').split('-').map(Number);
    if (d.length !== 3 || !d[0]) return null;
    const t = (parts[1] || '00:00').split(':').map(Number);
    const x = new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0, 0, 0);
    return isNaN(x.getTime()) ? null : x;
  }
  function toDueStr(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dayKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const isSameDay = (a, b) => dayKey(a) === dayKey(b);
  function weekStart(d) { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); }

  function fmtDue(d) {
    const now = new Date(), today = startOfDay(now);
    const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    if (dayKey(d) === dayKey(today)) return '今天 ' + hm;
    if (dayKey(d) === dayKey(addDays(today, 1))) return '明天 ' + hm;
    if (dayKey(d) === dayKey(addDays(today, 2))) return '后天 ' + hm;
    if (dayKey(d) === dayKey(addDays(today, -1))) return '昨天 ' + hm;
    if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${hm}`;
  }

  function cdText(due, now) {
    now = now || new Date();
    const diff = due.getTime() - now.getTime();
    const ad = Math.abs(diff);
    if (diff < 0) {
      if (ad < 60000) return '刚刚逾期';
      if (ad < 3600000) return '逾期 ' + Math.floor(ad / 60000) + ' 分钟';
      if (ad < 86400000) return '逾期 ' + Math.floor(ad / 3600000) + ' 小时';
      return '逾期 ' + Math.floor(ad / 86400000) + ' 天';
    }
    if (diff < 3600000) return '距 ' + Math.floor(diff / 60000) + ':' + pad2(Math.floor(diff % 60000 / 1000));
    if (diff < 86400000) return '距 ' + Math.floor(diff / 3600000) + ' 小时 ' + Math.floor(diff % 3600000 / 60000) + ' 分';
    const days = Math.floor(diff / 86400000);
    if (days < 31) return '距 ' + days + ' 天';
    return '距 ' + Math.floor(days / 30) + ' 个月';
  }

  function dateInputVal(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

  /* ---------- 存储 ---------- */
  function storageOK() {
    try {
      const k = '__ops_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  let idbCache = null;
  function openIDB() {
    if (idbCache) return idbCache;
    idbCache = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no idb'));
      let r;
      try { r = indexedDB.open('ops-archive', 1); } catch (e) { return rej(e); }
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return idbCache;
  }
  async function idbGet(k) {
    const db = await openIDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readonly');
      const q = tx.objectStore('kv').get(k);
      q.onsuccess = () => { db.close(); res(q.result); };
      q.onerror = () => { db.close(); rej(q.error); };
    });
  }
  async function idbSet(k, v) {
    const db = await openIDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, k);
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    });
  }

  let saveTimer = null;
  function persist() {
    const payload = { v: 1, savedAt: Date.now(), tasks: S.tasks, settings: S.settings };
    try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch (e) { /* 隐私模式/容量 */ }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { idbSet('data', payload).catch(() => {}); }, 500);
  }

  /* ---------- 状态 ---------- */
  const S = {
    tasks: [],
    settings: { sound: true, notify: 0, filter: 'all', tag: null, q: '' },
    view: 'archive',
    editing: null,
    lastOverdue: -1,
    installEvt: null
  };

  function normTask(t) {
    const d = {
      id: uid(), title: '', note: '', due: null, pr: 2, status: 'todo',
      tags: [], subs: [], repeat: null, createdAt: Date.now(), updatedAt: Date.now(),
      doneAt: null, deletedAt: null, notified: false, snoozeAt: null
    };
    const o = Object.assign(d, t || {});
    o.pr = Math.min(3, Math.max(0, Number(o.pr) || 0));
    o.tags = Array.isArray(o.tags) ? o.tags.filter(Boolean) : [];
    o.subs = Array.isArray(o.subs) ? o.subs.filter(s => s && s.text) : [];
    return o;
  }

  /* ---------- 便捷判断 ---------- */
  const alive = t => !t.deletedAt;
  const active = t => !t.deletedAt && t.status !== 'done';
  function isOverdue(t, now) {
    if (!active(t) || !t.due) return false;
    const d = parseDue(t.due);
    return !!d && d < (now || new Date());
  }
  function overdueCount(now) { return S.tasks.filter(t => isOverdue(t, now)).length; }

  /* ---------- 排序 ---------- */
  function sortTasks(list) {
    return list.slice().sort((a, b) => {
      const ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      if (a.pr !== b.pr) return a.pr - b.pr;
      const ad = a.due ? parseDue(a.due).getTime() : Infinity;
      const bd = b.due ? parseDue(b.due).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return b.createdAt - a.createdAt;
    });
  }

  /* ---------- 过滤 ---------- */
  function currentList() {
    const now = new Date(), today = startOfDay(now);
    const weekEnd = addDays(weekStart(now), 7);
    let list = S.tasks.filter(alive);
    if (S.settings.tag) list = list.filter(t => t.tags.indexOf(S.settings.tag) >= 0);
    const q = (S.settings.q || '').trim().toLowerCase();
    if (q) list = list.filter(t => (t.title + ' ' + t.note + ' ' + t.tags.join(' ')).toLowerCase().indexOf(q) >= 0);

    const f = S.settings.filter;
    if (f === 'done') {
      return list.filter(t => t.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    }
    list = list.filter(t => t.status !== 'done');
    if (f === 'today') list = list.filter(t => t.due && parseDue(t.due) < addDays(today, 1));
    else if (f === 'week') list = list.filter(t => t.due && parseDue(t.due) < weekEnd);
    else if (f === 'overdue') list = list.filter(t => t.due && parseDue(t.due) < now);
    else if (f === 'nodue') list = list.filter(t => !t.due);
    return sortTasks(list);
  }

  function groupTasks(list) {
    const now = new Date(), today = startOfDay(now);
    const weekEnd = addDays(weekStart(now), 7);
    const g = [
      { k: 'overdue', t: 'OVERDUE · 逾期', items: [] },
      { k: 'today', t: 'TODAY · 今天', items: [] },
      { k: 'week', t: 'THIS WEEK · 本周', items: [] },
      { k: 'later', t: 'LATER · 以后', items: [] },
      { k: 'nodue', t: 'NO DEADLINE · 未设时间', items: [] }
    ];
    list.forEach(t => {
      if (!t.due) { g[4].items.push(t); return; }
      const d = parseDue(t.due);
      if (d < now) g[0].items.push(t);
      else if (isSameDay(d, today)) g[1].items.push(t);
      else if (d < weekEnd) g[2].items.push(t);
      else g[3].items.push(t);
    });
    return g.filter(x => x.items.length);
  }

  /* ---------- 卡片 ---------- */
  function cardHTML(t) {
    const due = t.due ? parseDue(t.due) : null;
    const done = t.status === 'done';
    const od = isOverdue(t);
    const subsDone = t.subs.filter(s => s.done).length;
    const pct = t.subs.length ? Math.round(subsDone / t.subs.length * 100) : 0;

    let meta = '';
    if (due) meta += `<span class="due">${I.clock}${esc(fmtDue(due))}</span>`;
    if (due && !done) meta += `<span class="cd" data-due="${esc(t.due)}">${esc(cdText(due))}</span>`;
    if (t.repeat) meta += `<span class="rep">↻ ${esc(REP[t.repeat] || t.repeat)}</span>`;
    if (t.status === 'doing') meta += '<span class="badge-doing">进行中</span>';
    if (t.subs.length) meta += `<span class="sub">子项 ${subsDone}/${t.subs.length}</span>`;

    return `<article class="card${done ? ' done' : ''}${od ? ' overdue' : ''}${t.status === 'doing' ? ' doing' : ''}" data-id="${esc(t.id)}" data-pr="${t.pr}">
  <div class="sev"></div>
  <div class="card-body">
    <div class="card-top">
      <button class="card-check" type="button" data-act="toggle" data-id="${esc(t.id)}" aria-label="标记完成">${I.check}</button>
      <div class="card-main">
        <div class="card-title">${esc(t.title)}</div>
        ${meta ? `<div class="card-meta">${meta}</div>` : ''}
        ${t.tags.length ? `<div class="tags">${t.tags.map(g => `<span class="tag">#${esc(g)}</span>`).join('')}</div>` : ''}
        ${t.subs.length ? `<div class="sub-prog"><div class="track"><div class="fill" style="width:${pct}%"></div></div><span class="num">${pct}%</span></div>` : ''}
      </div>
      ${od ? `<span class="warn-tri">${I.warn}</span>` : ''}
      <span class="card-arrow">${I.chev}</span>
    </div>
  </div>
</article>`;
  }

  function emptyHTML(title, desc) {
    return `<div class="empty"><div class="ic">${I.empty}</div><div class="t">${esc(title)}</div><div class="d">${esc(desc)}</div></div>`;
  }

  /* ---------- 渲染 · 头部 ---------- */
  function renderHeader() {
    const now = new Date();
    const m = VIEW_META[S.view];
    $('#hdrTitle').textContent = m.t;
    $('#hdrSub').textContent = m.s;
    $('#hdrDate').textContent = `${WEEK_EN[now.getDay()]} ${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}`;
    $('#hdrClock').textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

    let n;
    if (S.view === 'archive') n = S.tasks.filter(active).length;
    else if (S.view === 'schedule') {
      const end = addDays(startOfDay(now), 1);
      n = S.tasks.filter(t => active(t) && t.due && parseDue(t.due) < end).length;
    } else n = S.tasks.filter(alive).length;
    $('#hdrCount').textContent = pad2(n);
  }

  /* ---------- 渲染 · 档案 ---------- */
  function renderArchive() {
    const now = new Date(), today = startOfDay(now);
    const weekEnd = addDays(weekStart(now), 7);
    const f = S.settings.filter;
    const counts = {
      all: S.tasks.filter(active).length,
      today: S.tasks.filter(t => active(t) && t.due && parseDue(t.due) < addDays(today, 1)).length,
      week: S.tasks.filter(t => active(t) && t.due && parseDue(t.due) < weekEnd).length,
      overdue: S.tasks.filter(t => isOverdue(t, now)).length,
      done: S.tasks.filter(t => alive(t) && t.status === 'done').length
    };
    const chips = [
      ['all', '全部', counts.all, ''],
      ['today', '今天', counts.today, ''],
      ['week', '本周', counts.week, ''],
      ['overdue', '逾期', counts.overdue, 'danger'],
      ['done', '已完成', counts.done, '']
    ];
    $('#filterBar').innerHTML = chips.map(c =>
      `<button type="button" class="chip ${c[3]}${f === c[0] ? ' on' : ''}" data-filter="${c[0]}">${c[1]}<span class="c">${pad2(c[2])}</span></button>`
    ).join('');

    const tagMap = new Map();
    S.tasks.filter(active).forEach(t => t.tags.forEach(g => tagMap.set(g, (tagMap.get(g) || 0) + 1)));
    const tags = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 14);
    $('#tagBar').innerHTML = tags.map(([g, n]) =>
      `<button type="button" class="tag-chip${S.settings.tag === g ? ' on' : ''}" data-tag="${esc(g)}">#${esc(g)} ${n}</button>`
    ).join('');

    const list = currentList();
    const wrap = $('#listWrap');

    if (!list.length) {
      const msg = {
        all: ['NO ACTIVE EVENTS', '还没有待处理事件，从上方快速添加一条。'],
        today: ['NOTHING TODAY', '今天没有到期事件，轻松一下。'],
        week: ['CLEAR THIS WEEK', '本周暂无到期事件。'],
        overdue: ['NO OVERDUE', '没有逾期事件，保持住。'],
        done: ['NO RECORDS', '还没有已完成的事件。']
      }[f] || ['EMPTY', '这里什么都没有。'];
      wrap.innerHTML = emptyHTML(msg[0], msg[1]);
      return;
    }

    if (f === 'done') {
      wrap.innerHTML = `<div class="grp"><div class="grp-head"><span class="t">ARCHIVED · 已归档</span><span class="ln"></span><span class="n">${pad2(list.length)}</span></div>${list.map(cardHTML).join('')}</div>`;
      return;
    }

    wrap.innerHTML = groupTasks(list).map(g =>
      `<div class="grp"><div class="grp-head"><span class="t">${esc(g.t)}</span><span class="ln"></span><span class="n">${pad2(g.items.length)}</span></div>${g.items.map(cardHTML).join('')}</div>`
    ).join('');
  }

  /* ---------- 渲染 · 日程 ---------- */
  function renderSchedule() {
    const now = new Date(), today = startOfDay(now), endToday = addDays(today, 1);
    const todayTasks = S.tasks.filter(t => alive(t) && t.status !== 'done' && t.due && parseDue(t.due) < endToday);
    const over = todayTasks.filter(t => parseDue(t.due) < now).sort((a, b) => parseDue(a.due) - parseDue(b.due));
    const rest = todayTasks.filter(t => parseDue(t.due) >= now).sort((a, b) => parseDue(a.due) - parseDue(b.due));
    const nodue = sortTasks(S.tasks.filter(t => active(t) && !t.due));
    const doneToday = S.tasks.filter(t => alive(t) && t.status === 'done' && t.doneAt && isSameDay(new Date(t.doneAt), now));

    $('#schedStats').innerHTML = `
      <div class="stat"><div class="k">TODAY 今日待办</div><div class="v">${pad2(rest.length + over.length)}<small>项</small></div></div>
      <div class="stat"><div class="k">DONE 今日完成</div><div class="v">${pad2(doneToday.length)}<small>项</small></div></div>
      <div class="stat${over.length ? ' warn' : ''}"><div class="k">OVERDUE 逾期</div><div class="v">${pad2(over.length)}<small>项</small></div></div>
      <div class="stat"><div class="k">NO DEADLINE 无期限</div><div class="v">${pad2(nodue.length)}<small>项</small></div></div>`;

    let html = '';

    if (over.length) {
      html += `<div class="grp"><div class="grp-head"><span class="t" style="color:var(--red)">OVERDUE · 已逾期</span><span class="ln"></span><span class="n">${pad2(over.length)}</span></div>
        <div class="timeline">${over.map(t => {
          const d = parseDue(t.due);
          return `<div class="tl-item"><div class="tl-time">${pad2(d.getHours())}:${pad2(d.getMinutes())}</div><div class="dot"></div>${cardHTML(t)}</div>`;
        }).join('')}</div></div>`;
    }

    if (rest.length) {
      html += `<div class="grp"><div class="grp-head"><span class="t">TODAY · 今天</span><span class="ln"></span><span class="n">${pad2(rest.length)}</span></div>
        <div class="timeline">${rest.map(t => {
          const d = parseDue(t.due);
          return `<div class="tl-item"><div class="tl-time">${pad2(d.getHours())}:${pad2(d.getMinutes())}</div><div class="dot"></div>${cardHTML(t)}</div>`;
        }).join('')}</div></div>`;
    }

    if (nodue.length) {
      html += `<div class="grp"><div class="grp-head"><span class="t">NO DEADLINE · 未设时间</span><span class="ln"></span><span class="n">${pad2(nodue.length)}</span></div>
        <div class="timeline">${nodue.map(t => `<div class="tl-item nodue"><div class="tl-time">—</div><div class="dot"></div>${cardHTML(t)}</div>`).join('')}</div></div>`;
    }

    if (!html) html = emptyHTML('CLEAR SCHEDULE', '今天没有待办事件，去档案页添加一条吧。');
    $('#schedWrap').innerHTML = html;
  }

  /* ---------- 渲染 · 统计 ---------- */
  function streakDays(doneAll) {
    const set = new Set(doneAll.filter(t => t.doneAt).map(t => dayKey(new Date(t.doneAt))));
    let d = new Date(), n = 0;
    if (!set.has(dayKey(d))) d = addDays(d, -1);
    while (set.has(dayKey(d))) { n++; d = addDays(d, -1); }
    return n;
  }

  function renderStats() {
    const now = new Date();
    const ws = weekStart(now), we = addDays(ws, 7);
    const all = S.tasks.filter(alive);
    const doneAll = all.filter(t => t.status === 'done' && t.doneAt);
    const doneWeek = doneAll.filter(t => t.doneAt >= ws.getTime() && t.doneAt < we.getTime());
    const dueWeek = all.filter(t => t.due && parseDue(t.due) >= ws && parseDue(t.due) < we);
    const dueWeekDone = dueWeek.filter(t => t.status === 'done').length;
    const rate = dueWeek.length ? Math.round(dueWeekDone / dueWeek.length * 100) : 0;
    const pending = all.filter(t => t.status !== 'done').length;
    const od = all.filter(t => isOverdue(t, now)).length;
    const st = streakDays(doneAll);

    const R = 36, C = 2 * Math.PI * R;
    const dash = C * rate / 100;

    const countMap = new Map();
    doneAll.forEach(t => { const k = dayKey(new Date(t.doneAt)); countMap.set(k, (countMap.get(k) || 0) + 1); });
    const WEEKS = 8;
    let cells = '';
    const start = addDays(ws, -7 * (WEEKS - 1));
    for (let w = 0; w < WEEKS; w++) {
      for (let i = 0; i < 7; i++) {
        const day = addDays(start, w * 7 + i);
        const n = countMap.get(dayKey(day)) || 0;
        const lv = n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 6 ? 3 : 4;
        const future = day > addDays(startOfDay(now), 0);
        cells += `<i class="l${future ? 0 : lv}" title="${dayKey(day)} · 完成 ${n}"></i>`;
      }
    }

    const tagMap = new Map();
    all.forEach(t => t.tags.forEach(g => tagMap.set(g, (tagMap.get(g) || 0) + 1)));
    const tags = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxTag = tags.length ? tags[0][1] : 1;

    $('#statsWrap').innerHTML = `
      <div class="stat-grid" style="margin-top:12px">
        <div class="stat"><div class="k">WEEK DONE 本周完成</div><div class="v">${pad2(doneWeek.length)}<small>项</small></div></div>
        <div class="stat"><div class="k">PENDING 待处理</div><div class="v">${pad2(pending)}<small>项</small></div></div>
        <div class="stat${od ? ' warn' : ''}"><div class="k">OVERDUE 逾期</div><div class="v">${pad2(od)}<small>项</small></div></div>
        <div class="stat"><div class="k">STREAK 连续天数</div><div class="v">${pad2(st)}<small>天</small></div></div>
      </div>

      <div class="ring-row">
        <div class="ring">
          <svg viewBox="0 0 84 84">
            <circle class="bgc" cx="42" cy="42" r="${R}" fill="none" stroke-width="6"/>
            <circle class="fgc" cx="42" cy="42" r="${R}" fill="none" stroke-width="6"
              stroke-dasharray="${dash.toFixed(1)} ${(C - dash).toFixed(1)}"/>
          </svg>
          <div class="pct">${rate}%</div>
        </div>
        <div class="ring-side">
          <div class="l">WEEKLY COMPLETION</div>
          <div class="t">本周执行率</div>
          <div class="s">本周到期 ${dueWeek.length} 项 · 已完成 ${dueWeekDone} 项</div>
        </div>
      </div>

      <div class="heat-wrap">
        <div class="heat-head"><span class="t">8 WEEKS · 完成热力图</span><span class="t">${pad2(doneAll.length)} TOTAL</span></div>
        <div class="heat">${cells}</div>
        <div class="heat-foot"><span class="lb">少</span><i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span class="lb">多</span></div>
      </div>

      <div class="tag-rank">
        <div class="heat-head"><span class="t">TOP TAGS · 标签分布</span></div>
        ${tags.length ? tags.map(([g, n], i) => `
          <div class="rank-row">
            <span class="n">${pad2(i + 1)}</span>
            <span class="tg">#${esc(g)}</span>
            <span class="b"><i style="width:${Math.round(n / maxTag * 100)}%"></i></span>
            <span class="c">${n}</span>
          </div>`).join('') : '<div class="d" style="color:var(--muted);font-size:12px;padding:8px 0">还没有使用标签。在事件里加 #标签 就能统计。</div>'}
      </div>`;
  }

  /* ---------- 渲染 · 设置 ---------- */
  function renderSettings() {
    const trashed = S.tasks.filter(t => t.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt);
    const notifyOn = S.settings.notify === 1;
    const canNotify = 'Notification' in window;
    const perm = canNotify ? Notification.permission : 'unsupported';

    $('#setWrap').innerHTML = `
      <div class="set-grp">
        <div class="h">ALERT · 提醒</div>
        <div class="set-row">
          <span class="ic">${I.clock}</span>
          <span class="tx"><span class="t">系统通知</span><span class="d">${canNotify ? (perm === 'granted' ? '已授权，到点会弹手机通知' : perm === 'denied' ? '已拒绝，请到浏览器设置里允许通知' : '未授权，点击右侧开关授权') : '当前环境不支持（需 https 或安装到主屏幕）'}</span></span>
          <button class="sw${notifyOn && perm === 'granted' ? ' on' : ''}" type="button" data-act="toggleNotify" aria-label="系统通知"></button>
        </div>
        <div class="set-row">
          <span class="ic">${I.warn}</span>
          <span class="tx"><span class="t">提示音</span><span class="d">提醒时播放短促提示音</span></span>
          <button class="sw${S.settings.sound ? ' on' : ''}" type="button" data-act="toggleSound" aria-label="提示音"></button>
        </div>
        <div class="set-row">
          <span class="ic">${I.chev}</span>
          <span class="tx"><span class="t">导出到系统日历（.ics）</span><span class="d">导入小米日历，由系统闹钟准点提醒，关机重启也不丢</span></span>
          <button class="btn sm ghost" type="button" data-act="exportIcs">导出</button>
        </div>
      </div>

      <div class="set-grp">
        <div class="h">DATA · 数据</div>
        <div class="set-row">
          <span class="ic">${I.check}</span>
          <span class="tx"><span class="t">导出备份（JSON）</span><span class="d">全部事件与设置，用于换机或存档</span></span>
          <button class="btn sm ghost" type="button" data-act="exportJson">导出</button>
        </div>
        <div class="set-row">
          <span class="ic">${I.chev}</span>
          <span class="tx"><span class="t">导入备份（合并）</span><span class="d">保留现有数据，同 ID 事件以备份为准</span></span>
          <button class="btn sm ghost" type="button" data-act="importMerge">导入</button>
        </div>
        <div class="set-row">
          <span class="ic">${I.warn}</span>
          <span class="tx"><span class="t">导入备份（覆盖）</span><span class="d">清空现有数据后导入，谨慎使用</span></span>
          <button class="btn sm danger" type="button" data-act="importReplace">导入</button>
        </div>
      </div>

      <div class="set-grp">
        <div class="h">RECYCLE · 回收站（${trashed.length}）</div>
        ${trashed.length ? trashed.slice(0, 30).map(t => `
          <div class="trash-item">
            <span class="t">${esc(t.title)}</span>
            <span class="d">${new Date(t.deletedAt).toLocaleDateString('zh-CN')}</span>
            <button class="btn sm ghost" type="button" data-act="restore" data-id="${esc(t.id)}">恢复</button>
          </div>`).join('') : '<div style="padding:12px 0;color:var(--muted);font-size:12px">回收站是空的</div>'}
        ${trashed.length ? `<div class="set-row" style="border-bottom:0"><button class="btn sm danger wide" type="button" data-act="purge">清空回收站</button></div>` : ''}
      </div>

      <div class="set-grp">
        <div class="h">APP · 应用</div>
        <div class="set-row">
          <span class="ic">${I.chev}</span>
          <span class="tx"><span class="t">添加到主屏幕</span><span class="d">${S.installEvt ? '点击安装，像 APP 一样全屏使用' : (isStandalone() ? '已在独立窗口运行' : 'Chrome 菜单 → 添加到主屏幕 / 安装应用')}</span></span>
          <button class="btn sm ghost" type="button" data-act="install">${S.installEvt ? '安装' : '说明'}</button>
        </div>
        <div class="set-row">
          <span class="ic">${I.check}</span>
          <span class="tx"><span class="t">本地存储</span><span class="d">数据只保存在这台手机，不上传任何服务器</span></span>
          <span class="go">LOCAL</span>
        </div>
        <div class="set-row">
          <span class="ic">${I.clock}</span>
          <span class="tx"><span class="t">版本</span><span class="d">行动档案 OPERATIONS v${APP_VER} · 自用版</span></span>
          <span class="go">v${APP_VER}</span>
        </div>
      </div>`;
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  /* ---------- 总渲染 ---------- */
  function render(opts) {
    opts = opts || {};
    const main = $('#main');
    const y = opts.keepScroll ? main.scrollTop : 0;
    renderHeader();
    renderArchive();
    renderSchedule();
    renderStats();
    renderSettings();
    updateNavBadge();
    if (opts.keepScroll) main.scrollTop = y;
  }

  function updateNavBadge() {
    const end = addDays(startOfDay(new Date()), 1);
    const n = S.tasks.filter(t => active(t) && t.due && parseDue(t.due) < end).length;
    const b = $('#navBadge');
    b.textContent = n > 99 ? '99+' : String(n);
    b.classList.toggle('show', n > 0);
  }

  /* ---------- 视图切换 ---------- */
  function switchView(v) {
    S.view = v;
    $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
    $$('.nav-item').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    $('#main').scrollTop = 0;
    renderHeader();
    updateNavBadge();
  }

  /* ---------- Toast ---------- */
  function toast(msg, kind, action) {
    const wrap = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    const span = document.createElement('span');
    span.textContent = msg;
    el.appendChild(span);
    if (action) {
      const b = document.createElement('button');
      b.textContent = action.label;
      b.style.cssText = 'margin-left:10px;color:var(--cyan);font-weight:700;font-size:12px;border-bottom:1px solid var(--cyan);padding:0 2px';
      b.onclick = () => { action.fn(); el.remove(); };
      el.appendChild(b);
    }
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 280); }, action ? 5200 : 2400);
  }

  /* ---------- 提示音 ---------- */
  let actx = null;
  function beep() {
    if (!S.settings.sound) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = actx || new AC();
      if (actx.state === 'suspended') actx.resume();
      const t0 = actx.currentTime;
      [[880, 0], [1180, .15]].forEach(([f, off]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'square';
        o.frequency.value = f;
        g.gain.setValueAtTime(.0001, t0 + off);
        g.gain.exponentialRampToValueAtTime(.13, t0 + off + .012);
        g.gain.exponentialRampToValueAtTime(.0001, t0 + off + .13);
        o.connect(g); g.connect(actx.destination);
        o.start(t0 + off); o.stop(t0 + off + .14);
      });
    } catch (e) { /* 静默失败 */ }
  }

  /* ---------- 提醒 ---------- */
  function notifySystem(t) {
    if (S.settings.notify !== 1) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      new Notification('⚠ 事件提醒 · ' + (PRI[t.pr] || PRI[2]).name, {
        body: t.title + (t.due ? '\n截止 ' + fmtDue(parseDue(t.due)) : ''),
        tag: t.id,
        silent: true
      });
    } catch (e) { /* iOS/file:// 不支持 */ }
  }

  function showBanner(t) {
    const wrap = $('#banners');
    const el = document.createElement('div');
    el.className = 'banner' + (t.pr === 0 ? ' warn' : '');
    el.innerHTML = `<span class="w">${I.warn}</span>
      <span class="tx">
        <span class="h">REMINDER · 事件提醒</span>
        <span class="b">${esc(t.title)}</span>
        <span class="d">${t.due ? esc(fmtDue(parseDue(t.due))) : ''} · ${esc((PRI[t.pr] || PRI[2]).name)}</span>
      </span>
      <span class="acts">
        <button type="button" class="yes" data-b="done">完成</button>
        <button type="button" data-b="snooze">10分后</button>
      </span>`;
    el.querySelector('[data-b="done"]').onclick = () => { el.remove(); toggleDone(t.id); };
    el.querySelector('[data-b="snooze"]').onclick = () => { el.remove(); snooze(t); };
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 20000);
  }

  function fireReminder(t) {
    beep();
    notifySystem(t);
    showBanner(t);
  }

  function snooze(t) {
    t.snoozeAt = Date.now() + 10 * 60 * 1000;
    t.notified = true;
    t.updatedAt = Date.now();
    persist();
    toast('已推迟 10 分钟提醒');
  }

  function tick() {
    const now = Date.now();
    const fired = [];
    S.tasks.forEach(t => {
      if (t.deletedAt || t.status === 'done' || !t.due) return;
      if (t.notified) return;
      const d = parseDue(t.due);
      if (!d) return;
      const dt = d.getTime();
      if (now < dt) return;
      if (t.snoozeAt && now < t.snoozeAt) return;
      if (now - dt > 3 * 3600 * 1000) { t.notified = true; return; } // 超过3小时的旧事件不再打扰
      t.notified = true;
      fired.push(t);
    });
    if (fired.length) {
      persist();
      fired.slice(0, 3).forEach(fireReminder);
      if (fired.length > 3) toast(`还有 ${fired.length - 3} 项到期事件`, '');
    }

    // 倒计时文案
    $$('.cd[data-due]').forEach(el => {
      const d = parseDue(el.dataset.due);
      if (d) el.textContent = cdText(d);
    });

    // 逾期数量变化 → 重绘
    const od = overdueCount();
    if (od !== S.lastOverdue) { S.lastOverdue = od; render({ keepScroll: true }); }

    // 头部时钟 / 跨天
    const nowD = new Date();
    $('#hdrClock').textContent = `${pad2(nowD.getHours())}:${pad2(nowD.getMinutes())}`;
    if (S._day !== dayKey(nowD)) { S._day = dayKey(nowD); render(); }
  }

  /* ---------- 完成 / 删除 ---------- */
  function nextOccurrence(d, freq) {
    const n = new Date(d);
    if (freq === 'daily') n.setDate(n.getDate() + 1);
    else if (freq === 'weekdays') {
      do { n.setDate(n.getDate() + 1); } while (n.getDay() === 0 || n.getDay() === 6);
    } else if (freq === 'weekly') n.setDate(n.getDate() + 7);
    else if (freq === 'monthly') {
      const day = n.getDate();
      n.setMonth(n.getMonth() + 1);
      if (n.getDate() < day) n.setDate(0);
    }
    return n;
  }

  function spawnNext(t) {
    if (!t.repeat) return;
    let base = t.due ? parseDue(t.due) : new Date();
    if (!base) base = new Date();
    let next = nextOccurrence(base, t.repeat);
    let guard = 0;
    while (next <= new Date() && guard++ < 400) next = nextOccurrence(next, t.repeat);
    const nt = normTask({
      title: t.title, note: t.note, due: toDueStr(next), pr: t.pr,
      tags: t.tags.slice(), repeat: t.repeat,
      subs: (t.subs || []).map(s => ({ id: uid(), text: s.text, done: false }))
    });
    S.tasks.push(nt);
  }

  function toggleDone(id) {
    const t = S.tasks.find(x => x.id === id);
    if (!t) return;
    if (t.status === 'done') {
      t.status = 'todo';
      t.doneAt = null;
      t.notified = false;
    } else {
      t.status = 'done';
      t.doneAt = Date.now();
      spawnNext(t);
      stamp();
      beep();
    }
    t.updatedAt = Date.now();
    persist();
    render({ keepScroll: true });
  }

  function stamp() {
    const el = $('#stamp');
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 1050);
  }

  function softDelete(id) {
    const t = S.tasks.find(x => x.id === id);
    if (!t) return;
    t.deletedAt = Date.now();
    t.updatedAt = Date.now();
    persist();
    render({ keepScroll: true });
    toast('已移入回收站', 'ok', {
      label: '撤销',
      fn: () => { t.deletedAt = null; t.updatedAt = Date.now(); persist(); render({ keepScroll: true }); }
    });
  }

  /* ---------- 编辑器 ---------- */
  function existingTask() {
    return S.editing && S.tasks.some(x => x.id === S.editing.id);
  }

  function openEditor(task) {
    S.editing = task ? clone(task) : normTask({ pr: 2 });
    if (!S.editing.tags) S.editing.tags = [];
    if (!S.editing.subs) S.editing.subs = [];
    fillEditor();
    $('#modal').classList.add('on');
    setTimeout(() => { try { $('#edTitle').focus(); } catch (e) {} }, 260);
  }

  function closeEditor() {
    $('#modal').classList.remove('on');
    S.editing = null;
  }

  function fillEditor() {
    const t = S.editing;
    const isEdit = existingTask();
    $('#edHead').textContent = isEdit ? 'EDIT EVENT / 编辑事件' : 'NEW EVENT / 新建事件';
    $('#edTitle').value = t.title || '';
    $('#edNote').value = t.note || '';
    const d = t.due ? parseDue(t.due) : null;
    $('#edDate').value = d ? dateInputVal(d) : '';
    $('#edTime').value = d ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '';
    $('#edRepeat').value = t.repeat || '';
    $('#btnDel').style.display = isEdit ? '' : 'none';
    syncPrio();
    renderEdTags();
    renderEdSubs();
  }

  function syncPrio() {
    $$('#edPrio [data-p]').forEach(b => b.classList.toggle('on', Number(b.dataset.p) === S.editing.pr));
  }

  function renderEdTags() {
    const wrap = $('#edTags');
    $$('.tag', wrap).forEach(n => n.remove());
    const input = $('#edTagInput');
    S.editing.tags.forEach(g => {
      const el = document.createElement('span');
      el.className = 'tag';
      el.innerHTML = `#${esc(g)}<b data-tagdel="${esc(g)}">×</b>`;
      wrap.insertBefore(el, input);
    });
  }

  function renderEdSubs() {
    const wrap = $('#edSubList');
    if (!S.editing.subs.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = S.editing.subs.map((s, i) =>
      `<div class="sub-row${s.done ? ' ok' : ''}" data-subidx="${i}">
        <span class="bx" data-subtoggle="${i}">${I.check}</span>
        <span class="tx">${esc(s.text)}</span>
        <button class="rm" type="button" data-subrm="${i}" aria-label="删除">${I.x}</button>
      </div>`
    ).join('');
  }

  function applyQuick(q) {
    const now = new Date();
    const today = startOfDay(now);
    let d = today, t = $('#edTime').value;
    if (q === 'today') { /* keep */ }
    else if (q === 'tomorrow') d = addDays(today, 1);
    else if (q === 'evening') { d = today; t = '20:00'; }
    else if (q === 'weekend') d = addDays(weekStart(now), 6);
    else if (q === 'nextweek') d = addDays(weekStart(now), 7);
    else if (q === 'clear') {
      $('#edDate').value = ''; $('#edTime').value = '';
      return;
    }
    $('#edDate').value = dateInputVal(d);
    $('#edTime').value = t || '09:00';
  }

  function addSubFromInput() {
    const inp = $('#edSubInput');
    const v = inp.value.trim();
    if (!v) return;
    S.editing.subs.push({ id: uid(), text: v, done: false });
    inp.value = '';
    renderEdSubs();
  }

  function saveEditor() {
    const t = S.editing;
    if (!t) return;
    const title = $('#edTitle').value.trim();
    if (!title) { toast('标题不能为空', 'err'); $('#edTitle').focus(); return; }

    const dv = $('#edDate').value;
    const tv = $('#edTime').value;
    let due = null;
    if (dv) due = dv + 'T' + (tv || '09:00');
    else if (tv) due = dateInputVal(new Date()) + 'T' + tv;

    const isEdit = existingTask();
    const old = isEdit ? S.tasks.find(x => x.id === t.id) : null;
    const fields = {
      title,
      note: $('#edNote').value.trim(),
      pr: t.pr,
      due,
      repeat: $('#edRepeat').value || null,
      tags: t.tags.slice(),
      subs: t.subs.map(s => ({ id: s.id || uid(), text: s.text, done: !!s.done })),
      updatedAt: Date.now()
    };

    if (old) {
      const dueChanged = old.due !== due;
      Object.assign(old, fields);
      if (dueChanged) { old.notified = false; old.snoozeAt = null; }
    } else {
      S.tasks.unshift(normTask(Object.assign({ createdAt: Date.now() }, fields)));
    }

    persist();
    closeEditor();
    render({ keepScroll: true });
    toast(isEdit ? '事件已更新' : '事件已记录', 'ok');
  }

  /* ---------- 快速添加解析 ---------- */
  const REP_WORDS = [
    ['工作日', 'weekdays'], ['每星期', 'weekly'], ['每周', 'weekly'], ['每月', 'monthly'],
    ['每天', 'daily'], ['每日', 'daily']
  ];
  const PRI_WORDS = { '急': 0, '紧急': 0, '1': 0, '高': 1, '2': 1, '中': 2, '3': 2, '低': 3, '4': 3 };

  function parseQuick(raw) {
    let s = ' ' + String(raw) + ' ';
    const out = { title: '', tags: [], pr: 2, repeat: null, due: null };
    const now = new Date();
    const today = startOfDay(now);

    // 标签
    s = s.replace(/#([^\s#]+)/g, (m, g) => { out.tags.push(g); return ' '; });

    // 重要度
    s = s.replace(/!([急紧高初中低]|紧急|[1-4])/g, (m, g) => {
      if (g in PRI_WORDS) out.pr = PRI_WORDS[g];
      return ' ';
    });

    // 重复
    for (const [w, f] of REP_WORDS) {
      if (s.indexOf(w) >= 0) { out.repeat = f; s = s.split(w).join(' '); break; }
    }

    // 时间 HH:MM
    let hh = null, mm = null;
    s = s.replace(/(\d{1,2})[:：](\d{2})/, (m, a, b) => { hh = +a; mm = +b; return ' '; });

    // 时段词
    let period = null;
    const pm = s.match(/(凌晨|早上|上午|中午|下午|傍晚|晚上|夜里)/);
    if (pm) { period = pm[1]; s = s.replace(pm[1], ' '); }

    // N点(半|N分)
    const dm = s.match(/(\d{1,2})\s*[点時时](半|\d{1,2}分?)?/);
    if (dm) {
      hh = +dm[1];
      mm = dm[2] === '半' ? 30 : (dm[2] ? parseInt(dm[2], 10) : 0);
      s = s.split(dm[0]).join(' ');
    }
    if (hh != null) {
      if (period && /下午|傍晚|晚上|夜里/.test(period) && hh < 12) hh += 12;
      if (period === '中午' && hh < 11) hh += 12;
      if (period === '凌晨' && hh === 12) hh = 0;
      if (hh > 23) hh = 23;
      if (mm > 59) mm = 0;
    }

    // 日期
    let dateBase = null;
    const dayWords = [['大后天', 3], ['后天', 2], ['明天', 1], ['明日', 1], ['今天', 0], ['今日', 0]];
    for (const [w, off] of dayWords) {
      if (s.indexOf(w) >= 0) { dateBase = addDays(today, off); s = s.split(w).join(' '); break; }
    }
    if (!dateBase) {
      const wk = s.match(/(下下|下)?\s*(?:周|星期|礼拜)([一二三四五六日天])/);
      if (wk) {
        const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
        const target = map[wk[2]];
        const ws = weekStart(now);
        let d = addDays(ws, (target + 6) % 7);
        if (wk[1] === '下') d = addDays(d, 7);
        if (wk[1] === '下下') d = addDays(d, 14);
        if (d < today) d = addDays(d, 7);
        dateBase = d;
        s = s.split(wk[0]).join(' ');
      }
    }
    if (!dateBase) {
      let m = s.match(/(\d{1,2})\s*[月\/\-]\s*(\d{1,2})\s*[日号]?/);
      if (m) {
        let mo = +m[1], da = +m[2];
        if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
          let y = now.getFullYear();
          let d = new Date(y, mo - 1, da);
          if (d < today) d = new Date(y + 1, mo - 1, da);
          dateBase = d;
          s = s.split(m[0]).join(' ');
        }
      }
    }

    if (!dateBase) {
      // 独立日期：15号 / 15日
      const dn = s.match(/(\d{1,2})\s*[日号]/);
      if (dn) {
        const da = +dn[1];
        if (da >= 1 && da <= 31) {
          let d = new Date(now.getFullYear(), now.getMonth(), da);
          if (d < today) d = new Date(now.getFullYear(), now.getMonth() + 1, da);
          dateBase = d;
          s = s.split(dn[0]).join(' ');
        }
      }
    }

    if (dateBase) {
      const h = hh == null ? 9 : hh;
      const mi = mm == null ? 0 : mm;
      out.due = dateInputVal(dateBase) + 'T' + pad2(h) + ':' + pad2(mi);
    } else if (hh != null) {
      const d = new Date(now);
      d.setHours(hh, mm || 0, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 1);
      out.due = toDueStr(d);
    }

    out.title = s.replace(/\s+/g, ' ').trim();
    if (!out.title) out.title = String(raw).trim();
    return out;
  }

  function quickAdd(raw) {
    const text = String(raw || '').trim();
    if (!text) return;
    const p = parseQuick(text);
    if (!p.title) { toast('请输入事件内容', 'err'); return; }
    const t = normTask({ title: p.title, pr: p.pr, tags: p.tags, repeat: p.repeat, due: p.due });
    S.tasks.unshift(t);
    persist();
    render({ keepScroll: true });
    const bits = [];
    if (p.due) bits.push(fmtDue(parseDue(p.due)));
    bits.push((PRI[t.pr] || PRI[2]).name);
    if (p.tags.length) bits.push(p.tags.map(x => '#' + x).join(' '));
    toast('已记录：' + p.title + '（' + bits.join(' · ') + '）', 'ok');
  }

  /* ---------- 导出 / 导入 ---------- */
  function download(filename, content, mime) {
    try {
      const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch (e) {
      toast('导出失败：' + e.message, 'err');
      return false;
    }
  }

  const icsEsc = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function icsStamp(d) {
    return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + 'T' +
      pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + 'Z';
  }

  function buildICS(tasks) {
    const L = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OPS Archive//CN', 'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH', 'X-WR-CALNAME:行动档案', 'X-WR-TIMEZONE:Asia/Shanghai'
    ];
    const now = icsStamp(new Date());
    let n = 0;
    tasks.forEach(t => {
      if (!t.due || t.deletedAt) return;
      const s = parseDue(t.due);
      if (!s) return;
      const e = new Date(s.getTime() + 30 * 60000);
      let rrule = '';
      if (t.repeat === 'daily') rrule = 'RRULE:FREQ=DAILY;COUNT=30';
      else if (t.repeat === 'weekdays') rrule = 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=40';
      else if (t.repeat === 'weekly') rrule = 'RRULE:FREQ=WEEKLY;COUNT=20';
      else if (t.repeat === 'monthly') rrule = 'RRULE:FREQ=MONTHLY;COUNT=12';
      const summary = (t.pr <= 1 ? '【' + PRI[t.pr].name + '】' : '') + t.title;
      L.push('BEGIN:VEVENT',
        'UID:' + t.id + '@ops-archive',
        'DTSTAMP:' + now,
        'DTSTART:' + icsStamp(s),
        'DTEND:' + icsStamp(e),
        'SUMMARY:' + icsEsc(summary));
      if (t.note) L.push('DESCRIPTION:' + icsEsc(t.note));
      if (t.tags.length) L.push('CATEGORIES:' + t.tags.map(icsEsc).join(','));
      if (rrule) L.push(rrule);
      L.push('BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(t.title), 'END:VALARM',
        'END:VEVENT');
      n++;
    });
    L.push('END:VCALENDAR');
    return { text: L.join('\r\n'), count: n };
  }

  function exportIcs() {
    const now = new Date();
    const list = S.tasks.filter(t => alive(t));
    const r = buildICS(list);
    if (!r.count) { toast('没有带时间的事件可以导出', 'err'); return; }
    const name = `行动档案-日历-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}.ics`;
    if (download(name, r.text, 'text/calendar;charset=utf-8')) {
      toast(`已导出 ${r.count} 个事件，用小米日历打开即可导入`, 'ok');
    }
  }

  function exportJson() {
    const now = new Date();
    const payload = {
      app: 'ops-archive', version: APP_VER, exportedAt: now.toISOString(),
      tasks: S.tasks, settings: S.settings
    };
    const name = `行动档案-备份-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}.json`;
    if (download(name, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8')) {
      toast(`已导出 ${S.tasks.length} 条记录`, 'ok');
    }
  }

  function pickFile(mode) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.style.display = 'none';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (f) doImport(f, mode);
      inp.remove();
    };
    document.body.appendChild(inp);
    inp.click();
  }

  function doImport(file, mode) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const obj = JSON.parse(String(fr.result));
        const arr = Array.isArray(obj) ? obj : obj.tasks;
        if (!Array.isArray(arr)) throw new Error('文件里没有 tasks 数组');
        const incoming = arr.map(normTask);
        if (mode === 'replace') {
          if (!confirm(`将清空现有 ${S.tasks.length} 条，导入 ${incoming.length} 条。确定？`)) return;
          S.tasks = incoming;
        } else {
          const map = new Map(S.tasks.map(t => [t.id, t]));
          incoming.forEach(t => map.set(t.id, t));
          S.tasks = Array.from(map.values());
        }
        if (obj.settings && mode === 'replace') Object.assign(S.settings, obj.settings);
        persist();
        render();
        toast(`导入完成，共 ${incoming.length} 条`, 'ok');
      } catch (e) {
        toast('导入失败：' + e.message, 'err');
      }
    };
    fr.onerror = () => toast('读取文件失败', 'err');
    fr.readAsText(file, 'utf-8');
  }

  /* ---------- 示例数据（首次使用） ---------- */
  function seed() {
    const now = new Date();
    const today = startOfDay(now);
    const at = (dayOff, h, m) => toDueStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOff, h, m || 0));
    return [
      normTask({
        title: '给甲方回复项目排期', note: '附上甘特图，说明 12 月上线风险。', pr: 0,
        due: at(0, 18, 0), tags: ['工作'],
        subs: [{ id: uid(), text: '整理排期表', done: true }, { id: uid(), text: '写风险说明', done: false }]
      }),
      normTask({ title: '交本周周报', pr: 1, due: at(1, 10, 0), tags: ['工作'], repeat: 'weekly' }),
      normTask({ title: '去超市补牛奶和鸡蛋', pr: 2, tags: ['生活'] }),
      normTask({ title: '预约体检', note: '记得空腹，带医保卡。', pr: 1, due: at(3, 9, 30), tags: ['健康'] }),
      normTask({
        title: '每天背 30 个单词', pr: 3, due: at(0, 21, 30), tags: ['学习'], repeat: 'daily',
        status: 'done', doneAt: Date.now() - 3600000
      })
    ];
  }

  /* ---------- 事件绑定 ---------- */
  function doAct(act, id, el) {
    switch (act) {
      case 'add': openEditor(null); break;
      case 'close': closeEditor(); break;
      case 'save': saveEditor(); break;
      case 'delete': {
        const t = S.editing;
        if (!t) break;
        const wasEdit = existingTask();
        closeEditor();
        if (wasEdit) softDelete(t.id);
        break;
      }
      case 'toggle': toggleDone(id); break;
      case 'toggleNotify': toggleNotify(); break;
      case 'toggleSound':
        S.settings.sound = !S.settings.sound;
        persist(); renderSettings();
        toast('提示音已' + (S.settings.sound ? '开启' : '关闭'));
        if (S.settings.sound) beep();
        break;
      case 'exportIcs': exportIcs(); break;
      case 'exportJson': exportJson(); break;
      case 'importMerge': pickFile('merge'); break;
      case 'importReplace': pickFile('replace'); break;
      case 'restore': {
        const t = S.tasks.find(x => x.id === id);
        if (t) { t.deletedAt = null; t.updatedAt = Date.now(); persist(); render(); toast('已恢复'); }
        break;
      }
      case 'purge': {
        const tr = S.tasks.filter(t => t.deletedAt);
        if (!tr.length) break;
        if (!confirm(`确定永久删除回收站里的 ${tr.length} 条记录？不可恢复。`)) break;
        S.tasks = S.tasks.filter(t => !t.deletedAt);
        persist(); render(); toast('回收站已清空', 'ok');
        break;
      }
      case 'install': doInstall(); break;
      default: break;
    }
  }

  async function toggleNotify() {
    if (!('Notification' in window)) {
      toast('当前环境不支持系统通知，请用 https 打开或安装到主屏幕', 'err');
      return;
    }
    if (Notification.permission === 'granted' && S.settings.notify === 1) {
      S.settings.notify = 0; persist(); renderSettings();
      toast('系统通知已关闭');
      return;
    }
    try {
      const p = await Notification.requestPermission();
      S.settings.notify = p === 'granted' ? 1 : 0;
      persist(); renderSettings();
      toast(p === 'granted' ? '已开启系统通知' : '未获得通知权限', p === 'granted' ? 'ok' : 'err');
      beep();
    } catch (e) {
      toast('授权失败：' + e.message, 'err');
    }
  }

  async function doInstall() {
    if (S.installEvt) {
      S.installEvt.prompt();
      try {
        const r = await S.installEvt.userChoice;
        if (r && r.outcome === 'accepted') toast('正在安装…', 'ok');
      } catch (e) {}
      S.installEvt = null;
      renderSettings();
      return;
    }
    if (isStandalone()) { toast('已在独立窗口中运行'); return; }
    toast('Chrome 右上角 ⋮ → 添加到主屏幕 / 安装应用');
  }

  function bind() {
    document.addEventListener('click', e => {
      const t = e.target;

      const nav = t.closest('.nav-item');
      if (nav) { switchView(nav.dataset.view); return; }

      const chip = t.closest('[data-filter]');
      if (chip) {
        S.settings.filter = chip.dataset.filter;
        persist(); render({ keepScroll: true });
        return;
      }

      const tagc = t.closest('[data-tag]');
      if (tagc) {
        const g = tagc.dataset.tag;
        S.settings.tag = (S.settings.tag === g) ? null : g;
        persist(); render({ keepScroll: true });
        return;
      }

      const tagDel = t.closest('[data-tagdel]');
      if (tagDel && S.editing) {
        const g = tagDel.dataset.tagdel;
        S.editing.tags = S.editing.tags.filter(x => x !== g);
        renderEdTags();
        return;
      }

      const pb = t.closest('#edPrio [data-p]');
      if (pb) { S.editing.pr = Number(pb.dataset.p); syncPrio(); return; }

      const qb = t.closest('#edQuick [data-q]');
      if (qb) { applyQuick(qb.dataset.q); return; }

      const srm = t.closest('[data-subrm]');
      if (srm && S.editing) {
        S.editing.subs.splice(Number(srm.dataset.subrm), 1);
        renderEdSubs();
        return;
      }
      const stg = t.closest('[data-subtoggle]');
      if (stg && S.editing) {
        const i = Number(stg.dataset.subtoggle);
        if (S.editing.subs[i]) { S.editing.subs[i].done = !S.editing.subs[i].done; renderEdSubs(); }
        return;
      }

      const actEl = t.closest('[data-act]');
      if (actEl) { doAct(actEl.dataset.act, actEl.dataset.id, actEl); return; }

      const card = t.closest('.card');
      if (card) {
        const task = S.tasks.find(x => x.id === card.dataset.id);
        if (task) openEditor(task);
        return;
      }

      if (e.target.id === 'modal') closeEditor();
    });

    $('#qaForm').addEventListener('submit', e => {
      e.preventDefault();
      const inp = $('#qaInput');
      quickAdd(inp.value);
      inp.value = '';
    });

    let st = null;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(st);
      const v = e.target.value;
      $('#searchClear').hidden = !v;
      st = setTimeout(() => {
        S.settings.q = v;
        persist();
        render({ keepScroll: true });
      }, 180);
    });

    $('#searchClear').addEventListener('click', () => {
      const inp = $('#searchInput');
      inp.value = '';
      S.settings.q = '';
      $('#searchClear').hidden = true;
      persist();
      render({ keepScroll: true });
      inp.focus();
    });

    $('#edTagInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
        e.preventDefault();
        const v = e.target.value.trim().replace(/^#/, '');
        if (v && S.editing && S.editing.tags.indexOf(v) < 0) {
          S.editing.tags.push(v);
          e.target.value = '';
          renderEdTags();
        }
      }
    });

    $('#edSubAdd').addEventListener('click', addSubFromInput);
    $('#edSubInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addSubFromInput(); }
    });

    $('#edTitle').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); saveEditor(); }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $('#modal').classList.contains('on')) closeEditor();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { tick(); render({ keepScroll: true }); }
    });

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      S.installEvt = e;
      renderSettings();
    });

    window.addEventListener('online', () => { const l = $('#hdrLive'); if (l) l.textContent = 'LOCAL'; });
  }

  /* ---------- 启动 ---------- */
  function fatal(msg) {
    try {
      const d = document.createElement('pre');
      d.id = 'fatal';
      d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:999;background:#3a0d10;' +
        'color:#ff9aa2;font:11px/1.5 monospace;padding:8px;white-space:pre-wrap;margin:0';
      d.textContent = 'RUNTIME ERROR\n' + msg;
      document.body.appendChild(d);
    } catch (e) {}
  }
  window.addEventListener('error', ev => fatal(ev.message + ' @ ' + (ev.filename || '') + ':' + (ev.lineno || '')));
  window.addEventListener('unhandledrejection', ev => {
    const r = ev.reason;
    fatal('UNHANDLED: ' + ((r && (r.stack || r.message)) || String(r)));
  });

  async function boot() {
    let payload = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) payload = JSON.parse(raw);
    } catch (e) { payload = null; }
    if (!payload) {
      try { payload = await idbGet('data'); } catch (e) { payload = null; }
    }
    if (payload && Array.isArray(payload.tasks)) {
      S.tasks = payload.tasks.map(normTask);
      if (payload.settings) Object.assign(S.settings, payload.settings);
      S.settings.filter = S.settings.filter || 'all';
      if (S.settings.tag && !S.tasks.some(t => t.tags.indexOf(S.settings.tag) >= 0)) S.settings.tag = null;
    } else {
      S.tasks = seed();
      persist();
    }

    S.lastOverdue = overdueCount();
    S._day = dayKey(new Date());

    bind();
    render();
    // 搜索词不跨会话保留，避免下次打开像"数据丢了"
    S.settings.q = '';
    $('#searchInput').value = '';
    $('#searchClear').hidden = true;
    if (!storageOK()) {
      toast('当前打开方式无法保存数据（关闭后会丢失），请用 http(s) 地址打开或安装到主屏幕', 'err');
    }
    $('#searchInput').value = S.settings.q || '';
    switchView('archive');

    tick();
    setInterval(tick, 15000);

    // 调试参数：?nosplash=1 跳过启动动画，?view=stats 直达某页，?open=1 打开编辑器
    const qs = new URLSearchParams(location.search);
    if (qs.has('debug')) {
      window.__ops = {
        S, parseQuick, buildICS, quickAdd, toggleDone, openEditor, saveEditor,
        render, currentList, groupTasks, normTask, fmtDue, cdText, toDueStr, parseDue, tick, fireReminder
      };
    }
    const hideSplash = () => {
      const sp = $('#splash');
      if (sp) { sp.classList.add('off'); setTimeout(() => sp.remove(), 500); }
    };
    if (qs.get('nosplash')) hideSplash();
    else setTimeout(hideSplash, 820);

    const v = qs.get('view');
    if (v && VIEW_META[v]) switchView(v);
    if (qs.get('open')) setTimeout(() => openEditor(null), 120);

    // PWA
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    boot().catch(e => fatal(((e && e.stack) || String(e))));
  });
})();
