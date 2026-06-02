const pages = {
  dashboard:    pageDashboard,
  funcionarios: pageFuncionarios,
  escala:       pageEscala,
  ponto:        pagePonto,
  pagamentos:   pagePagamentos,
};

// ── NAVEGAÇÃO ──
function navigateTo(pageKey) {
  const content = document.getElementById('content');
  document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageKey);
  });
  if (pages[pageKey]) {
    content.innerHTML = pages[pageKey]();
    if (typeof window._pageInit === 'function') { window._pageInit(); window._pageInit = null; }
  }
}

document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// ── HELPERS ──
function fmtMoeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}
function iniciais(nome) {
  return (nome || '').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}
function avatar(nome) {
  return `<div style="width:36px;height:36px;border-radius:50%;background:var(--cobalt-50);color:var(--cobalt-600);font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${iniciais(nome)}</div>`;
}

// ═══════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════
function pageDashboard() {
  const empresa      = Storage.getEmpresa();
  const funcionarios = Storage.getFuncionarios();
  const hoje         = new Date();
  const diasNomes    = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const diaHoje      = diasNomes[hoje.getDay()];
  const deFolga      = funcionarios.filter(f => f.horario?.folgas?.includes(diaHoje)).length;
  const hojeStr      = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const diaPgto = empresa?.rh?.diaPagamento;
  let proximoPgto = '—';
  if (diaPgto && diaPgto !== 'ultimo') {
    const dia  = parseInt(diaPgto);
    let data   = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    if (data <= hoje) data = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
    const diff = Math.ceil((data - hoje) / 86400000);
    proximoPgto = diff + (diff === 1 ? ' dia' : ' dias');
  }

  const linhas = funcionarios.map(f => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-200);">
      ${avatar(f.nome)}
      <div style="flex:1;">
        <p style="font-size:13px;font-weight:500;color:var(--gray-900);margin:0;">${f.nome}</p>
        <p style="font-size:12px;color:var(--gray-600);margin:0;">${f.cargo||'—'} · ${f.departamento||'—'}</p>
      </div>
      <span style="font-size:12px;color:var(--gray-600);">${f.horario?.entrada||'—'} – ${f.horario?.saida||'—'}</span>
    </div>`).join('');

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-xl);">
      <div>
        <h1 class="page-title" style="margin-bottom:2px;">${empresa?.nomeFantasia||empresa?.razaoSocial||'Dashboard'}</h1>
        <p style="font-size:13px;color:var(--gray-600);margin:0;">${hojeStr}</p>
      </div>
      <button class="btn btn-primary" onclick="abrirModalFuncionario()"><i class="ti ti-plus"></i> Novo funcionário</button>
    </div>
    <div class="metric-grid">
      <div class="metric-card"><p class="label">Funcionários</p><p class="value">${funcionarios.length}</p></div>
      <div class="metric-card"><p class="label">De folga hoje</p><p class="value">${deFolga}</p></div>
      <div class="metric-card"><p class="label">Trabalhando hoje</p><p class="value">${funcionarios.length - deFolga}</p></div>
      <div class="metric-card"><p class="label">Próximo pagamento</p><p class="value">${proximoPgto}</p></div>
    </div>
    <div class="card">
      <p style="font-size:13px;font-weight:600;color:var(--gray-900);margin-bottom:var(--space-md);">Equipe cadastrada</p>
      ${linhas || '<p style="font-size:13px;color:var(--gray-600);">Nenhum funcionário cadastrado.</p>'}
    </div>
    ${modalFuncionarioHTML()}`;
}

