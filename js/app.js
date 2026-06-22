// app.js — páginas do sistema RH (usa DB em vez de localStorage)

// ══ ROTEADOR ══════════════════════════════════════════════════
const pages = {
  dashboard:    pageDashboard,
  funcionarios: pageFuncionarios,
  escala:       pageEscala,
  ponto:        pagePonto,
  pagamentos:   pagePagamentos,
  relatorios:   pageRelatorios,
};

function navigateTo(k) {
  document.querySelectorAll('.menu-item, .bottom-nav-item')
    .forEach(i => i.classList.toggle('active', i.dataset.page === k));
  const el = document.getElementById('content');
  if (!el) return;
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:50vh;gap:12px;">
    <div style="width:28px;height:28px;border:3px solid var(--cobalt-200);border-top-color:var(--cobalt-600);border-radius:50%;animation:spin .7s linear infinite;"></div>
    <span style="color:var(--color-text-muted);font-size:13px;">Carregando...</span>
  </div>`;
  if (pages[k]) {
    pages[k]().then(html => { if (el) el.innerHTML = html; }).catch(e => {
      el.innerHTML = `<div class="alert alert-danger" style="margin:20px;"><i class="ti ti-alert-circle"></i> ${e.message}</div>`;
    });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.sidebar .menu-item').forEach(i => {
  i.addEventListener('click', () => {
    navigateTo(i.dataset.page);
    fecharSidebar && fecharSidebar();
  });
});

// ══ HELPERS ═══════════════════════════════════════════════════
const fmtR  = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtD  = iso => { if(!iso) return '—'; const[y,m,d]=(iso.split('T')[0]||iso).split('-'); return `${d}/${m}/${y}`; };
const fmtMes= iso => { if(!iso) return '—'; const[y,m]=iso.split('-'); const ms=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${ms[parseInt(m)-1]}/${y}`; };
const ini   = n => (n||'').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();
const tm    = t => { if(!t) return 0; const[h,m]=t.split(':').map(Number); return h*60+m; };

function av(nome, sz=36, foto) {
  if (foto) return `<img src="${foto}" style="width:${sz}px;height:${sz}px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid var(--cobalt-200);" alt="${nome}"/>`;
  return `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:var(--cobalt-50);color:var(--cobalt-600);font-size:${sz<40?11:14}px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:2px solid var(--cobalt-200);">${ini(nome)}</div>`;
}
const badge = (txt, tipo='neutral') => `<span class="badge badge-${tipo}">${txt}</span>`;
const statusBadge = s => s==='ativo'?badge('Ativo','success'):s==='ferias'?badge('Férias','info'):s==='afastado'?badge('Afastado','warning'):badge('Inativo','danger');

function minToStr(m) {
  const a=Math.abs(m), h=Math.floor(a/60), mn=a%60;
  return (m<0?'-':'')+h+'h'+(mn>0?mn+'m':'');
}

function calcHorasTrabalhadas(r) {
  if (!r?.entrada || !r?.saida) return 0;
  let m = tm(r.saida) - tm(r.entrada);
  if (r.saida_almoco && r.retorno_almoco) m -= (tm(r.retorno_almoco) - tm(r.saida_almoco));
  return m < 0 ? m + 1440 : m;
}

function confirmar(msg, fn) { if (window.confirm(msg)) fn(); }

// Verifica se o usuário logado pode criar/editar/excluir funcionários (admin e rh)
function podeGerenciarFuncionarios() {
  return Auth.hasRole('admin') || Auth.hasRole('rh');
}

// Verifica se o usuário logado deve ver a experiência restrita de "funcionário comum"
// — ou seja, NÃO tem nenhum role de gestão (admin/rh), mesmo que tenha múltiplos roles.
function ehSomenteFuncionario() {
  const profile = Auth.currentUser();
  if (!profile) return false;
  return Auth.hasRole('funcionario') && !Auth.hasRole('admin') && !Auth.hasRole('rh');
}

