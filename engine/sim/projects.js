/* Local Game Studio engine — projects: staged lifecycles (orders & deliveries, developments,
   productions, integrations, construction) with per-stage durations, running costs, risks,
   player decision gates, and completion effects. */
(function (E) {
  'use strict';
  const U = E.util;
  E.extendGame({
    startProject(id, sc, op = {}) {
      const pd = this.def.projects[id];
      if (!pd) { this.report('project', new Error('Unknown project ' + id)); return null; }
      const org = (op.owner ? this.ev(op.owner, sc) : sc.org) || this.playerOrg();
      const data = {};
      for (const [k, x] of Object.entries(op.set || {})) { let v = this.ev(x, sc); if (v && typeof v === 'object' && (v.__ent || v.__org)) v = this.refOf(v); data[k] = v; }
      const target = op.target ? this.ev(op.target, sc) : (sc.self && sc.self.__ent ? sc.self : null);
      const inst = { iid: this.newId('prj_'), id, owner: org.id, data, target: target ? this.refOf(target) : null, stage: -1, left: 0, total: 0, created: this.state.tick, spent: 0, name: '' };
      const psc = this.projectScope(inst);
      inst.name = this.tpl(op.name || pd.name || pd.label || id, psc);
      this.state.projects[inst.iid] = inst;
      this.enterStage(inst, 0);
      if (org.isPlayer && !this.state.warm) this.news(`${pd.label || 'Project'} started: ${inst.name}`, 'routine', { tag: 'project' });
      return inst;
    },
    projectScope(inst) {
      const org = this.state.orgs[inst.owner];
      const p = {};
      for (const [k, v] of Object.entries(inst.data || {})) p[k] = this.deref(v);
      p.name = inst.name; p.spent = inst.spent; p.age = this.state.tick - inst.created;
      return this.scope({ org, p, project: p, self: inst.target ? this.deref(inst.target) : null });
    },
    enterStage(inst, i) {
      const pd = this.def.projects[inst.id];
      const stages = pd.stages && pd.stages.length ? pd.stages : [{ id: 'work', label: pd.label || 'In progress', duration: pd.duration || 4 }];
      inst.stage = i;
      const sd = stages[i];
      const sc = this.projectScope(inst);
      inst.left = Math.max(1, Math.round(this.num(sd.duration != null ? sd.duration : 4, sc, 4)));
      inst.total = inst.left;
      inst.stageLabel = sd.label || sd.id;
      inst.waiting = null;
      if (sd.onEnter) this.runOps(sd.onEnter, sc);
    },
    progressProjects() {
      for (const inst of Object.values(this.state.projects)) {
        const pd = this.def.projects[inst.id];
        const org = this.state.orgs[inst.owner];
        if (!pd || !org || !org.alive) { delete this.state.projects[inst.iid]; continue; }
        if (inst.waiting) {
          if (!org.isPlayer) this.continueProject(inst.iid, 0); // AI approves gates
          continue;
        }
        const stages = pd.stages && pd.stages.length ? pd.stages : [{ id: 'work', label: pd.label, duration: pd.duration || 4 }];
        const sd = stages[inst.stage];
        const sc = this.projectScope(inst);
        if (sd.cost) { const c = this.num(sd.cost, sc, 0); if (c) { this.addCash(org, -Math.abs(c), sd.costCategory || pd.costCategory || pd.label || 'Projects', null, !!pd.capex); inst.spent += Math.abs(c); } }
        if (sd.risk) {
          const p = this.num(sd.risk.chance, sc, 0);
          if (p > 0 && this.rng.next() < p) {
            this.runOps(sd.risk.effects, sc);
            if (org.isPlayer && sd.risk.news) this.news(this.tpl(sd.risk.news, sc), sd.risk.priority || 'important', { tag: 'project' });
            if (sd.risk.event && org.isPlayer) this.scheduleEvent(sd.risk.event, 0, { self: inst.target }, org);
          }
        }
        inst.left--;
        if (inst.left > 0) continue;
        if (sd.onComplete) this.runOps(sd.onComplete, sc);
        if (sd.gate && org.isPlayer) { inst.waiting = { label: this.tpl(sd.gate.label || 'Approve next stage', sc), describe: sd.gate.describe ? this.tpl(sd.gate.describe, sc) : '', options: (sd.gate.options || [{ label: 'Continue' }, { label: 'Cancel project', cancel: true }]).map(o => ({ label: this.tpl(o.label, sc), cancel: !!o.cancel })) }; continue; }
        this.advanceProject(inst);
      }
    },
    advanceProject(inst) {
      const pd = this.def.projects[inst.id];
      const stages = pd.stages && pd.stages.length ? pd.stages : [{ id: 'work' }];
      if (inst.stage + 1 < stages.length) { this.enterStage(inst, inst.stage + 1); return; }
      const sc = this.projectScope(inst);
      delete this.state.projects[inst.iid];
      if (pd.onComplete) this.runOps(pd.onComplete, sc);
      const org = this.state.orgs[inst.owner];
      if (org && org.isPlayer && !this.state.warm) this.news(this.tpl(pd.doneNews || `${pd.label || 'Project'} complete: ${inst.name}`, sc), pd.donePriority || 'routine', { tag: 'project' });
    },
    continueProject(iid, optionIndex = 0) {
      const inst = this.state.projects[iid];
      if (!inst || !inst.waiting) return false;
      const pd = this.def.projects[inst.id];
      const stages = pd.stages || [];
      const sd = stages[inst.stage] || {};
      const opt = (sd.gate && sd.gate.options && sd.gate.options[optionIndex]) || (optionIndex === 1 ? { cancel: true } : {});
      const sc = this.projectScope(inst);
      if (opt.effects) this.runOps(opt.effects, sc);
      if (opt.cancel) { this.cancelProject(iid); return true; }
      inst.waiting = null;
      this.advanceProject(inst);
      return true;
    },
    cancelProject(iid) {
      const inst = this.state.projects[iid];
      if (!inst) return false;
      const pd = this.def.projects[inst.id];
      const sc = this.projectScope(inst);
      delete this.state.projects[iid];
      if (pd.onCancel) this.runOps(pd.onCancel, sc);
      if (this.state.orgs[inst.owner] && this.state.orgs[inst.owner].isPlayer) this.news(`${pd.label || 'Project'} cancelled: ${inst.name}`, 'routine', { tag: 'project' });
      return true;
    }
  });
})(globalThis.LGE = globalThis.LGE || {});
