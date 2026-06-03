const pages = {
  dashboard:    pageDashboard,
  funcionarios: pageFuncionarios,
  escala:       pageEscala,
  ponto:        pagePonto,
  pagamentos:   pagePagamentos,
};

function navigateTo(k){
  document.querySelectorAll('.menu-item').forEach(i=>i.classList.toggle('active',i.dataset.page===k));
  const el=document.getElementById('content'); if(!el) return;
  if(pages[k]) el.innerHTML=pages[k]();
}
document.querySelectorAll('.menu-item').forEach(i=>i.addEventListener('click',()=>navigateTo(i.dataset.page)));

// ── HELPERS ──
const fmtR=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtD=iso=>{ if(!iso)return'—'; const[y,m,d]=iso.split('-'); return d+'/'+m+'/'+y; };
const ini=nome=>(nome||'').split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
const av=(nome,sz=36)=>`<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:var(--cobalt-50);color:var(--cobalt-600);font-size:${sz<40?12:14}px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ini(nome)}</div>`;

function calcINSS(sal){
  let inss=0,b=sal,ant=0;
  for(const f of [{ate:1412,a:.075},{ate:2666.68,a:.09},{ate:4000.03,a:.12},{ate:7786.02,a:.14}]){
    if(b<=0)break; const faixa=Math.min(b,f.ate-ant); inss+=faixa*f.a; ant=f.ate; b-=faixa;
  }
  return Math.min(inss,sal*.14);
}
function calcIRRF(bc){
  if(bc>4664.68) return Math.max(0,bc*.275-869.36);
  if(bc>3751.05) return Math.max(0,bc*.225-636.13);
  if(bc>2826.65) return Math.max(0,bc*.15-354.80);
  if(bc>2112)    return Math.max(0,bc*.075-158.40);
  return 0;
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
function pageDashboard(){
  const emp=Storage.getEmpresa(),fs=Storage.getFuncionarios(),hj=new Date();
  const dns=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const dh=dns[hj.getDay()], df=fs.filter(f=>f.horario?.folgas?.includes(dh)).length;
  const hjs=hj.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  const dp=emp?.rh?.diaPagamento; let pp='—';
  if(dp&&dp!=='ultimo'){ const d=parseInt(dp); let dt=new Date(hj.getFullYear(),hj.getMonth(),d); if(dt<=hj)dt=new Date(hj.getFullYear(),hj.getMonth()+1,d); const di=Math.ceil((dt-hj)/86400000); pp=di+(di===1?' dia':' dias'); }
  const linhas=fs.map(f=>`
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-200);">
      ${av(f.nome)}<div style="flex:1;"><p style="font-size:13px;font-weight:500;color:var(--gray-900);margin:0;">${f.nome}</p>
      <p style="font-size:12px;color:var(--gray-600);margin:0;">${f.cargo||'—'} · ${f.departamento||'—'}</p></div>
      <span style="font-size:12px;color:var(--gray-600);">${f.horario?.entrada||'—'} – ${f.horario?.saida||'—'}</span>
    </div>`).join('');
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-xl);">
      <div><h1 class="page-title" style="margin-bottom:2px;">${emp?.nomeFantasia||emp?.razaoSocial||'Dashboard'}</h1>
      <p style="font-size:13px;color:var(--gray-600);margin:0;">${hjs}</p></div>
      <button class="btn btn-primary" onclick="abrirModal()"><i class="ti ti-plus"></i> Novo funcionário</button>
    </div>
    <div class="metric-grid">
      <div class="metric-card"><p class="label">Funcionários</p><p class="value">${fs.length}</p></div>
      <div class="metric-card"><p class="label">De folga hoje</p><p class="value">${df}</p></div>
      <div class="metric-card"><p class="label">Trabalhando hoje</p><p class="value">${fs.length-df}</p></div>
      <div class="metric-card"><p class="label">Próximo pagamento</p><p class="value">${pp}</p></div>
    </div>
    <div class="card"><p style="font-size:13px;font-weight:600;color:var(--gray-900);margin-bottom:12px;">Equipe cadastrada</p>
    ${linhas||'<p style="font-size:13px;color:var(--gray-600);">Nenhum funcionário.</p>'}</div>
    ${tplModal()}`;
}

// ═══════════════════════════════════════════
// FUNCIONÁRIOS
// ═══════════════════════════════════════════
function pageFuncionarios(){
  const lista=Storage.getFuncionarios();
  const cards=lista.map(f=>`
    <div class="card" style="display:flex;align-items:flex-start;gap:16px;">
      ${av(f.nome,44)}
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <p style="font-size:14px;font-weight:600;color:var(--gray-900);margin:0;">${f.nome}</p>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-secondary" style="padding:5px 10px;font-size:12px;" onclick="verFicha('${f.id}')"><i class="ti ti-eye"></i> Ver</button>
            <button class="btn btn-secondary" style="padding:5px 10px;font-size:12px;" onclick="abrirModal('${f.id}')"><i class="ti ti-edit"></i> Editar</button>
            <button class="btn btn-secondary" style="padding:5px 10px;font-size:12px;color:var(--color-danger);" onclick="excluirFunc('${f.id}','${f.nome.replace(/'/g,"\\'")}')"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        <p style="font-size:13px;color:var(--gray-600);margin:4px 0 8px;">${f.cargo||'—'} · ${f.departamento||'—'} · ${(f.tipoContrato||'').toUpperCase()||'—'}</p>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <span style="font-size:12px;color:var(--gray-600);"><i class="ti ti-mail" style="vertical-align:-2px;margin-right:4px;"></i>${f.contato?.email||'—'}</span>
          <span style="font-size:12px;color:var(--gray-600);"><i class="ti ti-calendar" style="vertical-align:-2px;margin-right:4px;"></i>Admissão: ${fmtD(f.admissao)}</span>
          <span style="font-size:12px;color:var(--cobalt-600);font-weight:500;">${fmtR(f.pagamento?.salario)}</span>
        </div>
      </div>
    </div>`).join('');
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-xl);">
      <h1 class="page-title" style="margin:0;">Funcionários</h1>
      <button class="btn btn-primary" onclick="abrirModal()"><i class="ti ti-plus"></i> Novo funcionário</button>
    </div>
    ${lista.length?`<div style="display:flex;flex-direction:column;gap:12px;">${cards}</div>`:'<div class="card"><p style="font-size:13px;color:var(--gray-600);">Nenhum funcionário cadastrado.</p></div>'}
    <div id="ficha-root"></div>
    ${tplModal()}`;
}