// ═══════════════════════════════════════════════
// FUNCIONÁRIOS
// ═══════════════════════════════════════════════
function pageFuncionarios() {
  const lista = Storage.getFuncionarios();

  const cards = lista.map(f => `
    <div class="card" style="display:flex;align-items:flex-start;gap:16px;">
      <div style="width:44px;height:44px;border-radius:50%;background:var(--cobalt-50);color:var(--cobalt-600);font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${iniciais(f.nome)}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <p style="font-size:14px;font-weight:600;color:var(--gray-900);margin:0;">${f.nome}</p>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-secondary" style="padding:5px 10px;font-size:12px;" onclick="verFuncionario('${f.id}')"><i class="ti ti-eye"></i> Ver</button>
            <button class="btn btn-secondary" style="padding:5px 10px;font-size:12px;" onclick="editarFuncionario('${f.id}')"><i class="ti ti-edit"></i> Editar</button>
            <button class="btn btn-secondary" style="padding:5px 10px;font-size:12px;color:var(--color-danger);" onclick="excluirFuncionario('${f.id}','${f.nome}')"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        <p style="font-size:13px;color:var(--gray-600);margin:4px 0 8px;">${f.cargo||'—'} · ${f.departamento||'—'} · ${f.tipoContrato?.toUpperCase()||'—'}</p>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <span style="font-size:12px;color:var(--gray-600);"><i class="ti ti-mail" style="font-size:13px;vertical-align:-2px;margin-right:4px;"></i>${f.contato?.email||'—'}</span>
          <span style="font-size:12px;color:var(--gray-600);"><i class="ti ti-calendar" style="font-size:13px;vertical-align:-2px;margin-right:4px;"></i>Admissão: ${fmtData(f.admissao)}</span>
          <span style="font-size:12px;color:var(--cobalt-600);font-weight:500;">${fmtMoeda(f.pagamento?.salario)}</span>
        </div>
      </div>
    </div>`).join('');

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-xl);">
      <h1 class="page-title" style="margin:0;">Funcionários</h1>
      <button class="btn btn-primary" onclick="abrirModalFuncionario()"><i class="ti ti-plus"></i> Novo funcionário</button>
    </div>
    ${lista.length
      ? `<div style="display:flex;flex-direction:column;gap:12px;">${cards}</div>`
      : `<div class="card"><p style="font-size:13px;color:var(--gray-600);">Nenhum funcionário cadastrado ainda.</p></div>`}
    <div id="modal-root"></div>
    <div id="ficha-root"></div>
    ${modalFuncionarioHTML()}`;
}

// ── FICHA DO FUNCIONÁRIO ──
function verFuncionario(id) {
  const f = Storage.getFuncionarioById(id);
  if (!f) return;

  const folgas = (f.horario?.folgas || []).map(d => ({
    segunda:'Segunda',terca:'Terça',quarta:'Quarta',quinta:'Quinta',
    sexta:'Sexta',sabado:'Sábado',domingo:'Domingo'
  }[d] || d)).join(', ') || '—';

  const fichaEl = document.getElementById('ficha-root');
  if (!fichaEl) return;

  fichaEl.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:200;display:flex;align-items:flex-start;justify-content:flex-end;" onclick="if(event.target===this)fecharFicha()">
      <div style="width:420px;height:100vh;overflow-y:auto;background:var(--white);padding:24px;box-shadow:-4px 0 24px rgba(0,0,0,0.1);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <p style="font-size:15px;font-weight:600;color:var(--gray-900);margin:0;">Ficha do funcionário</p>
          <button class="btn btn-secondary" style="padding:5px 10px;" onclick="fecharFicha()"><i class="ti ti-x"></i></button>
        </div>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--gray-200);">
          <div style="width:52px;height:52px;border-radius:50%;background:var(--cobalt-50);color:var(--cobalt-600);font-size:16px;font-weight:600;display:flex;align-items:center;justify-content:center;">${iniciais(f.nome)}</div>
          <div>
            <p style="font-size:15px;font-weight:600;color:var(--gray-900);margin:0;">${f.nome}</p>
            <p style="font-size:13px;color:var(--gray-600);margin:2px 0 0;">${f.cargo||'—'} · ${f.departamento||'—'}</p>
          </div>
        </div>
        ${secaoFicha('Dados pessoais', [
          ['CPF', f.cpf], ['RG', f.rg], ['Nascimento', fmtData(f.nascimento)],
          ['E-mail', f.contato?.email], ['Celular', f.contato?.celular]
        ])}
        ${secaoFicha('Contrato', [
          ['Tipo', f.tipoContrato?.toUpperCase()], ['Admissão', fmtData(f.admissao)]
        ])}
        ${secaoFicha('Pagamento', [
          ['Salário', fmtMoeda(f.pagamento?.salario)],
          ['Vale refeição', fmtMoeda(f.pagamento?.valeRefeicao)],
          ['Vale transporte', fmtMoeda(f.pagamento?.valeTransporte)],
          ['Banco', f.pagamento?.banco], ['Agência', f.pagamento?.agencia],
          ['Conta', f.pagamento?.conta + ' (' + (f.pagamento?.tipoConta||'') + ')']
        ])}
        ${secaoFicha('Horários', [
          ['Turno', f.horario?.turno], ['Entrada', f.horario?.entrada],
          ['Saída', f.horario?.saida], ['Folgas', folgas]
        ])}
        <div style="margin-top:20px;display:flex;gap:8px;">
          <button class="btn btn-primary" style="flex:1;" onclick="gerarHolerite('${f.id}')"><i class="ti ti-file-text"></i> Gerar holerite</button>
          <button class="btn btn-secondary" style="flex:1;" onclick="enviarEmail('${f.id}')"><i class="ti ti-mail"></i> Enviar e-mail</button>
        </div>
      </div>
    </div>`;
}

