// auth.js — autenticação e controle de sessão com Supabase Auth

const sb = window.supabaseClient;

const Auth = {
  _user: null,
  _profile: null,

  currentUser() { return this._profile; },
  currentSession() { return this._user; },

  async init() {
    try {
      const sessionPromise = sb.auth.getSession();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout ao conectar ao Supabase. Verifique suas credenciais.')), 8000)
      );

      const { data: { session } } = await Promise.race([
        sessionPromise,
        timeoutPromise
      ]);

      if (session?.user) {
        this._user = session.user;
        this._profile = await this._loadProfile(session.user.id);
      }

      sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          this._user = session.user;
          this._profile = await this._loadProfile(session.user.id);

          try {
            await DB.registrarSessao();
          } catch (e) {}

          this._pingSession();

        } else if (event === 'SIGNED_OUT') {
          this._user = null;
          this._profile = null;

        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          this._user = session.user;
        }
      });

    } catch (err) {
      console.error('[Auth.init]', err.message);

      const loading = document.getElementById('loading-screen');

      if (loading) {
        loading.innerHTML = `
          <div style="text-align:center;padding:40px;max-width:400px;">
            <div style="width:48px;height:48px;border-radius:50%;background:#FEE2E2;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
              <i class="ti ti-wifi-off" style="font-size:24px;color:#DC2626;"></i>
            </div>

            <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 8px;">
              Erro de conexão
            </p>

            <p style="font-size:13px;color:#6B7280;margin:0 0 20px;">
              ${err.message}
            </p>

            <p style="font-size:12px;color:#9CA3AF;margin:0 0 16px;">
              Verifique se as credenciais em <strong>js/supabase.js</strong> estão corretas.
            </p>

            <button
              onclick="location.reload()"
              style="background:#2347C5;color:#fff;border:none;padding:9px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">
              Tentar novamente
            </button>
          </div>
        `;
      }

      return null;
    }

    return this._profile;
  },

  async _loadProfile(userId) {
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) return null;

      return data;

    } catch (e) {
      console.error('[Auth._loadProfile]', e.message);
      return null;
    }
  },

  _pingSession() {
    setInterval(async () => {
      if (!this._profile) return;

      await sb
        .from('sessoes')
        .upsert({
          user_id: this._profile.id,
          user_nome: this._profile.nome,
          user_role: this._profile.role,
          ativo: true,
          last_seen: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      await sb
        .from('profiles')
        .update({
          ultimo_login: new Date().toISOString()
        })
        .eq('id', this._profile.id);

    }, 2 * 60 * 1000);
  },

  async login(email, senha) {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: senha
    });

    if (error) throw error;

    const profile = await this._loadProfile(data.user.id);

    if (!profile?.ativo) {
      await sb.auth.signOut();
      throw new Error('Conta desativada. Entre em contato com o administrador.');
    }

    this._user = data.user;
    this._profile = profile;

    return profile;
  },

  async cadastrar(email, senha, nome, role = 'funcionario') {
    const { data, error } = await sb.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome,
          role
        }
      }
    });

    if (error) throw error;

    await new Promise(r => setTimeout(r, 800));

    if (data.user) {
      await sb
        .from('profiles')
        .update({
          nome,
          role
        })
        .eq('id', data.user.id);
    }

    return data.user;
  },

  async logout() {
    await DB.encerrarSessao();
    await sb.auth.signOut();

    this._user = null;
    this._profile = null;
  },

  async recuperarSenha(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/reset-password.html`,
    });

    if (error) throw error;
  },

  async redefinirSenha(novaSenha) {
    const { error } = await sb.auth.updateUser({
      password: novaSenha
    });

    if (error) throw error;
  },

  async atualizarPerfil(dados) {
    if (!this._profile) {
      throw new Error('Não autenticado');
    }

    const { data, error } = await sb
      .from('profiles')
      .update({
        ...dados,
        updated_at: new Date().toISOString()
      })
      .eq('id', this._profile.id)
      .select()
      .single();

    if (error) throw error;

    this._profile = data;

    return data;
  },

  podeAcessar(rolesPermitidos) {
    if (!this._profile) return false;
    return rolesPermitidos.includes(this._profile.role);
  },

  async protegerRota(
    rolesPermitidos = ['admin', 'rh', 'funcionario']
  ) {
    const profile = await this.init();

    if (!profile) {
      location.href = '/auth/login.html';
      return false;
    }

    if (!rolesPermitidos.includes(profile.role)) {
      location.href = '/index.html';
      return false;
    }

    return true;
  },

  roleLabel(role) {
    return {
      admin: 'Administrador',
      rh: 'RH',
      funcionario: 'Funcionário'
    }[role] || role;
  },
};

// Helpers de cálculo
function calcINSS(sal) {
  let r = 0, b = sal, a = 0;

  for (const f of [
    { t: 1412, p: .075 },
    { t: 2666.68, p: .09 },
    { t: 4000.03, p: .12 },
    { t: 7786.02, p: .14 }
  ]) {
    if (b <= 0) break;

    const x = Math.min(b, f.t - a);

    r += x * f.p;
    a = f.t;
    b -= x;
  }

  return Math.min(r, sal * .14);
}

function calcIRRF(bc) {
  if (bc > 4664.68) return Math.max(0, bc * .275 - 869.36);
  if (bc > 3751.05) return Math.max(0, bc * .225 - 636.13);
  if (bc > 2826.65) return Math.max(0, bc * .15 - 354.80);
  if (bc > 2112) return Math.max(0, bc * .075 - 158.40);
  return 0;
}