// ══ DASHBOARD ═════════════════════════════════════════════════
async function pageDashboard() {
  const profile = Auth.currentUser();
  const ehFuncionarioComum = ehSomenteFuncionario();

  const [emp] = await Promise.all([DB.getEmpresa()]);
  const hjs = new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const dp = emp?.dia_pagamento;
  let pp = '—';
  if (dp && dp !== 'ultimo') {
    const hj = new Date(), dia = parseInt(dp);
    let dt = new Date(hj.getFullYear(), hj.getMonth(), dia);
    if (dt <= hj) dt = new Date(hj.getFullYear(), hj.getMonth()+1, dia);
    const diff = Math.ceil((dt-hj)/86400000);
    pp = diff === 0 ? 'Hoje' : diff+(diff===1?' dia':' dias');
  }

  // ── DASHBOARD SIMPLIFICADO PARA FUNCIONÁRIO COMUM ──
  if (ehFuncionarioComum) {
    let meuRegistro = null;
    try { meuRegistro = await DB.getFuncionarioByProfileId(profile.id); } catch(e) {}

    if (!meuRegistro) {
      return `
      <h1 class="page-title" style="margin-bottom:6px;">${emp?.nome_fantasia||emp?.razao_social||'Dashboard'}</h1>
      <p class="page-subtitle">${hjs}</p>
      <div class="alert alert-warning">
        <i class="ti ti-alert-circle"></i>
        <div>
          <p style="margin:0;">Seu login (<strong>${profile.email}</strong>) ainda não está vinculado a nenhum cadastro de funcionário.</p>
          <p style="margin:4px 0 0;font-size:12px;">Entre em contato com o RH para vincular seu acesso.</p>
        </div>
      </div>`;
    }

    const bh = await DB.getBancoHoras(meuRegistro.id).catch(()=>({saldo:0}));
    const folgas = (meuRegistro.dias_folga||[]).map(d=>({segunda:'Seg',terca:'Ter',quarta:'Qua',quinta:'Qui',sexta:'Sex',sabado:'Sáb',domingo:'Dom'}[d]||d)).join(', ')||'—';

    return `
    <div style="margin-bottom:var(--space-xl);">
      <h1 class="page-title">Olá, ${meuRegistro.nome.split(' ')[0]}</h1>
      <p class="page-subtitle" style="margin-bottom:0;">${hjs}</p>
    </div>
    <div class="metric-grid">
      <div class="metric-card"><p class="label">Meu status</p><p class="value" style="font-size:16px;">${statusBadge(meuRegistro.status||'ativo')}</p></div>
      <div class="metric-card"><p class="label">Meu horário</p><p class="value" style="font-size:16px;">${meuRegistro.entrada||'—'} – ${meuRegistro.saida||'—'}</p></div>
      <div class="metric-card"><p class="label">Minhas folgas</p><p class="value" style="font-size:14px;">${folgas}</p></div>
      <div class="metric-card"><p class="label">Próximo salário</p><p class="value" style="font-size:${pp.length>5?'14px':'22px'};">${pp}</p><p class="trend" style="color:var(--color-text-muted);">dia ${dp||'—'}</p></div>
      <div class="metric-card"><p class="label">Banco de horas</p><p class="value" style="font-size:16px;color:${bh.saldo>=0?'var(--color-success)':'var(--color-danger)'};">${minToStr(bh.saldo)}</p></div>
    </div>
    <div class="card" style="margin-top:16px;">
      <p class="section-label" style="margin-bottom:12px;">Ações rápidas</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${[
          {ico:'ti-clock-edit',txt:'Meu ponto',fn:"navigateTo('ponto')"},
          {ico:'ti-calendar',txt:'Minha escala',fn:"navigateTo('escala')"},
          {ico:'ti-receipt',txt:'Meu holerite',fn:"navigateTo('pagamentos')"},
        ].map(a=>`<button class="btn btn-secondary" style="justify-content:flex-start;gap:8px;" onclick="${a.fn}"><i class="ti ${a.ico}" style="color:var(--cobalt-400);font-size:16px;"></i><span style="font-size:12px;">${a.txt}</span></button>`).join('')}
      </div>
    </div>`;
  }

  // ── DASHBOARD COMPLETO PARA ADMIN / RH ──
  const met = await DB.getMetricas();
  const fs = await DB.getFuncionarios();

  const equipeHoje = fs.filter(f=>f.status!=='inativo').slice(0,5).map(f=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--color-card-border);">
      ${av(f.nome,34,f.foto_url)}
      <div style="flex:1;min-width:0;">
        <p style="font-size:13px;font-weight:500;color:var(--color-text-primary);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.nome}</p>
        <p style="font-size:11px;color:var(--color-text-secondary);margin:0;">${f.cargo||'—'}</p>
      </div>
      <span style="font-size:11px;color:var(--color-text-secondary);">${f.entrada||'—'}</span>
    </div>`).join('');

  const aprovsPend = met.aprovsPendentes;
  const alertaHTML = aprovsPend > 0
    ? `<div class="alert alert-warning" style="margin-bottom:12px;"><i class="ti ti-clock-edit"></i><span>${aprovsPend} correção(ões) de ponto aguardando aprovação</span><button class="btn btn-sm btn-secondary" style="margin-left:auto;" onclick="navigateTo('ponto')">Ver</button></div>`
    : '';

  return `
  <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:var(--space-xl);">
    <div>
      <h1 class="page-title">${emp?.nome_fantasia||emp?.razao_social||'Dashboard'}</h1>
      <p class="page-subtitle" style="margin-bottom:0;">${hjs}</p>
    </div>
    ${podeGerenciarFuncionarios() ? `<button class="btn btn-primary" onclick="abrirModalFunc()"><i class="ti ti-plus"></i> Novo funcionário</button>` : ''}
  </div>
  ${alertaHTML}
  <div class="metric-grid">
    <div class="metric-card"><p class="label">Ativos</p><p class="value">${met.ativos}</p><p class="trend" style="color:var(--color-text-muted);">${met.total} cadastros</p></div>
    <div class="metric-card"><p class="label">Trabalhando hoje</p><p class="value">${met.trabalhando}</p><p class="trend" style="color:var(--color-text-muted);">${met.deFolga} de folga</p></div>
    <div class="metric-card"><p class="label">Em férias</p><p class="value">${met.emFerias}</p></div>
    <div class="metric-card"><p class="label">Folha estimada</p><p class="value" style="font-size:16px;">${fmtR(met.folhaMes)}</p><p class="trend" style="color:var(--color-text-muted);">líquido/mês</p></div>
    <div class="metric-card"><p class="label">Próximo salário</p><p class="value" style="font-size:${pp.length>5?'14px':'22px'};">${pp}</p><p class="trend" style="color:var(--color-text-muted);">dia ${dp||'—'}</p></div>
    <div class="metric-card"><p class="label">Aprovações</p><p class="value" style="color:${aprovsPend>0?'var(--color-warning)':'var(--metric-value)'};">${aprovsPend}</p><p class="trend" style="color:var(--color-text-muted);">pendentes</p></div>
  </div>
  <div class="dash-grid-2col" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
    <div class="card">
      <p class="section-label" style="margin-bottom:12px;">Ações rápidas</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${[
          ...(podeGerenciarFuncionarios() ? [{ico:'ti-user-plus',txt:'Novo funcionário',fn:"abrirModalFunc()"}] : []),
          {ico:'ti-clock-edit',txt:'Lançar ponto',fn:"navigateTo('ponto')"},
          {ico:'ti-calendar',txt:'Ver escala',fn:"navigateTo('escala')"},
          {ico:'ti-receipt',txt:'Pagamentos',fn:"navigateTo('pagamentos')"},
        ].map(a=>`<button class="btn btn-secondary" style="justify-content:flex-start;gap:8px;" onclick="${a.fn}"><i class="ti ${a.ico}" style="color:var(--cobalt-400);font-size:16px;"></i><span style="font-size:12px;">${a.txt}</span></button>`).join('')}
      </div>
    </div>
    <div class="card dash-equipe">
      <p class="section-label" style="margin-bottom:4px;">Equipe hoje</p>
      ${equipeHoje || '<p style="font-size:13px;color:var(--color-text-muted);padding:12px 0;">Nenhum funcionário ativo.</p>'}
      ${fs.filter(f=>f.status!=='inativo').length > 5 ? `<button class="btn btn-ghost btn-sm" style="margin-top:8px;width:100%;" onclick="navigateTo('funcionarios')">Ver todos</button>` : ''}
    </div>
  </div>
  ${tplModalFunc()}`;
}

// ══ FUNCIONÁRIOS ══════════════════════════════════════════════
async function pageFuncionarios() {
  const profile = Auth.currentUser();
  const ehFuncionarioComum = ehSomenteFuncionario();

  let lista = await DB.getFuncionarios();

  // Funcionário comum só pode ver o próprio cadastro nesta tela
  if (ehFuncionarioComum) {
    let meuRegistro = null;
    try { meuRegistro = await DB.getFuncionarioByProfileId(profile.id); } catch(e) {}
    lista = meuRegistro ? [meuRegistro] : [];

    if (!meuRegistro) {
      return `
      <h1 class="page-title" style="margin-bottom:6px;">Meu Cadastro</h1>
      <div class="alert alert-warning">
        <i class="ti ti-alert-circle"></i>
        <div>
          <p style="margin:0;">Seu login (<strong>${profile.email}</strong>) ainda não está vinculado a nenhum cadastro de funcionário.</p>
          <p style="margin:4px 0 0;font-size:12px;">Entre em contato com o RH.</p>
        </div>
      </div>`;
    }
  }

  const cards = lista.map(f => `
    <div class="card func-card" data-nome="${f.nome.toLowerCase()}" data-cargo="${(f.cargo||'').toLowerCase()}"
      style="display:flex;align-items:flex-start;gap:14px;transition:box-shadow .15s;"
      onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='var(--shadow-sm)'">
      <div style="position:relative;">
        ${av(f.nome,44,f.foto_url)}
        <div style="position:absolute;bottom:0;right:0;width:12px;height:12px;border-radius:50%;background:${f.status==='ativo'||!f.status?'var(--color-success)':f.status==='ferias'?'var(--color-info)':'var(--gray-300)'};border:2px solid var(--color-card-bg);"></div>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;">
            <p style="font-size:14px;font-weight:600;color:var(--color-text-primary);margin:0;">${f.nome}</p>
            ${statusBadge(f.status||'ativo')}
          </div>
          <div style="display:flex;gap:5px;">
            ${podeGerenciarFuncionarios() ? `<button class="btn btn-secondary btn-sm btn-icon" title="Ver ficha" onclick="verFicha('${f.id}')"><i class="ti ti-eye"></i></button>` : ''}
            ${podeGerenciarFuncionarios() ? `<button class="btn btn-secondary btn-sm btn-icon" title="Editar" onclick="abrirModalFunc('${f.id}')"><i class="ti ti-edit"></i></button>` : ''}
            <button class="btn btn-secondary btn-sm btn-icon" title="Holerite" onclick="gerarHolerite('${f.id}')"><i class="ti ti-file-text"></i></button>
            ${podeGerenciarFuncionarios() ? `<button class="btn btn-danger btn-sm btn-icon" title="Excluir" onclick="excluirFunc('${f.id}','${f.nome.replace(/'/g,"\\'")}')"><i class="ti ti-trash"></i></button>` : ''}
          </div>
        </div>
        <p style="font-size:12px;color:var(--color-text-secondary);margin:4px 0 8px;">${f.cargo||'—'} · ${f.departamento||'—'} · <strong>${(f.tipo_contrato||'').toUpperCase()||'—'}</strong></p>
        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">
          <span style="font-size:12px;color:var(--color-text-secondary);"><i class="ti ti-mail" style="vertical-align:-2px;margin-right:3px;"></i>${f.email||'—'}</span>
          <span style="font-size:12px;color:var(--color-text-secondary);"><i class="ti ti-phone" style="vertical-align:-2px;margin-right:3px;"></i>${f.celular||'—'}</span>
          <span style="font-size:12px;color:var(--color-text-secondary);"><i class="ti ti-calendar" style="vertical-align:-2px;margin-right:3px;"></i>${fmtD(f.admissao)}</span>
          <span style="font-size:12px;font-weight:600;color:var(--cobalt-600);">${fmtR(f.salario)}</span>
        </div>
      </div>
    </div>`).join('');

  return `
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:var(--space-xl);">
    <div><h1 class="page-title" style="margin-bottom:2px;">${ehFuncionarioComum?'Meu Cadastro':'Funcionários'}</h1>
    <p class="page-subtitle" style="margin:0;">${ehFuncionarioComum?'':lista.length+' cadastro(s)'}</p></div>
    ${!ehFuncionarioComum ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <div style="position:relative;">
        <i class="ti ti-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--color-text-muted);font-size:14px;pointer-events:none;"></i>
        <input id="busca-func" type="text" placeholder="Buscar..." class="input" style="padding-left:32px;width:180px;" oninput="filtrarFuncs(this.value)"/>
      </div>
      <select id="filtro-status" class="input" style="width:130px;" onchange="filtrarFuncs(document.getElementById('busca-func').value)">
        <option value="">Todos</option><option value="ativo">Ativos</option>
        <option value="ferias">Férias</option><option value="afastado">Afastados</option><option value="inativo">Inativos</option>
      </select>
      ${podeGerenciarFuncionarios() ? `<button class="btn btn-primary" onclick="abrirModalFunc()"><i class="ti ti-plus"></i> Novo</button>` : ''}
    </div>` : ''}
  </div>
  <div id="func-lista" style="display:flex;flex-direction:column;gap:10px;">
    ${lista.length ? cards : '<div class="card"><p style="font-size:13px;color:var(--color-text-muted);">Nenhum funcionário cadastrado.</p></div>'}
  </div>
  <div id="ficha-root"></div>
  ${tplModalFunc()}`;
}

function filtrarFuncs(busca) {
  const status = document.getElementById('filtro-status')?.value || '';
  const b = (busca||'').toLowerCase();
  document.querySelectorAll('.func-card').forEach(c => {
    const matchB = !b || c.dataset.nome.includes(b) || c.dataset.cargo.includes(b);
    c.style.display = matchB ? '' : 'none';
  });
}

// ── FICHA LATERAL ──
async function verFicha(id) {
  const [f, docs, bh, hist] = await Promise.all([
    DB.getFuncionarioById(id), DB.getDocumentos(id),
    DB.getBancoHoras(id), DB.getPagamentos(id)
  ]);
  if (!f) return;
  const folgas = (f.dias_folga||[]).map(d=>({segunda:'Seg',terca:'Ter',quarta:'Qua',quinta:'Qui',sexta:'Sex',sabado:'Sáb',domingo:'Dom'}[d]||d)).join(', ')||'—';
  const el = document.getElementById('ficha-root'); if (!el) return;
  el.dataset.fichaId = id;

  el.innerHTML = `
  <div style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:400;display:flex;align-items:flex-start;justify-content:flex-end;" onclick="if(event.target===this)fecharFicha()">
    <div style="width:min(420px,100vw);height:100vh;overflow-y:auto;background:var(--color-card-bg);box-shadow:var(--shadow-lg);">
      <div style="background:var(--cobalt-600);padding:20px;display:flex;align-items:flex-start;gap:14px;">
        ${av(f.nome,52,f.foto_url)}
        <div style="flex:1;">
          <p style="font-size:16px;font-weight:700;color:#fff;margin:0 0 2px;">${f.nome}</p>
          <p style="font-size:12px;color:rgba(255,255,255,.8);margin:0 0 6px;">${f.cargo||'—'} · ${f.departamento||'—'}</p>
          ${statusBadge(f.status||'ativo')}
        </div>
        <button onclick="fecharFicha()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">×</button>
      </div>
      <div style="display:flex;border-bottom:1px solid var(--color-card-border);background:var(--color-page-bg);">
        ${['dados','contrato','docs','historico'].map((t,i)=>
          `<button onclick="fichaTab('${t}')" id="ftab-${t}" style="flex:1;padding:10px 4px;border:none;background:${i===0?'var(--color-card-bg)':'transparent'};font-size:11px;font-weight:600;color:${i===0?'var(--cobalt-600)':'var(--color-text-secondary)'};cursor:pointer;border-bottom:2px solid ${i===0?'var(--cobalt-600)':'transparent'};transition:.15s;">${{dados:'Dados',contrato:'Contrato',docs:'Docs',historico:'Histórico'}[t]}</button>`
        ).join('')}
      </div>
      <div id="ficha-corpo" style="padding:18px;">${fichaConteudo(f,'dados',docs,bh,hist,folgas)}</div>
      <div style="padding:14px 18px;border-top:1px solid var(--color-card-border);display:flex;flex-direction:column;gap:7px;background:var(--color-page-bg);">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;">
          <button class="btn btn-primary" onclick="gerarHolerite('${f.id}')"><i class="ti ti-file-text"></i> Holerite</button>
          <button class="btn btn-secondary" onclick="abrirEnvioHolerite('${f.id}')"><i class="ti ti-mail"></i> Enviar</button>
        </div>
        ${podeGerenciarFuncionarios() ? `<button class="btn btn-secondary" style="width:100%;" onclick="abrirModalFunc('${f.id}');fecharFicha()"><i class="ti ti-edit"></i> Editar</button>` : ''}
      </div>
    </div>
  </div>
  <div id="modal-holerite-email"></div>`;
}

function fichaConteudo(f, tab, docs=[], bh={saldo:0,historico:[]}, hist=[], folgas='—') {
  if (tab === 'dados') return `
    ${sf('Pessoal',[['Nome',f.nome],['CPF',f.cpf],['RG',f.rg],['Nascimento',fmtD(f.nascimento)],['E-mail',f.email],['Celular',f.celular]])}
    ${sf('Emergência',[['Contato',f.em_nome||'—'],['Telefone',f.em_telefone||'—'],['Parentesco',f.em_parentesco||'—']])}`;
  if (tab === 'contrato') return `
    ${sf('Contrato',[['Tipo',(f.tipo_contrato||'').toUpperCase()],['Admissão',fmtD(f.admissao)],['Cargo',f.cargo],['Depto',f.departamento]])}
    ${sf('Pagamento',[['Salário bruto',fmtR(f.salario)],['Vale refeição',fmtR(f.vale_refeicao)],['Vale transporte',fmtR(f.vale_transporte)],['Banco',f.banco],['Agência',f.agencia],['Conta',f.conta]])}
    ${sf('Horários',[['Turno',f.turno],['Entrada',f.entrada],['Saída',f.saida],['Folgas',folgas]])}`;
  if (tab === 'docs') return `
    <p class="section-label">Documentos (${docs.length})</p>
    ${docs.map(d=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--color-card-border);">
      <i class="ti ti-file" style="color:var(--cobalt-400);"></i>
      <div style="flex:1;"><p style="font-size:13px;margin:0;">${d.nome}</p><p style="font-size:11px;color:var(--color-text-muted);margin:0;">${d.tipo||'—'} · ${fmtD(d.created_at?.slice(0,10))}</p></div>
      <button onclick="delDocFicha('${f.id}','${d.id}')" class="btn btn-ghost btn-sm btn-icon"><i class="ti ti-trash" style="color:var(--color-danger);"></i></button>
    </div>`).join('')||'<p style="font-size:13px;color:var(--color-text-muted);">Nenhum documento.</p>'}
    <div style="display:flex;gap:8px;margin-top:12px;">
      <input id="doc-nome" type="text" placeholder="Nome do documento" class="input" style="flex:1;"/>
      <select id="doc-tipo" class="input" style="width:110px;"><option>CNH</option><option>RG</option><option>CPF</option><option>Diploma</option><option>Atestado</option><option>Outro</option></select>
      <button class="btn btn-primary btn-sm" onclick="addDocFicha('${f.id}')"><i class="ti ti-plus"></i></button>
    </div>`;
  if (tab === 'historico') return `
    <p class="section-label">Banco de horas — saldo: <strong style="color:${bh.saldo>=0?'var(--color-success)':'var(--color-danger)'};">${minToStr(bh.saldo)}</strong></p>
    <div style="max-height:120px;overflow-y:auto;margin-bottom:16px;">
      ${(bh.historico||[]).slice(0,8).map(h=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--color-card-border);font-size:12px;"><span style="color:var(--color-text-secondary);">${h.descricao||'—'}</span><span style="font-weight:600;color:${h.tipo==='credito'?'var(--color-success)':'var(--color-danger)'};">${h.tipo==='credito'?'+':'-'}${minToStr(Math.abs(h.minutos))}</span></div>`).join('')||'<p style="font-size:12px;color:var(--color-text-muted);">Sem movimentações.</p>'}
    </div>
    <p class="section-label">Histórico de pagamentos</p>
    ${(hist||[]).slice(0,6).map(h=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--color-card-border);font-size:12px;"><span>${fmtMes(h.competencia)}</span><span style="font-weight:600;color:var(--cobalt-600);">${fmtR(h.liquido)}</span></div>`).join('')||'<p style="font-size:12px;color:var(--color-text-muted);">Sem histórico.</p>'}`;
  return '';
}

function sf(titulo, campos) {
  return `<div style="margin-bottom:14px;"><p class="section-label">${titulo}</p>
    ${campos.map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--color-card-border);"><span style="font-size:12px;color:var(--color-text-secondary);">${l}</span><span style="font-size:12px;font-weight:500;color:var(--color-text-primary);text-align:right;max-width:60%;">${v||'—'}</span></div>`).join('')}
  </div>`;
}

async function fichaTab(tab) {
  const el = document.getElementById('ficha-root'); if (!el) return;
  const id = el.dataset.fichaId;
  const [f, docs, bh, hist] = await Promise.all([
    DB.getFuncionarioById(id), DB.getDocumentos(id), DB.getBancoHoras(id), DB.getPagamentos(id)
  ]);
  if (!f) return;
  const folgas = (f.dias_folga||[]).map(d=>({segunda:'Seg',terca:'Ter',quarta:'Qua',quinta:'Qui',sexta:'Sex',sabado:'Sáb',domingo:'Dom'}[d]||d)).join(', ')||'—';
  document.querySelectorAll('[id^="ftab-"]').forEach(b => {
    const t = b.id.replace('ftab-','');
    b.style.background = t===tab ? 'var(--color-card-bg)' : 'transparent';
    b.style.color = t===tab ? 'var(--cobalt-600)' : 'var(--color-text-secondary)';
    b.style.borderBottom = t===tab ? '2px solid var(--cobalt-600)' : '2px solid transparent';
  });
  const corpo = document.getElementById('ficha-corpo');
  if (corpo) corpo.innerHTML = fichaConteudo(f, tab, docs, bh, hist, folgas);
}

async function addDocFicha(fid) {
  const nome = document.getElementById('doc-nome')?.value.trim();
  const tipo = document.getElementById('doc-tipo')?.value;
  if (!nome) { toast('Informe o nome do documento','err'); return; }
  await DB.addDocumento(fid, {nome, tipo});
  fichaTab('docs');
}

async function delDocFicha(fid, docId) {
  await DB.delDocumento(docId);
  fichaTab('docs');
}

function fecharFicha() { const e = document.getElementById('ficha-root'); if (e) e.innerHTML = ''; }

// ── MODAL FUNCIONÁRIO ──
function tplModalFunc() {
  const dep = ['Recursos Humanos','Tecnologia','Financeiro','Comercial','Operações','Marketing','Jurídico','Diretoria'];
  const bancos = [['001','Banco do Brasil'],['033','Santander'],['104','Caixa'],['237','Bradesco'],['341','Itaú'],['260','Nubank'],['077','Inter'],['290','PagBank']];
  return `
  <div id="modal-func" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:500;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;">
    <div style="background:var(--color-card-bg);border-radius:var(--radius-lg);width:100%;max-width:600px;margin:auto;box-shadow:var(--shadow-lg);">
      <div style="padding:18px 22px;border-bottom:1px solid var(--color-card-border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--color-card-bg);z-index:1;border-radius:var(--radius-lg) var(--radius-lg) 0 0;">
        <p id="modal-titulo" style="font-size:15px;font-weight:700;color:var(--color-text-primary);margin:0;">Novo funcionário</p>
        <button onclick="fecharModalFunc()" class="btn btn-icon btn-secondary"><i class="ti ti-x"></i></button>
      </div>
      <div style="padding:22px;display:flex;flex-direction:column;gap:18px;">

        <div>
          <p class="section-label">Foto e status</p>
          <div style="display:flex;align-items:center;gap:14px;">
            <div id="foto-preview" style="width:56px;height:56px;border-radius:50%;background:var(--cobalt-50);border:2px solid var(--cobalt-200);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--cobalt-400);cursor:pointer;overflow:hidden;" onclick="document.getElementById('mf-foto-input').click()"><i class="ti ti-camera"></i></div>
            <input type="file" id="mf-foto-input" accept="image/*" style="display:none;" onchange="previewFotoModal(this)"/>
            <div style="flex:1;">
              <p style="font-size:12px;color:var(--color-text-secondary);margin:0 0 6px;">Clique para adicionar foto</p>
              <select id="mf-status" class="input" style="width:160px;"><option value="ativo">Ativo</option><option value="ferias">Em férias</option><option value="afastado">Afastado</option><option value="inativo">Inativo</option></select>
            </div>
          </div>
        </div>

        <div>
          <p class="section-label">Dados pessoais</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" class="form-grid-2">
            <div class="field-group" style="grid-column:span 2;"><label class="field-label">Nome completo *</label><input id="mf-nome" type="text" class="input" placeholder="Nome completo"/></div>
            <div class="field-group"><label class="field-label">CPF</label><input id="mf-cpf" type="text" class="input" placeholder="000.000.000-00" maxlength="14"/></div>
            <div class="field-group"><label class="field-label">E-mail *</label><input id="mf-email" type="email" class="input" placeholder="email@empresa.com"/></div>
            <div class="field-group"><label class="field-label">Celular</label><input id="mf-celular" type="text" class="input" placeholder="(11) 90000-0000" maxlength="15"/></div>
            <div class="field-group"><label class="field-label">Nascimento</label><input id="mf-nasc" type="date" class="input"/></div>
          </div>
        </div>

        <div>
          <p class="section-label">Contato de emergência</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" class="form-grid-2">
            <div class="field-group"><label class="field-label">Nome</label><input id="mf-em-nome" type="text" class="input"/></div>
            <div class="field-group"><label class="field-label">Telefone</label><input id="mf-em-tel" type="text" class="input"/></div>
            <div class="field-group"><label class="field-label">Parentesco</label><input id="mf-em-par" type="text" class="input" placeholder="Ex: cônjuge"/></div>
          </div>
        </div>

        <div>
          <p class="section-label">Cargo e contrato</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" class="form-grid-2">
            <div class="field-group"><label class="field-label">Cargo *</label><input id="mf-cargo" type="text" class="input" placeholder="Ex: Analista"/></div>
            <div class="field-group"><label class="field-label">Departamento</label><select id="mf-depto" class="input"><option value="">Selecione...</option>${dep.map(d=>`<option>${d}</option>`).join('')}</select></div>
            <div class="field-group"><label class="field-label">Tipo de contrato</label><select id="mf-contrato" class="input"><option value="clt">CLT</option><option value="pj">PJ</option><option value="estagio">Estágio</option><option value="temporario">Temporário</option></select></div>
            <div class="field-group"><label class="field-label">Admissão</label><input id="mf-admissao" type="date" class="input"/></div>
          </div>
        </div>

        <div>
          <p class="section-label">Pagamento</p>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;" class="form-grid-2">
            <div class="field-group"><label class="field-label">Salário (R$) *</label><input id="mf-sal" type="number" min="0" step="0.01" class="input" placeholder="0,00"/></div>
            <div class="field-group"><label class="field-label">Vale refeição</label><input id="mf-vr" type="number" min="0" step="0.01" class="input" placeholder="0,00"/></div>
            <div class="field-group"><label class="field-label">Vale transporte</label><input id="mf-vt" type="number" min="0" step="0.01" class="input" placeholder="0,00"/></div>
            <div class="field-group"><label class="field-label">Banco</label><select id="mf-banco" class="input"><option value="">Selecione...</option>${bancos.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
            <div class="field-group"><label class="field-label">Agência</label><input id="mf-agencia" type="text" class="input" placeholder="0000"/></div>
            <div class="field-group"><label class="field-label">Conta</label><input id="mf-conta" type="text" class="input" placeholder="00000-0"/></div>
          </div>
        </div>

        <div>
          <p class="section-label">Horários e folgas</p>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;" class="form-grid-2">
            <div class="field-group"><label class="field-label">Turno</label><select id="mf-turno" class="input" onchange="mfTurno(this.value)"><option value="integral">Integral</option><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option><option value="personalizado">Personalizado</option></select></div>
            <div class="field-group"><label class="field-label">Entrada</label><input id="mf-entrada" type="time" class="input" value="08:00"/></div>
            <div class="field-group"><label class="field-label">Saída</label><input id="mf-saida" type="time" class="input" value="17:00"/></div>
          </div>
          <div class="field-group"><label class="field-label">Dias de folga</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
              ${['segunda','terca','quarta','quinta','sexta','sabado','domingo'].map(d=>`
                <label style="display:flex;align-items:center;gap:5px;padding:5px 8px;border:1.5px solid var(--color-card-border);border-radius:var(--radius-md);cursor:pointer;font-size:12px;font-weight:500;transition:.15s;" class="folga-lbl" data-dia="${d}">
                  <input type="checkbox" name="mf-folga" value="${d}" ${['sabado','domingo'].includes(d)?'checked':''} style="accent-color:var(--cobalt-600);" onchange="estiloFolga(this)"/>
                  ${{segunda:'Seg',terca:'Ter',quarta:'Qua',quinta:'Qui',sexta:'Sex',sabado:'Sáb',domingo:'Dom'}[d]}
                </label>`).join('')}
            </div>
          </div>
        </div>
      </div>
      <input type="hidden" id="mf-id"/>
      <input type="hidden" id="mf-foto-data"/>
      <div style="padding:16px 22px;border-top:1px solid var(--color-card-border);display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="fecharModalFunc()">Cancelar</button>
        <button class="btn btn-primary" onclick="salvarModalFunc()"><i class="ti ti-check"></i> Salvar</button>
      </div>
    </div>
  </div>`;
}

function estiloFolga(cb) {
  const lbl = cb.closest('.folga-lbl'); if (!lbl) return;
  lbl.style.background    = cb.checked ? 'var(--cobalt-50)' : '';
  lbl.style.borderColor   = cb.checked ? 'var(--cobalt-400)' : 'var(--color-card-border)';
  lbl.style.color         = cb.checked ? 'var(--cobalt-600)' : '';
}

function mfTurno(v) {
  const h = {integral:{e:'08:00',s:'18:00'},manha:{e:'06:00',s:'14:00'},tarde:{e:'14:00',s:'22:00'},noite:{e:'22:00',s:'06:00'},personalizado:{e:'',s:''}};
  if (h[v]) { document.getElementById('mf-entrada').value=h[v].e; document.getElementById('mf-saida').value=h[v].s; }
}

function previewFotoModal(input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    const prev = document.getElementById('foto-preview');
    const data = document.getElementById('mf-foto-data');
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
    if (data) data.value = e.target.result;
  };
  r.readAsDataURL(f);
}

async function abrirModalFunc(id) {
  const modal = document.getElementById('modal-func');
  if (!modal) { navigateTo('funcionarios'); setTimeout(()=>abrirModalFunc(id),200); return; }
  const g = k => document.getElementById(k);
  ['mf-nome','mf-cpf','mf-email','mf-celular','mf-nasc','mf-cargo','mf-admissao','mf-sal','mf-vr','mf-vt','mf-agencia','mf-conta','mf-em-nome','mf-em-tel','mf-em-par'].forEach(k=>{if(g(k))g(k).value='';});
  ['mf-depto','mf-banco'].forEach(k=>{if(g(k))g(k).value='';});
  if(g('mf-contrato'))g('mf-contrato').value='clt';
  if(g('mf-turno'))g('mf-turno').value='integral';
  if(g('mf-status'))g('mf-status').value='ativo';
  if(g('mf-entrada'))g('mf-entrada').value='08:00';
  if(g('mf-saida'))g('mf-saida').value='17:00';
  if(g('mf-foto-data'))g('mf-foto-data').value='';
  if(g('foto-preview'))g('foto-preview').innerHTML='<i class="ti ti-camera"></i>';
  document.querySelectorAll('[name="mf-folga"]').forEach(cb=>{cb.checked=['sabado','domingo'].includes(cb.value);estiloFolga(cb);});
  if(g('mf-id'))g('mf-id').value='';
  if(g('modal-titulo'))g('modal-titulo').textContent='Novo funcionário';

  if (id) {
    const f = await DB.getFuncionarioById(id); if (!f) return;
    const s = (k,v) => { if(g(k)) g(k).value = v||''; };
    s('mf-id',f.id);s('mf-nome',f.nome);s('mf-cpf',f.cpf);s('mf-email',f.email);s('mf-celular',f.celular);
    s('mf-nasc',f.nascimento);s('mf-cargo',f.cargo);s('mf-depto',f.departamento);
    s('mf-contrato',f.tipo_contrato||'clt');s('mf-admissao',f.admissao);
    s('mf-sal',f.salario);s('mf-vr',f.vale_refeicao);s('mf-vt',f.vale_transporte);
    s('mf-banco',f.banco);s('mf-agencia',f.agencia);s('mf-conta',f.conta);
    s('mf-turno',f.turno||'integral');s('mf-entrada',f.entrada||'08:00');s('mf-saida',f.saida||'17:00');
    s('mf-status',f.status||'ativo');
    s('mf-em-nome',f.em_nome);s('mf-em-tel',f.em_telefone);s('mf-em-par',f.em_parentesco);
    document.querySelectorAll('[name="mf-folga"]').forEach(cb=>{cb.checked=(f.dias_folga||[]).includes(cb.value);estiloFolga(cb);});
    if(f.foto_url&&g('foto-preview')){g('foto-preview').innerHTML=`<img src="${f.foto_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;if(g('mf-foto-data'))g('mf-foto-data').value=f.foto_url;}
    if(g('modal-titulo'))g('modal-titulo').textContent='Editar funcionário';
  }
  modal.style.display='flex';
  document.querySelectorAll('[name="mf-folga"]').forEach(cb=>estiloFolga(cb));
}
function fecharModalFunc() { const m=document.getElementById('modal-func');if(m)m.style.display='none'; }

