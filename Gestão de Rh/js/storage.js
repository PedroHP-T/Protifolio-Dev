// storage.js — lê e salva todos os dados do sistema no localStorage

const Storage = {

  // ── EMPRESA ──

  getEmpresa() {
    const data = localStorage.getItem('rh_empresa');
    return data ? JSON.parse(data) : null;
  },

  saveEmpresa(empresa) {
    localStorage.setItem('rh_empresa', JSON.stringify(empresa));
  },

  // ── FUNCIONÁRIOS ──

  getFuncionarios() {
    const data = localStorage.getItem('rh_funcionarios');
    return data ? JSON.parse(data) : [];
  },

  getFuncionarioById(id) {
    return this.getFuncionarios().find(f => f.id === id) || null;
  },

  saveFuncionario(funcionario) {
    const lista = this.getFuncionarios();
    const index = lista.findIndex(f => f.id === funcionario.id);
    if (index >= 0) {
      lista[index] = funcionario; // atualiza existente
    } else {
      lista.push(funcionario);    // adiciona novo
    }
    localStorage.setItem('rh_funcionarios', JSON.stringify(lista));
  },

  deleteFuncionario(id) {
    const lista = this.getFuncionarios().filter(f => f.id !== id);
    localStorage.setItem('rh_funcionarios', JSON.stringify(lista));
  },

  // ── UTILITÁRIOS ──

  // Gera um ID único para cada funcionário
  gerarId() {
    return 'func_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  },

  // Verifica se o sistema já foi configurado
  sistemaConfigurado() {
    return !!this.getEmpresa();
  },

  // Apaga tudo (usado em testes ou reset do sistema)
  resetar() {
    localStorage.removeItem('rh_empresa');
    localStorage.removeItem('rh_funcionarios');
  }

};
