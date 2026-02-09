
    (function(){
      let didInit = false;

      // === CONFIGURAÇÃO DAS CHAVES DI (Dual Infodose) ===
      const STORAGE = {
        API_KEY:       'di_apiKey',
        MODEL_NAME:    'di_modelName',
        USER_NAME:     'di_userName',
        INFODOSE_NAME: 'di_infodoseName',
        SYSTEM_ROLE:   'di_systemRole'
      };

      const DEFAULTS = {
        API_URL: 'https://openrouter.ai/api/v1/chat/completions',
        MODEL:   'deepseek/deepseek-chat-v3-0324:free',
        TEMP:    0.2,
        INFODOSE: 'Dual.Infodose',
        USER: 'Viajante'
      };

      let CONFIG = {
        API_URL: DEFAULTS.API_URL,
        MODEL:   DEFAULTS.MODEL,
        TEMP:    DEFAULTS.TEMP,
        AUTH_TOKEN: '',
        USER_NAME: DEFAULTS.USER,
        INFODOSE_NAME: DEFAULTS.INFODOSE,
        SYSTEM_ROLE: ''
      };

      // Helper DOM
      const $  = s => document.querySelector(s);
      const $$ = s => Array.from(document.querySelectorAll(s));

      // Elementos
      const moduleRoot     = $('#dualChatModule');
      const responseContainer = $('#response');
      const pagesWrapper   = $('#pagesWrapper');
      const bootText       = $('#bootText');
      const footerHint     = $('#footerHint');
      const apiKeyInput    = $('#apiKeyInput');
      const modelSelect    = $('#modelSelect');
      const customModelInput = $('#customModelInput');
      const iaStatus       = $('#iaStatus');
      const userInput      = $('#userInput');
      
      let pages = [];
      let currentPage = 0;
      let isCollapsed = false;
      let conversation = []; // Histórico simples

      // ==========================================
      // 1. CARREGAMENTO E SALVAMENTO (DI KEYS)
      // ==========================================

      function updateBootUI() {
        // Atualiza a frase inicial com os nomes configurados
        const txt = `🧬 Iniciando. Pulso simbiótico detectado. Olá, ${CONFIG.USER_NAME}. Sou ${CONFIG.INFODOSE_NAME}.`;
        bootText.textContent = txt;
        bootText.setAttribute('data-text', txt);
        userInput.placeholder = `Diga: 'oi, ${CONFIG.INFODOSE_NAME}'...`;
      }

      function loadIaConfig(){
        // Ler do LocalStorage usando as chaves DI
        const key   = localStorage.getItem(STORAGE.API_KEY) || '';
        const model = localStorage.getItem(STORAGE.MODEL_NAME) || DEFAULTS.MODEL;
        const uName = localStorage.getItem(STORAGE.USER_NAME) || DEFAULTS.USER;
        const iName = localStorage.getItem(STORAGE.INFODOSE_NAME) || DEFAULTS.INFODOSE;
        const sysRole = localStorage.getItem(STORAGE.SYSTEM_ROLE) || '';

        // Atualizar runtime config
        CONFIG.AUTH_TOKEN = key ? 'Bearer ' + key : '';
        CONFIG.MODEL      = model;
        CONFIG.USER_NAME  = uName;
        CONFIG.INFODOSE_NAME = iName;
        CONFIG.SYSTEM_ROLE = sysRole;

        // Atualizar UI Inputs
        apiKeyInput.value = key;
        
        // Logica do Select vs Custom
        let found = false;
        Array.from(modelSelect.options).forEach(opt => {
          if (opt.value === model){ found = true; modelSelect.value = model; }
        });
        if (!found){
          modelSelect.value = 'custom';
          customModelInput.value = model;
        } else {
            customModelInput.value = '';
        }

        // Feedback Status
        if (!key){
          iaStatus.textContent = 'Falta di_apiKey no storage.';
          iaStatus.className = 'ia-status warn';
        } else {
          iaStatus.textContent = `Config DI carregada. Modelo: ${model}`;
          iaStatus.className = 'ia-status ok';
        }

        updateBootUI();
      }

      function saveIaConfig(){
        // Pega valores da UI
        let key = apiKeyInput.value.trim();
        let model = modelSelect.value;
        if (model === 'custom'){
          const c = customModelInput.value.trim();
          if (c) model = c;
        }
        if (!model) model = DEFAULTS.MODEL;

        if (!key){
          iaStatus.textContent = 'Preencha a API Key para salvar.';
          iaStatus.className = 'ia-status warn';
          return;
        }

        try{
          // Salva nas chaves DI
          localStorage.setItem(STORAGE.API_KEY, key);
          localStorage.setItem(STORAGE.MODEL_NAME, model);
          // Nota: Não estamos salvando user/infodose aqui via UI, 
          // isso geralmente vem de fora ou mantemos o que já estava.
        }catch(e){ console.error(e); }

        loadIaConfig(); // Recarrega para aplicar
        iaStatus.textContent = 'Configurações DI salvas!';
      }

      function clearIaConfig(){
        try{
          localStorage.removeItem(STORAGE.API_KEY);
          localStorage.removeItem(STORAGE.MODEL_NAME);
          localStorage.removeItem(STORAGE.USER_NAME);
          localStorage.removeItem(STORAGE.INFODOSE_NAME);
          localStorage.removeItem(STORAGE.SYSTEM_ROLE);
        }catch(e){ console.error(e); }
        
        loadIaConfig();
        iaStatus.textContent = 'Configurações DI limpas.';
        iaStatus.className = 'ia-status warn';
      }

      // ==========================================
      // 2. CHAMADA IA (USANDO DI_SYSTEMROLE)
      // ==========================================

      async function callOpenRouter(promptText){
        if (!CONFIG.AUTH_TOKEN){
          throw new Error('Chave DI não configurada.');
        }

        // Se o sistema não tiver role definida no storage, usa o fallback cinematográfico
        const fallbackSystem = `Você é ${CONFIG.INFODOSE_NAME}, assistente cinematográfico. O usuário é ${CONFIG.USER_NAME}.
Responda em português, usando blocos Markdown e callouts (::info, ::warn).
Estrutura: 1) Recompensa inicial, 2) Curiosidade no meio, 3) Convite final.`;

        const finalSystem = CONFIG.SYSTEM_ROLE && CONFIG.SYSTEM_ROLE.trim().length > 0 
            ? CONFIG.SYSTEM_ROLE 
            : fallbackSystem;

        const messages = [
          { role:'system', content: finalSystem },
          ...conversation.slice(-4), // Mantém contexto curto
          { role:'user', content: promptText }
        ];

        const body = {
          model: CONFIG.MODEL,
          temperature: CONFIG.TEMP,
          messages
        };

        const res = await fetch(CONFIG.API_URL, {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'Authorization': CONFIG.AUTH_TOKEN
          },
          body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error(`Erro API: ${res.status}`);
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '...';
        
        conversation.push({ role:'user', content: promptText });
        conversation.push({ role:'assistant', content });
        return content;
      }

      // ==========================================
      // 3. UI E INTERAÇÃO BÁSICA
      // ==========================================

      // Parser simples para visualização (estilo Livro Vivo)
      function parseToHtml(text){
        if (!text) return '';
        let out = text
          .replace(/^### (.*)$/gim, '<h3>$1</h3>')
          .replace(/^## (.*)$/gim, '<h2>$1</h2>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/::(info|warn|success)(.*)/gim, '<div class="lv-callout $1">$2</div>')
          .replace(/\n/g, '<br/>');
        return out;
      }

      function renderResponse(text){
        // Cria uma página simples
        const div = document.createElement('div');
        div.className = 'page active';
        div.innerHTML = `<div class="response-block middle">${parseToHtml(text)}</div>`;
        
        // Limpa anteriores por simplicidade neste exemplo
        pagesWrapper.innerHTML = '';
        pagesWrapper.appendChild(div);
      }

      async function handleSend(){
        const txt = userInput.value.trim();
        if(!txt) return;
        
        userInput.value = '';
        footerHint.textContent = `Pulsando para ${CONFIG.MODEL}...`;
        
        try {
            const answer = await callOpenRouter(txt);
            renderResponse(answer);
            footerHint.textContent = 'Resposta recebida.';
        } catch(e) {
            renderResponse(`::warn Falha: ${e.message}`);
            footerHint.textContent = 'Erro de conexão.';
        }
      }

      // Listeners
      $('#sendBtn').addEventListener('click', handleSend);
      userInput.addEventListener('keydown', e => { if(e.key === 'Enter') handleSend(); });
      
      $('#toggleSettingsBtn').addEventListener('click', () => {
        const p = $('#iaConfigPanel');
        p.classList.toggle('active');
        if(p.classList.contains('active')) loadIaConfig();
      });
      $('#closeIaConfigPanelBtn').addEventListener('click', () => $('#iaConfigPanel').classList.remove('active'));
      $('#saveIaConfigBtn').addEventListener('click', saveIaConfig);
      $('#clearIaConfigBtn').addEventListener('click', clearIaConfig);
      $('#footerHint').addEventListener('click', () => {
         moduleRoot.classList.toggle('collapsed');
      });

      // ==========================================
      // 4. API EXTERNA E MENSAGENS DO HOST
      // ==========================================

      // API Pública para scripts externos
      window.Hub1DualInfodose = {
        // Define identidade programaticamente
        setIdentity: (data) => {
            if(data.user) localStorage.setItem(STORAGE.USER_NAME, data.user);
            if(data.infodose) localStorage.setItem(STORAGE.INFODOSE_NAME, data.infodose);
            if(data.role) localStorage.setItem(STORAGE.SYSTEM_ROLE, data.role);
            loadIaConfig(); // Atualiza UI instantaneamente
            console.log('Dual Infodose: Identidade atualizada via Script.');
        },
        send: (txt) => { userInput.value = txt; handleSend(); }
      };

      // Listener de mensagens do Host (Window Message)
      window.addEventListener('message', (ev) => {
        const data = ev.data;
        if (!data || data.source !== 'hub1.host') return;

        // Setar API KEY via host
        if (data.type === 'hub1.dual.setToken' && data.payload?.token){
          localStorage.setItem(STORAGE.API_KEY, data.payload.token);
          loadIaConfig();
        }
        
        // Setar Identidade via host
        if (data.type === 'hub1.dual.setIdentity'){
           window.Hub1DualInfodose.setIdentity(data.payload);
        }
      });

      // Boot
      function init(){
        if(didInit) return;
        didInit = true;
        loadIaConfig();
      }
      document.addEventListener('DOMContentLoaded', init);
      init();

    })();
  