async function salvarModalFunc() {
  const g = k => document.getElementById(k)?.value.trim();
  const nome=g('mf-nome'), email=g('mf-email'), cargo=g('mf-cargo'), sal=g('mf-sal');
  if (!nome||!email||!cargo||!sal) { toast('Preencha nome, e-mail, cargo e salário','err'); return; }
  const idE = g('mf-id');
  const folgas = Array.from(document.querySelectorAll('[name="mf-folga"]:checked')).map(c=>c.value);
  const foto = document.getElementById('mf-foto-data')?.value || '';
  const payload = {
    nome, cpf:g('mf-cpf'), nascimento:document.getElementById('mf-nasc')?.value||null,
    foto_url: foto||null, status:document.getElementById('mf-status')?.value||'ativo',
    email, celular:g('mf-celular'),
    em_nome:g('mf-em-nome'), em_telefone:g('mf-em-tel'), em_parentesco:g('mf-em-par'),
    cargo, departamento:g('mf-depto'), tipo_contrato:document.getElementById('mf-contrato')?.value||'clt',
    admissao:document.getElementById('mf-admissao')?.value||null,
    salario:parseFloat(sal)||0, vale_refeicao:parseFloat(g('mf-vr'))||0, vale_transporte:parseFloat(g('mf-vt'))||0,
    banco:g('mf-banco'), agencia:g('mf-agencia'), conta:g('mf-conta'),
    turno:document.getElementById('mf-turno')?.value||'integral',
    entrada:document.getElementById('mf-entrada')?.value||null,
    saida:document.getElementById('mf-saida')?.value||null,
    dias_folga:folgas,
  };
  if (idE) payload.id = idE;
  try {
    await DB.saveFuncionario(payload);
    fecharModalFunc();
    toast('Funcionário salvo!');
    navigateTo('funcionarios');
  } catch(e) { toast(e.message,'err'); }
}

