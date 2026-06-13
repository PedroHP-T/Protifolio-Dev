// setup.js — validação e salvamento dos formulários de cadastro

// ── FUNÇÕES DE VALIDAÇÃO ──

function mostrarErro(campoId, erroId) {
  document.getElementById(campoId).classList.add('error');
  document.getElementById(erroId).classList.add('visible');
}

function limparErro(campoId, erroId) {
  document.getElementById(campoId).classList.remove('error');
  document.getElementById(erroId).classList.remove('visible');
}

function validarCampo(campoId, erroId) {
  const campo = document.getElementById(campoId);
  const valor = campo ? campo.value.trim() : '';
  if (!valor) {
    mostrarErro(campoId, erroId);
    return false;
  }
  limparErro(campoId, erroId);
  return true;
}

function mostrarAlerta(mensagem) {
  const alerta = document.getElementById('alerta-erro');
  if (!alerta) return;
  alerta.textContent = mensagem;
  alerta.classList.add('visible');
  alerta.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function esconderAlerta() {
  const alerta = document.getElementById('alerta-erro');
  if (alerta) alerta.classList.remove('visible');
}

// ── SALVAR EMPRESA ──

function salvarEmpresa() {
  esconderAlerta();

  // Validações obrigatórias
  const ok = [
    validarCampo('razao-social',    'erro-razao-social'),
    validarCampo('cnpj',            'erro-cnpj'),
    validarCampo('cidade',          'erro-cidade'),
    validarCampo('email-empresa',   'erro-email-empresa'),
    validarCampo('dia-pagamento',   'erro-dia-pagamento'),
  ];

  if (ok.includes(false)) {
    mostrarAlerta('Preencha todos os campos obrigatórios antes de continuar.');
    return;
  }

  // Monta o objeto da empresa
  const empresa = {
    razaoSocial:      document.getElementById('razao-social').value.trim(),
    nomeFantasia:     document.getElementById('nome-fantasia').value.trim(),
    cnpj:             document.getElementById('cnpj').value.trim(),
    segmento:         document.getElementById('segmento').value,
    numFuncionarios:  document.getElementById('num-funcionarios').value,
    endereco: {
      logradouro:   document.getElementById('logradouro').value.trim(),
      numero:       document.getElementById('numero').value.trim(),
      bairro:       document.getElementById('bairro').value.trim(),
      cidade:       document.getElementById('cidade').value.trim(),
      estado:       document.getElementById('estado').value,
      cep:          document.getElementById('cep').value.trim(),
      complemento:  document.getElementById('complemento').value.trim(),
    },
    contato: {
      email:    document.getElementById('email-empresa').value.trim(),
      telefone: document.getElementById('telefone').value.trim(),
    },
    rh: {
      diaPagamento:       document.getElementById('dia-pagamento').value,
      diaVale:            document.getElementById('dia-vale').value,
      valeRefeicao:       document.getElementById('vale-refeicao').checked,
      valeTransporte:     document.getElementById('vale-transporte').checked,
      valeAlimentacao:    document.getElementById('vale-alimentacao').checked,
      planoSaude:         document.getElementById('plano-saude').checked,
    },
    criadoEm: new Date().toISOString(),
  };

  Storage.saveEmpresa(empresa);

  // Vai para o cadastro de funcionários
  window.location.href = 'funcionario.html';
}

// ── SALVAR FUNCIONÁRIO ──

function salvarFuncionario() {
  esconderAlerta();

  // Validações obrigatórias
  const ok = [
    validarCampo('nome',      'erro-nome'),
    validarCampo('cpf',       'erro-cpf'),
    validarCampo('email',     'erro-email'),
    validarCampo('cargo',     'erro-cargo'),
    validarCampo('admissao',  'erro-admissao'),
    validarCampo('salario',   'erro-salario'),
  ];

  if (ok.includes(false)) {
    mostrarAlerta('Preencha todos os campos obrigatórios antes de continuar.');
    return;
  }

  // Dias de folga selecionados
  const folgas = Array.from(
    document.querySelectorAll('input[name="folga"]:checked')
  ).map(cb => cb.value);

  // Monta o objeto do funcionário
  const funcionario = {
    id:             Storage.gerarId(),
    nome:           document.getElementById('nome').value.trim(),
    cpf:            document.getElementById('cpf').value.trim(),
    rg:             document.getElementById('rg').value.trim(),
    nascimento:     document.getElementById('nascimento').value,
    sexo:           document.getElementById('sexo').value,
    contato: {
      email:   document.getElementById('email').value.trim(),
      celular: document.getElementById('celular').value.trim(),
    },
    cargo:          document.getElementById('cargo').value.trim(),
    departamento:   document.getElementById('departamento').value,
    tipoContrato:   document.getElementById('tipo-contrato').value,
    admissao:       document.getElementById('admissao').value,
    pagamento: {
      salario:        parseFloat(document.getElementById('salario').value) || 0,
      valeRefeicao:   parseFloat(document.getElementById('vale-refeicao').value) || 0,
      valeTransporte: parseFloat(document.getElementById('vale-transporte').value) || 0,
      banco:          document.getElementById('banco').value,
      agencia:        document.getElementById('agencia').value.trim(),
      conta:          document.getElementById('conta').value.trim(),
      tipoConta:      document.getElementById('tipo-conta').value,
    },
    horario: {
      turno:   document.getElementById('turno').value,
      entrada: document.getElementById('entrada').value,
      saida:   document.getElementById('saida').value,
      folgas:  folgas,
    },
    criadoEm: new Date().toISOString(),
  };

  Storage.saveFuncionario(funcionario);

  // Vai para o dashboard
  window.location.href = '../index.html';
}

// ── LIMPA ERRO AO DIGITAR ──
// Adiciona listener em todos os campos com classe .error ao focar
document.addEventListener('DOMContentLoaded', () => {

  // Redireciona se empresa não estiver cadastrada (só na página de funcionário)
  if (window.location.pathname.includes('funcionario.html')) {
    if (!Storage.sistemaConfigurado()) {
      window.location.href = 'empresa.html';
    }
  }

  // Remove erro ao digitar no campo
  document.querySelectorAll('input, select, textarea').forEach(campo => {
    campo.addEventListener('input', () => {
      campo.classList.remove('error');
      const erroId = 'erro-' + campo.id;
      const erroEl = document.getElementById(erroId);
      if (erroEl) erroEl.classList.remove('visible');
    });
  });

});
