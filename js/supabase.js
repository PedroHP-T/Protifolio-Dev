// supabase.js — configuração central do cliente Supabase
// INSTRUÇÕES: substitua as constantes abaixo pelas suas credenciais do Supabase
// Acesse: https://supabase.com → seu projeto → Settings → API

const SUPABASE_URL = 'https://qebzkkobvzinrrlewqkw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlYnpra29idnppbnJybGV3cWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTgzNzYsImV4cCI6MjA5Njc5NDM3Nn0.xU0pI95IqJgpKk-2JLxS7fNC_slJD96Lp6WW7YFEwZk';

// Inicializa o cliente Supabase usando o CDN carregado no HTML
window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: localStorage,
    },
  }
);

// ADICIONE ISSO
window.supabase = window.supabaseClient;

// Verifica se as credenciais foram configuradas
if (SUPABASE_URL.includes('SEU_PROJECT_ID')) {
  console.warn('[RH Gestão] Configure as credenciais do Supabase em js/supabase.js');
}

