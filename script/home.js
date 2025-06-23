// No topo do seu arquivo home.js
console.log('Antes da importação do Supabase');
import { supabase } from './supabase.js';
console.log('Supabase importado:', supabase ? 'OK' : 'FALHOU');
function createParticlesForModal(container) {
    if (!container) return;
    
    container.innerHTML = '';
    const particleCount = 15;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');

        const size = Math.random() * 10 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;

        const duration = Math.random() * 15 + 10;
        const delay = Math.random() * 5;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${delay}s`;

        container.appendChild(particle);
    }
}

function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');

        // Tamanho aleatório
        const size = Math.random() * 15 + 5;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        // Posição inicial aleatória
        particle.style.left = `${Math.random() * 100}%`;

        // Duração e atraso aleatórios para animação
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * 5;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${delay}s`;

        particlesContainer.appendChild(particle);
    }
}

async function registerOrUpdateUser(walletAddress) {
    try {
      console.log('Tentando registrar/atualizar:', walletAddress);
      const username = walletAddress.slice(-4);
      const now = new Date().toISOString();
  
      // Usa maybeSingle em vez de single
      const { data: existingUser, error: selectError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .maybeSingle();
      if (selectError) throw selectError;
  
      if (existingUser) {
        console.log('Usuário existente, atualizando...');
        const { error: updateError } = await supabase
          .from('users')
          .update({ last_login: now })
          .eq('id', existingUser.id);
        if (updateError) throw updateError;
        console.log('Usuário atualizado com sucesso');
        return existingUser.id;
      } else {
        console.log('Criando novo usuário...');
        const { data: inserted, error: insertError } = await supabase
          .from('users')
          .insert({
            wallet_address: walletAddress,
            username,
            created_at: now,
            last_login: now
          })
          .select('id')
          .maybeSingle();
        if (insertError) throw insertError;
        console.log('Novo usuário criado com sucesso');
        return inserted.id;
      }
    } catch (error) {
      console.error('Erro detalhado:', error);
      return null;
    }
}

// Toggle de tema claro/escuro
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

// Verificar se há preferência salva ou do sistema
const savedTheme = localStorage.getItem('sunaryum-theme');
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Definir tema inicial
if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    body.classList.add('dark-theme');
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
}

// Alternar tema
themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-theme');

    if (body.classList.contains('dark-theme')) {
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('sunaryum-theme', 'dark');
    } else {
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('sunaryum-theme', 'light');
    }
});

