/* Local Game Studio — web UI. Vanilla JS, no build step, talks only to the local server. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const main = $('#main');
  const api = async (p, opts = {}) => {
    const r = await fetch('/api/' + p, Object.assign({ headers: { 'content-type': 'application/json' } }, opts, opts.body && typeof opts.body !== 'string' ? { body: JSON.stringify(opts.body) } : {}));
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('json') ? await r.json() : await r.text();
    if (!r.ok) throw new Error((data && data.error) || r.statusText);
    return data;
  };
  const toast = (t) => { const d = document.createElement('div'); d.textContent = t; $('#toast').appendChild(d); setTimeout(() => d.remove(), 4200); };
  const ago = (iso) => { if (!iso) return ''; const s = (Date.now() - new Date(iso).getTime()) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : new Date(iso).toLocaleDateString(); };
  const fmtMs = (ms) => ms == null ? '' : ms < 1000 ? ms + ' ms' : ms < 60000 ? (ms / 1000).toFixed(0) + ' s' : (ms / 60000).toFixed(1) + ' min';
  let streams = [];
  const closeStreams = () => { streams.forEach(s => s.close()); streams = []; };

  /* ---------- status pill ---------- */
  let STATUS = null;
  async function refreshStatus() {
    try {
      STATUS = await api('status');
      const l = STATUS.llm || {};
      const prov = l.providers || {};
      const any = Object.entries(prov).find(([, v]) => v && v.ok);
      const cls = l.ready ? 'ok' : any ? 'warn' : 'bad';
      const txt = l.ready ? `Local model: ${esc(l.roles.main)}` : any ? 'Runtime running — choose a model' : 'No local model running — deterministic designer only';
      $('#status').innerHTML = `<span class="dot ${cls}"></span><span>${txt}</span>${STATUS.jobs ? `<span class="chip">${STATUS.jobs} job${STATUS.jobs > 1 ? 's' : ''} running</span>` : ''}`;
    } catch (e) { $('#status').innerHTML = '<span class="dot bad"></span> Studio server unreachable'; }
  }

  /* ---------- router ---------- */
  const routes = {};
  function go(hash) { location.hash = hash; }
  async function render() {
    closeStreams();
    const parts = (location.hash || '#/create').slice(2).split('/');
    $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === (parts[0] === 'project' || parts[0] === 'job' ? 'projects' : parts[0])));
    const fn = routes[parts[0]] || routes.create;
    main.innerHTML = '<div class="empty">Loading…</div>';
    try { await fn(...parts.slice(1)); } catch (e) { main.innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
    main.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', render);

  /* ================= CREATE ================= */
  let attachments = [];
  routes.create = async () => {
    const draft = localStorage.getItem('lgs.draft') || '';
    main.innerHTML = `
      <h1>What game should we make?</h1>
      <p class="lede">Describe the management game you want — one sentence or a 30,000-word spec. The studio designs, builds, tests, playtests, balances and packages it on this computer.</p>
      <textarea class="prompt" id="prompt" placeholder="e.g. Build me a deep airline management game where I start with a small regional airline and can eventually build a global carrier…">${esc(draft)}</textarea>
      <div class="create-row">
        <label class="chk"><input type="radio" name="mode" value="auto" checked> One-click auto</label>
        <label class="chk"><input type="radio" name="mode" value="review"> Pause to review the design</label>
        <span class="spacer"></span>
        <button class="btn primary big" id="build">BUILD GAME</button>
      </div>
      <details class="opts"><summary>Optional controls</summary>
        <div class="optgrid">
          <label class="f">Depth<select id="o-depth"><option value="">From the prompt</option><option>light</option><option>medium</option><option>deep</option><option>very deep</option></select></label>
          <label class="f">Realism<select id="o-realism"><option value="">From the prompt</option><option>arcade</option><option>grounded</option><option>realistic</option></select></label>
          <label class="f">Session length<select id="o-length"><option value="">From the prompt</option><option>short</option><option>medium</option><option>long</option><option>endless</option></select></label>
          <label class="f">Universe<select id="o-universe"><option value="">From the prompt</option><option value="realistic-fictional">Real places, fictional companies</option><option value="fictional">Fully fictional</option><option value="mixed">Real + fictional (clearly labeled)</option></select></label>
          <label class="f">Visual priority<select id="o-visual"><option value="">From the prompt</option><option>clean</option><option>rich</option><option>cinematic</option></select></label>
          <label class="f">Workflow<select id="o-mode"><option value="create">Create a new game</option><option value="remaster">Remaster an HTML game (attach it)</option><option value="expand">Expand an HTML game (attach it)</option></select></label>
          <label class="chk"><input type="checkbox" id="o-llm" checked> Use the local model when available</label>
        </div>
        <div class="drop" id="drop">Drop an existing HTML game, design document or screenshots here (or <label style="text-decoration:underline;cursor:pointer">browse<input type="file" id="file" multiple hidden></label>)</div>
        <div id="atts" class="chips" style="margin-top:8px"></div>
      </details>
      <div class="compiled" id="compiled"></div>`;
    const ta = $('#prompt');
    let t = null;
    const compile = async () => {
      localStorage.setItem('lgs.draft', ta.value);
      if (ta.value.trim().length < 12) { $('#compiled').innerHTML = ''; return; }
      const c = await api('compile', { method: 'POST', body: { prompt: ta.value } });
      const by = (k) => c.requirements.filter(r => r.kind === k);
      const conf = c.conflicts.length ? `<div class="notice">${c.conflicts.map(x => `<div><b>${x.severity === 'major' ? 'Needs your decision' : 'Resolved'}:</b> ${esc(x.text)} — ${esc(x.resolution)}</div>`).join('')}</div>` : '';
      $('#compiled').innerHTML = `<div class="panel"><h3>The studio understood</h3>
        <p class="small">Genre: <b>${esc(c.genre.genre || 'not recognized — a generic management archetype will be used')}</b>${c.genre.genre ? ` (${Math.round(c.genre.confidence * 100)}% confidence)` : ''} · ${c.requirements.length} requirements · ${c.stats.words} words</p>
        ${['must', 'should', 'optional', 'negative'].map(k => by(k).length ? `<div style="margin:8px 0"><span class="muted small">${{ must: 'Must have', should: 'Should have', optional: 'Optional', negative: 'Avoid' }[k]}</span><div class="chips">${by(k).map(r => `<span class="chip ${k}" title="${esc(r.area)}">${esc(r.text.length > 90 ? r.text.slice(0, 88) + '…' : r.text)}</span>`).join('')}</div></div>` : '').join('')}
        ${conf}</div>`;
    };
    ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(compile, 400); });
    if (draft) compile();
    const addFiles = async (files) => {
      for (const f of files) { if (f.size > 40 * 1024 * 1024) { toast(`${f.name} is too large`); continue; } const content = /\.(png|jpe?g|webp|gif)$/i.test(f.name) ? '[image attached: ' + f.name + ']' : await f.text(); attachments.push({ name: f.name, content }); }
      $('#atts').innerHTML = attachments.map((a, i) => `<span class="chip">${esc(a.name)} <a href="#" data-x="${i}">×</a></span>`).join('');
      const html = attachments.find(a => /\.html?$/i.test(a.name));
      if (html && $('#o-mode').value === 'create') { $('#o-mode').value = 'remaster'; toast('HTML game attached — workflow set to Remaster'); }
    };
    $('#file').addEventListener('change', (e) => addFiles(e.target.files));
    const drop = $('#drop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('on'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('on'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('on'); addFiles(e.dataTransfer.files); });
    $('#atts').addEventListener('click', (e) => { const x = e.target.dataset.x; if (x != null) { e.preventDefault(); attachments.splice(+x, 1); addFiles([]); } });
    $('#build').addEventListener('click', async () => {
      const prompt = ta.value.trim();
      const mode = $('#o-mode').value;
      if (!prompt && mode === 'create') { ta.focus(); toast('Describe the game first.'); return; }
      const options = {}; for (const k of ['depth', 'realism', 'length', 'universe', 'visual']) { const v = $('#o-' + k).value; if (v) options[k] = v; }
      $('#build').disabled = true;
      try {
        const r = await api('projects', { method: 'POST', body: { prompt, mode, options, attachments, review: document.querySelector('input[name=mode]:checked').value === 'review', useLLM: $('#o-llm').checked } });
        localStorage.removeItem('lgs.draft'); attachments = [];
        go(`#/job/${r.job.id}/${r.project.id}`);
      } catch (e) { toast(e.message); $('#build').disabled = false; }
    });
  };

  /* ================= JOB PROGRESS ================= */
  function stageList(stages) {
    return `<ul class="stages">${stages.map((s, i) => `<li class="${s.status}"><span class="ic">${s.status === 'done' ? '✓' : s.status === 'failed' ? '!' : s.status === 'skipped' ? '–' : s.status === 'running' ? '' : i + 1}</span><div><b>${esc(s.label)}</b>${s.repairs ? ` <span class="chip warn">${s.repairs} repair${s.repairs > 1 ? 's' : ''}</span>` : ''}${s.notes && s.notes.length ? `<div class="notes">${s.notes.slice(-4).map(esc).join('<br>')}</div>` : ''}</div><span class="t">${s.ms != null ? fmtMs(s.ms) : ''}</span></li>`).join('')}</ul>`;
  }
  routes.job = async (jobId, projectId) => {
    let snap = await api('jobs/' + jobId);
    const draw = () => {
      const p = snap.progress, cur = snap.stages.find(s => s.status === 'running');
      const pct = Math.round(p.done / p.total * 100);
      main.innerHTML = `
        <p class="small"><a href="#/project/${esc(snap.projectId)}">← Project</a></p>
        <h1>${{ create: 'Building your game', remaster: 'Remastering', modify: 'Changing your game', audit: 'Auditing', balance: 'Balancing', export: 'Exporting' }[snap.kind] || 'Working'}</h1>
        <p class="lede">${snap.status === 'done' ? 'Finished.' : snap.status === 'failed' ? 'Stopped: ' + esc(snap.error) : snap.status === 'paused' ? 'Waiting for your design review.' : cur ? `Stage ${snap.stages.indexOf(cur) + 1} of ${snap.stages.length}: <b>${esc(cur.label)}</b> <span id="detail" class="muted"></span>` : 'Queued…'}</p>
        <div class="progressbar"><i style="width:${pct}%"></i></div><p class="small muted">${p.done} of ${p.total} stages complete</p>
        <div id="review"></div>
        <div class="grid g2" style="margin-top:14px"><div class="panel">${stageList(snap.stages)}</div>
        <div><div class="panel"><h3>Production log</h3><div class="log" id="log">${(snap.log || []).map(l => `<div class="${l.level}">${esc(l.text)}</div>`).join('')}</div></div>
        <div class="cc-actions">${snap.status === 'done' || snap.status === 'failed' ? `<a class="btn primary" href="#/project/${esc(snap.projectId)}">Open project</a><a class="btn" href="/play/${esc(snap.projectId)}/" target="_blank">▶ Play</a>` : `<button class="btn danger" id="cancel">Cancel</button>`}</div></div></div>`;
      const lg = $('#log'); if (lg) lg.scrollTop = lg.scrollHeight;
      if ($('#cancel')) $('#cancel').onclick = async () => { if (confirm('Cancel this job? Completed stages and saved versions are kept.')) await api(`jobs/${jobId}/cancel`, { method: 'POST' }); };
      if (snap.status === 'paused' && snap.waiting) drawReview(snap);
    };
    draw();
    if (['done', 'failed', 'cancelled'].includes(snap.status)) return;
    const es = new EventSource(`/api/jobs/${jobId}/events`);
    streams.push(es);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data);
      if (e.type === 'snapshot') { snap = e.job; draw(); return; }
      if (e.type === 'log') { snap.log = (snap.log || []).concat([e]); const lg = $('#log'); if (lg) { const d = document.createElement('div'); d.className = e.level; d.textContent = e.text; lg.appendChild(d); lg.scrollTop = lg.scrollHeight; } return; }
      if (e.type === 'progress') { const d = $('#detail'); if (d) d.textContent = '· ' + e.detail; return; }
      if (e.type === 'stage') { const i = snap.stages.findIndex(s => s.id === e.stage.id); if (i >= 0) snap.stages[i] = e.stage; snap.progress = e.progress; draw(); return; }
      if (e.type === 'status') { snap.status = e.status; snap.error = e.error; if (e.waiting) snap.waiting = e.waiting; draw(); if (['done', 'failed', 'cancelled'].includes(e.status)) { es.close(); refreshStatus(); if (e.status === 'done') toast('Done!'); } }
    };
  };
  function drawReview(snap) {
    const w = snap.waiting;
    $('#review').innerHTML = `<div class="panel"><h2>Review the design</h2><p class="small muted">Edit anything, then continue. Feature verdicts follow the anti-bloat rubric — requested features are always kept.</p>
      <div class="grid g2"><label class="f">Title<input id="rv-title" value="${esc(w.brief.title || '')}"></label><label class="f">Role<input id="rv-role" value="${esc(w.brief.role || '')}"></label></div>
      <label class="f" style="margin-top:10px">Player fantasy (one per line)<textarea id="rv-fantasy" rows="5">${esc((w.brief.fantasy || []).join('\n'))}</textarea></label>
      <table class="t" style="margin-top:12px"><tr><th>Feature</th><th>Requested</th><th>Verdict</th></tr>${w.plan.features.map(f => `<tr><td>${esc(f.label)}</td><td>${f.requested ? 'yes' : ''}</td><td><select data-f="${esc(f.id)}">${['keep', 'automate', 'merge', 'cut'].map(v => `<option ${v === f.verdict ? 'selected' : ''}>${v}</option>`).join('')}</select></td></tr>`).join('')}</table>
      <div class="cc-actions"><button class="btn primary" id="rv-go">Continue building</button></div></div>`;
    $('#rv-go').onclick = async () => {
      const verdicts = {}; $$('select[data-f]').forEach(s => { verdicts[s.dataset.f] = s.value; });
      await api(`jobs/${snap.id}/resume`, { method: 'POST', body: { brief: { title: $('#rv-title').value, role: $('#rv-role').value, fantasy: $('#rv-fantasy').value.split('\n').map(x => x.trim()).filter(Boolean) }, verdicts } });
      $('#review').innerHTML = '';
    };
  }

  /* ================= PROJECTS ================= */
  routes.projects = async () => {
    const list = await api('projects');
    main.innerHTML = `<h1>Projects</h1><p class="lede">Every game is a persistent project with its design memory, versions, test reports and releases.</p>
      ${list.length ? `<div class="cards">${list.map(p => `<a class="pcard" href="#/project/${esc(p.id)}"><span class="muted small">${esc(p.genre || '')} · ${esc(p.status || '')}</span><b>${esc(p.title || p.id)}</b><span class="small muted">Updated ${ago(p.updated)}${p.stage ? ' · ' + esc(p.stage) : ''}</span>${p.gates ? `<span class="chips"><span class="chip ${p.gates.finished ? 'good' : 'warn'}">gates ${p.gates.passed}/${p.gates.total}</span></span>` : ''}</a>`).join('')}</div>` : '<div class="empty">No projects yet. <a href="#/create">Create your first game.</a></div>'}`;
  };

  /* ================= PROJECT CONTROL CENTER ================= */
  routes.project = async (id, tab) => {
    const p = await api('projects/' + id);
    tab = tab || 'overview';
    const a = p.reports.audit;
    const running = p.meta.lastJob && (p.meta.lastJob.status === 'running');
    const rel = p.releases.slice().sort((x, y) => new Date(y.mtime) - new Date(x.mtime))[0];
    main.innerHTML = `
      <p class="small"><a href="#/projects">← Projects</a></p>
      <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap"><div style="flex:1;min-width:260px"><h1>${esc(p.title || p.id)}</h1><p class="lede" style="margin:0">${esc(p.meta.genre || '')}${p.brief && p.brief.tagline ? ' — ' + esc(p.brief.tagline) : ''}</p></div>
      ${a ? `<div class="kpi" style="min-width:150px"><span>Quality</span><b>${a.scorecard.score}/100</b><div class="small muted">gates ${esc(a.scorecard.gates)} · review ${esc(a.scorecard.review)}</div></div>` : ''}</div>
      ${running ? `<div class="notice info">A job is running. <a href="#/job/${esc(p.meta.lastJob.id)}/${esc(p.id)}">Watch progress</a></div>` : p.meta.lastJob && p.meta.lastJob.status === 'failed' ? `<div class="notice">Last job failed: ${esc(p.meta.lastJob.error || '')}</div>` : ''}
      <div class="cc-actions">
        ${p.hasGame ? `<a class="btn primary" href="/play/${esc(p.id)}/" target="_blank">▶ PLAY</a>` : ''}
        <button class="btn" data-go="modify">Modify</button>
        <button class="btn" data-job="audit">Audit</button>
        <button class="btn" data-job="balance">Balance</button>
        <button class="btn" data-job="export">Export HTML</button>
        ${rel ? `<a class="btn" href="/api/projects/${esc(p.id)}/release/${esc(rel.file)}?download=1">⬇ ${esc(rel.file)}</a>` : ''}
        <button class="btn" data-go="tests">Test report</button>
        <button class="btn" data-go="design">Design</button>
        <button class="btn" data-go="history">Build history</button>
        <button class="btn" data-remaster="1">Remaster</button>
        <button class="btn" data-reveal="1" title="Open the project folder on this computer">Open project folder</button>
      </div>
      <div class="subtabs">${[['overview', 'Overview'], ['modify', 'Modify'], ['design', 'Design'], ['requirements', 'Requirements'], ['tests', 'Tests & QA'], ['balance', 'Balance'], ['screens', 'Screenshots'], ['history', 'Build history']].map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="tabbody"></div>`;
    $$('[data-tab]').forEach(b => b.onclick = () => go(`#/project/${id}/${b.dataset.tab}`));
    $$('[data-go]').forEach(b => b.onclick = () => go(`#/project/${id}/${b.dataset.go}`));
    $$('[data-job]').forEach(b => b.onclick = async () => { const r = await api(`projects/${id}/jobs`, { method: 'POST', body: { kind: b.dataset.job } }); go(`#/job/${r.job.id}/${id}`); });
    $('[data-reveal]').onclick = async () => { const r = await api(`projects/${id}/reveal`, { method: 'POST' }); toast('Opened ' + r.path); };
    $('[data-remaster]').onclick = async () => { if (!confirm('Rebuild this game from its prompt with the current studio (a new version; the old one stays in Build history)?')) return; const r = await api(`projects/${id}/jobs`, { method: 'POST', body: { kind: 'create' } }); go(`#/job/${r.job.id}/${id}`); };
    const body = $('#tabbody');
    const T = projectTabs[tab] || projectTabs.overview;
    T(body, p, id);
  };
  const projectTabs = {};
  projectTabs.overview = (body, p, id) => {
    const a = p.reports.audit, t = p.reports.tests, b = p.reports.browser;
    body.innerHTML = `<div class="grid g2">
      <div class="panel"><h3>Quality gates</h3>${a ? a.gates.gates.map(g => `<div class="gate"><span>${{ pass: '✅', warn: '⚠️', fail: '❌', 'n/a': '➖', 'not-run': '⏸' }[g.status]}</span><div><b>${g.gate}. ${esc(g.name)}</b><div class="small muted">${(g.evidence || []).slice(0, 3).map(esc).join(' · ')}</div></div></div>`).join('') : '<div class="empty">No audit yet.</div>'}</div>
      <div><div class="panel"><h3>Design review</h3>${a ? a.review.map(r => `<div class="gate"><span>${{ pass: '✅', concern: '⚠️', 'not-run': '⏸' }[r.verdict] || '•'}</span><div><b>${esc(r.test)} test</b><div class="small muted">${r.evidence.slice(0, 2).map(esc).join(' · ')}</div></div></div>`).join('') : '<div class="empty">No review yet.</div>'}</div>
      <div class="panel"><h3>At a glance</h3><div class="kpis">
        <div class="kpi"><span>Tests</span><b>${t ? `${t.passed}/${t.passed + t.failed}` : '—'}</b></div>
        <div class="kpi"><span>Browser checks</span><b>${b ? (b.skipped ? 'skipped' : `${b.passed}/${b.passed + b.failed}`) : '—'}</b></div>
        <div class="kpi"><span>Versions</span><b>${p.versions.length}</b></div>
        <div class="kpi"><span>Requests</span><b>${(p.meta.requests || []).length}</b></div></div></div></div></div>
      ${a && a.critics.length ? `<div class="panel"><h3>Open findings</h3>${a.critics.slice(0, 12).map(c => `<div class="small" style="margin:4px 0"><span class="chip ${c.severity === 'critical' || c.severity === 'major' ? 'bad' : ''}">${esc(c.severity)}</span> ${esc(c.text)} <span class="muted">${c.fix ? '→ ' + esc(c.fix) : ''}</span></div>`).join('')}</div>` : ''}
      <div class="panel"><h3>Original prompt</h3><div class="doc">${esc(p.prompt)}</div></div>`;
  };
  projectTabs.modify = (body, p, id) => {
    body.innerHTML = `<div class="panel"><h2>What should change?</h2><p class="small muted">The studio reads the project's memory and changes the existing game — it never regenerates it blindly. Examples: “The route system is too tedious — make it about network strategy.” · “The late game is too easy.” · “Make the fleet page much more visual.” · “Export the finished game.”</p>
      <textarea class="req" id="req" placeholder="Describe the change…"></textarea><div class="create-row"><span class="small muted" id="cls"></span><span class="spacer"></span><button class="btn primary" id="send">Apply change</button></div></div>
      <div class="panel"><h3>Previous requests</h3>${(p.meta.requests || []).slice().reverse().map(r => `<div class="small" style="margin:6px 0"><span class="muted">${ago(r.t)}</span> — ${esc(r.text)} ${r.job ? `<a href="#/job/${esc(r.job)}/${esc(id)}">details</a>` : ''}</div>`).join('') || '<div class="empty">None yet.</div>'}</div>`;
    let t; $('#req').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(async () => { if (e.target.value.length < 6) return; const c = await api('classify', { method: 'POST', body: { request: e.target.value } }); $('#cls').textContent = 'Understood as: ' + c.intents.join(' + ') + (c.direction ? ` (${c.direction}, ${c.phase} game)` : ''); }, 300); });
    $('#send').onclick = async () => { const request = $('#req').value.trim(); if (!request) return; const r = await api(`projects/${id}/request`, { method: 'POST', body: { request } }); go(`#/job/${r.job.id}/${id}`); };
  };
  projectTabs.design = async (body, p, id) => {
    body.innerHTML = `<div class="grid" style="grid-template-columns:220px 1fr"><div class="panel">${p.memoryDocs.map(n => `<div><a href="#" data-doc="${esc(n)}">${esc(n.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()))}</a></div>`).join('')}</div><div id="docv" class="panel"><div class="empty">Pick a design document. You can edit them — the studio uses them as project memory.</div></div></div>`;
    $$('[data-doc]').forEach(a => a.onclick = async (e) => {
      e.preventDefault(); const name = a.dataset.doc; const text = await api(`projects/${id}/memory/${name}`);
      $('#docv').innerHTML = `<h3>${esc(name)}</h3><textarea class="doc" id="doctext">${esc(text)}</textarea><div class="cc-actions"><button class="btn" id="docsave">Save</button></div>`;
      $('#docsave').onclick = async () => { await api(`projects/${id}/memory/${name}`, { method: 'PUT', body: { text: $('#doctext').value } }); toast('Saved'); };
    });
  };
  projectTabs.requirements = (body, p) => {
    const tr = p.trace || [];
    body.innerHTML = `<div class="panel"><h3>Requirements matrix</h3>${tr.length ? `<table class="t"><tr><th>ID</th><th>Requirement</th><th>Kind</th><th>Status</th><th>Where</th></tr>${tr.map(r => `<tr><td>${esc(r.id)}</td><td>${esc(r.text)}</td><td>${esc(r.kind)}</td><td><span class="chip ${r.status === 'implemented' || r.status === 'respected' ? 'good' : r.status === 'not-found' ? 'bad' : 'warn'}">${esc(r.status)}</span>${r.note ? `<div class="small muted">${esc(r.note)}</div>` : ''}</td><td class="small">${(r.where || []).slice(0, 4).map(esc).join('<br>')}</td></tr>`).join('')}</table>` : '<div class="empty">No trace yet.</div>'}</div>
      ${p.requirements && p.requirements.conflicts.length ? `<div class="panel"><h3>Conflicts</h3>${p.requirements.conflicts.map(c => `<div class="small">• ${esc(c.text)} → ${esc(c.resolution)}</div>`).join('')}</div>` : ''}`;
  };
  projectTabs.tests = (body, p, id) => {
    const t = p.reports.tests, b = p.reports.browser;
    body.innerHTML = `<div class="grid g2"><div class="panel"><h3>Simulation tests</h3>${t ? `<table class="t">${t.results.map(r => `<tr><td>${r.ok ? '✅' : '❌'}</td><td>${esc(r.name)}<div class="small muted">${esc(r.error || r.note || '')}</div></td><td class="small muted">${r.ms} ms</td></tr>`).join('')}</table>` : '<div class="empty">Not run.</div>'}</div>
      <div class="panel"><h3>Browser QA</h3>${!b ? '<div class="empty">Not run.</div>' : b.skipped ? `<div class="notice">${esc(b.reason)}</div>` : `<table class="t">${b.steps.map(s => `<tr><td>${s.ok ? '✅' : '❌'}</td><td>${esc(s.name)}<div class="small muted">${esc(s.note)}</div></td></tr>`).join('')}</table>${b.errors.length ? `<div class="notice">${b.errors.slice(0, 5).map(e => esc(e.text)).join('<br>')}</div>` : ''}`}</div></div>
      ${b && b.metrics && b.metrics.screens ? `<div class="panel"><h3>Screen metrics (information density)</h3><table class="t"><tr><th>Screen</th><th>Panels</th><th>Words</th><th>Numbers</th><th>Buttons</th><th>Visuals</th></tr>${Object.entries(b.metrics.screens).map(([k, m]) => `<tr><td>${esc(k)}</td><td>${m.panels}</td><td>${m.words}</td><td>${m.numbers}</td><td>${m.buttons}</td><td>${m.visuals}</td></tr>`).join('')}</table></div>` : ''}
      <p><a class="btn" href="/api/projects/${esc(id)}/report/AUDIT.md" target="_blank">Full audit report (Markdown)</a></p>`;
  };
  function miniChart(series) {
    const all = series.flatMap(s => s.values).filter(Number.isFinite); if (all.length < 2) return '<div class="empty">Not enough data.</div>';
    const mn = Math.min(0, ...all), mx = Math.max(...all), W = 520, H = 140, n = Math.max(...series.map(s => s.values.length));
    const X = (i) => 30 + i / Math.max(1, n - 1) * (W - 40), Y = (v) => 10 + (1 - (v - mn) / (mx - mn || 1)) * (H - 30);
    const colors = ['var(--accent)', 'var(--good)', 'var(--warn)', 'var(--bad)', 'var(--info)', 'var(--muted)'];
    return `<svg class="mini-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${series.map((s, i) => `<polyline style="stroke:${colors[i % 6]}" points="${s.values.map((v, j) => Number.isFinite(v) ? `${X(j)},${Y(v)}` : '').filter(Boolean).join(' ')}"/>`).join('')}<line x1="30" x2="${W - 10}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)"/></svg><div class="chips">${series.map((s, i) => `<span class="chip" style="border-color:${colors[i % 6]}">${esc(s.label)}</span>`).join('')}</div>`;
  }
  projectTabs.balance = async (body, p, id) => {
    const bal = p.reports.balance; const md = await api(`projects/${id}/memory/BALANCE_REPORT`).catch(() => '');
    if (!bal) { body.innerHTML = '<div class="empty">No balance run yet.</div>'; return; }
    const S = bal.aggregate.strategies;
    body.innerHTML = `<div class="grid g2"><div class="panel"><h3>Company value by year (median)</h3>${miniChart(Object.entries(S).map(([k, v]) => ({ label: k, values: v.valueByYear })))}</div>
      <div class="panel"><h3>Strategies</h3><table class="t"><tr><th>Strategy</th><th>Survival</th><th>Margin</th><th>Growth</th></tr>${Object.entries(S).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${Math.round(v.survival * 100)}%</td><td>${v.medianMargin == null ? '—' : (v.medianMargin * 100).toFixed(1) + '%'}</td><td>×${v.medianValueGrowth == null ? '—' : v.medianValueGrowth.toFixed(1)}</td></tr>`).join('')}</table>
      <p class="small">${bal.findings.length ? bal.findings.map(f => '• ' + esc(f.text)).join('<br>') : 'No balance findings.'}</p></div></div>
      <div class="panel"><h3>Balance report</h3><div class="doc">${esc(md)}</div></div>`;
  };
  projectTabs.screens = (body, p, id) => {
    body.innerHTML = p.screenshots.length ? `<div class="shots">${p.screenshots.map(s => `<a href="/api/projects/${esc(id)}/screenshots/${esc(s)}" target="_blank"><img loading="lazy" src="/api/projects/${esc(id)}/screenshots/${esc(s)}" alt="${esc(s)}"><span>${esc(s.replace(/^\d+-|\.png$/g, ''))}</span></a>`).join('')}</div>` : '<div class="empty">No screenshots yet (browser QA captures them).</div>';
  };
  projectTabs.history = (body, p, id) => {
    body.innerHTML = `<div class="grid g2"><div class="panel"><h3>Versions</h3><ul class="versions">${p.versions.slice().reverse().map(v => `<li><span class="stage">${esc(v.stage)}</span><span style="flex:1">${esc(v.note)}<div class="small muted">${ago(v.created)}</div></span><button class="btn sm" data-restore="${esc(v.id)}">Restore</button></li>`).join('') || '<div class="empty">No versions.</div>'}</ul></div>
      <div class="panel"><h3>Change history</h3>${p.history.map(h => `<div class="small" style="margin:5px 0"><span class="muted">${ago(h.t)}</span> · <b>${esc(h.kind)}</b> ${esc(h.text)}</div>`).join('')}</div></div>
      <div class="panel"><h3>Releases</h3>${p.releases.map(r => `<div class="small"><a href="/api/projects/${esc(id)}/release/${esc(r.file)}?download=1">${esc(r.file)}</a> · ${(r.size / 1024 / 1024).toFixed(1)} MB · ${ago(r.mtime)}</div>`).join('') || '<div class="empty">None.</div>'}</div>`;
    $$('[data-restore]').forEach(b => b.onclick = async () => { if (!confirm('Restore this version? The current state is backed up first.')) return; await api(`projects/${id}/restore`, { method: 'POST', body: { version: b.dataset.restore } }); toast('Restored'); render(); });
  };

  /* ================= MODELS ================= */
  routes.models = async () => {
    const m = await api('models');
    const hw = m.hardware || {}, st = m.status || {};
    const prov = st.providers || {};
    const inst = m.installed || [];
    const opts = (sel) => `<option value="">— none —</option>${inst.map(i => `<option ${i.id === sel ? 'selected' : ''}>${esc(i.id)}</option>`).join('')}`;
    main.innerHTML = `<h1>Models</h1><p class="lede">Local models design, write content and critique. Simulation, testing, balancing and bundling are ordinary software and never need a model. Without any model the studio still builds complete games from its design library.</p>
      <div class="grid g2"><div class="panel"><h3>This computer</h3><div class="kpis"><div class="kpi"><span>Memory</span><b>${hw.totalGB} GB</b></div><div class="kpi"><span>GPU budget</span><b>${hw.gpuBudgetGB} GB</b></div><div class="kpi"><span>CPU cores</span><b>${hw.cpus}</b></div></div><p class="small muted">${esc(hw.cpuModel || '')}<br>${(hw.notes || []).map(esc).join('<br>')}</p></div>
      <div class="panel"><h3>Runtimes</h3>${Object.entries(prov).map(([k, v]) => `<div class="small" style="margin:4px 0"><span class="dot ${v.ok ? 'ok' : 'bad'}"></span> <b>${esc(k)}</b> ${v.ok ? 'running' + (v.version ? ' ' + esc(v.version) : '') : '— not running' + (k === 'ollama' ? ' (install from ollama.com, then reopen this page)' : '')}</div>`).join('') || '<div class="empty">No runtime enabled — see Settings.</div>'}
      <h3 style="margin-top:14px">Roles</h3><div class="grid g3"><label class="f">Fast (quick parsing)<select data-role="fast">${opts(m.roles.fast)}</select></label><label class="f">Main (design & code)<select data-role="main">${opts(m.roles.main)}</select></label><label class="f">Critic (review)<select data-role="critic">${opts(m.roles.critic)}</select></label></div></div></div>
      <div class="panel"><h3>Recommended for this machine</h3><table class="t"><tr><th>Model</th><th>Tier</th><th>Size</th><th>Fits?</th><th>Measured</th><th></th></tr>${(m.recommendations || []).map(r => { const b = m.benchmarks[r.id]; return `<tr><td><b>${esc(r.label || r.id)}</b><div class="small muted">${esc(r.id)}${r.note ? ' · ' + esc(r.note) : ''}</div></td><td>${esc(r.tier || '')}</td><td>${r.sizeGB} GB <span class="small muted">(${esc(r.sizeSource)})</span></td><td><span class="fit ${r.fit.verdict}">${r.fit.verdict === 'fits' ? 'Fits' : r.fit.verdict === 'tight' ? 'Tight' : 'Too big'}</span><div class="small muted">needs ~${r.fit.needGB} of ${r.fit.budgetGB} GB</div></td><td class="small">${b ? `${b.avgSeconds ? b.avgSeconds.toFixed(1) + ' s' : '—'} · JSON ${Math.round(b.jsonReliability * 100)}%` : '—'}</td><td>${r.installed ? `<button class="btn sm" data-bench="${esc(r.id)}">Benchmark</button> <button class="btn sm danger" data-rm="${esc(r.id)}">Remove</button>` : (r.fit.verdict === 'too-big' ? `<button class="btn sm" data-pull="${esc(r.id)}" title="Probably too large for this machine — it may run very slowly or fail to load">Install anyway</button>` : `<button class="btn sm primary" data-pull="${esc(r.id)}">Install</button>`)}<div class="small" id="pull-${esc(r.id).replace(/[^\w]/g, '_')}"></div></td></tr>`; }).join('')}</table>
      <p class="small muted">Installing downloads the model once through Ollama; after that everything runs offline. The studio picks Fast / Balanced / Best-that-fits automatically when you install the first model.</p></div>`;
    $$('[data-role]').forEach(s => s.onchange = async () => { await api('models/roles', { method: 'POST', body: { [s.dataset.role]: s.value } }); toast('Saved'); refreshStatus(); });
    $$('[data-pull]').forEach(b => b.onclick = () => {
      const id = b.dataset.pull, out = $('#pull-' + id.replace(/[^\w]/g, '_')); b.disabled = true;
      const es = new EventSource('/api/models/pull?model=' + encodeURIComponent(id)); streams.push(es);
      es.onmessage = async (e) => { const d = JSON.parse(e.data); if (d.type === 'progress') out.textContent = `${d.status || ''} ${d.total ? Math.round(d.completed / d.total * 100) + '%' : ''}`; if (d.type === 'done') { es.close(); out.textContent = 'Installed'; const cur = await api('models'); const roles = cur.roles; if (!roles.main) await api('models/roles', { method: 'POST', body: { main: id, fast: roles.fast || id, critic: roles.critic || id } }); render(); refreshStatus(); } if (d.type === 'error') { es.close(); out.textContent = d.error; b.disabled = false; } };
    });
    $$('[data-bench]').forEach(b => b.onclick = async () => { b.disabled = true; b.textContent = 'Running…'; try { const r = await api('models/benchmark', { method: 'POST', body: { model: b.dataset.bench } }); toast(`JSON reliability ${Math.round(r.jsonReliability * 100)}%, ${r.avgSeconds ? r.avgSeconds.toFixed(1) + ' s' : 'failed'}`); } catch (e) { toast(e.message); } render(); });
    $$('[data-rm]').forEach(b => b.onclick = async () => { if (!confirm('Remove ' + b.dataset.rm + ' from disk?')) return; await api('models/remove', { method: 'POST', body: { model: b.dataset.rm } }); render(); });
  };

  /* ================= LIBRARY ================= */
  routes.library = async (file) => {
    const list = await api('library');
    main.innerHTML = `<h1>Game Design Intelligence Library</h1><p class="lede">What the studio knows about management games: reference-game audit, core loops, mechanics, UI patterns, failure patterns, fun patterns, genre fantasies. Every design stage reads from it.</p>
      <div class="grid" style="grid-template-columns:260px 1fr"><div class="panel">${list.map(f => `<div style="margin:4px 0"><a href="#/library/${esc(f.file)}">${esc(f.file)}</a> <span class="small muted">${f.items != null ? f.items + ' items' : ''}</span></div>`).join('')}</div><div class="panel" id="libv">${file ? '' : '<div class="empty">Pick a file.</div>'}</div></div>`;
    if (file) { const r = await fetch('/api/library/' + encodeURIComponent(file)); const txt = await r.text(); let pretty = txt; try { pretty = JSON.stringify(JSON.parse(txt), null, 2); } catch (e) { /* markdown */ } $('#libv').innerHTML = `<h3>${esc(file)}</h3><div class="doc" style="max-height:70vh">${esc(pretty)}</div>`; }
  };

  /* ================= BENCHMARKS ================= */
  routes.benchmarks = async () => {
    const b = await api('benchmarks'); const projects = await api('projects');
    main.innerHTML = `<h1>Benchmarks</h1><p class="lede">Eight briefs across the management genre check that the studio generalizes. Building all of them takes a while on a laptop — pick a few.</p>
      <div class="panel"><table class="t"><tr><th></th><th>Brief</th><th>Expected domain mechanics</th><th>Latest build</th></tr>${b.briefs.map(x => { const pr = projects.find(p => (p.title || '').startsWith(`Benchmark ${x.id}:`)); return `<tr><td><input type="checkbox" data-b="${esc(x.id)}"></td><td><b>${esc(x.id)}. ${esc(x.name)}</b><div class="small muted">${esc(x.prompt.slice(0, 140))}…</div></td><td class="small">${x.expect.map(esc).join(', ')}</td><td>${pr ? `<a href="#/project/${esc(pr.id)}">${esc(pr.status || 'open')}</a>${pr.gates ? ` <span class="chip ${pr.gates.finished ? 'good' : 'warn'}">gates ${pr.gates.passed}/${pr.gates.total}</span>` : ''}` : '—'}</td></tr>`; }).join('')}</table>
      <div class="cc-actions"><button class="btn primary" id="runb">Build selected</button></div></div>`;
    $('#runb').onclick = async () => { const ids = $$('[data-b]:checked').map(c => c.dataset.b); if (!ids.length) return toast('Select at least one brief'); await api('benchmarks/run', { method: 'POST', body: { ids } }); toast(`Queued ${ids.length} build(s)`); go('#/projects'); };
  };

  /* ================= SETTINGS ================= */
  routes.settings = async () => {
    const s = await api('settings'); const prefs = await api('preferences');
    const P = s.providers;
    main.innerHTML = `<h1>Settings</h1>
      <div class="grid g2"><div class="panel"><h3>Local runtimes</h3>
        <label class="chk"><input type="checkbox" id="s-oll" ${P.ollama.enabled ? 'checked' : ''}> Ollama</label><label class="f">Address<input id="s-ollurl" value="${esc(P.ollama.baseUrl)}"></label>
        <label class="chk" style="margin-top:12px"><input type="checkbox" id="s-oai" ${P.openaiCompatible.enabled ? 'checked' : ''}> OpenAI-compatible local server (LM Studio, mlx_lm.server, llama.cpp)</label><label class="f">Address<input id="s-oaiurl" value="${esc(P.openaiCompatible.baseUrl)}"></label>
        <h3 style="margin-top:18px">Cloud (optional)</h3>
        <div class="notice">Off by default. When enabled, it is only used for a build where you explicitly choose it — never silently. Your prompts and game definitions would be sent to that provider.</div>
        <label class="chk"><input type="checkbox" id="s-cloud" ${P.cloud.enabled ? 'checked' : ''}> Enable a cloud provider</label>
        <div class="grid g2"><label class="f">Provider<select id="s-cprov">${['none', 'anthropic', 'openai'].map(x => `<option ${x === P.cloud.provider ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label class="f">Model<input id="s-cmodel" value="${esc(P.cloud.model || '')}"></label></div>
        <label class="f">API key<input id="s-ckey" type="password" value="${esc(P.cloud.apiKey || '')}"></label></div>
      <div class="panel"><h3>Builds</h3>
        <div class="grid g2"><label class="f">Playtest runs per round<input type="number" id="s-runs" value="${s.generation.balanceRuns}" min="6" max="60"></label><label class="f">Years simulated<input type="number" id="s-years" value="${s.generation.balanceYears}" min="3" max="20"></label>
        <label class="f">Model repair attempts<input type="number" id="s-rep" value="${s.generation.maxRepairs}" min="0" max="5"></label><label class="f">Temperature<input type="number" step="0.05" id="s-temp" value="${s.generation.temperature}" min="0" max="1.2"></label>
        <label class="f">Context (main)<input type="number" id="s-ctx" value="${s.context.main}" step="1024"></label><label class="f">Context (fast)<input type="number" id="s-ctxf" value="${s.context.fast}" step="1024"></label></div>
        <label class="chk" style="margin-top:10px"><input type="checkbox" id="s-br" ${s.generation.browserTests !== false ? 'checked' : ''}> Run browser tests & screenshots</label>
        <h3 style="margin-top:18px">Server</h3><p class="small">Listening on <b>${esc(s.host)}:${s.port}</b> — this computer only.</p>
        <div class="cc-actions"><button class="btn primary" id="s-save">Save settings</button></div></div></div>
      <div class="panel"><h3>What the studio has learned about you</h3><p class="small muted">Soft preferences, learned from your requests. Edit or clear freely — they are hints, never rules.</p>
        <textarea class="doc" id="prefs" style="min-height:220px">${esc(JSON.stringify({ likes: prefs.likes, dislikes: prefs.dislikes, notes: prefs.notes, signals: prefs.signals }, null, 2))}</textarea>
        <div class="cc-actions"><button class="btn" id="p-save">Save preferences</button></div></div>`;
    $('#s-save').onclick = async () => {
      await api('settings', { method: 'PUT', body: { providers: { ollama: { enabled: $('#s-oll').checked, baseUrl: $('#s-ollurl').value }, openaiCompatible: { enabled: $('#s-oai').checked, baseUrl: $('#s-oaiurl').value }, cloud: { enabled: $('#s-cloud').checked, provider: $('#s-cprov').value, model: $('#s-cmodel').value, apiKey: $('#s-ckey').value } }, generation: { balanceRuns: +$('#s-runs').value, balanceYears: +$('#s-years').value, maxRepairs: +$('#s-rep').value, temperature: +$('#s-temp').value, browserTests: $('#s-br').checked }, context: { main: +$('#s-ctx').value, fast: +$('#s-ctxf').value } } });
      toast('Saved'); refreshStatus();
    };
    $('#p-save').onclick = async () => { try { await api('preferences', { method: 'PUT', body: JSON.parse($('#prefs').value) }); toast('Saved'); } catch (e) { toast('Not valid JSON: ' + e.message); } };
  };

  refreshStatus(); setInterval(refreshStatus, 15000);
  render();
})();