// ── FICHA LATERAL ──
function verFicha(id){
  const f=Storage.getFuncionarioById(id); if(!f) return;
  const folgas=(f.horario?.folgas||[]).map(d=>({segunda:'Segunda',terca:'Terça',quarta:'Quarta',quinta:'Quinta',sexta:'Sexta',sabado:'Sábado',domingo:'Domingo'}[d]||d)).join(', ')||'—';
  const el=document.getElementById('ficha-root'); if(!el) return;
  el.innerHTML=`
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:200;display:flex;align-items:flex-start;justify-content:flex-end;" onclick="if(event.target===this)fecharFicha()">
      <div style="width:420px;height:100vh;overflow-y:auto;background:var(--color-content-bg,var(--white));padding:24px;box-shadow:-4px 0 24px rgba(0,0,0,0.1);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <p style="font-size:15px;font-weight:600;color:var(--gray-900);margin:0;">Ficha do funcionário</p>
          <button class="btn btn-secondary" style="padding:5px 10px;" onclick="fecharFicha()"><i class="ti ti-x"></i></button>
        </div>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--gray-200);">
          ${av(f.nome,52)}
          <div><p style="font-size:15px;font-weight:600;color:var(--gray-900);margin:0;">${f.nome}</p>
          <p style="font-size:13px;color:var(--gray-600);margin:2px 0 0;">${f.cargo||'—'} · ${f.departamento||'—'}</p></div>
        </div>
        ${s('Dados pessoais',[['CPF',f.cpf],['RG',f.rg],['Nascimento',fmtD(f.nascimento)],['E-mail',f.contato?.email],['Celular',f.contato?.celular]])}
        ${s('Contrato',[['Tipo',(f.tipoContrato||'').toUpperCase()],['Admissão',fmtD(f.admissao)]])}
        ${s('Pagamento',[['Salário',fmtR(f.pagamento?.salario)],['Vale refeição',fmtR(f.pagamento?.valeRefeicao)],['Vale transporte',fmtR(f.pagamento?.valeTransporte)],['Banco',f.pagamento?.banco],['Agência',f.pagamento?.agencia],['Conta',f.pagamento?.conta]])}
        ${s('Horários',[['Turno',f.horario?.turno],['Entrada',f.horario?.entrada],['Saída',f.horario?.saida],['Folgas',folgas]])}
        <div style="margin-top:20px;display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-primary" style="width:100%;" onclick="gerarHolerite('${f.id}')"><i class="ti ti-file-text"></i> Visualizar holerite</button>
          <button class="btn btn-secondary" style="width:100%;" onclick="abrirEnvioHolerite('${f.id}')"><i class="ti ti-mail"></i> Enviar holerite por e-mail</button>
          <button class="btn btn-secondary" style="width:100%;" onclick="enviarEmailAvulso('${f.id}')"><i class="ti ti-send"></i> Enviar comunicado</button>
        </div>
      </div>
    </div>
    <div id="modal-holerite-email"></div>`;
}
function s(t,cs){
  return `<div style="margin-bottom:16px;"><p style="font-size:11px;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">${t}</p>
  ${cs.map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gray-200);"><span style="font-size:12px;color:var(--gray-600);">${l}</span><span style="font-size:12px;font-weight:500;color:var(--gray-900);text-align:right;max-width:60%;">${v||'—'}</span></div>`).join('')}</div>`;
}
function fecharFicha(){ const e=document.getElementById('ficha-root'); if(e)e.innerHTML=''; }

// ── ENVIO DE HOLERITE POR E-MAIL ──
function abrirEnvioHolerite(id){
  const f=Storage.getFuncionarioById(id); if(!f) return;
  const el=document.getElementById('modal-holerite-email'); if(!el) return;
  const mesAno=new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const email=f.contato?.email||'';
  el.innerHTML=`
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:var(--color-content-bg,var(--white));border-radius:var(--radius-lg);padding:28px;width:100%;max-width:460px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <p style="font-size:15px;font-weight:600;color:var(--gray-900);margin:0;">Enviar holerite por e-mail</p>
          <button class="btn btn-secondary" style="padding:5px 10px;" onclick="document.getElementById('modal-holerite-email').innerHTML=''"><i class="ti ti-x"></i></button>
        </div>
        <div style="background:var(--cobalt-50);border-radius:var(--radius-md);padding:12px;margin-bottom:16px;">
          <p style="font-size:13px;font-weight:500;color:var(--cobalt-600);margin:0 0 2px;">${f.nome}</p>
          <p style="font-size:12px;color:var(--gray-600);margin:0;">Competência: ${mesAno}</p>
        </div>
        <div class="form-field" style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:600;color:var(--gray-900);display:block;margin-bottom:4px;">Para (e-mail do funcionário)</label>
          <input id="he-para" type="email" value="${email}" placeholder="email@exemplo.com"
            style="width:100%;height:38px;padding:0 12px;border:1px solid var(--gray-200);border-radius:var(--radius-md);font-size:13px;outline:none;background:var(--color-content-bg,var(--white));color:var(--gray-900);"/>
        </div>
        <div class="form-field" style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:600;color:var(--gray-900);display:block;margin-bottom:4px;">Assunto</label>
          <input id="he-assunto" type="text" value="Holerite — ${mesAno}"
            style="width:100%;height:38px;padding:0 12px;border:1px solid var(--gray-200);border-radius:var(--radius-md);font-size:13px;outline:none;background:var(--color-content-bg,var(--white));color:var(--gray-900);"/>
        </div>
        <div class="form-field" style="margin-bottom:16px;">
          <label style="font-size:12px;font-weight:600;color:var(--gray-900);display:block;margin-bottom:4px;">Mensagem</label>
          <textarea id="he-corpo" rows="4"
            style="width:100%;padding:10px 12px;border:1px solid var(--gray-200);border-radius:var(--radius-md);font-size:13px;outline:none;resize:vertical;font-family:inherit;background:var(--color-content-bg,var(--white));color:var(--gray-900);">Olá ${f.nome.split(' ')[0]},

Segue em anexo o seu holerite referente à competência ${mesAno}.