// Conexão da Wallet - Setup e Handlers
async function setupWalletConnection() {

    const walletAddress = document.getElementById('walletAddress');
    let currentWallet = null;

   
    async function isExtensionInstalled() {
        return new Promise((resolve) => {
            console.log("Iniciando verificação de extensão...");
            
            const timeoutId = setTimeout(() => {
                console.log("Timeout na detecção da extensão");
                window.removeEventListener('message', responseListener);
                resolve(false);
            }, 800);

            function responseListener(event) {
                if (event.source !== window) return;
                if (event.data.type === 'EXTENSION_DETECTION_RESPONSE') {
                    console.log("Resposta positiva da extensão recebida");
                    clearTimeout(timeoutId);
                    window.removeEventListener('message', responseListener);
                    resolve(true);
                }
            }

            window.addEventListener('message', responseListener);

            console.log("Enviando pedido de detecção para extensão...");
            window.postMessage({
                type: 'EXTENSION_DETECTION_REQUEST',
                origin: window.location.origin
            }, '*');
        });
    }

    // Configura listener para o botão de conexão
    const connectBtn = document.getElementById('connectWalletBtn');
    if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
        console.log('Botão Conectar Clicado');

        const installed = await isExtensionInstalled();
        console.log('Extensão instalada?', installed);

        if (!installed) {
            console.log('Extensão não detectada, mostrando alerta');
            showExtensionAlert();
            return;
        }

        // 🔥 WAKE-UP DA API AQUI
        try {
            console.log('[Warmup] Acordando API...');
            const pingResponse = await fetch('https://airdrop-sunaryum.onrender.com/api/wallet/ping');
            if (pingResponse.ok) {
                console.log('[Warmup] API acordada com sucesso');
            } else {
                console.warn('[Warmup] API respondeu, mas com status', pingResponse.status);
            }
        } catch (err) {
            console.error('[Warmup] Erro ao acordar API:', err);
        }

        // Inicia conexão
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';
        connectBtn.disabled = true;

        console.log('Enviando mensagem para extensão: OPEN_WALLET_CONNECT');
        window.postMessage({
            type: 'OPEN_WALLET_CONNECT',
            origin: window.location.origin
        }, '*');

        // Timeout de segurança
        setTimeout(() => {
            if (!currentWallet) {
                console.log('Nenhuma resposta da extensão, resetando botão');
                resetConnectButton();
                alert('Tempo esgotado! Verifique se a extensão está funcionando corretamente.');
            }
        }, 5000);
    });
}


    // Listener para resposta da conexão
    window.addEventListener('message', (event) => {
        console.log('Mensagem recebida:', event.data);
        
        // Trata resposta de detecção
        if (event.data.type === 'EXTENSION_DETECTION_RESPONSE') {
            return;
        }
        
        // Trata conexão bem-sucedida
        if (event.data.type === 'WALLET_CONNECTED') {
            console.log('WALLET_CONNECTED recebido', event.data.data);
            
            // Verifica se os dados estão estruturados corretamente
            if (event.data.data && event.data.data.address) {
                handleWalletConnect(event.data.data);
            } 
            // Trata formato antigo de mensagem
            else if (event.data.address) {
                console.warn('Formato antigo de mensagem detectado, convertendo...');
                handleWalletConnect({
                    address: event.data.address,
                    publicKey: event.data.publicKey
                });
            } 
            // Trata mensagens inválidas
            else {
                console.error('Formato inválido de mensagem:', event.data);
                resetConnectButton();
                alert('Erro na conexão: dados inválidos recebidos da extensão');
            }
        }
    });

    // Handler para conexão bem-sucedida
    async function handleWalletConnect(data) {
        console.log('Handling wallet connect:', data);
        
        // Verificação robusta dos dados recebidos
        if (!data?.address) {
            console.error('Dados da carteira incompletos:', data);
            
            // Tenta recuperar do localStorage em caso de falha
            const savedAddress = localStorage.getItem('sunaryumWalletAddress');
            if (savedAddress) {
                console.log('Usando endereço salvo no localStorage');
                data = { address: savedAddress };
            } else {
                resetConnectButton();
                alert('Falha na conexão: endereço da carteira não recebido');
                return;
            }
        }
    
        // REGISTRA NO SUPABASE e obtém o userId
        const userId = await registerOrUpdateUser(data.address);
        console.log('Usuário registrado/atualizado. ID:', userId);
    
        // Salva em localStorage para "sessão"
        localStorage.setItem('sunaryumWalletAddress', data.address);
        if (userId) {
          localStorage.setItem('sunaryumUserId', userId);
        }
    
        currentWallet = data;
    
        // Atualiza UI com endereço conectado
        const shortAddress = `${data.address.slice(0, 6)}...${data.address.slice(-4)}`;
        const walletAddressEl = document.getElementById('walletAddress');
        if (walletAddressEl) {
            walletAddressEl.textContent = shortAddress;
            walletAddressEl.style.display = 'block';
        }
    
        // Efeito de confete
        await triggerConfettiEffect();
    
        // Configura botão para ir ao dashboard
        if (connectBtn) {
            const newBtn = connectBtn.cloneNode(true);
            connectBtn.replaceWith(newBtn);
            newBtn.innerHTML = '<i class="fas fa-rocket"></i> Ir para o Dashboard';
            newBtn.disabled = false;
            newBtn.addEventListener('click', () => {
                console.log('Redirecionando para dashboard');
                window.location.href ='/dashboard/';
            });
        }
    
        document.dispatchEvent(new CustomEvent('walletConnected', { detail: data }));
    }
    
    // Efeito de confete/partículas para feedback visual
    async function triggerConfettiEffect() {
        return new Promise(resolve => {
            // Cria partículas extras para o efeito
            const particlesContainer = document.getElementById('particles');
            const burstParticles = 50;

            for (let i = 0; i < burstParticles; i++) {
                const particle = document.createElement('div');
                particle.classList.add('particle', 'burst-particle');

                // Configuração aleatória para o efeito
                const size = Math.random() * 20 + 5;
                const color = `hsl(${Math.random() * 60 + 30}, 100%, 50%)`; // Tons de amarelo/laranja

                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.backgroundColor = color;
                particle.style.left = `${Math.random() * 100}%`;
                particle.style.top = `${Math.random() * 100}%`;

                // Animação especial para o burst
                const duration = Math.random() * 2 + 1;
                particle.style.animation = `burstAnimation ${duration}s forwards`;

                particlesContainer.appendChild(particle);

                // Remove após a animação
                setTimeout(() => {
                    particle.remove();
                }, duration * 1000);
            }

            setTimeout(resolve, 1000);
        });
    }

    // Reseta o botão se a conexão falhar
    function resetConnectButton() {
        if (connectBtn) {
            connectBtn.innerHTML = 'Conectar Carteira <i class="fas fa-plug"></i>';
            connectBtn.disabled = false;
        }
    }

    return {
        getWalletState: () => currentWallet
    };
}

