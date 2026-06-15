// db.js — camada de acesso ao banco de dados (Supabase)
// Substitui o localStorage; mantém a mesma interface do storage.js anterior

const DB = {

  // ── UTILITÁRIOS ──────────────────────────────────────────────

  async _query(fn) {
    try {
      const res = await fn();
      if (res.error) throw res.error;
      return res.data;
    } catch (err) {
      console.error('[DB]', err.message);
      throw err;
    }
  },

  async _log(acao, tabela, id, antes, depois) {
    const user = Auth.currentUser();
    if (!user) return;
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_nome: user.nome,
      acao,
      tabela,
      registro_id: id,
      dados_antes: antes || null,
      dados_depois: depois || null,
    });
  },

  // ── EMPRESA ──────────────────────────────────────────────────

  async getEmpresa() {
    const rows = await this._query(() => supabase.from('empresa').select('*').limit(1));
    return rows?.[0] || null;
  },

  async saveEmpresa(data) {
    const existing = await this.getEmpresa();
    if (existing) {
      const res = await supabase.from('empresa').update(data).eq('id', existing.id).select().single();
      if (res.error) throw res.error;
      await this._log('update', 'empresa', existing.id, existing, data);
      return res.data;
    } else {
      const res = await supabase.from('empresa').insert(data).select().single();
      if (res.error) throw res.error;
      await this._log('insert', 'empresa', res.data.id, null, data);
      return res.data;
    }
  },

  // ── FUNCIONÁRIOS ─────────────────────────────────────────────

  async getFuncionarios(filtros = {}) {
    let q = supabase.from('funcionarios').select('*').order('nome');
    if (filtros.status) q = q.eq('status', filtros.status);
    if (filtros.departamento_id) q = q.eq('departamento_id', filtros.departamento_id);
    return await this._query(() => q);
  },

  async getFuncionarioById(id) {
    const res = await supabase.from('funcionarios').select('*').eq('id', id).single();
    return res.data || null;
  },

  async getFuncionarioByProfileId(profileId) {
    const res = await supabase.from('funcionarios').select('*').eq('profile_id', profileId).single();
    return res.data || null;
  },

  async saveFuncionario(data) {
    const { id, ...payload } = data;
    payload.updated_at = new Date().toISOString();
    if (id) {
      const antes = await this.getFuncionarioById(id);
      const res = await supabase.from('funcionarios').update(payload).eq('id', id).select().single();
      if (res.error) throw res.error;
      await this._log('update', 'funcionarios', id, antes, payload);
      return res.data;
    } else {
      const res = await supabase.from('funcionarios').insert(payload).select().single();
      if (res.error) throw res.error;
      await this._log('insert', 'funcionarios', res.data.id, null, payload);
      return res.data;
    }
  },

  async deleteFuncionario(id) {
    await this._log('delete', 'funcionarios', id, null, null);
    return await this._query(() => supabase.from('funcionarios').delete().eq('id', id));
  },

  // ── PONTO ────────────────────────────────────────────────────

  async getPontoMes(funcionarioId, ano, mes) {
    const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
    const fim    = `${ano}-${String(mes).padStart(2,'0')}-31`;
    return await this._query(() =>
      supabase.from('ponto').select('*')
        .eq('funcionario_id', funcionarioId)
        .gte('data', inicio).lte('data', fim)
        .order('data')
    );
  },

  async savePonto(funcionarioId, data, campos) {
    // data pode ser string ISO ou objeto {ano, mes, dia}
    let dataISO;
    if (typeof data === 'string') {
      dataISO = data;
    } else {
      const a = data.ano, m = String(data.mes).padStart(2,'0'), d = String(data.dia).padStart(2,'0');
      dataISO = `${a}-${m}-${d}`;
    }
    // Busca registro existente para fazer merge dos campos
    const { data: existente } = await supabase.from('ponto')
      .select('*').eq('funcionario_id', funcionarioId).eq('data', dataISO).single();

    const payload = {
      funcionario_id: funcionarioId,
      data: dataISO,
      ...(existente || {}),  // preserva campos já salvos
      ...campos,             // sobrescreve só o campo alterado
      updated_at: new Date().toISOString(),
    };
    delete payload.id;       // remove id para upsert funcionar pelo conflito

    const res = await supabase.from('ponto')
      .upsert(payload, { onConflict: 'funcionario_id,data' })
      .select().single();
    if (res.error) throw res.error;
    return res.data;
  },

  async aprovarPonto(pontoId, status, obs) {
    const user = Auth.currentUser();
    const res = await supabase.from('ponto').update({
      status, obs, aprovado_por: user?.id, updated_at: new Date().toISOString()
    }).eq('id', pontoId).select().single();
    if (res.error) throw res.error;
    await this._log('update', 'ponto', pontoId, null, { status, obs });
    return res.data;
  },

  // ── BANCO DE HORAS ───────────────────────────────────────────

  async getBancoHoras(funcionarioId) {
    const rows = await this._query(() =>
      supabase.from('banco_horas').select('*').eq('funcionario_id', funcionarioId).order('created_at', { ascending: false })
    );
    const saldo = (rows || []).reduce((a, r) => a + (r.tipo === 'credito' ? r.minutos : -r.minutos), 0);
    return { saldo, historico: rows || [] };
  },

  async addBancoHoras(funcionarioId, minutos, descricao) {
    return await this._query(() =>
      supabase.from('banco_horas').insert({
        funcionario_id: funcionarioId,
        minutos: Math.abs(minutos),
        descricao,
        tipo: minutos >= 0 ? 'credito' : 'debito',
      })
    );
  },

  // ── PAGAMENTOS ───────────────────────────────────────────────

  async getPagamentos(funcionarioId) {
    return await this._query(() =>
      supabase.from('pagamentos').select('*')
        .eq('funcionario_id', funcionarioId).order('competencia', { ascending: false })
    );
  },

  async savePagamento(data) {
    const res = await supabase.from('pagamentos').insert(data).select().single();
    if (res.error) throw res.error;
    await this._log('insert', 'pagamentos', res.data.id, null, data);
    return res.data;
  },

  async getPagamentosMes(competencia) {
    return await this._query(() =>
      supabase.from('pagamentos').select('*, funcionarios(nome, cargo, departamento)').eq('competencia', competencia)
    );
  },

  // ── DOCUMENTOS ───────────────────────────────────────────────

  async getDocumentos(funcionarioId) {
    return await this._query(() =>
      supabase.from('documentos').select('*').eq('funcionario_id', funcionarioId).order('created_at', { ascending: false })
    );
  },

  async addDocumento(funcionarioId, doc) {
    return await this._query(() =>
      supabase.from('documentos').insert({ funcionario_id: funcionarioId, ...doc })
    );
  },

  async delDocumento(id) {
    return await this._query(() => supabase.from('documentos').delete().eq('id', id));
  },

  // ── FÉRIAS ───────────────────────────────────────────────────

  async getFerias(funcionarioId) {
    return await this._query(() =>
      supabase.from('ferias').select('*').eq('funcionario_id', funcionarioId).order('inicio', { ascending: false })
    );
  },

  async saveFerias(data) {
    return await this._query(() => supabase.from('ferias').insert(data));
  },

  // ── APROVAÇÕES ───────────────────────────────────────────────

  async getAprovacoes(status = null) {
    let q = supabase.from('aprovacoes').select('*, funcionarios(nome,cargo)').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    return await this._query(() => q);
  },

  async addAprovacao(data) {
    const user = Auth.currentUser();
    return await this._query(() =>
      supabase.from('aprovacoes').insert({ ...data, solicitante_id: user?.id })
    );
  },

  async resolverAprovacao(id, status, obs) {
    const user = Auth.currentUser();
    return await this._query(() =>
      supabase.from('aprovacoes').update({
        status, obs,
        resolvido_por: user?.id,
        resolvido_em: new Date().toISOString(),
      }).eq('id', id)
    );
  },

  // ── DEPARTAMENTOS ────────────────────────────────────────────

  async getDepartamentos() {
    return await this._query(() =>
      supabase.from('departamentos').select('*, profiles(nome)').eq('ativo', true).order('nome')
    );
  },

  async saveDepartamento(data) {
    const { id, ...payload } = data;
    if (id) {
      return await this._query(() => supabase.from('departamentos').update(payload).eq('id', id));
    }
    return await this._query(() => supabase.from('departamentos').insert(payload));
  },

  async deleteDepartamento(id) {
    return await this._query(() => supabase.from('departamentos').update({ ativo: false }).eq('id', id));
  },

  // ── CARGOS ───────────────────────────────────────────────────

  async getCargos(departamentoId = null) {
    let q = supabase.from('cargos').select('*').eq('ativo', true).order('nome');
    if (departamentoId) q = q.eq('departamento_id', departamentoId);
    return await this._query(() => q);
  },

  async saveCargo(data) {
    const { id, ...payload } = data;
    if (id) return await this._query(() => supabase.from('cargos').update(payload).eq('id', id));
    return await this._query(() => supabase.from('cargos').insert(payload));
  },

  async deleteCargo(id) {
    return await this._query(() => supabase.from('cargos').update({ ativo: false }).eq('id', id));
  },

  // ── PERFIS / USUÁRIOS ────────────────────────────────────────

  async getProfiles() {
    return await this._query(() => supabase.from('profiles').select('*').order('nome'));
  },

  async getProfile(id) {
    const res = await supabase.from('profiles').select('*').eq('id', id).single();
    return res.data || null;
  },

  async updateProfile(id, data) {
    const res = await supabase.from('profiles').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (res.error) throw res.error;
    await this._log('update', 'profiles', id, null, data);
    return res.data;
  },

  async updateProfileRole(id, role) {
    return await this.updateProfile(id, { role });
  },

  async toggleProfileAtivo(id, ativo) {
    return await this.updateProfile(id, { ativo });
  },

  // ── AUDIT LOGS ───────────────────────────────────────────────

  async getAuditLogs(limit = 100) {
    return await this._query(() =>
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit)
    );
  },

  // ── SESSÕES ONLINE ───────────────────────────────────────────

  async registrarSessao() {
    const user = Auth.currentUser();
    if (!user) return;
    await supabase.from('sessoes').upsert({
      user_id: user.id,
      user_nome: user.nome,
      user_role: user.role,
      ativo: true,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  },

  async encerrarSessao() {
    const user = Auth.currentUser();
    if (!user) return;
    await supabase.from('sessoes').update({ ativo: false }).eq('user_id', user.id);
  },

  async getSessoesAtivas() {
    const limite = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min
    return await this._query(() =>
      supabase.from('sessoes').select('*').eq('ativo', true).gte('last_seen', limite).order('last_seen', { ascending: false })
    );
  },

  // ── CONFIGURAÇÕES ────────────────────────────────────────────

  async getConfig(chave) {
    const res = await supabase.from('configuracoes').select('valor').eq('id', chave).single();
    return res.data?.valor || null;
  },

  async setConfig(chave, valor) {
    await supabase.from('configuracoes').upsert({ id: chave, valor, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  },

  // ── MÉTRICAS / DASHBOARD ─────────────────────────────────────

  async getMetricas() {
    const [funcs, aprovsPend, pontoHoje] = await Promise.all([
      this.getFuncionarios(),
      this.getAprovacoes('pendente'),
      this._query(() =>
        supabase.from('ponto').select('*').eq('data', new Date().toISOString().slice(0,10))
      ),
    ]);
    const hoje = new Date();
    const dns = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
    const dh = dns[hoje.getDay()];
    const ativos    = (funcs||[]).filter(f => f.status !== 'inativo');
    const deFolga   = ativos.filter(f => (f.dias_folga||[]).includes(dh));
    const emFerias  = (funcs||[]).filter(f => f.status === 'ferias');
    const folhaMes  = ativos.reduce((a,f) => {
      const s = parseFloat(f.salario||0);
      const inss = calcINSS(s);
      return a + s - inss - calcIRRF(s - inss);
    }, 0);
    return { ativos: ativos.length, total: (funcs||[]).length, deFolga: deFolga.length,
             trabalhando: ativos.length - deFolga.length, emFerias: emFerias.length,
             aprovsPendentes: (aprovsPend||[]).length, folhaMes };
  },

  // ── RELATÓRIOS ───────────────────────────────────────────────

  async getRelatorioFolha(competencia) {
    return await this._query(() =>
      supabase.from('pagamentos')
        .select('*, funcionarios(nome, cargo, departamento, tipo_contrato)')
        .eq('competencia', competencia)
        .order('created_at')
    );
  },

  async getRelatorioPonto(funcionarioId, ano, mes) {
    return await this.getPontoMes(funcionarioId, ano, mes);
  },

  async getRelatorioFuncionarios() {
    return await this._query(() =>
      supabase.from('funcionarios').select('*').order('nome')
    );
  },
};