Atenciosamente,
Departamento de RH</textarea>
        </div>
        <div style="background:#FFF9E6;border:1px solid #F5D76E;border-radius:var(--radius-md);padding:10px 12px;margin-bottom:16px;font-size:12px;color:#7A6600;">
          <i class="ti ti-info-circle" style="vertical-align:-2px;margin-right:4px;"></i>
          O holerite será aberto em uma nova aba para você salvar como PDF e anexar manualmente ao e-mail.
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById('modal-holerite-email').innerHTML=''">Cancelar</button>
          <button class="btn btn-primary" style="flex:1;" onclick="confirmarEnvioHolerite('${id}')">
            <i class="ti ti-mail"></i> Abrir e-mail
          </button>
        </div>
      </div>
    </div>`;
}

function confirmarEnvioHolerite(id){
  const para=document.getElementById('he-para')?.value.trim();
  const assunto=document.getElementById('he-assunto')?.value.trim();
  const corpo=document.getElementById('he-corpo')?.value.trim();
  if(!para){ alert('Informe o e-mail do destinatário.'); return; }
  // Abre o holerite para salvar como PDF
  gerarHolerite(id);
  // Abre o cliente de e-mail
  setTimeout(()=>{
    window.location.href='mailto:'+para+'?subject='+encodeURIComponent(assunto)+'&body='+encodeURIComponent(corpo+'\n\n[Anexe o PDF do holerite gerado na aba anterior]');
  }, 800);
  document.getElementById('modal-holerite-email').innerHTML='';
}

function enviarEmailAvulso(id){
  const f=Storage.getFuncionarioById(id); if(!f) return;
  const email=f.contato?.email;
  if(!email){ alert('Este funcionário não tem e-mail cadastrado.'); return; }
  window.location.href='mailto:'+email+'?subject='+encodeURIComponent('Comunicado — RH')+'&body='+encodeURIComponent('Olá '+f.nome.split(' ')[0]+',\n\n');
}

// ── MODAL NOVO / EDITAR ──
function tplModal(){
  const dep=['Recursos Humanos','Tecnologia','Financeiro','Comercial','Operações','Marketing','Diretoria'];
  const bancos=[['001','Banco do Brasil'],['033','Santander'],['104','Caixa Econômica'],['237','Bradesco'],['341','Itaú'],['260','Nubank'],['077','Inter'],['290','PagBank']];
  return `
  <div id="modal-func" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:300;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;">
    <div style="background:var(--color-content-bg,var(--white));border-radius:var(--radius-lg);padding:28px;width:100%;max-width:580px;margin:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <p id="modal-titulo" style="font-size:15px;font-weight:600;color:var(--gray-900);margin:0;">Novo funcionário</p>
        <button class="btn btn-secondary" style="padding:5px 10px;" onclick="fecharModal()"><i class="ti ti-x"></i></button>
      </div>

      <p style="font-size:11px;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">Dados pessoais</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div class="form-field" style="grid-column:span 2;"><label>Nome completo *</label><input id="mf-nome" type="text" placeholder="Nome completo"/></div>
        <div class="form-field"><label>CPF</label><input id="mf-cpf" type="text" placeholder="000.000.000-00" maxlength="14"/></div>
        <div class="form-field"><label>E-mail *</label><input id="mf-email" type="email" placeholder="email@empresa.com"/></div>
        <div class="form-field"><label>Celular</label><input id="mf-celular" type="text" placeholder="(11) 90000-0000" maxlength="15"/></div>
        <div class="form-field"><label>Nascimento</label><input id="mf-nasc" type="date"/></div>
      </div>

      <p style="font-size:11px;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">Cargo e contrato</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div class="form-field"><label>Cargo *</label><input id="mf-cargo" type="text" placeholder="Ex: Analista"/></div>
        <div class="form-field"><label>Departamento</label>
          <select id="mf-depto"><option value="">Selecione...</option>${dep.map(d=>`<option>${d}</option>`).join('')}</select>
        </div>
        <div class="form-field"><label>Tipo de contrato</label>
          <select id="mf-contrato"><option value="clt">CLT</option><option value="pj">PJ</option><option value="estagio">Estágio</option><option value="temporario">Temporário</option></select>
        </div>
        <div class="form-field"><label>Admissão</label><input id="mf-admissao" type="date"/></div>
      </div>

      <p style="font-size:11px;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">Pagamento</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
        <div class="form-field"><label>Salário (R$) *</label><input id="mf-sal" type="number" min="0" step="0.01" placeholder="0,00"/></div>
        <div class="form-field"><label>Vale refeição</label><input id="mf-vr" type="number" min="0" step="0.01" placeholder="0,00"/></div>
        <div class="form-field"><label>Vale transporte</label><input id="mf-vt" type="number" min="0" step="0.01" placeholder="0,00"/></div>
        <div class="form-field"><label>Banco</label>
          <select id="mf-banco"><option value="">Selecione...</option>${bancos.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
        </div>
        <div class="form-field"><label>Agência</label><input id="mf-agencia" type="text" placeholder="0000"/></div>
        <div class="form-field"><label>Conta</label><input id="mf-conta" type="text" placeholder="00000-0"/></div>
      </div>

      <p style="font-size:11px;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">Horários</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
        <div class="form-field"><label>Turno</label>
          <select id="mf-turno" onchange="mfTurno(this.value)">
            <option value="integral">Integral</option><option value="manha">Manhã</option>
            <option value="tarde">Tarde</option><option value="noite">Noite</option><option value="personalizado">Personalizado</option>
          </select>
        </div>
        <div class="form-field"><label>Entrada</label><input id="mf-entrada" type="time" value="08:00"/></div>
        <div class="form-field"><label>Saída</label><input id="mf-saida" type="time" value="17:00"/></div>
      </div>
      <div class="form-field" style="margin-bottom:4px;"><label>Dias de folga</label>
        <div class="check-group">
          ${['segunda','terca','quarta','quinta','sexta','sabado','domingo'].map(d=>`
            <label class="check-item"><input type="checkbox" name="mf-folga" value="${d}" ${['sabado','domingo'].includes(d)?'checked':''}/> ${{segunda:'Seg',terca:'Ter',quarta:'Qua',quinta:'Qui',sexta:'Sex',sabado:'Sáb',domingo:'Dom'}[d]}</label>`).join('')}
        </div>
      </div>

      <input type="hidden" id="mf-id"/>
      <div style="display:flex;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid var(--gray-200);">
        <button class="btn btn-secondary" style="flex:1;" onclick="fecharModal()">Cancelar</button>
        <button class="btn btn-primary" style="flex:1;" onclick="salvarModal()"><i class="ti ti-check"></i> Salvar</button>
      </div>
    </div>
  </div>`;
}

function mfTurno(v){
  const h={integral:{e:'08:00',s:'18:00'},manha:{e:'06:00',s:'14:00'},tarde:{e:'14:00',s:'22:00'},noite:{e:'22:00',s:'06:00'},personalizado:{e:'',s:''}};
  if(h[v]){document.getElementById('mf-entrada').value=h[v].e;document.getElementById('mf-saida').value=h[v].s;}
}

function abrirModal(id){
  const modal=document.getElementById('modal-func');
  if(!modal){navigateTo('funcionarios');setTimeout(()=>abrirModal(id),150);return;}
  const campos=['nome','cpf','email','celular','cargo','admissao','sal','vr','vt','agencia','conta'];
  campos.forEach(c=>{const e=document.getElementById('mf-'+c);if(e)e.value='';});
  ['depto','contrato','banco','turno'].forEach(c=>{const e=document.getElementById('mf-'+c);if(e)e.value=c==='contrato'?'clt':c==='turno'?'integral':'';});
  const ne=document.getElementById('mf-nasc');if(ne)ne.value='';
  document.getElementById('mf-entrada').value='08:00';
  document.getElementById('mf-saida').value='17:00';
  document.querySelectorAll('[name="mf-folga"]').forEach(cb=>cb.checked=['sabado','domingo'].includes(cb.value));
  document.getElementById('mf-id').value='';
  document.getElementById('modal-titulo').textContent='Novo funcionário';

  if(id){
    const f=Storage.getFuncionarioById(id);if(!f)return;
    const set=(k,v)=>{const e=document.getElementById('mf-'+k);if(e)e.value=v||'';};
    set('id',f.id);set('nome',f.nome);set('cpf',f.cpf);
    set('email',f.contato?.email);set('celular',f.contato?.celular);
    set('nasc',f.nascimento);set('cargo',f.cargo);
    set('depto',f.departamento);set('contrato',f.tipoContrato||'clt');
    set('admissao',f.admissao);set('sal',f.pagamento?.salario);
    set('vr',f.pagamento?.valeRefeicao);set('vt',f.pagamento?.valeTransporte);
    set('banco',f.pagamento?.banco);set('agencia',f.pagamento?.agencia);
    set('conta',f.pagamento?.conta);set('turno',f.horario?.turno||'integral');
    set('entrada',f.horario?.entrada||'08:00');set('saida',f.horario?.saida||'17:00');
    document.querySelectorAll('[name="mf-folga"]').forEach(cb=>cb.checked=(f.horario?.folgas||[]).includes(cb.value));
    document.getElementById('modal-titulo').textContent='Editar funcionário';
  }
  modal.style.display='flex';
}

function fecharModal(){const m=document.getElementById('modal-func');if(m)m.style.display='none';}

function salvarModal(){
  const g=id=>document.getElementById(id)?.value.trim();
  const nome=g('mf-nome'),email=g('mf-email'),cargo=g('mf-cargo'),sal=g('mf-sal');
  if(!nome||!email||!cargo||!sal){alert('Preencha nome, e-mail, cargo e salário.');return;}
  const idE=g('mf-id');
  const folgas=Array.from(document.querySelectorAll('[name="mf-folga"]:checked')).map(c=>c.value);
  Storage.saveFuncionario({
    id:idE||Storage.gerarId(),nome,
    cpf:g('mf-cpf'),nascimento:document.getElementById('mf-nasc').value,
    contato:{email,celular:g('mf-celular')},
    cargo,departamento:g('mf-depto'),
    tipoContrato:document.getElementById('mf-contrato').value,
    admissao:document.getElementById('mf-admissao').value,
    pagamento:{salario:parseFloat(sal)||0,valeRefeicao:parseFloat(g('mf-vr'))||0,valeTransporte:parseFloat(g('mf-vt'))||0,banco:g('mf-banco'),agencia:g('mf-agencia'),conta:g('mf-conta')},
    horario:{turno:document.getElementById('mf-turno').value,entrada:document.getElementById('mf-entrada').value,saida:document.getElementById('mf-saida').value,folgas},
    criadoEm:idE?Storage.getFuncionarioById(idE)?.criadoEm:new Date().toISOString(),
  });
  fecharModal();navigateTo('funcionarios');
}

function excluirFunc(id,nome){
  if(!confirm('Excluir '+nome+'? Esta ação não pode ser desfeita.'))return;
  Storage.deleteFuncionario(id);navigateTo('funcionarios');
}

// ── HOLERITE PADRÃO SP ──
function gerarHolerite(id){
  const f=Storage.getFuncionarioById(id),emp=Storage.getEmpresa();if(!f)return;
  const sal=parseFloat(f.pagamento?.salario||0),vr=parseFloat(f.pagamento?.valeRefeicao||0),vt=parseFloat(f.pagamento?.valeTransporte||0);
  const inss=calcINSS(sal),irrf=calcIRRF(sal-inss),fgts=sal*.08;
  const liq=sal-inss-irrf+vr+vt;
  const hj=new Date(),mesAno=hj.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const diasMes=new Date(hj.getFullYear(),hj.getMonth()+1,0).getDate();
  let hMes=220;
  if(f.horario?.entrada&&f.horario?.saida){
    const[eh,em]=f.horario.entrada.split(':').map(Number),[sh,sm]=f.horario.saida.split(':').map(Number);
    let hd=((sh*60+sm)-(eh*60+em))/60;if(hd<0)hd+=24;
    const nd=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
    let dc=0;for(let d=1;d<=diasMes;d++){const ds=new Date(hj.getFullYear(),hj.getMonth(),d).getDay();if(!(f.horario?.folgas||[]).includes(nd[ds]))dc++;}
    hMes=Math.round(hd*dc);
  }
  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Holerite — ${f.nome}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000;padding:20px;max-width:740px;margin:0 auto;}.topo{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;}.topo-e{padding:8px 10px;border-right:1px solid #000;}.topo-d{padding:8px 10px;}h1{font-size:13px;font-weight:bold;text-align:center;padding:5px;background:#f0f0f0;border:1px solid #000;border-top:none;letter-spacing:.5px;}.g2{display:grid;grid-template-columns:1fr 1fr;border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;}.c{padding:4px 8px;border-right:1px solid #000;border-bottom:1px solid #ccc;}.c:nth-child(even){border-right:none;}.c label{display:block;font-size:9px;color:#555;text-transform:uppercase;margin-bottom:1px;}.c span{font-size:11px;font-weight:bold;}table{width:100%;border-collapse:collapse;border:1px solid #000;border-top:none;}th{background:#d0d0d0;font-size:10px;padding:5px 6px;border:1px solid #000;text-align:left;}th.r,td.r{text-align:right;}td{font-size:11px;padding:4px 6px;border-bottom:1px solid #ccc;border-left:1px solid #ddd;}tr:last-child td{border-bottom:none;}.sh{background:#e8e8e8;font-size:10px;font-weight:bold;padding:3px 6px;border-bottom:1px solid #000;border-top:1px solid #000;letter-spacing:.3px;}.tots{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #000;border-top:none;}.tc{padding:8px;border-right:1px solid #000;text-align:center;}.tc:last-child{border-right:none;}.tc label{font-size:9px;text-transform:uppercase;color:#555;display:block;margin-bottom:2px;}.tc span{font-size:13px;font-weight:bold;}.rod{margin-top:12px;border:1px solid #000;display:grid;grid-template-columns:1fr 1fr;}.as{padding:30px 16px 8px;border-right:1px solid #000;font-size:10px;text-align:center;}.as:last-child{border-right:none;}.obs{font-size:9px;color:#555;margin-top:10px;text-align:center;}@media print{button{display:none!important;}}</style></head><body>
  <div style="margin-bottom:10px;display:flex;gap:8px;"><button onclick="window.print()" style="background:#2347C5;color:#fff;border:none;padding:7px 18px;border-radius:5px;cursor:pointer;font-size:12px;">🖨️ Imprimir / Salvar PDF</button><button onclick="window.close()" style="background:#f0f0f0;border:1px solid #ccc;padding:7px 18px;border-radius:5px;cursor:pointer;font-size:12px;">Fechar</button></div>
  <div class="topo"><div class="topo-e"><p style="font-size:13px;font-weight:bold;">${emp?.razaoSocial||'Empresa'}</p><p style="font-size:10px;color:#555;">CNPJ: ${emp?.cnpj||'—'}</p><p style="font-size:10px;color:#555;">${emp?.endereco?.logradouro||''} ${emp?.endereco?.numero||''}, ${emp?.endereco?.bairro||''}</p><p style="font-size:10px;color:#555;">${emp?.endereco?.cidade||''}${emp?.endereco?.estado?' - '+emp.endereco.estado:''} · CEP: ${emp?.endereco?.cep||'—'}</p></div><div class="topo-d"><p style="font-size:11px;font-weight:bold;text-align:right;">RECIBO DE PAGAMENTO DE SALÁRIO</p><p style="font-size:10px;text-align:right;color:#555;">Competência: ${mesAno}</p><p style="font-size:10px;text-align:right;color:#555;">Referência: ${diasMes} dias / ${hMes}h</p></div></div>
  <h1>DADOS DO EMPREGADO</h1>
  <div class="g2"><div class="c"><label>Nome completo</label><span>${f.nome}</span></div><div class="c"><label>CPF</label><span>${f.cpf||'—'}</span></div><div class="c"><label>Cargo / Função</label><span>${f.cargo||'—'}</span></div><div class="c"><label>Departamento</label><span>${f.departamento||'—'}</span></div><div class="c"><label>Data de admissão</label><span>${fmtD(f.admissao)}</span></div><div class="c"><label>Tipo de contrato</label><span>${(f.tipoContrato||'').toUpperCase()}</span></div><div class="c"><label>Banco / Agência / Conta</label><span>${f.pagamento?.banco||'—'} / ${f.pagamento?.agencia||'—'} / ${f.pagamento?.conta||'—'}</span></div><div class="c"><label>Horário</label><span>${f.horario?.entrada||'—'} às ${f.horario?.saida||'—'} (${f.horario?.turno||'—'})</span></div></div>
  <table><thead><tr><th style="width:40px;">Cód.</th><th>Descrição</th><th style="width:60px;" class="r">Ref.</th><th style="width:100px;" class="r">Vencimentos</th><th style="width:100px;" class="r">Descontos</th></tr></thead><tbody>
  <tr><td colspan="5" class="sh">VENCIMENTOS</td></tr>
  <tr><td>001</td><td>Salário mensal</td><td class="r">${hMes}h</td><td class="r">${fmtR(sal)}</td><td></td></tr>
  ${vr>0?`<tr><td>010</td><td>Vale refeição</td><td class="r">—</td><td class="r">${fmtR(vr)}</td><td></td></tr>`:''}
  ${vt>0?`<tr><td>011</td><td>Vale transporte</td><td class="r">—</td><td class="r">${fmtR(vt)}</td><td></td></tr>`:''}
  <tr><td colspan="5" class="sh">DESCONTOS</td></tr>
  <tr><td>050</td><td>INSS — Previdência Social (tabela progressiva 2024)</td><td class="r">—</td><td></td><td class="r">${fmtR(inss)}</td></tr>
  <tr><td>060</td><td>IRRF — Imposto de Renda Retido na Fonte</td><td class="r">—</td><td></td><td class="r">${fmtR(irrf)}</td></tr>
  <tr><td colspan="5" class="sh">INFORMATIVO (não incide no líquido)</td></tr>
  <tr><td>070</td><td>FGTS (8%) — depósito pelo empregador</td><td class="r">8%</td><td class="r">${fmtR(fgts)}</td><td></td></tr>
  </tbody></table>
  <div class="tots"><div class="tc"><label>Total de vencimentos</label><span>${fmtR(sal+vr+vt)}</span></div><div class="tc"><label>Total de descontos</label><span style="color:#c00;">${fmtR(inss+irrf)}</span></div><div class="tc"><label>Salário líquido a receber</label><span style="color:#00600f;">${fmtR(liq)}</span></div></div>
  <div class="rod"><div class="as">_________________________________<br>${emp?.razaoSocial||'Empresa'}<br><span style="font-size:9px;">Empregador</span></div><div class="as">_________________________________<br>${f.nome}<br><span style="font-size:9px;">Empregado — Assinatura</span></div></div>
  <p class="obs">Gerado em ${new Date().toLocaleString('pt-BR')} · RH Gestão · Conforme CLT / Lei nº 5.452/43</p>
  </body></html>`);
  win.document.close();
}