// Integração com Extensão (se aplicável)
if (typeof browser !== 'undefined') {
    window.addEventListener('message', (event) => {
        if (event.data.type === 'OPEN_WALLET_CONNECT') {
            browser.runtime.sendMessage({
                action: "openConnectWindow",
                origin: event.data.origin
            });
        }
    });

    browser.runtime.onMessage.addListener((msg) => {
        if (msg.action === "walletDataUpdate") {
            window.postMessage({
                type: 'WALLET_CONNECTED',
                data: msg.data
            }, '*');
        }
    });
}

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    setupWalletConnection();
    createParticles();

    // Exemplo de como outras partes do sistema podem acessar o estado
    document.addEventListener('walletConnected', (e) => {
        console.log('Wallet connected:', e.detail);
    });
});

// DEBUG: Listener para todas as mensagens
window.addEventListener('message', (event) => {
    console.log('Mensagem recebida (DEBUG):', event.data);
});
// Estado do modal
const modalState = {
    isSeedVisible: false,
    generated: false
};

// Elementos do modal
const modalElements = {
    generateSeedBtn: document.getElementById('generateSeedBtn'),
    toggleVisibilityBtn: document.getElementById('toggleVisibilityBtn'),
    copySeedBtn: document.getElementById('copySeedBtn'),
    continueBtn: document.getElementById('continueBtn'),
    seedPhraseGrid: document.getElementById('seedPhraseGrid'),
    seedInput: document.getElementById('seedInput'),
    importBtn: document.getElementById('importBtn'),
    importStatus: document.getElementById('importStatus'),
    goToDashboardBtn: document.getElementById('goToDashboardBtn'),
    createTab: document.querySelector('[data-tab="create"]'),
    importTab: document.querySelector('[data-tab="import"]'),
    createWalletTab: document.getElementById('createWalletTab'),
    importWalletTab: document.getElementById('importWalletTab')
};

let walletData = null; // Armazena os dados da carteira gerada

// Inicialização dos eventos do modal
function setupModalEventListeners() {
    if (modalElements.generateSeedBtn) {
        modalElements.generateSeedBtn.addEventListener('click', generateSeedPhrase);
    }
    
    if (modalElements.toggleVisibilityBtn) {
        modalElements.toggleVisibilityBtn.addEventListener('click', toggleSeedVisibility);
    }
    
    if (modalElements.copySeedBtn) {
        modalElements.copySeedBtn.addEventListener('click', copySeedPhrase);
    }
    
    if (modalElements.continueBtn) {
        modalElements.continueBtn.addEventListener('click', handleWalletCreation);
    }
    
    if (modalElements.importBtn) {
        modalElements.importBtn.addEventListener('click', importWallet);
    }
    
    if (modalElements.goToDashboardBtn) {
        modalElements.goToDashboardBtn.addEventListener('click', () => {
            window.location.href ='/dashboard/';
        });
    }
}

// Gera uma nova seed phrase usando a API
async function generateSeedPhrase() {
    if (!modalElements.generateSeedBtn) return;
    
    try {
        // Salvar estado original
        const originalHTML = modalElements.generateSeedBtn.innerHTML;
        
        // Ativar loading
        modalElements.generateSeedBtn.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i> Gerando...
        `;
        modalElements.generateSeedBtn.disabled = true;
        
        const res = await fetch('https://airdrop-sunaryum.onrender.com/api/wallet/create');
        
        if (!res.ok) throw new Error('Erro no servidor');
        
        walletData = await res.json();
        renderSeedPhrase(walletData.mnemonic);
        
        // Restaurar botão
        modalElements.generateSeedBtn.innerHTML = originalHTML;
        modalElements.generateSeedBtn.disabled = false;
        
        modalState.generated = true;
        updateModalUIState();
        
    } catch (error) {
        console.error('Erro na geração:', error);
        
        // Feedback visual de erro
        modalElements.generateSeedBtn.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i> Erro - Tentar novamente
        `;
        
        setTimeout(() => {
            modalElements.generateSeedBtn.innerHTML = `
                <i class="fas fa-sync"></i> Gerar Nova Seed
            `;
            modalElements.generateSeedBtn.disabled = false;
        }, 2000);
    }
}