async function excluirFunc(id, nome) {
  confirmar(`Excluir ${nome}? Esta ação não pode ser desfeita.`, async () => {
    try { await DB.deleteFuncionario(id); toast('Funcionário removido'); navigateTo('funcionarios'); }
    catch(e) { toast(e.message,'err'); }
  });
}

// ── ENVIO HOLERITE POR EMAIL ──
function abrirEnvioHolerite(id) {
  DB.getFuncionarioById(id).then(f => {
    if (!f) return;
    const mesAno = new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    const el = document.getElementById('modal-holerite-email'); if (!el) return;
    el.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:600;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div style="background:var(--color-card-bg);border-radius:var(--radius-lg);padding:24px;width:100%;max-width:440px;box-shadow:var(--shadow-lg);">
        <p style="font-size:15px;font-weight:600;margin:0 0 14px;">Enviar holerite</p>
        <div style="background:var(--cobalt-50);border-radius:var(--radius-md);padding:10px 12px;margin-bottom:14px;"><p style="font-size:12px;color:var(--cobalt-600);margin:0;">${f.nome} · ${mesAno}</p></div>
        <div class="field-group" style="margin-bottom:10px;"><label class="field-label">Para</label><input id="he-para" type="email" value="${f.email||''}" class="input"/></div>
        <div class="field-group" style="margin-bottom:10px;"><label class="field-label">Assunto</label><input id="he-ass" type="text" value="Holerite — ${mesAno}" class="input"/></div>
        <div class="field-group" style="margin-bottom:14px;"><label class="field-label">Mensagem</label>
          <textarea id="he-corpo" class="textarea-base">Olá ${f.nome.split(' ')[0]},\n\nSegue holerite de ${mesAno}.\n\nAtenciosamente,\nDepartamento de RH</textarea>
        </div>
        <div class="alert alert-info" style="margin-bottom:14px;font-size:12px;"><i class="ti ti-info-circle"></i> O holerite será gerado em nova aba. Salve como PDF e anexe ao e-mail.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="document.getElementById('modal-holerite-email').innerHTML=''">Cancelar</button>
          <button class="btn btn-primary" onclick="confirmarEnvioHolerite('${id}')"><i class="ti ti-mail"></i> Abrir e-mail</button>
        </div>
      </div>
    </div>`;
  });
}

function confirmarEnvioHolerite(id) {
  const para = document.getElementById('he-para')?.value.trim();
  const ass  = document.getElementById('he-ass')?.value.trim();
  const corpo= document.getElementById('he-corpo')?.value.trim();
  if (!para) { toast('Informe o e-mail','err'); return; }
  gerarHolerite(id);
  setTimeout(() => { window.location.href='mailto:'+para+'?subject='+encodeURIComponent(ass)+'&body='+encodeURIComponent(corpo+'\n\n[Anexe o PDF gerado]'); }, 800);
  document.getElementById('modal-holerite-email').innerHTML='';
}

// ── HOLERITE PDF ──
async function gerarHolerite(id) {
  const [f, emp] = await Promise.all([DB.getFuncionarioById(id), DB.getEmpresa()]);
  if (!f) return;
  const sal=parseFloat(f.salario||0), vr=parseFloat(f.vale_refeicao||0), vt=parseFloat(f.vale_transporte||0);
  const inss=calcINSS(sal), irrf=calcIRRF(sal-inss), fgts=sal*.08, liq=sal-inss-irrf+vr+vt;
  const hj=new Date(), mesAno=hj.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const dimMes=new Date(hj.getFullYear(),hj.getMonth()+1,0).getDate();
  let hMes=220;
  if(f.entrada&&f.saida){
    let hd=(tm(f.saida)-tm(f.entrada))/60;if(hd<0)hd+=24;
    const nd=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
    let dc=0;for(let d=1;d<=dimMes;d++){const ds=new Date(hj.getFullYear(),hj.getMonth(),d).getDay();if(!(f.dias_folga||[]).includes(nd[ds]))dc++;}
    hMes=Math.round(hd*dc);
  }
  // Salva no histórico
  try { await DB.savePagamento({ funcionario_id:f.id, competencia:`${hj.getFullYear()}-${String(hj.getMonth()+1).padStart(2,'0')}`, salario_bruto:sal, inss, irrf, fgts, vr, vt, liquido:liq, status:'gerado' }); } catch(e){}

  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Holerite — ${f.nome}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;color:#000;padding:20px;max-width:740px;margin:0 auto;}
  .topo{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;}.te{padding:8px 10px;border-right:1px solid #000;}.td{padding:8px 10px;}
  h1{font-size:13px;font-weight:bold;text-align:center;padding:5px;background:#f0f0f0;border:1px solid #000;border-top:none;}
  .g2{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:none;}.c{padding:4px 8px;border-right:1px solid #000;border-bottom:1px solid #ccc;}.c:nth-child(even){border-right:none;}.c label{display:block;font-size:9px;color:#555;text-transform:uppercase;margin-bottom:1px;}.c span{font-size:11px;font-weight:bold;}
  table{width:100%;border-collapse:collapse;border:1px solid #000;border-top:none;}th{background:#d0d0d0;font-size:10px;padding:5px 6px;border:1px solid #000;text-align:left;}th.r,td.r{text-align:right;}td{font-size:11px;padding:4px 6px;border-bottom:1px solid #ccc;}tr:last-child td{border-bottom:none;}
  .sh{background:#e8e8e8;font-size:10px;font-weight:bold;padding:3px 6px;border-bottom:1px solid #000;border-top:1px solid #000;}
  .tots{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #000;border-top:none;}.tc{padding:8px;border-right:1px solid #000;text-align:center;}.tc:last-child{border-right:none;}.tc label{font-size:9px;text-transform:uppercase;color:#555;display:block;margin-bottom:2px;}.tc span{font-size:13px;font-weight:bold;}
  .rod{margin-top:12px;border:1px solid #000;display:grid;grid-template-columns:1fr 1fr;}.as{padding:30px 16px 8px;border-right:1px solid #000;font-size:10px;text-align:center;}.as:last-child{border-right:none;}
  .obs{font-size:9px;color:#555;margin-top:10px;text-align:center;}@media print{button{display:none!important;}}</style></head><body>
  <div style="margin-bottom:10px;display:flex;gap:8px;"><button onclick="window.print()" style="background:#2347C5;color:#fff;border:none;padding:7px 18px;border-radius:5px;cursor:pointer;font-size:12px;">🖨️ Imprimir / Salvar PDF</button><button onclick="window.close()" style="background:#f0f0f0;border:1px solid #ccc;padding:7px 18px;border-radius:5px;cursor:pointer;font-size:12px;">Fechar</button></div>
  <div class="topo"><div class="te"><p style="font-size:13px;font-weight:bold;">${emp?.razao_social||'Empresa'}</p><p style="font-size:10px;color:#555;">CNPJ: ${emp?.cnpj||'—'}</p><p style="font-size:10px;color:#555;">${emp?.logradouro||''} ${emp?.numero||''}</p><p style="font-size:10px;color:#555;">${emp?.cidade||''}${emp?.estado?' - '+emp.estado:''}</p></div><div class="td" style="text-align:right;"><p style="font-size:12px;font-weight:bold;">RECIBO DE PAGAMENTO DE SALÁRIO</p><p style="font-size:10px;color:#555;margin-top:4px;">Competência: ${mesAno}</p><p style="font-size:10px;color:#555;">Ref.: ${dimMes} dias · ${hMes}h mensais</p></div></div>
  <h1>DADOS DO EMPREGADO</h1>
  <div class="g2"><div class="c"><label>Nome</label><span>${f.nome}</span></div><div class="c"><label>CPF</label><span>${f.cpf||'—'}</span></div><div class="c"><label>Cargo</label><span>${f.cargo||'—'}</span></div><div class="c"><label>Departamento</label><span>${f.departamento||'—'}</span></div><div class="c"><label>Admissão</label><span>${fmtD(f.admissao)}</span></div><div class="c"><label>Contrato</label><span>${(f.tipo_contrato||'').toUpperCase()}</span></div><div class="c"><label>Banco / Ag. / Conta</label><span>${f.banco||'—'} / ${f.agencia||'—'} / ${f.conta||'—'}</span></div><div class="c"><label>Horário</label><span>${f.entrada||'—'} – ${f.saida||'—'} (${f.turno||'—'})</span></div></div>
  <table><thead><tr><th style="width:36px;">Cód.</th><th>Descrição</th><th class="r" style="width:56px;">Ref.</th><th class="r" style="width:100px;">Vencimentos</th><th class="r" style="width:100px;">Descontos</th></tr></thead><tbody>
  <tr><td colspan="5" class="sh">VENCIMENTOS</td></tr>
  <tr><td>001</td><td>Salário mensal</td><td class="r">${hMes}h</td><td class="r">${fmtR(sal)}</td><td></td></tr>
  ${vr>0?`<tr><td>010</td><td>Vale refeição</td><td class="r">—</td><td class="r">${fmtR(vr)}</td><td></td></tr>`:''}
  ${vt>0?`<tr><td>011</td><td>Vale transporte</td><td class="r">—</td><td class="r">${fmtR(vt)}</td><td></td></tr>`:''}
  <tr><td colspan="5" class="sh">DESCONTOS</td></tr>
  <tr><td>050</td><td>INSS — Previdência Social (tabela progressiva 2024)</td><td class="r">—</td><td></td><td class="r">${fmtR(inss)}</td></tr>
  <tr><td>060</td><td>IRRF — Imposto de Renda Retido na Fonte</td><td class="r">—</td><td></td><td class="r">${fmtR(irrf)}</td></tr>
  <tr><td colspan="5" class="sh">INFORMATIVO</td></tr>
  <tr><td>070</td><td>FGTS (8%) — depósito patronal</td><td class="r">8%</td><td class="r">${fmtR(fgts)}</td><td></td></tr>
  </tbody></table>
  <div class="tots"><div class="tc"><label>Total vencimentos</label><span>${fmtR(sal+vr+vt)}</span></div><div class="tc"><label>Total descontos</label><span style="color:#c00;">${fmtR(inss+irrf)}</span></div><div class="tc"><label>Líquido a receber</label><span style="color:#006600;">${fmtR(liq)}</span></div></div>
  <div class="rod"><div class="as">_______________________________<br>${emp?.razao_social||'Empresa'}<br><span style="font-size:9px;">Empregador</span></div><div class="as">_______________________________<br>${f.nome}<br><span style="font-size:9px;">Empregado — Assinatura e data</span></div></div>
  <p class="obs">Gerado em ${new Date().toLocaleString('pt-BR')} · RH Gestão · Conforme CLT Lei nº 5.452/43</p>
  </body></html>`);
  win.document.close();
}

// ══ ESCALA ════════════════════════════════════════════════════
async function pageEscala() {
  const profile = Auth.currentUser();
  const ehFuncionarioComum = ehSomenteFuncionario();

  const fsAll = await DB.getFuncionarios();
  const hj = new Date(), ano=hj.getFullYear(), mes=hj.getMonth();
  const nomeMes = hj.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const dnf=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const dna=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  // Funcionário comum só vê a própria escala
  let fs = fsAll;
  let meuRegistro = null;
  let erroVinculo = null;
  if (ehFuncionarioComum) {
    try {
      meuRegistro = await DB.getFuncionarioByProfileId(profile.id);
    } catch(e) {
      erroVinculo = e.message;
      console.error('[pageEscala] erro ao buscar vínculo:', e);
    }
    fs = meuRegistro ? [meuRegistro] : [];
  }

  function buildCal(f) {
    const dim=new Date(ano,mes+1,0).getDate(), pd=new Date(ano,mes,1).getDay();
    let cells='';
    for(let i=0;i<pd;i++) cells+=`<td style="background:var(--color-page-bg);border-radius:var(--radius-sm);"></td>`;
    for(let d=1;d<=dim;d++){
      const ds=new Date(ano,mes,d).getDay(), dk=dnf[ds];
      const folga=(f.dias_folga||[]).includes(dk), isH=(d===hj.getDate()&&mes===hj.getMonth());
      const bg=isH?'background:var(--cobalt-50);':folga?'background:var(--color-page-bg);':'background:var(--color-card-bg);';
      const bo=isH?'border:2px solid var(--cobalt-400);':'border:1px solid var(--color-card-border);';
      cells+=`<td style="${bg}${bo}border-radius:var(--radius-sm);padding:4px 2px;text-align:center;vertical-align:top;">
        <p style="font-size:12px;font-weight:${isH?700:500};color:${isH?'var(--cobalt-600)':folga?'var(--color-text-muted)':'var(--color-text-primary)'};margin:0;">${d}</p>
        ${folga?`<p style="font-size:9px;color:var(--color-text-muted);margin:1px 0 0;background:var(--gray-200);border-radius:3px;padding:1px 3px;display:inline-block;">Folga</p>`
               :`<p style="font-size:10px;color:var(--cobalt-600);font-weight:600;margin:1px 0 0;">${f.entrada||'—'}</p><p style="font-size:9px;color:var(--color-text-muted);margin:0;">${f.saida||'—'}</p>`}
      </td>`;
    }
    const rest=(7-(((pd+dim)%7)||7))%7;
    for(let i=0;i<rest;i++) cells+=`<td style="background:var(--color-page-bg);border-radius:var(--radius-sm);"></td>`;
    const tds=cells.match(/<td[\s\S]*?<\/td>/g)||[];
    let rows=''; for(let i=0;i<tds.length;i+=7) rows+=`<tr style="height:68px;">${tds.slice(i,i+7).join('')}</tr>`;
    let dt=0,df=0;
    for(let d=1;d<=dim;d++){const ds=new Date(ano,mes,d).getDay();(f.dias_folga||[]).includes(dnf[ds])?df++:dt++;}
    let hd=0; if(f.entrada&&f.saida){hd=(tm(f.saida)-tm(f.entrada))/60;if(hd<0)hd+=24;}
    return {rows,dt,df,hm:Math.round(hd*dt)};
  }

  // Funcionário comum sem registro vinculado: mostra aviso
  if (ehFuncionarioComum && !meuRegistro) {
    return `
    <h1 class="page-title" style="margin-bottom:6px;">Escalas</h1>
    <p class="page-subtitle">${nomeMes}</p>
    <div class="alert alert-warning">
      <i class="ti ti-alert-circle"></i>
      <div>
        <p style="margin:0;">Seu login (<strong>${profile.email}</strong>) ainda não está vinculado a nenhum cadastro de funcionário.</p>
        <p style="margin:4px 0 0;font-size:12px;">Peça ao RH para cadastrar um funcionário usando exatamente este e-mail, ou para vincular manualmente seu acesso em Área de RH → Usuários → Editar.</p>
        ${erroVinculo ? `<p style="margin:8px 0 0;font-size:11px;color:var(--color-danger);font-family:monospace;">Erro técnico: ${erroVinculo}</p>` : ''}
      </div>
    </div>`;
  }

  const opts = fs.map((f,i)=>`<option value="${i}">${f.nome}</option>`).join('');
  const f0 = fs[0];
  const cal0 = f0 ? buildCal(f0) : null;
  const bh0  = f0 ? await DB.getBancoHoras(f0.id) : {saldo:0};

  // Guarda a lista de funcionários numa variável global em vez de
  // serializar JSON dentro do atributo onchange (que quebrava com
  // nomes contendo aspas ou apóstrofos)
  window._escalaFuncionarios = fs.map(f=>({id:f.id,nome:f.nome,dias_folga:f.dias_folga||[],entrada:f.entrada,saida:f.saida,turno:f.turno}));

  return `
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:var(--space-xl);">
    <div><h1 class="page-title" style="margin-bottom:2px;">${ehFuncionarioComum?'Minha Escala':'Escalas'}</h1><p class="page-subtitle" style="margin:0;">${nomeMes}</p></div>
    ${!ehFuncionarioComum && fs.length?`<div style="display:flex;gap:8px;align-items:center;"><select id="sel-esc" class="input" style="width:200px;" onchange="reEscala(this.value, window._escalaFuncionarios)">${opts}</select></div>`:''}
  </div>
  <div id="esc-metrics" class="metric-grid" style="margin-bottom:16px;">
    <div class="metric-card"><p class="label">Dias trabalhados</p><p class="value">${cal0?.dt||0}</p></div>
    <div class="metric-card"><p class="label">Dias de folga</p><p class="value">${cal0?.df||0}</p></div>
    <div class="metric-card"><p class="label">Horas no mês</p><p class="value">${cal0?.hm||0}h</p></div>
    <div class="metric-card"><p class="label">Banco de horas</p><p class="value" style="font-size:16px;color:${bh0.saldo>=0?'var(--color-success)':'var(--color-danger)'};">${minToStr(bh0.saldo)}</p></div>
  </div>
  <div id="esc-corpo">
    ${fs.length&&cal0?`<div class="card" style="padding:12px;overflow-x:auto;">
      <table style="width:100%;border-collapse:separate;border-spacing:3px;min-width:500px;">
        <thead><tr>${dna.map(n=>`<th style="text-align:center;font-size:11px;font-weight:600;color:var(--color-text-muted);padding:4px;">${n}</th>`).join('')}</tr></thead>
        <tbody>${cal0.rows}</tbody>
      </table>
    </div>`:'<div class="card"><p style="font-size:13px;color:var(--color-text-muted);">Nenhum funcionário cadastrado.</p></div>'}
  </div>`;
}

async function reEscala(idx, fsList) {
  const f = fsList[parseInt(idx)]; if (!f) return;
  const hj=new Date(), ano=hj.getFullYear(), mes=hj.getMonth();
  const dnf=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const dna=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const dim=new Date(ano,mes+1,0).getDate(), pd=new Date(ano,mes,1).getDay();
  let cells='';
  for(let i=0;i<pd;i++) cells+=`<td style="background:var(--color-page-bg);border-radius:var(--radius-sm);"></td>`;
  for(let d=1;d<=dim;d++){
    const ds=new Date(ano,mes,d).getDay(), dk=dnf[ds];
    const folga=(f.dias_folga||[]).includes(dk), isH=(d===hj.getDate()&&mes===hj.getMonth());
    const bg=isH?'background:var(--cobalt-50);':folga?'background:var(--color-page-bg);':'background:var(--color-card-bg);';
    const bo=isH?'border:2px solid var(--cobalt-400);':'border:1px solid var(--color-card-border);';
    cells+=`<td style="${bg}${bo}border-radius:var(--radius-sm);padding:4px 2px;text-align:center;vertical-align:top;">
      <p style="font-size:12px;font-weight:${isH?700:500};color:${isH?'var(--cobalt-600)':folga?'var(--color-text-muted)':'var(--color-text-primary)'};margin:0;">${d}</p>
      ${folga?`<p style="font-size:9px;color:var(--color-text-muted);margin:1px 0 0;background:var(--gray-200);border-radius:3px;padding:1px 3px;display:inline-block;">Folga</p>`:`<p style="font-size:10px;color:var(--cobalt-600);font-weight:600;margin:1px 0 0;">${f.entrada||'—'}</p><p style="font-size:9px;color:var(--color-text-muted);margin:0;">${f.saida||'—'}</p>`}
    </td>`;
  }
  const rest=(7-(((pd+dim)%7)||7))%7;
  for(let i=0;i<rest;i++) cells+=`<td style="background:var(--color-page-bg);border-radius:var(--radius-sm);"></td>`;
  const tds=cells.match(/<td[\s\S]*?<\/td>/g)||[];
  let rows=''; for(let i=0;i<tds.length;i+=7) rows+=`<tr style="height:68px;">${tds.slice(i,i+7).join('')}</tr>`;
  let dt=0,df=0;
  for(let d=1;d<=dim;d++){const ds=new Date(ano,mes,d).getDay();(f.dias_folga||[]).includes(dnf[ds])?df++:dt++;}
  let hd=0; if(f.entrada&&f.saida){hd=(tm(f.saida)-tm(f.entrada))/60;if(hd<0)hd+=24;}
  const bh = await DB.getBancoHoras(f.id);
  document.getElementById('esc-corpo').innerHTML=`<div class="card" style="padding:12px;overflow-x:auto;"><table style="width:100%;border-collapse:separate;border-spacing:3px;min-width:500px;"><thead><tr>${dna.map(n=>`<th style="text-align:center;font-size:11px;font-weight:600;color:var(--color-text-muted);padding:4px;">${n}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  document.getElementById('esc-metrics').innerHTML=`
    <div class="metric-card"><p class="label">Dias trabalhados</p><p class="value">${dt}</p></div>
    <div class="metric-card"><p class="label">Dias de folga</p><p class="value">${df}</p></div>
    <div class="metric-card"><p class="label">Horas no mês</p><p class="value">${Math.round(hd*dt)}h</p></div>
    <div class="metric-card"><p class="label">Banco de horas</p><p class="value" style="font-size:16px;color:${bh.saldo>=0?'var(--color-success)':'var(--color-danger)'};">${minToStr(bh.saldo)}</p></div>`;
}

// ══ PONTO ═════════════════════════════════════════════════════
async function pagePonto() {
  const profile = Auth.currentUser();
  const ehFuncionarioComum = ehSomenteFuncionario();

  const fsAll = await DB.getFuncionarios();
  const hj = new Date();
  const mesAno = hj.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const aprovsPend = (await DB.getAprovacoes('pendente').catch(()=>[])) || [];

  // Funcionário comum só vê e edita o próprio ponto
  let fs = fsAll;
  let meuRegistro = null;
  if (ehFuncionarioComum) {
    try { meuRegistro = await DB.getFuncionarioByProfileId(profile.id); } catch(e) {}
    fs = meuRegistro ? [meuRegistro] : [];
  }

  if (ehFuncionarioComum && !meuRegistro) {
    return `
    <h1 class="page-title" style="margin-bottom:6px;">Folha de ponto</h1>
    <p class="page-subtitle">${mesAno}</p>
    <div class="alert alert-warning"><i class="ti ti-alert-circle"></i> Seu cadastro de funcionário ainda não foi vinculado. Entre em contato com o RH.</div>`;
  }

  const opts = fs.map(f=>`<option value="${f.id}">${f.nome}</option>`).join('');

  if (!fs.length) {
    return `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:var(--space-lg);">
      <div><h1 class="page-title" style="margin-bottom:2px;">Folha de ponto</h1>
      <p class="page-subtitle" style="margin:0;">${mesAno}</p></div>
    </div>
    <div class="card"><p style="font-size:13px;color:var(--color-text-muted);">Nenhum funcionário cadastrado.</p></div>`;
  }

  // Carrega a tabela do primeiro funcionário ANTES de montar o HTML
  let tabelaInicial = '';
  try {
    tabelaInicial = await buildPontoTable(fs[0].id, hj.getFullYear(), hj.getMonth()+1);
  } catch(e) {
    tabelaInicial = `<div class="alert alert-danger"><i class="ti ti-alert-circle"></i> Erro ao carregar: ${e.message}</div>`;
  }

  return `
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:var(--space-lg);">
    <div><h1 class="page-title" style="margin-bottom:2px;">${ehFuncionarioComum?'Meu Ponto':'Folha de ponto'}</h1>
    <p class="page-subtitle" style="margin:0;">${mesAno}</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${!ehFuncionarioComum ? `<select id="sel-ponto" class="input" style="width:200px;" onchange="rePonto(this.value)">${opts}</select>` : ''}
      <button class="btn btn-secondary btn-sm" onclick="exportarPontoCsv()"><i class="ti ti-download"></i> Exportar</button>
    </div>
  </div>
  <input type="hidden" id="ponto-funcionario-id" value="${fs[0].id}"/>
  ${aprovsPend.length ? `<div class="alert alert-warning" style="margin-bottom:12px;"><i class="ti ti-clock-edit"></i><span>${aprovsPend.length} correção(ões) aguardando aprovação</span><button class="btn btn-sm btn-secondary" style="margin-left:auto;" onclick="verAprovacoes()">Ver</button></div>` : ''}
  <div id="ponto-corpo">${tabelaInicial}</div>
  <div id="modal-aprovacoes"></div>`;
}

async function buildPontoTable(fid, ano, mes) {
  // mes = 1-based (1=jan, 6=jun)
  const f = await DB.getFuncionarioById(fid);
  if (!f) return '<div class="alert alert-danger"><i class="ti ti-alert-circle"></i> Funcionário não encontrado.</div>';

  const hj  = new Date();
  const dim  = new Date(ano, mes, 0).getDate(); // último dia do mês
  const hoje0 = new Date(hj.getFullYear(), hj.getMonth(), hj.getDate()); // hoje sem hora

  // Busca registros do mês
  let registros = [];
  try { registros = await DB.getPontoMes(fid, ano, mes) || []; } catch(e) {}
  const regMap = {};
  registros.forEach(r => {
    const dia = parseInt((r.data||'').split('-')[2]);
    if (dia) regMap[dia] = r;
  });

  const dnf = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const dna = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let linhas = '', totTrab = 0, totExt = 0;

  for (let d = 1; d <= dim; d++) {
    const dt  = new Date(ano, mes - 1, d);
    const ds  = dt.getDay();
    const na  = dna[ds];
    const dk  = dnf[ds];
    const r   = regMap[d] || {};
    const isH = (d === hj.getDate() && mes === hj.getMonth() + 1 && ano === hj.getFullYear());
    const folga   = (f.dias_folga || []).includes(dk);
    const futuro  = dt > hoje0;

    const bg = folga ? 'background:var(--gray-50);' : isH ? 'background:var(--cobalt-50);' : '';
    const dia = String(d).padStart(2, '0');

    if (folga) {
      linhas += `<tr style="${bg}">
        <td style="padding:7px 10px;font-size:12px;color:var(--color-text-muted);">${dia} ${na}</td>
        <td colspan="4" style="padding:7px 10px;text-align:center;"><span class="badge badge-neutral">Folga</span></td>
        <td></td><td></td><td></td>
      </tr>`;
      continue;
    }

    if (futuro) {
      linhas += `<tr style="${bg}">
        <td style="padding:7px 10px;font-size:12px;color:var(--color-text-secondary);">${dia} ${na}</td>
        <td colspan="4" style="padding:7px 10px;text-align:center;color:var(--color-text-muted);font-size:12px;">—</td>
        <td></td><td></td><td></td>
      </tr>`;
      continue;
    }

    // Dia passado ou hoje — mostra inputs
    const min = calcHorasTrabalhadas({
      entrada: r.entrada, saida: r.saida,
      saida_almoco: r.saida_almoco, retorno_almoco: r.retorno_almoco
    });
    let extras = 0;
    if (f.entrada && f.saida) {
      let prev = tm(f.saida) - tm(f.entrada);
      if (prev < 0) prev += 1440;
      extras = min - prev;
    }
    totTrab += min;
    totExt  += extras;

    const inp = (campo, val) =>
      `<td style="padding:3px 4px;">
        <input type="time" value="${val || ''}"
          style="width:82px;height:30px;padding:0 6px;border:1.5px solid var(--color-card-border);border-radius:var(--radius-md);font-size:12px;color:var(--color-text-primary);background:var(--color-input-bg);"
          onchange="salvarBatida('${fid}','${ano}','${mes}','${d}','${campo}',this.value)"/>
      </td>`;

    const corExt = extras > 0 ? 'var(--color-success)' : extras < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)';
    const extStr = extras !== 0
      ? `<span style="color:${corExt};font-size:11px;font-weight:600;">${extras > 0 ? '+' : ''}${minToStr(extras)}</span>`
      : '<span style="font-size:11px;color:var(--color-text-muted);">—</span>';
    const stEl = r.status === 'aprovado'
      ? '<span class="badge badge-success" style="font-size:10px;">✓</span>'
      : r.status === 'correcao' ? '<span class="badge badge-warning" style="font-size:10px;">!</span>' : '';

    linhas += `<tr style="${bg}border-bottom:1px solid var(--color-card-border);">
      <td style="padding:7px 10px;font-size:12px;font-weight:${isH ? 700 : 400};color:${isH ? 'var(--cobalt-600)' : 'var(--color-text-primary)'};">${dia} ${na}</td>
      ${inp('entrada', r.entrada)}
      ${inp('saida_almoco', r.saida_almoco)}
      ${inp('retorno_almoco', r.retorno_almoco)}
      ${inp('saida', r.saida)}
      <td style="padding:7px 10px;font-size:12px;text-align:center;font-weight:500;">${min > 0 ? minToStr(min) : '—'}</td>
      <td style="padding:7px 10px;text-align:center;">${extStr}</td>
      <td style="padding:7px 6px;text-align:center;">${stEl}
        <button class="btn btn-ghost btn-sm btn-icon" title="Solicitar correção"
          onclick="solicitarCorrecao('${fid}','${d}','${ano}','${mes}')">
          <i class="ti ti-edit" style="font-size:13px;"></i>
        </button>
      </td>
    </tr>`;
  }

  return `
  <div class="metric-grid" style="margin-bottom:12px;">
    <div class="metric-card"><p class="label">Turno</p><p class="value" style="font-size:14px;">${f.turno || '—'}</p></div>
    <div class="metric-card"><p class="label">Entrada prevista</p><p class="value" style="font-size:14px;">${f.entrada || '—'}</p></div>
    <div class="metric-card"><p class="label">Saída prevista</p><p class="value" style="font-size:14px;">${f.saida || '—'}</p></div>
    <div class="metric-card"><p class="label">Total trabalhado</p><p class="value" style="font-size:14px;">${minToStr(totTrab)}</p></div>
    <div class="metric-card"><p class="label">Saldo extras</p><p class="value" style="font-size:14px;color:${totExt >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">${minToStr(totExt)}</p></div>
  </div>
  <div class="table-wrap">
    <table class="data-table" style="min-width:680px;">
      <thead>
        <tr>
          <th style="width:80px;">Dia</th>
          <th class="c">Entrada</th>
          <th class="c">Saída almoço</th>
          <th class="c">Retorno almoço</th>
          <th class="c">Saída</th>
          <th class="c">Total</th>
          <th class="c">Extras</th>
          <th class="c">Status</th>
        </tr>
      </thead>
      <tbody>${linhas || '<tr><td colspan="8" style="padding:20px;text-align:center;color:var(--color-text-muted);">Nenhum registro encontrado.</td></tr>'}</tbody>
    </table>
  </div>`;
}