function secaoFicha(titulo, campos) {
  const linhas = campos.map(([label, val]) =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gray-200);">
      <span style="font-size:12px;color:var(--gray-600);">${label}</span>
      <span style="font-size:12px;font-weight:500;color:var(--gray-900);text-align:right;max-width:60%;">${val||'—'}</span>
    </div>`).join('');
  return `
    <div style="margin-bottom:16px;">
      <p style="font-size:11px;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">${titulo}</p>
      ${linhas}
    </div>`;
}

function fecharFicha() {
  const el = document.getElementById('ficha-root');
  if (el) el.innerHTML = '';
}

// ── MODAL NOVO/EDITAR FUNCIONÁRIO ──
function modalFuncionarioHTML() {
  return `
    <div id="modal-func" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:300;align-items:center;justify-content:center;">
      <div style="background:var(--white);border-radius:var(--radius-lg);padding:24px;width:560px;max-height:90vh;overflow-y:auto;margin:0 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <p id="modal-titulo" style="font-size:15px;font-weight:600;color:var(--gray-900);margin:0;">Novo funcionário</p>
          <button class="btn btn-secondary" style="padding:5px 10px;" onclick="fecharModal()"><i class="ti ti-x"></i></button>
        </div>
        <div class="form-grid cols-1"><div class="form-field">
          <label>Nome completo *</label><input id="mf-nome" type="text" placeholder="Nome completo" />
        </div></div>
        <div class="form-grid" style="margin-top:10px;">
          <div class="form-field"><label>CPF</label><input id="mf-cpf" type="text" placeholder="000.000.000-00" maxlength="14" /></div>
          <div class="form-field"><label>E-mail *</label><input id="mf-email" type="email" placeholder="email@empresa.com" /></div>
        </div>
        <div class="form-grid" style="margin-top:10px;">
          <div class="form-field"><label>Cargo *</label><input id="mf-cargo" type="text" placeholder="Ex: Analista" /></div>
          <div class="form-field"><label>Departamento</label>
            <select id="mf-depto">
              <option value="">Selecione...</option>
              <option>Recursos Humanos</option><option>Tecnologia</option><option>Financeiro</option>
              <option>Comercial</option><option>Operações</option><option>Marketing</option><option>Diretoria</option>
            </select>
          </div>
        </div>
        <div class="form-grid" style="margin-top:10px;">
          <div class="form-field"><label>Tipo de contrato</label>
            <select id="mf-contrato"><option value="clt">CLT</option><option value="pj">PJ</option><option value="estagio">Estágio</option><option value="temporario">Temporário</option></select>
          </div>
          <div class="form-field"><label>Admissão</label><input id="mf-admissao" type="date" /></div>
        </div>
        <div class="form-grid cols-3" style="margin-top:10px;">
          <div class="form-field"><label>Salário (R$) *</label><input id="mf-salario" type="number" min="0" step="0.01" placeholder="0,00" /></div>
          <div class="form-field"><label>Vale refeição</label><input id="mf-vr" type="number" min="0" step="0.01" placeholder="0,00" /></div>
          <div class="form-field"><label>Vale transporte</label><input id="mf-vt" type="number" min="0" step="0.01" placeholder="0,00" /></div>
        </div>
        <div class="form-grid cols-3" style="margin-top:10px;">
          <div class="form-field"><label>Turno</label>
            <select id="mf-turno" onchange="mfTurno(this.value)">
              <option value="integral">Integral</option><option value="manha">Manhã</option>
              <option value="tarde">Tarde</option><option value="noite">Noite</option><option value="personalizado">Personalizado</option>
            </select>
          </div>
          <div class="form-field"><label>Entrada</label><input id="mf-entrada" type="time" value="08:00" /></div>
          <div class="form-field"><label>Saída</label><input id="mf-saida" type="time" value="17:00" /></div>
        </div>
        <div class="form-field" style="margin-top:10px;"><label>Dias de folga</label>
          <div class="check-group">
            ${['segunda','terca','quarta','quinta','sexta','sabado','domingo'].map(d =>
              `<label class="check-item"><input type="checkbox" name="mf-folga" value="${d}" ${['sabado','domingo'].includes(d)?'checked':''}/> ${{segunda:'Seg',terca:'Ter',quarta:'Qua',quinta:'Qui',sexta:'Sex',sabado:'Sáb',domingo:'Dom'}[d]}</label>`
            ).join('')}
          </div>
        </div>
        <input type="hidden" id="mf-id" />
        <div style="display:flex;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid var(--gray-200);">
          <button class="btn btn-secondary" style="flex:1;" onclick="fecharModal()">Cancelar</button>
          <button class="btn btn-primary" style="flex:1;" onclick="salvarModalFuncionario()">Salvar funcionário</button>
        </div>
      </div>
    </div>`;
}

function mfTurno(v) {
  const h = {integral:{e:'08:00',s:'18:00'},manha:{e:'06:00',s:'14:00'},tarde:{e:'14:00',s:'22:00'},noite:{e:'22:00',s:'06:00'},personalizado:{e:'',s:''}};
  if (h[v]) { document.getElementById('mf-entrada').value=h[v].e; document.getElementById('mf-saida').value=h[v].s; }
}

function abrirModalFuncionario(id) {
  const modal = document.getElementById('modal-func');
  if (!modal) { navigateTo('funcionarios'); setTimeout(()=>abrirModalFuncionario(id),100); return; }
  document.getElementById('mf-id').value = '';
  document.getElementById('mf-nome').value = '';
  document.getElementById('mf-cpf').value = '';
  document.getElementById('mf-email').value = '';
  document.getElementById('mf-cargo').value = '';
  document.getElementById('mf-depto').value = '';
  document.getElementById('mf-contrato').value = 'clt';
  document.getElementById('mf-admissao').value = '';
  document.getElementById('mf-salario').value = '';
  document.getElementById('mf-vr').value = '';
  document.getElementById('mf-vt').value = '';
  document.getElementById('mf-turno').value = 'integral';
  document.getElementById('mf-entrada').value = '08:00';
  document.getElementById('mf-saida').value = '17:00';
  document.querySelectorAll('[name="mf-folga"]').forEach(cb => { cb.checked = ['sabado','domingo'].includes(cb.value); });
  document.getElementById('modal-titulo').textContent = 'Novo funcionário';
  modal.style.display = 'flex';
}

function editarFuncionario(id) {
  const f = Storage.getFuncionarioById(id);
  if (!f) return;
  const modal = document.getElementById('modal-func');
  if (!modal) { navigateTo('funcionarios'); setTimeout(()=>editarFuncionario(id),100); return; }
  document.getElementById('mf-id').value        = f.id;
  document.getElementById('mf-nome').value      = f.nome||'';
  document.getElementById('mf-cpf').value       = f.cpf||'';
  document.getElementById('mf-email').value     = f.contato?.email||'';
  document.getElementById('mf-cargo').value     = f.cargo||'';
  document.getElementById('mf-depto').value     = f.departamento||'';
  document.getElementById('mf-contrato').value  = f.tipoContrato||'clt';
  document.getElementById('mf-admissao').value  = f.admissao||'';
  document.getElementById('mf-salario').value   = f.pagamento?.salario||'';
  document.getElementById('mf-vr').value        = f.pagamento?.valeRefeicao||'';
  document.getElementById('mf-vt').value        = f.pagamento?.valeTransporte||'';
  document.getElementById('mf-turno').value     = f.horario?.turno||'integral';
  document.getElementById('mf-entrada').value   = f.horario?.entrada||'08:00';
  document.getElementById('mf-saida').value     = f.horario?.saida||'17:00';
  document.querySelectorAll('[name="mf-folga"]').forEach(cb => { cb.checked = (f.horario?.folgas||[]).includes(cb.value); });
  document.getElementById('modal-titulo').textContent = 'Editar funcionário';
  modal.style.display = 'flex';
}

function fecharModal() {
  const m = document.getElementById('modal-func');
  if (m) m.style.display = 'none';
}

function salvarModalFuncionario() {
  const nome   = document.getElementById('mf-nome').value.trim();
  const email  = document.getElementById('mf-email').value.trim();
  const cargo  = document.getElementById('mf-cargo').value.trim();
  const sal    = document.getElementById('mf-salario').value;
  if (!nome || !email || !cargo || !sal) { alert('Preencha nome, e-mail, cargo e salário.'); return; }

  const idExist = document.getElementById('mf-id').value;
  const folgas  = Array.from(document.querySelectorAll('[name="mf-folga"]:checked')).map(c=>c.value);

  const func = {
    id:           idExist || Storage.gerarId(),
    nome,
    cpf:          document.getElementById('mf-cpf').value.trim(),
    contato:      { email, celular: '' },
    cargo,
    departamento: document.getElementById('mf-depto').value,
    tipoContrato: document.getElementById('mf-contrato').value,
    admissao:     document.getElementById('mf-admissao').value,
    pagamento: {
      salario:        parseFloat(sal)||0,
      valeRefeicao:   parseFloat(document.getElementById('mf-vr').value)||0,
      valeTransporte: parseFloat(document.getElementById('mf-vt').value)||0,
    },
    horario: {
      turno:   document.getElementById('mf-turno').value,
      entrada: document.getElementById('mf-entrada').value,
      saida:   document.getElementById('mf-saida').value,
      folgas,
    },
    criadoEm: idExist ? Storage.getFuncionarioById(idExist)?.criadoEm : new Date().toISOString(),
  };

  Storage.saveFuncionario(func);
  fecharModal();
  navigateTo('funcionarios');
}

function excluirFuncionario(id, nome) {
  if (!confirm('Excluir ' + nome + '? Esta ação não pode ser desfeita.')) return;
  Storage.deleteFuncionario(id);
  navigateTo('funcionarios');
}

// ── HOLERITE ──
function gerarHolerite(id) {
  const f = Storage.getFuncionarioById(id);
  const empresa = Storage.getEmpresa();
  if (!f) return;

  const sal     = parseFloat(f.pagamento?.salario||0);
  const vr      = parseFloat(f.pagamento?.valeRefeicao||0);
  const vt      = parseFloat(f.pagamento?.valeTransporte||0);
  const inss    = sal * 0.09;
  const irrf    = sal > 4664.68 ? sal * 0.275 : sal > 3751.05 ? sal * 0.225 : sal > 2826.65 ? sal * 0.15 : sal > 2112 ? sal * 0.075 : 0;
  const liquido = sal - inss - irrf + vr + vt;
  const mesAno  = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Holerite — ${f.nome}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; max-width: 680px; margin: 0 auto; color: #111; }
      h2 { color: #2347C5; border-bottom: 2px solid #2347C5; padding-bottom: 8px; }
      .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #2347C5; color: white; padding: 8px 12px; text-align: left; font-size: 13px; }
      td { padding: 7px 12px; font-size: 13px; border-bottom: 1px solid #E4E6EA; }
      .total { font-weight: bold; font-size: 15px; color: #2347C5; }
      @media print { button { display: none; } }
    </style></head><body>
    <div class="header">
      <div><h2>${empresa?.nomeFantasia||empresa?.razaoSocial||'Empresa'}</h2><p style="margin:0;font-size:13px;color:#6B7280;">CNPJ: ${empresa?.cnpj||'—'}</p></div>
      <div style="text-align:right"><p style="margin:0;font-size:13px;font-weight:600;">HOLERITE</p><p style="margin:0;font-size:13px;color:#6B7280;">${mesAno}</p></div>
    </div>
    <table><tr><th colspan="2">Dados do funcionário</th></tr>
      <tr><td>Nome</td><td>${f.nome}</td></tr>
      <tr><td>Cargo</td><td>${f.cargo||'—'}</td></tr>
      <tr><td>Departamento</td><td>${f.departamento||'—'}</td></tr>
      <tr><td>Admissão</td><td>${fmtData(f.admissao)}</td></tr>
      <tr><td>CPF</td><td>${f.cpf||'—'}</td></tr>
    </table>
    <table><tr><th>Descrição</th><th>Valor</th></tr>
      <tr><td>Salário bruto</td><td>${fmtMoeda(sal)}</td></tr>
      <tr><td>Vale refeição</td><td>${fmtMoeda(vr)}</td></tr>
      <tr><td>Vale transporte</td><td>${fmtMoeda(vt)}</td></tr>
      <tr><td style="color:#DC2626;">(-) INSS (9%)</td><td style="color:#DC2626;">- ${fmtMoeda(inss)}</td></tr>
      <tr><td style="color:#DC2626;">(-) IRRF</td><td style="color:#DC2626;">- ${fmtMoeda(irrf)}</td></tr>
      <tr><td class="total">Salário líquido</td><td class="total">${fmtMoeda(liquido)}</td></tr>
    </table>
    <p style="font-size:11px;color:#9CA3AF;margin-top:32px;">Documento gerado em ${new Date().toLocaleString('pt-BR')} · RH Gestão</p>
    <button onclick="window.print()" style="background:#2347C5;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;">Imprimir / Salvar PDF</button>
    </body></html>`);
  win.document.close();
}