// Renderiza a seed phrase na interface
function renderSeedPhrase(mnemonic) {
    if (!modalElements.seedPhraseGrid) return;
    
    modalElements.seedPhraseGrid.innerHTML = '';
    
    const words = mnemonic.split(' ');
    words.forEach((word, index) => {
        const wordEl = document.createElement('div');
        wordEl.className = 'seed-word';
        wordEl.dataset.word = word;
        
        wordEl.innerHTML = `
            <span class="word-index">${index + 1}</span>
            <span class="word-content">${'•'.repeat(word.length)}</span>
        `;
        
        modalElements.seedPhraseGrid.appendChild(wordEl);
    });
}

function toggleSeedVisibility() {
    modalState.isSeedVisible = !modalState.isSeedVisible;
    updateVisibilityUI();
    toggleSeedWords();
}

function updateVisibilityUI() {
    const icon = modalElements.toggleVisibilityBtn.querySelector('i');
    const textSpan = modalElements.toggleVisibilityBtn.querySelector('span');
    
    if (textSpan) {
        textSpan.textContent = modalState.isSeedVisible ? 'Ocultar Seed' : 'Mostrar Seed';
    }

    if (icon) {
        if (modalState.isSeedVisible) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

// Alterna a exibição das palavras da seed
function toggleSeedWords() {
    const words = document.querySelectorAll('.seed-word');
    words.forEach(word => {
        const content = word.querySelector('.word-content');
        if (modalState.isSeedVisible) {
            content.textContent = word.dataset.word;
            content.classList.add('visible');
        } else {
            content.textContent = '•'.repeat(word.dataset.word.length);
            content.classList.remove('visible');
        }
    });
}

// Copia a seed phrase para a área de transferência
function copySeedPhrase() {
    if (!walletData) return;
    
    navigator.clipboard.writeText(walletData.mnemonic)
        .then(() => {
            const originalText = modalElements.copySeedBtn.querySelector('span').textContent;
            modalElements.copySeedBtn.querySelector('span').textContent = 'Copied!';
            modalElements.copySeedBtn.disabled = true;
            
            setTimeout(() => {
                modalElements.copySeedBtn.querySelector('span').textContent = originalText;
                modalElements.copySeedBtn.disabled = false;
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy:', err);
        });
}

// Atualiza o estado da UI do modal
function updateModalUIState() {
    if (modalElements.copySeedBtn) {
        modalElements.copySeedBtn.disabled = !modalState.generated;
    }
    
    if (modalElements.continueBtn) {
        modalElements.continueBtn.disabled = !modalState.generated;
    }
}

// Manipula a criação da carteira (ao clicar em "Continuar")
async function handleWalletCreation() {
    if (!walletData) return;
    
    // Preenche automaticamente o campo de importação
    modalElements.seedInput.value = walletData.mnemonic;
    
    // Alterna para a aba de importação
    modalElements.importTab.click();
    
    // Mostra status de processamento
    modalElements.importStatus.textContent = 'Processando sua nova carteira...';
    modalElements.importStatus.className = 'status-message';
    
    // Dispara o processo de importação automaticamente
    setTimeout(() => {
        importWallet();
    }, 1000);
}

function showImportStatus(message, type) {
    if (!modalElements.importStatus) return;
    
    modalElements.importStatus.textContent = message;
    modalElements.importStatus.className = 'status-message';
    
    switch(type) {
        case 'error':
            modalElements.importStatus.classList.add('error');
            break;
        case 'success':
            modalElements.importStatus.classList.add('success');
            break;
        case 'loading':
            modalElements.importStatus.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i> ${message}
            `;
            break;
    }
}

// Importa a carteira usando a seed phrase
async function importWallet() {
    const seed = modalElements.seedInput.value.trim();
    const words = seed.split(/\s+/);

    // Validação melhorada
    if (words.length !== 12) {
        showImportStatus('Por favor, insira uma seed válida de 12 palavras.', 'error');
        return;
    }

    showImportStatus('Importando sua carteira...', 'loading');
    
    try {
        const res = await fetch('https://airdrop-sunaryum.onrender.com/api/wallet/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mnemonic: seed })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Erro na resposta do servidor');
        }

        const data = await res.json();
        saveWalletData(data);
        
        // Registrar usuário e redirecionar
        await finalizeWalletSetup(data.address);
        showImportStatus('✅ Carteira importada com sucesso! Redirecionando...', 'success');
        
    } catch (error) {
        console.error('Erro na importação:', error);
        showImportStatus(`Falha na importação: ${error.message}`, 'error');
    }
}

function saveWalletData(data) {
    const walletData = {
        address: data.address,
        public_key: data.public_key,
        private_key: data.private_key,
        mnemonic: modalElements.seedInput.value.trim()
    };
    
    localStorage.setItem('walletData', JSON.stringify(walletData));
}
// Configuração dos modais
const noExtensionModal = document.getElementById('noExtensionModal');
const walletCreationModal = document.getElementById('walletCreationModal');
const closeButtons = document.querySelectorAll('.close');
const installExtensionOption = document.getElementById('installExtensionOption');
const createWalletOption = document.getElementById('createWalletOption');
const connectWithoutExtensionBtn = document.getElementById('connectWithoutExtensionBtn');
const createTab = document.querySelector('[data-tab="create"]');
const importTab = document.querySelector('[data-tab="import"]');

function resetModalState() {
    modalState.isSeedVisible = false;
    modalState.generated = false;
    
    // Reseta elementos visuais
    if (modalElements.seedPhraseGrid) modalElements.seedPhraseGrid.innerHTML = '';
    if (modalElements.importStatus) {
        modalElements.importStatus.textContent = '';
        modalElements.importStatus.className = 'status-message';
    }
    
    // Reseta botão de geração
    if (modalElements.generateSeedBtn) {
        modalElements.generateSeedBtn.innerHTML = `
            <i class="fas fa-sync"></i> Gerar Nova Seed
        `;
        modalElements.generateSeedBtn.disabled = false;
    }
    
    updateVisibilityUI();
    updateModalUIState();
}

// Modificado para abrir o modal corretamente
function openModal(modal) {
    modal.style.display = 'flex';
    
    // Reseta o estado quando abre o modal de criação
    if (modal.id === 'walletCreationModal') {
        resetModalState();
    }
}

// Função para fechar um modal
function closeModal(modal) {
    modal.style.display = 'none';
}

// Configurar eventos dos modais
function setupModals() {
    // Botão "Conectar sem Extensão"
    if (connectWithoutExtensionBtn) {
        connectWithoutExtensionBtn.addEventListener('click', () => {
            closeModal(noExtensionModal);
            openModal(walletCreationModal);
          
        });
    }

    // Botões de fechar
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            closeModal(modal);
        });
    });

    // Fechar ao clicar fora do modal
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target);
        }
    });

    // Instalar Extensão
    if (installExtensionOption) {
        installExtensionOption.addEventListener('click', () => {
            window.open('https://addons.mozilla.org/firefox/addon/sunaryum-wallet/', '_blank');
        });
    }

    // Criar/Importar Carteira
    if (createWalletOption) {
        createWalletOption.addEventListener('click', () => {
            closeModal(noExtensionModal);
            openModal(walletCreationModal);
        });
    }

    // Controle das abas
    if (createTab && importTab) {
        [createTab, importTab].forEach(tab => {
            tab.addEventListener('click', () => {
                [createTab, importTab].forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                [modalElements.createWalletTab, modalElements.importWalletTab].forEach(content => content.classList.remove('active'));
                if (tab.dataset.tab === 'create') {
                    modalElements.createWalletTab.classList.add('active');
                } else {
                    modalElements.importWalletTab.classList.add('active');
                }
            });
        });
    }
}

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    setupModals();
    setupModalEventListeners();
    
    // Adiciona o estilo para a animação de spinner
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-spin {
            animation: spin 1s linear infinite;
        }
    `;
    document.head.appendChild(style);
});

    
async function finalizeWalletSetup(address) {
    // Registrar/atualizar usuário no Supabase
    const userId = await registerOrUpdateUser(address);
    
    if (userId) {
        // Salvar dados no localStorage
        localStorage.setItem('sunaryumWalletAddress', address);
        localStorage.setItem('sunaryumUserId', userId);
        
        // Redirecionar para o dashboard após breve delay
        setTimeout(() => {
            window.location.href ='/dashboard/';
        }, 2000);
        
        return true;
    }
    return false;
}