async function salvarBatida(fid, ano, mes, dia, campo, valor) {
  try {
    const campos = { [campo]: valor || null };
    await DB.savePonto(fid, { ano:parseInt(ano), mes:parseInt(mes), dia:parseInt(dia) }, campos);
    rePonto(fid, true);
  } catch(e) { toast(e.message,'err'); }
}

async function rePonto(fid, silent) {
  const hj=new Date();
  const el=document.getElementById('ponto-corpo');
  if (el) el.innerHTML = await buildPontoTable(fid, hj.getFullYear(), hj.getMonth()+1);
  if (!silent) { const s=document.getElementById('sel-ponto'); if(s)s.value=fid; }
}

async function solicitarCorrecao(fid, dia, ano, mes) {
  const obs = window.prompt(`Motivo da correção do ponto dia ${dia}:`);
  if (!obs) return;
  await DB.addAprovacao({ funcionario_id:fid, tipo:'correcao_ponto', dados:{dia,ano,mes}, obs, status:'pendente' });
  toast('Solicitação enviada para aprovação');
}

async function verAprovacoes() {
  const aprovs = await DB.getAprovacoes();
  const el = document.getElementById('modal-aprovacoes'); if (!el) return;
  el.innerHTML = `
  <div style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px;">
    <div style="background:var(--color-card-bg);border-radius:var(--radius-lg);width:100%;max-width:540px;max-height:85vh;overflow-y:auto;box-shadow:var(--shadow-lg);">
      <div style="padding:16px 20px;border-bottom:1px solid var(--color-card-border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--color-card-bg);">
        <p style="font-size:15px;font-weight:600;margin:0;">Aprovações de ponto</p>
        <button onclick="document.getElementById('modal-aprovacoes').innerHTML=''" class="btn btn-icon btn-secondary"><i class="ti ti-x"></i></button>
      </div>
      <div style="padding:16px;">
        ${(aprovs||[]).length===0?'<p style="font-size:13px;color:var(--color-text-muted);">Nenhuma solicitação.</p>':
          (aprovs||[]).map(a=>`<div style="padding:12px;border:1px solid var(--color-card-border);border-radius:var(--radius-md);margin-bottom:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <p style="font-size:13px;font-weight:600;margin:0;">${a.funcionarios?.nome||'—'}</p>
              ${a.status==='pendente'?'<span class="badge badge-warning">Pendente</span>':a.status==='aprovado'?'<span class="badge badge-success">Aprovado</span>':'<span class="badge badge-danger">Rejeitado</span>'}
            </div>
            <p style="font-size:12px;color:var(--color-text-secondary);margin:0 0 8px;">${a.obs||'—'}</p>
            ${a.status==='pendente'?`<div style="display:flex;gap:8px;">
              <button class="btn btn-sm" style="background:var(--color-success-bg);color:var(--color-success);border:1px solid var(--color-success);" onclick="resolverAprov('${a.id}','aprovado')"><i class="ti ti-check"></i> Aprovar</button>
              <button class="btn btn-danger btn-sm" onclick="resolverAprov('${a.id}','rejeitado')"><i class="ti ti-x"></i> Rejeitar</button>
            </div>`:''}
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

async function resolverAprov(id, status) {
  await DB.resolverAprovacao(id, status, '');
  toast(status==='aprovado'?'Aprovado!':'Rejeitado', status==='aprovado'?'ok':'err');
  verAprovacoes();
}

async function exportarPontoCsv() {
  const sel=document.getElementById('sel-ponto');
  const hidden=document.getElementById('ponto-funcionario-id');
  const fid=sel?.value || hidden?.value;
  if (!fid) return;
  const f=await DB.getFuncionarioById(fid); if (!f) return;
  const hj=new Date(), ano=hj.getFullYear(), mes=hj.getMonth()+1;
  const dim=new Date(ano,mes,0).getDate();
  const registros=await DB.getPontoMes(fid,ano,mes);
  const regMap={}; (registros||[]).forEach(r=>{regMap[parseInt(r.data.split('-')[2])]=r;});
  const dnf=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  let csv=`Funcionário:,${f.nome}\nCompetência:,${mes}/${ano}\n\nDia,Dia semana,Entrada,Saída almoço,Retorno almoço,Saída,Total,Extras\n`;
  for(let d=1;d<=dim;d++){
    const ds=new Date(ano,mes-1,d).getDay(), na=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][ds];
    const folga=(f.dias_folga||[]).includes(dnf[ds]);
    const r=regMap[d]||{};
    const min=calcHorasTrabalhadas({entrada:r.entrada,saida:r.saida,saida_almoco:r.saida_almoco,retorno_almoco:r.retorno_almoco});
    let ext=0; if(r.entrada&&r.saida&&f.entrada&&f.saida){let p=tm(f.saida)-tm(f.entrada);if(p<0)p+=1440;ext=min-p;}
    if(folga) csv+=`${d},${na},FOLGA,,,,, \n`;
    else csv+=`${d},${na},${r.entrada||''},${r.saida_almoco||''},${r.retorno_almoco||''},${r.saida||''},${min?minToStr(min):''},${ext?minToStr(ext):''}\n`;
  }
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`ponto_${f.nome.split(' ')[0]}_${mes}_${ano}.csv`;a.click();
  toast('Relatório exportado!');
}