// ── E-MAIL ──
function enviarEmail(id) {
  const f = Storage.getFuncionarioById(id);
  if (!f) return;
  const email = f.contato?.email;
  if (!email) { alert('Este funcionário não tem e-mail cadastrado.'); return; }
  const assunto = encodeURIComponent('Comunicado — RH');
  const corpo   = encodeURIComponent('Olá ' + f.nome.split(' ')[0] + ',\n\n');
  window.open('mailto:' + email + '?subject=' + assunto + '&body=' + corpo);
}

// ═══════════════════════════════════════════════
// ESCALA
// ═══════════════════════════════════════════════
function pageEscala() {
  const funcionarios = Storage.getFuncionarios();
  const hoje         = new Date();
  const anoMes       = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Gera os 7 dias da semana atual (dom a sáb)
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay());

  const diasSemana = Array.from({length: 7}, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(inicioSemana.getDate() + i);
    return d;
  });

  const nomeDia = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const nomesDiaFolga = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];

  const cabecalho = diasSemana.map((d, i) => {
    const isHoje = d.toDateString() === hoje.toDateString();
    return `<th style="padding:8px;text-align:center;font-size:12px;font-weight:600;color:${isHoje?'var(--cobalt-600)':'var(--gray-600)'};">
      <div>${nomeDia[i]}</div>
      <div style="font-size:16px;font-weight:700;color:${isHoje?'var(--cobalt-600)':'var(--gray-900)'};">${d.getDate()}</div>
    </th>`;
  }).join('');

  const linhasFuncionarios = funcionarios.map(f => {
    const colunas = diasSemana.map((d, i) => {
      const diaKey   = nomesDiaFolga[i];
      const folga    = (f.horario?.folgas || []).includes(diaKey);
      const isHoje   = d.toDateString() === hoje.toDateString();
      const bg       = isHoje ? 'background:var(--cobalt-50);' : '';
      if (folga) {
        return `<td style="padding:6px 4px;text-align:center;${bg}"><span style="font-size:11px;color:var(--gray-400);">Folga</span></td>`;
      }
      return `<td style="padding:6px 4px;text-align:center;${bg}">
        <span style="font-size:11px;color:var(--cobalt-600);font-weight:500;display:block;">${f.horario?.entrada||'—'}</span>
        <span style="font-size:10px;color:var(--gray-400);">${f.horario?.saida||'—'}</span>
      </td>`;
    }).join('');
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid var(--gray-200);white-space:nowrap;">
        <p style="font-size:13px;font-weight:500;color:var(--gray-900);margin:0;">${f.nome}</p>
        <p style="font-size:11px;color:var(--gray-600);margin:0;">${f.cargo||'—'}</p>
      </td>
      ${colunas}
    </tr>`;
  }).join('');

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-xl);">
      <div>
        <h1 class="page-title" style="margin-bottom:2px;">Escalas</h1>
        <p style="font-size:13px;color:var(--gray-600);margin:0;">Semana atual · ${anoMes}</p>
      </div>
    </div>
    <div class="card" style="overflow-x:auto;padding:0;">
      <table style="width:100%;border-collapse:collapse;min-width:600px;">
        <thead>
          <tr style="border-bottom:2px solid var(--gray-200);">
            <th style="padding:12px;text-align:left;font-size:12px;color:var(--gray-600);font-weight:600;min-width:140px;">Funcionário</th>
            ${cabecalho}
          </tr>
        </thead>
        <tbody>
          ${linhasFuncionarios || `<tr><td colspan="8" style="padding:16px;text-align:center;font-size:13px;color:var(--gray-600);">Nenhum funcionário cadastrado.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="metric-grid" style="margin-top:16px;">
      <div class="metric-card"><p class="label">Total na equipe</p><p class="value">${funcionarios.length}</p></div>
      <div class="metric-card"><p class="label">Trabalhando hoje</p>
        <p class="value">${funcionarios.filter(f => !f.horario?.folgas?.includes(nomesDiaFolga[hoje.getDay()])).length}</p>
      </div>
      <div class="metric-card"><p class="label">De folga hoje</p>
        <p class="value">${funcionarios.filter(f => f.horario?.folgas?.includes(nomesDiaFolga[hoje.getDay()])).length}</p>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════
// FOLHA DE PONTO
// ═══════════════════════════════════════════════
function pagePonto() {
  const funcionarios = Storage.getFuncionarios();
  const mesAtual     = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Calcula horas esperadas e extras de cada funcionário (simulação baseada no horário cadastrado)
  function calcHoras(f) {
    if (!f.horario?.entrada || !f.horario?.saida) return { esperadas: 0, trabalhadas: 0, extras: 0 };
    const [eh, em] = f.horario.entrada.split(':').map(Number);
    const [sh, sm] = f.horario.saida.split(':').map(Number);
    let hDia = (sh * 60 + sm) - (eh * 60 + em);
    if (hDia < 0) hDia += 1440; // turno da noite
    hDia = hDia / 60;

    // Dias úteis no mês (exclui folgas do funcionário)
    const hoje   = new Date();
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate();
    const nomesDia  = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
    let diasUteis   = 0;
    for (let d = 1; d <= diasNoMes; d++) {
      const diaSem = new Date(hoje.getFullYear(), hoje.getMonth(), d).getDay();
      if (!(f.horario?.folgas||[]).includes(nomesDia[diaSem])) diasUteis++;
    }
    const esperadas   = Math.round(hDia * diasUteis);
    const trabalhadas = esperadas; // sem ponto real, assume que cumpriu
    return { esperadas, trabalhadas, extras: 0 };
  }

  const linhas = funcionarios.map(f => {
    const { esperadas, trabalhadas, extras } = calcHoras(f);
    return `
      <tr style="border-bottom:1px solid var(--gray-200);">
        <td style="padding:10px 12px;">
          <p style="font-size:13px;font-weight:500;color:var(--gray-900);margin:0;">${f.nome}</p>
          <p style="font-size:11px;color:var(--gray-600);margin:0;">${f.cargo||'—'}</p>
        </td>
        <td style="padding:10px 12px;font-size:13px;color:var(--gray-600);text-align:center;">${f.horario?.turno||'—'}</td>
        <td style="padding:10px 12px;font-size:13px;color:var(--gray-600);text-align:center;">${f.horario?.entrada||'—'} – ${f.horario?.saida||'—'}</td>
        <td style="padding:10px 12px;font-size:13px;color:var(--gray-900);text-align:center;font-weight:500;">${esperadas}h</td>
        <td style="padding:10px 12px;font-size:13px;text-align:center;">
          <span style="color:${extras>0?'var(--color-success)':extras<0?'var(--color-danger)':'var(--gray-600)'};">
            ${extras > 0 ? '+' : ''}${extras}h
          </span>
        </td>
        <td style="padding:10px 12px;text-align:center;">
          <button class="btn btn-secondary" style="padding:4px 10px;font-size:12px;" onclick="gerarHolerite('${f.id}')">
            <i class="ti ti-file-text"></i> Holerite
          </button>
        </td>
      </tr>`;
  }).join('');

  const totalHoras = funcionarios.reduce((acc, f) => acc + calcHoras(f).esperadas, 0);

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-xl);">
      <div>
        <h1 class="page-title" style="margin-bottom:2px;">Folha de ponto</h1>
        <p style="font-size:13px;color:var(--gray-600);margin:0;">${mesAtual}</p>
      </div>
    </div>
    <div class="metric-grid" style="margin-bottom:16px;">
      <div class="metric-card"><p class="label">Funcionários</p><p class="value">${funcionarios.length}</p></div>
      <div class="metric-card"><p class="label">Total de horas (mês)</p><p class="value">${totalHoras}h</p></div>
      <div class="metric-card"><p class="label">Horas extras</p><p class="value">0h</p></div>
    </div>
    <div class="card" style="padding:0;overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;min-width:580px;">
        <thead>
          <tr style="border-bottom:2px solid var(--gray-200);">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--gray-600);font-weight:600;">Funcionário</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:var(--gray-600);font-weight:600;">Turno</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:var(--gray-600);font-weight:600;">Horário</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:var(--gray-600);font-weight:600;">Horas esperadas</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:var(--gray-600);font-weight:600;">Extras</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:var(--gray-600);font-weight:600;">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${linhas || `<tr><td colspan="6" style="padding:16px;text-align:center;font-size:13px;color:var(--gray-600);">Nenhum funcionário cadastrado.</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ═══════════════════════════════════════════════
// PAGAMENTOS
// ═══════════════════════════════════════════════
function pagePagamentos() {
  const empresa      = Storage.getEmpresa();
  const funcionarios = Storage.getFuncionarios();
  const hoje         = new Date();
  const mes          = hoje.getMonth();
  const ano          = hoje.getFullYear();

  const diaSal  = parseInt(empresa?.rh?.diaPagamento) || 5;
  const diaVale = parseInt(empresa?.rh?.diaVale) || 20;

  // Próximas datas
  function proximaData(dia) {
    let d = new Date(ano, mes, dia);
    if (d < hoje) d = new Date(ano, mes + 1, dia);
    return d;
  }

  function diasAte(d) {
    const diff = Math.ceil((d - hoje) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff < 0)   return 'Passou';
    return 'Em ' + diff + (diff === 1 ? ' dia' : ' dias');
  }

  const proxSal  = proximaData(diaSal);
  const proxVale = proximaData(diaVale);

  // Totais
  const totalSalarios = funcionarios.reduce((a, f) => a + (parseFloat(f.pagamento?.salario)||0), 0);
  const totalVR       = funcionarios.reduce((a, f) => a + (parseFloat(f.pagamento?.valeRefeicao)||0), 0);
  const totalVT       = funcionarios.reduce((a, f) => a + (parseFloat(f.pagamento?.valeTransporte)||0), 0);

  // Calendário do mês
  const primeiroDia   = new Date(ano, mes, 1).getDay();
  const diasNoMes     = new Date(ano, mes + 1, 0).getDate();
  const nomeMes       = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  let celulas = '';
  for (let i = 0; i < primeiroDia; i++) celulas += `<td style="padding:6px;"></td>`;
  for (let d = 1; d <= diasNoMes; d++) {
    const isHoje  = d === hoje.getDate();
    const isSal   = d === diaSal;
    const isVale  = d === diaVale;
    const destaque = isSal ? 'background:var(--cobalt-600);color:#fff;border-radius:50%;' :
                     isVale ? 'background:var(--cobalt-200);color:var(--cobalt-800);border-radius:50%;' :
                     isHoje ? 'background:var(--gray-200);border-radius:50%;' : '';
    celulas += `<td style="padding:4px;text-align:center;">
      <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:12px;${destaque}font-weight:${isHoje||isSal||isVale?'600':'400'};">
        ${d}${isSal?'<span title="Salário">💰</span>':''}
      </div>
      ${isSal ? `<div style="font-size:9px;color:var(--cobalt-600);text-align:center;margin-top:1px;">Sal.</div>` : ''}
      ${isVale ? `<div style="font-size:9px;color:var(--cobalt-400);text-align:center;margin-top:1px;">Vale</div>` : ''}
    </td>`;
  }

  // Tabela de pagamentos individuais
  const linhas = funcionarios.map(f => {
    const sal    = parseFloat(f.pagamento?.salario||0);
    const inss   = sal * 0.09;
    const irrf   = sal > 4664.68 ? sal * 0.275 : sal > 3751.05 ? sal * 0.225 : sal > 2826.65 ? sal * 0.15 : sal > 2112 ? sal * 0.075 : 0;
    const liq    = sal - inss - irrf;
    return `
      <tr style="border-bottom:1px solid var(--gray-200);">
        <td style="padding:10px 12px;">
          <p style="font-size:13px;font-weight:500;color:var(--gray-900);margin:0;">${f.nome}</p>
          <p style="font-size:11px;color:var(--gray-600);margin:0;">${f.cargo||'—'}</p>
        </td>
        <td style="padding:10px 12px;font-size:13px;color:var(--gray-600);text-align:right;">${fmtMoeda(sal)}</td>
        <td style="padding:10px 12px;font-size:13px;color:var(--color-danger);text-align:right;">- ${fmtMoeda(inss+irrf)}</td>
        <td style="padding:10px 12px;font-size:13px;color:var(--gray-600);text-align:right;">${fmtMoeda(f.pagamento?.valeRefeicao||0)}</td>
        <td style="padding:10px 12px;font-size:13px;color:var(--gray-600);text-align:right;">${fmtMoeda(f.pagamento?.valeTransporte||0)}</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:600;color:var(--cobalt-600);text-align:right;">${fmtMoeda(liq + (f.pagamento?.valeRefeicao||0) + (f.pagamento?.valeTransporte||0))}</td>
        <td style="padding:10px 12px;text-align:center;">
          <button class="btn btn-secondary" style="padding:4px 10px;font-size:12px;" onclick="gerarHolerite('${f.id}')">
            <i class="ti ti-file-text"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-xl);">
      <div>
        <h1 class="page-title" style="margin-bottom:2px;">Pagamentos</h1>
        <p style="font-size:13px;color:var(--gray-600);margin:0;">${nomeMes}</p>
      </div>
    </div>

    <div class="metric-grid" style="margin-bottom:20px;">
      <div class="metric-card"><p class="label">Total salários</p><p class="value" style="font-size:16px;">${fmtMoeda(totalSalarios)}</p></div>
      <div class="metric-card"><p class="label">Total vale refeição</p><p class="value" style="font-size:16px;">${fmtMoeda(totalVR)}</p></div>
      <div class="metric-card"><p class="label">Total vale transporte</p><p class="value" style="font-size:16px;">${fmtMoeda(totalVT)}</p></div>
      <div class="metric-card"><p class="label">Custo total mês</p><p class="value" style="font-size:16px;">${fmtMoeda(totalSalarios+totalVR+totalVT)}</p></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 260px;gap:16px;margin-bottom:20px;">

      <div class="card" style="padding:0;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:540px;">
          <thead>
            <tr style="border-bottom:2px solid var(--gray-200);">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--gray-600);font-weight:600;">Funcionário</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:var(--gray-600);font-weight:600;">Bruto</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:var(--gray-600);font-weight:600;">Descontos</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:var(--gray-600);font-weight:600;">VR</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:var(--gray-600);font-weight:600;">VT</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:var(--gray-600);font-weight:600;">Líquido</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:var(--gray-600);font-weight:600;"></th>
            </tr>
          </thead>
          <tbody>
            ${linhas || `<tr><td colspan="7" style="padding:16px;text-align:center;font-size:13px;color:var(--gray-600);">Nenhum funcionário.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="card">
        <p style="font-size:12px;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px;">${nomeMes}</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<th style="text-align:center;font-size:11px;color:var(--gray-600);padding:4px;font-weight:600;">${d}</th>`).join('')}</tr>
          </thead>
          <tbody id="cal-body">
            ${gerarCalendar(celulas)}
          </tbody>
        </table>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:20px;height:20px;border-radius:50%;background:var(--cobalt-600);flex-shrink:0;"></div>
            <div>
              <p style="font-size:12px;font-weight:500;color:var(--gray-900);margin:0;">Salário — dia ${diaSal}</p>
              <p style="font-size:11px;color:var(--gray-600);margin:0;">${diasAte(proxSal)}</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:20px;height:20px;border-radius:50%;background:var(--cobalt-200);flex-shrink:0;"></div>
            <div>
              <p style="font-size:12px;font-weight:500;color:var(--gray-900);margin:0;">Vale — dia ${diaVale||'—'}</p>
              <p style="font-size:11px;color:var(--gray-600);margin:0;">${diaVale ? diasAte(proxVale) : 'Não configurado'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function gerarCalendar(celulas) {
  const tds = celulas.match(/<td[\s\S]*?<\/td>/g) || [];
  let html = '';
  for (let i = 0; i < tds.length; i++) {
    if (i % 7 === 0) html += '<tr>';
    html += tds[i];
    if (i % 7 === 6 || i === tds.length - 1) html += '</tr>';
  }
  return html;
}