// ═══════════════════════════════════════════
// ESCALA — calendário mensal com nome e folga
// ═══════════════════════════════════════════
function pageEscala(){
  const fs=Storage.getFuncionarios(),hj=new Date();
  const ano=hj.getFullYear(),mes=hj.getMonth();
  const nm=hj.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const dnf=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const dna=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  function buildCal(f){
    if(!f) return '<p style="font-size:13px;color:var(--gray-600);">Nenhum funcionário.</p>';
    const dim=new Date(ano,mes+1,0).getDate(), pd=new Date(ano,mes,1).getDay();
    let cells='';
    for(let i=0;i<pd;i++) cells+=`<td style="background:var(--gray-100);border-radius:6px;"></td>`;
    for(let d=1;d<=dim;d++){
      const ds=new Date(ano,mes,d).getDay(),dk=dnf[ds];
      const folga=(f.horario?.folgas||[]).includes(dk),isH=d===hj.getDate();
      const bg=isH?'background:var(--cobalt-50);':'background:var(--color-content-bg,var(--white));';
      const bo=isH?'border:2px solid var(--cobalt-400);':'border:1px solid var(--gray-200);';
      if(folga){
        cells+=`<td style="${bg}${bo}border-radius:6px;padding:4px;text-align:center;vertical-align:top;">
          <p style="font-size:12px;font-weight:600;color:${isH?'var(--cobalt-600)':'var(--gray-400)'};margin:0;">${d}</p>
          <p style="font-size:9px;color:var(--gray-400);margin:1px 0 0;line-height:1.2;">${f.nome.split(' ')[0]}</p>
          <p style="font-size:9px;color:var(--gray-300,#CCC);background:#f3f3f3;border-radius:3px;padding:1px 3px;margin:2px auto 0;display:inline-block;">Folga</p>
        </td>`;
      } else {
        cells+=`<td style="${bg}${bo}border-radius:6px;padding:4px;text-align:center;vertical-align:top;">
          <p style="font-size:12px;font-weight:600;color:${isH?'var(--cobalt-600)':'var(--gray-900)'};margin:0;">${d}</p>
          <p style="font-size:9px;color:var(--gray-600);margin:1px 0 0;line-height:1.2;">${f.nome.split(' ')[0]}</p>
          <p style="font-size:10px;color:var(--cobalt-600);font-weight:500;margin:2px 0 0;">${f.horario?.entrada||'—'}</p>
          <p style="font-size:9px;color:var(--gray-400);margin:0;">${f.horario?.saida||'—'}</p>
        </td>`;
      }
    }
    const tot=pd+dim, rest=(7-(tot%7))%7;
    for(let i=0;i<rest;i++) cells+=`<td style="background:var(--gray-100);border-radius:6px;"></td>`;
    const tds=cells.match(/<td[\s\S]*?<\/td>/g)||[];
    let rows='';for(let i=0;i<tds.length;i+=7)rows+='<tr style="height:72px;">'+tds.slice(i,i+7).join('')+'</tr>';

    let dtrab=0,dfolga=0;
    for(let d=1;d<=dim;d++){const ds=new Date(ano,mes,d).getDay();(f.horario?.folgas||[]).includes(dnf[ds])?dfolga++:dtrab++;}
    let hd=0;
    if(f.horario?.entrada&&f.horario?.saida){const[eh,em]=f.horario.entrada.split(':').map(Number),[sh,sm]=f.horario.saida.split(':').map(Number);hd=((sh*60+sm)-(eh*60+em))/60;if(hd<0)hd+=24;}
    const hm=Math.round(hd*dtrab);

    return `
      <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
        <div class="metric-card" style="flex:1;min-width:90px;"><p class="label">Dias trabalhados</p><p class="value">${dtrab}</p></div>
        <div class="metric-card" style="flex:1;min-width:90px;"><p class="label">Dias de folga</p><p class="value">${dfolga}</p></div>
        <div class="metric-card" style="flex:1;min-width:90px;"><p class="label">Horas no mês</p><p class="value">${hm}h</p></div>
        <div class="metric-card" style="flex:1;min-width:90px;"><p class="label">Turno</p><p class="value" style="font-size:14px;">${f.horario?.turno||'—'}</p></div>
      </div>
      <div class="card" style="padding:12px;overflow-x:auto;">
        <table style="width:100%;border-collapse:separate;border-spacing:3px;min-width:500px;">
          <thead><tr>${dna.map(n=>`<th style="text-align:center;font-size:11px;color:var(--gray-600);font-weight:600;padding:4px;">${n}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  const opts=fs.map((f,i)=>`<option value="${i}">${f.nome}</option>`).join('');
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-xl);">
      <div><h1 class="page-title" style="margin-bottom:2px;">Escalas</h1><p style="font-size:13px;color:var(--gray-600);margin:0;">${nm}</p></div>
      ${fs.length?`<select id="sel-esc" onchange="reEscala(this.value)" style="height:36px;padding:0 12px;border:1px solid var(--gray-200);border-radius:var(--radius-md);font-size:13px;color:var(--gray-900);background:var(--color-content-bg,var(--white));outline:none;">${opts}</select>`:''}
    </div>
    <div id="esc-corpo">${fs.length?buildCal(fs[0]):'<div class="card"><p style="font-size:13px;color:var(--gray-600);">Nenhum funcionário cadastrado.</p></div>'}</div>`;
}

function reEscala(idx){
  const fs=Storage.getFuncionarios(),f=fs[parseInt(idx)],hj=new Date();
  const ano=hj.getFullYear(),mes=hj.getMonth();
  const dnf=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const dna=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  if(!f)return;
  const dim=new Date(ano,mes+1,0).getDate(),pd=new Date(ano,mes,1).getDay();
  let cells='';
  for(let i=0;i<pd;i++) cells+=`<td style="background:var(--gray-100);border-radius:6px;"></td>`;
  for(let d=1;d<=dim;d++){
    const ds=new Date(ano,mes,d).getDay(),dk=dnf[ds];
    const folga=(f.horario?.folgas||[]).includes(dk),isH=d===hj.getDate();
    const bg=isH?'background:var(--cobalt-50);':'background:var(--color-content-bg,var(--white));';
    const bo=isH?'border:2px solid var(--cobalt-400);':'border:1px solid var(--gray-200);';
    if(folga){
      cells+=`<td style="${bg}${bo}border-radius:6px;padding:4px;text-align:center;vertical-align:top;"><p style="font-size:12px;font-weight:600;color:${isH?'var(--cobalt-600)':'var(--gray-400)'};margin:0;">${d}</p><p style="font-size:9px;color:var(--gray-400);margin:1px 0 0;">${f.nome.split(' ')[0]}</p><p style="font-size:9px;color:var(--gray-300,#CCC);background:#f3f3f3;border-radius:3px;padding:1px 3px;margin:2px auto 0;display:inline-block;">Folga</p></td>`;
    }else{
      cells+=`<td style="${bg}${bo}border-radius:6px;padding:4px;text-align:center;vertical-align:top;"><p style="font-size:12px;font-weight:600;color:${isH?'var(--cobalt-600)':'var(--gray-900)'};margin:0;">${d}</p><p style="font-size:9px;color:var(--gray-600);margin:1px 0 0;">${f.nome.split(' ')[0]}</p><p style="font-size:10px;color:var(--cobalt-600);font-weight:500;margin:2px 0 0;">${f.horario?.entrada||'—'}</p><p style="font-size:9px;color:var(--gray-400);margin:0;">${f.horario?.saida||'—'}</p></td>`;
    }
  }
  const tot=pd+dim,rest=(7-(tot%7))%7;
  for(let i=0;i<rest;i++) cells+=`<td style="background:var(--gray-100);border-radius:6px;"></td>`;
  const tds=cells.match(/<td[\s\S]*?<\/td>/g)||[];
  let rows='';for(let i=0;i<tds.length;i+=7)rows+='<tr style="height:72px;">'+tds.slice(i,i+7).join('')+'</tr>';
  let dt=0,df2=0;
  for(let d=1;d<=dim;d++){const ds=new Date(ano,mes,d).getDay();(f.horario?.folgas||[]).includes(dnf[ds])?df2++:dt++;}
  let hd=0;
  if(f.horario?.entrada&&f.horario?.saida){const[eh,em]=f.horario.entrada.split(':').map(Number),[sh,sm]=f.horario.saida.split(':').map(Number);hd=((sh*60+sm)-(eh*60+em))/60;if(hd<0)hd+=24;}
  document.getElementById('esc-corpo').innerHTML=`
    <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
      <div class="metric-card" style="flex:1;min-width:90px;"><p class="label">Dias trabalhados</p><p class="value">${dt}</p></div>
      <div class="metric-card" style="flex:1;min-width:90px;"><p class="label">Dias de folga</p><p class="value">${df2}</p></div>
      <div class="metric-card" style="flex:1;min-width:90px;"><p class="label">Horas no mês</p><p class="value">${Math.round(hd*dt)}h</p></div>
      <div class="metric-card" style="flex:1;min-width:90px;"><p class="label">Turno</p><p class="value" style="font-size:14px;">${f.horario?.turno||'—'}</p></div>
    </div>
    <div class="card" style="padding:12px;overflow-x:auto;">
      <table style="width:100%;border-collapse:separate;border-spacing:3px;min-width:500px;">
        <thead><tr>${dna.map(n=>`<th style="text-align:center;font-size:11px;color:var(--gray-600);font-weight:600;padding:4px;">${n}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ═══════════════════════════════════════════
// FOLHA DE PONTO
// ═══════════════════════════════════════════
function pagePonto(){
  const fs=Storage.getFuncionarios(),hj=new Date();
  const mesAno=hj.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const chave=`rh_ponto_${hj.getFullYear()}_${hj.getMonth()+1}`;
  const opts=fs.map(f=>`<option value="${f.id}">${f.nome}</option>`).join('');
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-xl);">
      <div><h1 class="page-title" style="margin-bottom:2px;">Folha de ponto</h1><p style="font-size:13px;color:var(--gray-600);margin:0;">${mesAno}</p></div>
      ${fs.length?`<select id="sel-ponto" onchange="rePonto(this.value)" style="height:36px;padding:0 12px;border:1px solid var(--gray-200);border-radius:var(--radius-md);font-size:13px;color:var(--gray-900);background:var(--color-content-bg,var(--white));outline:none;">${opts}</select>`:''}
    </div>
    <div id="ponto-corpo">${fs.length?buildPonto(fs[0].id,chave):'<div class="card"><p style="font-size:13px;color:var(--gray-600);">Nenhum funcionário.</p></div>'}</div>`;
}

function buildPonto(fid,chave){
  const fs=Storage.getFuncionarios(),f=fs.find(x=>x.id===fid);if(!f)return '';
  const hj=new Date(),dim=new Date(hj.getFullYear(),hj.getMonth()+1,0).getDate();
  const reg=JSON.parse(localStorage.getItem(chave)||'{}')[fid]||{};
  const dnf=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const tm=t=>{if(!t)return 0;const[h,m]=t.split(':').map(Number);return h*60+m;};
  let linhas='',totExt=0;
  for(let d=1;d<=dim;d++){
    const dt=new Date(hj.getFullYear(),hj.getMonth(),d),ds=dt.getDay();
    const folga=(f.horario?.folgas||[]).includes(dnf[ds]);
    const futuro=dt>hj,isH=dt.toDateString()===hj.toDateString();
    const r=reg[d]||{};
    let horas='—',extras=0;
    if(r.entrada&&r.saida){
      let min=(tm(r.saida)-tm(r.entrada));
      if(r.saidaAlmoco&&r.retornoAlmoco)min-=(tm(r.retornoAlmoco)-tm(r.saidaAlmoco));
      if(min<0)min+=1440;
      horas=Math.floor(min/60)+'h'+(min%60>0?min%60+'m':'');
      if(f.horario?.entrada&&f.horario?.saida){
        let prev=tm(f.horario.saida)-tm(f.horario.entrada);if(prev<0)prev+=1440;
        extras=min-prev; totExt+=extras;
      }
    }
    const na=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][ds];
    const bg=folga?'background:#fafafa;':isH?'background:var(--cobalt-50);':'';
    if(folga){
      linhas+=`<tr style="${bg}border-bottom:1px solid var(--gray-200);"><td style="padding:7px 10px;font-size:12px;color:var(--gray-400);">${String(d).padStart(2,'0')} ${na}</td><td colspan="4" style="padding:7px 10px;font-size:12px;color:var(--gray-400);text-align:center;">Folga</td><td></td><td></td></tr>`;
    }else if(futuro){
      linhas+=`<tr style="${bg}border-bottom:1px solid var(--gray-200);"><td style="padding:7px 10px;font-size:12px;color:var(--gray-600);">${String(d).padStart(2,'0')} ${na}</td><td colspan="4" style="padding:7px 10px;text-align:center;color:var(--gray-400);">—</td><td></td><td></td></tr>`;
    }else{
      const ti=(c,v)=>`<td style="padding:4px 6px;"><input type="time" value="${v||''}" style="width:82px;height:28px;padding:0 6px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;color:var(--gray-900);background:var(--color-content-bg,var(--white));" onchange="saveBatida('${fid}','${d}','${c}',this.value,'${chave}')"/></td>`;
      const ex=extras>0?`<span style="color:var(--color-success);font-size:11px;">+${Math.floor(extras/60)}h${extras%60>0?extras%60+'m':''}</span>`:extras<0?`<span style="color:var(--color-danger);font-size:11px;">${Math.floor(extras/60)}h${Math.abs(extras%60)>0?Math.abs(extras%60)+'m':''}</span>`:'<span style="font-size:11px;color:var(--gray-400);">—</span>';
      linhas+=`<tr style="${bg}border-bottom:1px solid var(--gray-200);">
        <td style="padding:7px 10px;font-size:12px;font-weight:${isH?'600':'400'};color:${isH?'var(--cobalt-600)':'var(--gray-900)'};">${String(d).padStart(2,'0')} ${na}</td>
        ${ti('entrada',r.entrada)}${ti('saidaAlmoco',r.saidaAlmoco)}${ti('retornoAlmoco',r.retornoAlmoco)}${ti('saida',r.saida)}
        <td style="padding:7px 10px;font-size:12px;text-align:center;">${horas}</td>
        <td style="padding:7px 10px;text-align:center;">${ex}</td>
      </tr>`;
    }
  }
  const eh=Math.floor(Math.abs(totExt)/60),em2=Math.abs(totExt)%60;
  const es=(totExt>=0?'+':'-')+eh+'h'+(em2>0?em2+'m':'');
  return `
    <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
      <div class="metric-card" style="flex:1;min-width:90px;"><p class="label">Turno</p><p class="value" style="font-size:14px;">${f.horario?.turno||'—'}</p></div>
      <div class="metric-card" style="flex:1;min-width:90px;"><p class="label">Entrada prevista</p><p class="value" style="font-size:14px;">${f.horario?.entrada||'—'}</p></div>
      <div class="metric-card" style="flex:1;min-width:90px;"><p class="label">Saída prevista</p><p class="value" style="font-size:14px;">${f.horario?.saida||'—'}</p></div>
      <div class="metric-card" style="flex:1;min-width:90px;"><p class="label">Saldo horas</p><p class="value" style="font-size:14px;color:${totExt>=0?'var(--color-success)':'var(--color-danger)'};">${es}</p></div>
    </div>
    <div class="card" style="padding:0;overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;min-width:620px;">
        <thead><tr style="border-bottom:2px solid var(--gray-200);">
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--gray-600);font-weight:600;width:76px;">Dia</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;color:var(--gray-600);font-weight:600;">Entrada</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;color:var(--gray-600);font-weight:600;">Saída almoço</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;color:var(--gray-600);font-weight:600;">Retorno almoço</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;color:var(--gray-600);font-weight:600;">Saída</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;color:var(--gray-600);font-weight:600;">Total</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;color:var(--gray-600);font-weight:600;">Extras</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
}

function saveBatida(fid,dia,campo,valor,chave){
  const obj=JSON.parse(localStorage.getItem(chave)||'{}');
  if(!obj[fid])obj[fid]={};if(!obj[fid][dia])obj[fid][dia]={};
  obj[fid][dia][campo]=valor;localStorage.setItem(chave,JSON.stringify(obj));
  rePonto(fid,true);
}
function rePonto(fid,silent){
  const chave=`rh_ponto_${new Date().getFullYear()}_${new Date().getMonth()+1}`;
  const el=document.getElementById('ponto-corpo');if(el)el.innerHTML=buildPonto(fid,chave);
  if(!silent){const s=document.getElementById('sel-ponto');if(s)s.value=fid;}
}

// ═══════════════════════════════════════════
// PAGAMENTOS
// ═══════════════════════════════════════════
function pagePagamentos(){
  const emp=Storage.getEmpresa(),fs=Storage.getFuncionarios(),hj=new Date();
  const mes=hj.getMonth(),ano=hj.getFullYear();
  const ds=parseInt(emp?.rh?.diaPagamento)||5,dv=parseInt(emp?.rh?.diaVale)||20;
  const pd=d=>{let x=new Date(ano,mes,d);if(x<hj)x=new Date(ano,mes+1,d);return x;};
  const da=d=>{const di=Math.ceil((d-hj)/86400000);if(di===0)return 'Hoje';if(di<0)return 'Passou';return 'Em '+di+(di===1?' dia':' dias');};
  const nm=hj.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const dim=new Date(ano,mes+1,0).getDate(),pd2=new Date(ano,mes,1).getDay();
  const tS=fs.reduce((a,f)=>a+(parseFloat(f.pagamento?.salario)||0),0);
  const tVR=fs.reduce((a,f)=>a+(parseFloat(f.pagamento?.valeRefeicao)||0),0);
  const tVT=fs.reduce((a,f)=>a+(parseFloat(f.pagamento?.valeTransporte)||0),0);

  let cells='';
  for(let i=0;i<pd2;i++)cells+=`<td style="padding:3px;"></td>`;
  for(let d=1;d<=dim;d++){
    const iH=d===hj.getDate(),iS=d===ds,iV=d===dv;
    const bg=iS?'background:var(--cobalt-600);color:#fff;':iV?'background:var(--cobalt-200);color:var(--cobalt-800);':iH?'background:var(--gray-200);':'';
    cells+=`<td style="padding:3px;text-align:center;"><div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:11px;border-radius:50%;${bg}font-weight:${iH||iS||iV?700:400};">${d}</div>${iS?'<p style="font-size:8px;color:var(--cobalt-600);text-align:center;margin:0;">Sal.</p>':''}${iV&&dv?'<p style="font-size:8px;color:var(--cobalt-400);text-align:center;margin:0;">Vale</p>':''}</td>`;
  }
  const tds=cells.match(/<td[\s\S]*?<\/td>/g)||[];
  let cr='';for(let i=0;i<tds.length;i+=7)cr+='<tr>'+tds.slice(i,i+7).join('')+'</tr>';

  const linhas=fs.map(f=>{
    const sal=parseFloat(f.pagamento?.salario||0),inss=calcINSS(sal),irrf=calcIRRF(sal-inss);
    const vr=parseFloat(f.pagamento?.valeRefeicao||0),vt=parseFloat(f.pagamento?.valeTransporte||0);
    return `<tr style="border-bottom:1px solid var(--gray-200);">
      <td style="padding:9px 12px;"><p style="font-size:13px;font-weight:500;color:var(--gray-900);margin:0;">${f.nome}</p><p style="font-size:11px;color:var(--gray-600);margin:0;">${f.cargo||'—'}</p></td>
      <td style="padding:9px 12px;font-size:13px;color:var(--gray-600);text-align:right;">${fmtR(sal)}</td>
      <td style="padding:9px 12px;font-size:13px;color:var(--color-danger);text-align:right;">- ${fmtR(inss+irrf)}</td>
      <td style="padding:9px 12px;font-size:13px;color:var(--gray-600);text-align:right;">${fmtR(vr)}</td>
      <td style="padding:9px 12px;font-size:13px;color:var(--gray-600);text-align:right;">${fmtR(vt)}</td>
      <td style="padding:9px 12px;font-size:13px;font-weight:600;color:var(--cobalt-600);text-align:right;">${fmtR(sal-inss-irrf+vr+vt)}</td>
      <td style="padding:9px 12px;text-align:center;"><button class="btn btn-secondary" style="padding:4px 10px;font-size:12px;" onclick="gerarHolerite('${f.id}')"><i class="ti ti-file-text"></i></button></td>
    </tr>`;
  }).join('');

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-xl);">
      <div><h1 class="page-title" style="margin-bottom:2px;">Pagamentos</h1><p style="font-size:13px;color:var(--gray-600);margin:0;">${nm}</p></div>
    </div>
    <div class="metric-grid" style="margin-bottom:20px;">
      <div class="metric-card"><p class="label">Total salários</p><p class="value" style="font-size:16px;">${fmtR(tS)}</p></div>
      <div class="metric-card"><p class="label">Vale refeição</p><p class="value" style="font-size:16px;">${fmtR(tVR)}</p></div>
      <div class="metric-card"><p class="label">Vale transporte</p><p class="value" style="font-size:16px;">${fmtR(tVT)}</p></div>
      <div class="metric-card"><p class="label">Custo total mês</p><p class="value" style="font-size:16px;">${fmtR(tS+tVR+tVT)}</p></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 260px;gap:16px;align-items:start;">
      <div class="card" style="padding:0;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:520px;">
          <thead><tr style="border-bottom:2px solid var(--gray-200);">
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:var(--gray-600);font-weight:600;">Funcionário</th>
            <th style="padding:9px 12px;text-align:right;font-size:11px;color:var(--gray-600);font-weight:600;">Bruto</th>
            <th style="padding:9px 12px;text-align:right;font-size:11px;color:var(--gray-600);font-weight:600;">Descontos</th>
            <th style="padding:9px 12px;text-align:right;font-size:11px;color:var(--gray-600);font-weight:600;">VR</th>
            <th style="padding:9px 12px;text-align:right;font-size:11px;color:var(--gray-600);font-weight:600;">VT</th>
            <th style="padding:9px 12px;text-align:right;font-size:11px;color:var(--gray-600);font-weight:600;">Líquido</th>
            <th></th>
          </tr></thead>
          <tbody>${linhas||'<tr><td colspan="7" style="padding:16px;text-align:center;font-size:13px;color:var(--gray-600);">Nenhum funcionário.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="card">
        <p style="font-size:11px;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;">${nm}</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>${['D','S','T','Q','Q','S','S'].map(d=>`<th style="text-align:center;font-size:10px;color:var(--gray-600);padding:3px;font-weight:600;">${d}</th>`).join('')}</tr></thead>
          <tbody>${cr}</tbody>
        </table>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:20px;height:20px;border-radius:50%;background:var(--cobalt-600);flex-shrink:0;"></div>
            <div><p style="font-size:12px;font-weight:500;color:var(--gray-900);margin:0;">Salário — dia ${ds}</p><p style="font-size:11px;color:var(--gray-600);margin:0;">${da(pd(ds))}</p></div>
          </div>
          ${dv?`<div style="display:flex;align-items:center;gap:8px;"><div style="width:20px;height:20px;border-radius:50%;background:var(--cobalt-200);flex-shrink:0;"></div><div><p style="font-size:12px;font-weight:500;color:var(--gray-900);margin:0;">Vale — dia ${dv}</p><p style="font-size:11px;color:var(--gray-600);margin:0;">${da(pd(dv))}</p></div></div>`:''}
        </div>
      </div>
    </div>`;
}