// ══ PAGAMENTOS ════════════════════════════════════════════════
async function pagePagamentos() {
  const profile = Auth.currentUser();
  const ehFuncionarioComum = ehSomenteFuncionario();

  const [emp, fsAll] = await Promise.all([DB.getEmpresa(), DB.getFuncionarios()]);
  const hj=new Date(), mes=hj.getMonth(), ano=hj.getFullYear();
  const diaSal=parseInt(emp?.dia_pagamento)||5, diaVale=parseInt(emp?.dia_vale)||20;
  const nomeMes=hj.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const dim=new Date(ano,mes+1,0).getDate(), pd=new Date(ano,mes,1).getDay();

  // Funcionário comum só vê a própria linha
  let fs = fsAll;
  let meuRegistro = null;
  let erroVinculo = null;
  if (ehFuncionarioComum) {
    try {
      meuRegistro = await DB.getFuncionarioByProfileId(profile.id);
    } catch(e) {
      erroVinculo = e.message;
      console.error('[pagePagamentos] erro ao buscar vínculo:', e);
    }
    fs = meuRegistro ? [meuRegistro] : [];
  }

  function proxData(d){let x=new Date(ano,mes,d);if(x<hj)x=new Date(ano,mes+1,d);return x;}
  function diasAte(d){const di=Math.ceil((d-hj)/86400000);return di===0?'Hoje':di<0?'Passou':'Em '+di+(di===1?' dia':' dias');}

  const tSal=fs.reduce((a,f)=>a+(parseFloat(f.salario||0)),0);
  const tVR=fs.reduce((a,f)=>a+(parseFloat(f.vale_refeicao||0)),0);
  const tVT=fs.reduce((a,f)=>a+(parseFloat(f.vale_transporte||0)),0);
  const tFGTS=tSal*.08, t13=tSal/12;

  let cells='';
  for(let i=0;i<pd;i++) cells+=`<td style="padding:2px;"></td>`;
  for(let d=1;d<=dim;d++){
    const iH=d===hj.getDate(),iS=d===diaSal,iV=d===diaVale;
    const bg=iS?'background:var(--cobalt-600);color:#fff;':iV?'background:var(--cobalt-200);color:var(--cobalt-800);':iH?'background:var(--gray-200);':'';
    cells+=`<td style="padding:2px;text-align:center;"><div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:11px;border-radius:50%;${bg}font-weight:${iH||iS||iV?700:400};">${d}</div>${iS?'<p style="font-size:8px;color:var(--cobalt-600);text-align:center;margin:0;">Sal.</p>':''}${iV&&diaVale?'<p style="font-size:8px;color:var(--cobalt-400);text-align:center;margin:0;">Vale</p>':''}</td>`;
  }
  const tds2=cells.match(/<td[\s\S]*?<\/td>/g)||[];
  let calRows=''; for(let i=0;i<tds2.length;i+=7) calRows+=`<tr>${tds2.slice(i,i+7).join('')}</tr>`;

  // Funcionário comum sem registro vinculado: mostra aviso
  if (ehFuncionarioComum && !meuRegistro) {
    return `
    <h1 class="page-title" style="margin-bottom:6px;">Pagamentos</h1>
    <p class="page-subtitle">${nomeMes}</p>
    <div class="alert alert-warning">
      <i class="ti ti-alert-circle"></i>
      <div>
        <p style="margin:0;">Seu login (<strong>${profile.email}</strong>) ainda não está vinculado a nenhum cadastro de funcionário.</p>
        <p style="margin:4px 0 0;font-size:12px;">Peça ao RH para cadastrar um funcionário usando exatamente este e-mail, ou para vincular manualmente seu acesso em Área de RH → Usuários → Editar.</p>
        ${erroVinculo ? `<p style="margin:8px 0 0;font-size:11px;color:var(--color-danger);font-family:monospace;">Erro técnico: ${erroVinculo}</p>` : ''}
      </div>
    </div>`;
  }

  const linhas=fs.map(f=>{
    const sal=parseFloat(f.salario||0), inss=calcINSS(sal), irrf=calcIRRF(sal-inss);
    const vr=parseFloat(f.vale_refeicao||0), vt=parseFloat(f.vale_transporte||0);
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:8px;">${av(f.nome,28,f.foto_url)}<div><p style="font-size:12px;font-weight:500;margin:0;">${f.nome}</p><p style="font-size:11px;color:var(--color-text-muted);margin:0;">${f.cargo||'—'}</p></div></div></td>
      <td class="r">${fmtR(sal)}</td>
      <td class="r" style="color:var(--color-danger);">- ${fmtR(inss+irrf)}</td>
      <td class="r">${fmtR(vr)}</td><td class="r">${fmtR(vt)}</td>
      <td class="r" style="color:var(--color-text-muted);">${fmtR(sal*.08)}</td>
      <td class="r" style="font-weight:700;color:var(--cobalt-600);">${fmtR(sal-inss-irrf+vr+vt)}</td>
      <td class="c"><button class="btn btn-secondary btn-sm btn-icon" title="Holerite" onclick="gerarHolerite('${f.id}')"><i class="ti ti-file-text"></i></button></td>
    </tr>`;
  }).join('');

  return `
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:var(--space-xl);">
    <div><h1 class="page-title" style="margin-bottom:2px;">${ehFuncionarioComum ? 'Meu Holerite' : 'Pagamentos'}</h1><p class="page-subtitle" style="margin:0;">${nomeMes}</p></div>
    ${!ehFuncionarioComum ? `<button class="btn btn-secondary btn-sm" onclick="exportarFolhaCsv()"><i class="ti ti-download"></i> Exportar folha</button>` : ''}
  </div>
  <div class="metric-grid" style="margin-bottom:20px;">
    <div class="metric-card"><p class="label">${ehFuncionarioComum?'Salário':'Total salários'}</p><p class="value" style="font-size:15px;">${fmtR(tSal)}</p></div>
    <div class="metric-card"><p class="label">Vale refeição</p><p class="value" style="font-size:15px;">${fmtR(tVR)}</p></div>
    <div class="metric-card"><p class="label">Vale transporte</p><p class="value" style="font-size:15px;">${fmtR(tVT)}</p></div>
    ${!ehFuncionarioComum ? `
    <div class="metric-card"><p class="label">FGTS (encargo)</p><p class="value" style="font-size:15px;color:var(--color-warning);">${fmtR(tFGTS)}</p></div>
    <div class="metric-card"><p class="label">Provisão 13º</p><p class="value" style="font-size:15px;color:var(--color-info);">${fmtR(t13)}/mês</p></div>
    <div class="metric-card"><p class="label">Custo total</p><p class="value" style="font-size:15px;">${fmtR(tSal+tVR+tVT+tFGTS)}</p></div>` : ''}
  </div>
  <div style="display:grid;grid-template-columns:1fr 248px;gap:16px;align-items:start;">
    <div class="table-wrap">
      <table class="data-table" style="min-width:580px;">
        <thead><tr><th>Funcionário</th><th class="r">Bruto</th><th class="r">Descontos</th><th class="r">VR</th><th class="r">VT</th><th class="r">FGTS</th><th class="r">Líquido</th><th></th></tr></thead>
        <tbody>${linhas||'<tr><td colspan="8" style="padding:16px;text-align:center;color:var(--color-text-muted);">Nenhum funcionário.</td></tr>'}</tbody>
      </table>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div class="card">
        <p class="section-label" style="margin-bottom:10px;">${nomeMes}</p>
        <table style="width:100%;border-collapse:collapse;"><thead><tr>${['D','S','T','Q','Q','S','S'].map(d=>`<th style="text-align:center;font-size:10px;color:var(--color-text-muted);padding:2px;font-weight:600;">${d}</th>`).join('')}</tr></thead><tbody>${calRows}</tbody></table>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:7px;">
          <div style="display:flex;align-items:center;gap:8px;"><div style="width:18px;height:18px;border-radius:50%;background:var(--cobalt-600);flex-shrink:0;"></div><div><p style="font-size:12px;font-weight:500;color:var(--color-text-primary);margin:0;">Salário — dia ${diaSal}</p><p style="font-size:11px;color:var(--color-text-secondary);margin:0;">${diasAte(proxData(diaSal))}</p></div></div>
          ${diaVale?`<div style="display:flex;align-items:center;gap:8px;"><div style="width:18px;height:18px;border-radius:50%;background:var(--cobalt-200);flex-shrink:0;"></div><div><p style="font-size:12px;font-weight:500;color:var(--color-text-primary);margin:0;">Vale — dia ${diaVale}</p><p style="font-size:11px;color:var(--color-text-secondary);margin:0;">${diasAte(proxData(diaVale))}</p></div></div>`:''}
        </div>
      </div>
      ${!ehFuncionarioComum ? `
      <div class="card">
        <p class="section-label" style="margin-bottom:10px;">Encargos e provisões</p>
        ${[['FGTS (8%)',fmtR(tFGTS),'warning'],['13º (1/12)',fmtR(t13),'info'],['Férias (1/11)',fmtR(tSal/11),'info']].map(([l,v,t])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--color-card-border);"><span style="font-size:12px;color:var(--color-text-secondary);">${l}</span><span class="badge badge-${t}">${v}</span></div>`).join('')}
      </div>` : ''}
    </div>
  </div>`;
}

async function exportarFolhaCsv() {
  const [fs, emp] = await Promise.all([DB.getFuncionarios(), DB.getEmpresa()]);
  const mes = new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  let csv=`Empresa:,${emp?.razao_social||''}\nCompetência:,${mes}\n\nFuncionário,Cargo,Salário Bruto,INSS,IRRF,VR,VT,FGTS,Líquido\n`;
  fs.forEach(f=>{
    const sal=parseFloat(f.salario||0),inss=calcINSS(sal),irrf=calcIRRF(sal-inss);
    const vr=parseFloat(f.vale_refeicao||0),vt=parseFloat(f.vale_transporte||0),fgts=sal*.08;
    csv+=`${f.nome},${f.cargo||''},${sal.toFixed(2)},${inss.toFixed(2)},${irrf.toFixed(2)},${vr.toFixed(2)},${vt.toFixed(2)},${fgts.toFixed(2)},${(sal-inss-irrf+vr+vt).toFixed(2)}\n`;
  });
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`folha_${new Date().getMonth()+1}_${new Date().getFullYear()}.csv`;a.click();
  toast('Folha exportada!');
}

// ══ RELATÓRIOS ════════════════════════════════════════════════
async function pageRelatorios() {
  return `
  <h1 class="page-title" style="margin-bottom:6px;">Relatórios</h1>
  <p class="page-subtitle">Exporte e analise os dados do sistema</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;">
    ${[
      {ico:'ti-users',titulo:'Funcionários',desc:'Lista completa com dados de todos os funcionários',fn:"relFuncionarios()"},
      {ico:'ti-clock',titulo:'Folha de ponto',desc:'Registro de ponto do mês atual por funcionário',fn:"navigateTo('ponto')"},
      {ico:'ti-cash',titulo:'Folha de pagamento',desc:'Resumo de salários, descontos e encargos',fn:"navigateTo('pagamentos')"},
      {ico:'ti-chart-bar',titulo:'Dashboard',desc:'Métricas e indicadores gerais da equipe',fn:"navigateTo('dashboard')"},
    ].map(r=>`
      <div class="card" style="cursor:pointer;transition:box-shadow .15s;" onclick="${r.fn}" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='var(--shadow-sm)'">
        <div style="width:44px;height:44px;border-radius:var(--radius-md);background:var(--cobalt-50);display:flex;align-items:center;justify-content:center;margin-bottom:12px;">
          <i class="ti ${r.ico}" style="font-size:22px;color:var(--cobalt-600);"></i>
        </div>
        <p style="font-size:14px;font-weight:600;color:var(--color-text-primary);margin:0 0 4px;">${r.titulo}</p>
        <p style="font-size:12px;color:var(--color-text-secondary);margin:0 0 14px;">${r.desc}</p>
        <button class="btn btn-secondary btn-sm"><i class="ti ti-arrow-right"></i> Acessar</button>
      </div>`).join('')}
  </div>`;
}

async function relFuncionarios() {
  const fs = await DB.getRelatorioFuncionarios();
  let csv='Nome,Cargo,Departamento,Contrato,Admissão,Salário,E-mail,Status\n';
  fs.forEach(f=>{csv+=`${f.nome},${f.cargo||''},${f.departamento||''},${f.tipo_contrato||''},${f.admissao||''},${f.salario||0},${f.email||''},${f.status||'ativo'}\n`;});
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`funcionarios_${new Date().toISOString().slice(0,10)}.csv`;a.click();
  toast('Relatório exportado!');
}

//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//