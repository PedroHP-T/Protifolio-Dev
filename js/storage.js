// storage.js — camada de dados completa do sistema RH

const Storage = {

  // ── EMPRESA ──
  getEmpresa()          { return this._get('rh_empresa'); },
  saveEmpresa(d)        { this._set('rh_empresa', d); },

  // ── FUNCIONÁRIOS ──
  getFuncionarios()     { return this._get('rh_funcionarios') || []; },
  getFuncionarioById(id){ return this.getFuncionarios().find(f=>f.id===id)||null; },
  saveFuncionario(f)    {
    const lista=this.getFuncionarios(), i=lista.findIndex(x=>x.id===f.id);
    i>=0 ? lista[i]=f : lista.push(f);
    this._set('rh_funcionarios', lista);
  },
  deleteFuncionario(id) { this._set('rh_funcionarios', this.getFuncionarios().filter(f=>f.id!==id)); },

  // ── PONTO ──
  getPontoMes(ano, mes) { return this._get(`rh_ponto_${ano}_${mes}`) || {}; },
  savePontoMes(ano, mes, d) { this._set(`rh_ponto_${ano}_${mes}`, d); },
  saveBatida(fid, ano, mes, dia, campo, valor) {
    const obj = this.getPontoMes(ano, mes);
    if(!obj[fid]) obj[fid]={};
    if(!obj[fid][dia]) obj[fid][dia]={};
    obj[fid][dia][campo]=valor;
    this.savePontoMes(ano, mes, obj);
  },

  // ── BANCO DE HORAS ──
  getBancoHoras(fid)    { return this._get(`rh_banco_${fid}`) || {saldo:0, historico:[]}; },
  addBancoHoras(fid, minutos, descricao) {
    const bh = this.getBancoHoras(fid);
    bh.saldo += minutos;
    bh.historico.unshift({ data: new Date().toISOString(), minutos, descricao });
    if(bh.historico.length > 50) bh.historico = bh.historico.slice(0,50);
    this._set(`rh_banco_${fid}`, bh);
  },

  // ── HISTÓRICO DE PAGAMENTOS ──
  getHistPagamentos(fid){ return this._get(`rh_hpgto_${fid}`) || []; },
  addHistPagamento(fid, pgto) {
    const h = this.getHistPagamentos(fid);
    h.unshift({ ...pgto, id: this.gerarId(), criadoEm: new Date().toISOString() });
    if(h.length>24) h.pop();
    this._set(`rh_hpgto_${fid}`, h);
  },

  // ── DOCUMENTOS ──
  getDocumentos(fid)    { return this._get(`rh_docs_${fid}`) || []; },
  addDocumento(fid, doc){ const d=this.getDocumentos(fid); d.push({...doc,id:this.gerarId(),criadoEm:new Date().toISOString()}); this._set(`rh_docs_${fid}`,d); },
  delDocumento(fid, id) { this._set(`rh_docs_${fid}`, this.getDocumentos(fid).filter(d=>d.id!==id)); },

  // ── APROVAÇÕES DE PONTO ──
  getAprovacoes()       { return this._get('rh_aprovacoes') || []; },
  addAprovacao(ap)      { const l=this.getAprovacoes(); l.unshift({...ap,id:this.gerarId(),criadoEm:new Date().toISOString()}); this._set('rh_aprovacoes',l); },
  resolverAprovacao(id, status, obs) {
    const l=this.getAprovacoes(), i=l.findIndex(a=>a.id===id);
    if(i>=0){l[i].status=status;l[i].obs=obs||'';l[i].resolvidoEm=new Date().toISOString();}
    this._set('rh_aprovacoes',l);
  },

  // ── FÉRIAS ──
  getFerias(fid)        { return this._get(`rh_ferias_${fid}`) || []; },
  addFerias(fid, f)     { const l=this.getFerias(fid); l.push({...f,id:this.gerarId()}); this._set(`rh_ferias_${fid}`,l); },

  // ── UTILITÁRIOS ──
  gerarId()             { return 'id_'+Date.now()+'_'+Math.random().toString(36).slice(2,7); },
  sistemaConfigurado()  { return !!this.getEmpresa(); },
  resetar()             {
    Object.keys(localStorage).filter(k=>k.startsWith('rh_')).forEach(k=>localStorage.removeItem(k));
  },
  _get(k)               { try{ const d=localStorage.getItem(k); return d?JSON.parse(d):null; }catch(e){return null;} },
  _set(k,v)             { try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){console.warn('Storage full',e);} },
};
