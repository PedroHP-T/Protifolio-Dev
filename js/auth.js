// auth.js — autenticação e controle de sessão com Supabase Auth

const Auth = {
  _user: null,   // cache do usuário autenticado
  _profile: null, // cache do perfil

  // Retorna usuário atual do cache
  currentUser() { return this._profile; },
  currentSession() { return this._user; },

  // Inicializa: verifica sessão existente e configura listener
  async init() {
    try {
      // Timeout de 8 segundos para não travar infinitamente
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout ao conectar ao Supabase. Verifique suas credenciais.')), 8000)
      );

      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

      if (session?.user) {
        this._user    = session.user;
        this._profile = await this._loadProfile(session.user.id);
      }

      // Listener de mudança de estado
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          this._user    = session.user;
          this._profile = await this._loadProfile(session.user.id);
          try { await DB.registrarSessao(); } catch(e) {}
          this._pingSession();
        } else if (event === 'SIGNED_OUT') {
          this._user    = null;
          this._profile = null;
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          this._user = session.user;
        }
      });

    } catch(err) {
      console.error('[Auth.init]', err.message);
      const loading = document.getElementById('loading-screen');
      if (loading) {
        loading.innerHTML = `
          <div style="text-align:center;padding:40px;max-width:400px;">
            <div style="width:48px;height:48px;border-radius:50%;background:#FEE2E2;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
              <i class="ti ti-wifi-off" style="font-size:24px;color:#DC2626;"></i>
            </div>
            <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 8px;">Erro de conexão</p>
            <p style="font-size:13px;color:#6B7280;margin:0 0 20px;">${err.message}</p>
            <p style="font-size:12px;color:#9CA3AF;margin:0 0 16px;">Verifique se as credenciais em <strong>js/supabase.js</strong> estão corretas.</p>
            <button onclick="location.reload()" style="background:#2347C5;color:#fff;border:none;padding:9px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">Tentar novamente</button>
          </div>`;
      }
      return null;
    }

    return this._profile;
  },

  // Carrega perfil do banco
  async _loadProfile(userId) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error || !data) return null;

      // Busca todos os roles do usuário na tabela user_roles.
      // Se a tabela ainda não existir (migração não rodada), cai no
      // fallback de usar só o role único de profiles.role.
      try {
        const { data: rolesData, error: rolesErr } = await supabase
          .from('user_roles').select('role').eq('profile_id', userId);
        if (!rolesErr && rolesData && rolesData.length) {
          data.roles = rolesData.map(r => r.role);
        } else {
          data.roles = [data.role];
        }
      } catch(e) {
        data.roles = [data.role];
      }

      return data;
    } catch(e) {
      console.error('[Auth._loadProfile]', e.message);
      return null;
    }
  },

  // Verifica se o usuário logado tem um role específico (entre possivelmente vários)
  hasRole(role) {
    if (!this._profile) return false;
    if (Array.isArray(this._profile.roles)) return this._profile.roles.includes(role);
    return this._profile.role === role;
  },

  // Ping de sessão a cada 2 minutos
  _pingSession() {
    setInterval(async () => {
      if (this._profile) {
        await supabase.from('sessoes').upsert({
          user_id: this._profile.id,
          user_nome: this._profile.nome,
          user_role: this._profile.role,
          ativo: true,
          last_seen: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        await supabase.from('profiles').update({ ultimo_login: new Date().toISOString() }).eq('id', this._profile.id);
      }
    }, 2 * 60 * 1000);
  },

  // Verifica se o role passa direto sem aprovação (admin e RH)
  _isAprovacaoAutomatica(role) {
    return role === 'admin' || role === 'administrator' || role === 'rh';
  },

  // Login com e-mail e senha
  async login(email, senha) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;

    const profile = await this._loadProfile(data.user.id);

    if (!profile?.ativo) {
      await supabase.auth.signOut();
      throw new Error('Conta desativada. Entre em contato com o administrador.');
    }

    this._user    = data.user;
    this._profile = profile;

    // Admin e RH entram direto, sem precisar de CNPJ nem aprovação
    if (this._isAprovacaoAutomatica(profile.role)) {
      return profile;
    }

    // Funcionário: precisa ter vinculado um CNPJ primeiro
    if (!profile.cnpj_empresa) {
      throw { code: 'SEM_CNPJ', profile };
    }

    // Já vinculou CNPJ, mas ainda não foi aprovado
    if (profile.acesso_status === 'pendente') {
      throw { code: 'ACESSO_PENDENTE', profile };
    }

    if (profile.acesso_status === 'rejeitado') {
      await supabase.auth.signOut();
      throw new Error('Seu acesso à empresa foi negado. Entre em contato com o administrador.');
    }

    return profile;
  },

  // Cadastro de novo usuário
  async cadastrar(email, senha, nome, role = 'funcionario') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome, role } },
    });

    if (error) throw error;

    // Aguarda trigger criar o profile
    await new Promise(r => setTimeout(r, 800));

    if (data.user) {
      await supabase.from('profiles').update({
        nome,
        role,
        ativo: true,
        acesso_status: this._isAprovacaoAutomatica(role) ? 'aprovado' : 'pendente',
      }).eq('id', data.user.id);
    }

    return data.user;
  },

  // Vincula o usuário logado a uma empresa pelo CNPJ
  async vincularCnpj(cnpj) {
    if (!this._profile) throw new Error('Não autenticado');

    const cnpjLimpo = cnpj.replace(/\D/g, '');

    // Busca empresa pelo CNPJ (compara só os números)
    const { data: empresas, error: errBusca } = await supabase.from('empresa').select('*');
    if (errBusca) throw errBusca;

    const empresa = (empresas || []).find(e => (e.cnpj || '').replace(/\D/g, '') === cnpjLimpo);
    if (!empresa) {
      throw new Error('Nenhuma empresa encontrada com este CNPJ. Verifique o número ou peça para o administrador cadastrar a empresa primeiro.');
    }

    const { data, error } = await supabase.from('profiles').update({
      cnpj_empresa: cnpj,
      acesso_status: 'pendente',
      updated_at: new Date().toISOString(),
    }).eq('id', this._profile.id).select().single();

    if (error) throw error;
    this._profile = data;
    return { profile: data, empresa };
  },

  // Cadastra uma nova empresa e vincula o usuário atual como admin dela
  async cadastrarEmpresaComoAdmin(dadosEmpresa) {
    if (!this._profile) throw new Error('Não autenticado');

    // Verifica se já existe empresa com esse CNPJ
    const cnpjLimpo = (dadosEmpresa.cnpj || '').replace(/\D/g, '');
    const { data: existentes } = await supabase.from('empresa').select('cnpj');
    const jaExiste = (existentes || []).some(e => (e.cnpj || '').replace(/\D/g, '') === cnpjLimpo);
    if (jaExiste) {
      throw new Error('Já existe uma empresa cadastrada com este CNPJ.');
    }

    // Cria a empresa
    const { data: empresa, error: errEmpresa } = await supabase.from('empresa').insert(dadosEmpresa).select().single();
    if (errEmpresa) throw errEmpresa;

    // Promove o usuário atual a admin e vincula a empresa
    const { data: profile, error: errProfile } = await supabase.from('profiles').update({
      role: 'admin',
      acesso_status: 'aprovado',
      cnpj_empresa: dadosEmpresa.cnpj,
      updated_at: new Date().toISOString(),
    }).eq('id', this._profile.id).select().single();

    if (errProfile) throw errProfile;
    this._profile = profile;
    return { profile, empresa };
  },

  // Verifica status atual de aprovação (usado na tela de espera)
  async verificarStatusAcesso(profileId) {
    const { data, error } = await supabase.from('profiles').select('acesso_status, cnpj_empresa').eq('id', profileId).single();
    if (error) throw error;
    return data;
  },

  // Logout
  async logout() {
    await DB.encerrarSessao();
    await supabase.auth.signOut();
    this._user    = null;
    this._profile = null;
  },

  // Recuperação de senha
  async recuperarSenha(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/reset-password.html`,
    });
    if (error) throw error;
  },

  // Redefinir senha (após clicar no link do e-mail)
  async redefinirSenha(novaSenha) {
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) throw error;
  },

  // Atualizar perfil do usuário logado
  async atualizarPerfil(dados) {
    if (!this._profile) throw new Error('Não autenticado');
    const { data, error } = await supabase.from('profiles')
      .update({ ...dados, updated_at: new Date().toISOString() })
      .eq('id', this._profile.id).select().single();
    if (error) throw error;
    this._profile = data;
    return data;
  },

  // Verifica se o usuário tem permissão para uma ação
  podeAcessar(rolesPermitidos) {
    if (!this._profile) return false;
    const meusRoles = Array.isArray(this._profile.roles) ? this._profile.roles : [this._profile.role];
    return rolesPermitidos.some(r => meusRoles.includes(r));
  },

  // Protege rota: redireciona se não autenticado ou sem permissão
  async protegerRota(rolesPermitidos = ['admin','rh','funcionario']) {
    const profile = await this.init();
    // Detecta se estamos numa subpasta (admin/, rh/, setup/, etc.) para calcular o caminho relativo correto
    const emSubpasta = /\/(admin|rh|setup|auth)\//.test(location.pathname);
    const base = emSubpasta ? '../index.html' : 'index.html';
    if (!profile) {
      location.href = base;
      return false;
    }
    const meusRoles = Array.isArray(profile.roles) ? profile.roles : [profile.role];
    if (!rolesPermitidos.some(r => meusRoles.includes(r))) {
      location.href = base;
      return false;
    }
    return true;
  },

  // Label amigável do role
  roleLabel(role) {
    return { admin: 'Administrador', rh: 'RH', funcionario: 'Funcionário' }[role] || role;
  },
};

// Helpers de cálculo (usados em db.js e app.js)
function calcINSS(sal) {
  let r=0,b=sal,a=0;
  for(const f of [{t:1412,p:.075},{t:2666.68,p:.09},{t:4000.03,p:.12},{t:7786.02,p:.14}]){
    if(b<=0)break; const x=Math.min(b,f.t-a); r+=x*f.p; a=f.t; b-=x;
  }
  return Math.min(r,sal*.14);
}
function calcIRRF(bc){
  if(bc>4664.68)return Math.max(0,bc*.275-869.36);
  if(bc>3751.05)return Math.max(0,bc*.225-636.13);
  if(bc>2826.65)return Math.max(0,bc*.15-354.80);
  if(bc>2112)   return Math.max(0,bc*.075-158.40);
  return 0;
}
