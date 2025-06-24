import { supabase } from './supabase.js';

// Elementos da UI
const walletAddressElement = document.getElementById('walletAddress');
const logoutButton = document.getElementById('logoutButton');
const checkinBtn = document.getElementById('checkin-btn');
const streakCounter = document.getElementById('streakCounter');
const streakStat = document.getElementById('streakStat');
const pointsStat = document.getElementById('pointsStat');
const balanceStat = document.getElementById('balanceStat');
const missionsGrid = document.getElementById('missionsGrid');
const achievementsGrid = document.getElementById('achievementsGrid');

// Estado
let currentUser = null;
let userData = null;
let isProcessingMission = false;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard iniciado');

    try {
        // Verificar autenticação
        await checkAuth();

        // Carregar dados do usuário
        await loadUserData();

        // Carregar missões
        await loadMissions();

        // Configurar eventos de verificação de links
        setupLinkVerification();

        // Carregar conquistas
        await loadAchievements();

        // Verificar conquistas
        await checkAchievements();

        // Configurar eventos
        setupEventListeners();

    } catch (error) {
        console.error('Erro na inicialização:', error);
    }
});

// Função para verificar autenticação
async function checkAuth() {
    const walletAddress = localStorage.getItem('sunaryumWalletAddress');
    const userId = localStorage.getItem('sunaryumUserId');

    console.log('Verificando autenticação:', { walletAddress, userId });

    if (!walletAddress) {
        console.log('Redirecionando para home.html');
        window.location.href = "/home/";
        return;
    }

    // Atualiza UI com endereço
    if (walletAddressElement) {
        const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
        walletAddressElement.textContent = shortAddress;
    }
}

// Carrega dados do usuário do Supabase
async function loadUserData() {
    const walletAddress = localStorage.getItem('sunaryumWalletAddress');
    const userId = localStorage.getItem('sunaryumUserId');

    console.log('Carregando dados do usuário:', { walletAddress, userId });

    try {
        let query = supabase
            .from('users')
            .select('*');

        if (userId) {
            query = query.eq('id', userId);
        } else {
            query = query.eq('wallet_address', walletAddress);
        }

        const { data: user, error } = await query.single();

        if (error) {
            console.error('Erro ao buscar usuário:', error);
            throw error;
        }

        if (!user) {
            console.log('Usuário não encontrado, criando novo...');
            await createNewUser(walletAddress);
            return;
        }

        userData = user;
        currentUser = user;

        // Atualizar UI com dados do usuário
        updateUserUI();
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);

        // Criar novo usuário se não existir
        if (error.message.includes('0 rows')) {
            await createNewUser(walletAddress);
        }
    }
}

// Atualiza a interface com os dados do usuário
function hasCheckedInToday() {
    if (!userData || !userData.last_checkin) return false;

    const lastCheckin = new Date(userData.last_checkin);
    const today = new Date();

    return (
        lastCheckin.getDate() === today.getDate() &&
        lastCheckin.getMonth() === today.getMonth() &&
        lastCheckin.getFullYear() === today.getFullYear()
    );
}

// Modifique a função updateUserUI para incluir a verificação do check-in
function updateUserUI() {
    if (!userData) {
        console.warn('Nenhum dado de usuário para atualizar UI');
        return;
    }

    console.log('Atualizando UI com dados:', userData);

    // Atualiza streak
    if (streakCounter) {
        streakCounter.innerHTML = `<strong>${userData.streak || 0} dias</strong>`;
    }
    if (streakStat) {
        streakStat.textContent = userData.streak || 0;
    }

    // Atualiza pontos
    if (pointsStat) {
        pointsStat.textContent = userData.total_points || 0;
    }

    // Atualiza saldo
    if (balanceStat) {
        balanceStat.textContent = `${userData.sun_balance || 0} SUN`;
    }

    // Atualiza estado do botão de check-in
    updateCheckinButtonState();
}

// Nova função para atualizar o estado do botão de check-in
function updateCheckinButtonState() {
    if (!checkinBtn) return;

    if (hasCheckedInToday()) {
        checkinBtn.disabled = true;
        checkinBtn.innerHTML = '<i class="fas fa-check-circle"></i> Check-in realizado hoje';
        startCheckinCooldown();
    } else {
        checkinBtn.disabled = false;
        checkinBtn.innerHTML = 'Daily Check-in';
    }
}

function startCheckinCooldown() {
    if (!hasCheckedInToday()) return;

    // Função de atualização reutilizável
    function updateButton() {
        const now = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const timeLeft = tomorrow - now;

        if (timeLeft <= 0) {
            clearInterval(cooldownInterval);
            updateCheckinButtonState();
            return;
        }

        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

        checkinBtn.innerHTML = `
            <i class="fas fa-clock"></i> Next check-in in 
            ${hours}h ${Math.round(minutes)}m
        `;
    }

    // Atualiza a cada minuto
    const cooldownInterval = setInterval(updateButton, 60000);

    // Executa imediatamente
    updateButton();
}

async function loadMissions() {
    try {
        console.log("[loadMissions] Iniciando carregamento de missões...");

        if (!missionsGrid) {
            console.error("[loadMissions] Elemento missionsGrid não encontrado no DOM");
            return;
        }

        // Mostrar estado de carregamento
        missionsGrid.innerHTML = '<div class="loading-message">Carregando missões...</div>';

        // Buscar missões ativas com tratamento de erro detalhado
        let missions = [];
        let missionsError = null;

        try {
            const response = await supabase
                .from('missions')
                .select('*')
                .eq('is_active', true)
                .order('points_reward', { ascending: false });

            missions = response.data;
            missionsError = response.error;
        } catch (fetchError) {
            console.error("[loadMissions] Erro na requisição:", fetchError);
            missionsError = fetchError;
        }

        console.log("[loadMissions] Resposta do Supabase:", { missions, missionsError });

        if (missionsError) {
            console.error("[loadMissions] Erro ao buscar missões:", missionsError);
            let errorMessage = missionsError.message || "Erro desconhecido ao carregar missões";

            missionsGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar missões</p>
                    <p class="error-detail">${errorMessage}</p>
                    <button onclick="location.reload()">Tentar novamente</button>
                    <p class="admin-hint">Dica para administrador: Verifique as políticas RLS no Supabase</p>
                </div>
            `;
            return;
        }

        // Limpar grid
        missionsGrid.innerHTML = '';

        if (!missions || missions.length === 0) {
            console.warn("[loadMissions] Nenhuma missão encontrada");
            missionsGrid.innerHTML = `
                <div class="empty-message">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhuma missão disponível no momento</p>
                    <p class="admin-hint">Dica para administrador: Verifique se há missões ativas no banco de dados</p>
                </div>
            `;
            return;
        }

        console.log(`[loadMissions] ${missions.length} missões encontradas`);

        // Buscar missões completadas pelo usuário
        let completedMissionIds = [];
        try {
            const { data: completedMissions, error: completedError } = await supabase
                .from('completed_missions')
                .select('mission_id')
                .eq('user_id', userData.id);

            if (completedError) {
                console.error("[loadMissions] Erro ao buscar missões completadas:", completedError);
            } else {
                completedMissionIds = completedMissions.map(m => m.mission_id);
            }
        } catch (error) {
            console.error("[loadMissions] Erro ao buscar missões completadas:", error);
        }

        // Adicionar missões à UI com o novo design
        missions.forEach(mission => {
            const isCompleted = completedMissionIds.includes(mission.id);

            const missionCard = document.createElement('div');
            missionCard.className = `mission-card ${isCompleted ? 'completed' : ''}`;
            missionCard.dataset.missionId = mission.id;

            let actionButton;
            if (isCompleted) {
                actionButton = `
                    <button class="mission-completed" disabled>
                        <i class="fas fa-check-circle"></i> Done
                    </button>
                `;
            } else if (mission.action_url) {
                actionButton = `
                    <a href="${mission.action_url}" 
                       target="_blank" 
                       class="mission-link" 
                       data-id="${mission.id}">
                        Visit Link
                    </a>
                `;
            } else {
                actionButton = `
                    <button class="mission-action" data-id="${mission.id}">
                        Completar Missão
                    </button>
                `;
            }

            // Novo HTML com o design reformulado
            missionCard.innerHTML = `
                <div class="mission-icon-container">
                    <i class="fab fa-${getMissionIcon(mission.mission_type)} mission-icon"></i>
                </div>
                <h3 class="mission-title">${mission.name}</h3>
                <p class="mission-description">${mission.description}</p>
                <div class="mission-rewards">
                    <div class="reward-badge">
                        <span class="reward-label">Points</span>
                        <span class="reward-value points">${mission.points_reward}</span>
                    </div>
                    <div class="reward-badge">
                        <span class="reward-label">SUN</span>
                        <span class="reward-value sun">${mission.sun_reward}</span>
                    </div>
                </div>
                ${actionButton}
            `;

            missionsGrid.appendChild(missionCard);
        });

        // Reconfigurar event listeners para links
        setupLinkVerification();

    } catch (error) {
        console.error("[loadMissions] Erro inesperado:", error);
        missionsGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erro inesperado ao carregar missões</p>
                <p class="error-detail">${error.message || "Erro desconhecido"}</p>
                <button onclick="location.reload()">Recarregar página</button>
            </div>
        `;
    }
}

// Atualize os ícones
function getMissionIcon(missionType) {
    const icons = {
        'social': 'share-alt',
        'twitter': 'twitter',
        'discord': 'discord',
        'website': 'globe',
        'youtube': 'youtube',
        'telegram': 'telegram',
        'daily': 'calendar-check',
        'feedback': 'comment-alt',
        'checkin': 'calendar-day'
    };
    return icons[missionType] || 'tasks';
}

// Verificação simplificada de missões com links
function setupLinkVerification() {
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('mission-link')) {
            e.preventDefault();
            const missionId = e.target.dataset.id;
            const link = e.target.href;

            // Atualiza UI imediatamente
            e.target.innerHTML = '<i class="fas fa-check-circle"></i> Missão completada!';
            e.target.classList.add('completed');
            e.target.style.background = '#38a169';
            e.target.style.cursor = 'default';
            e.target.onclick = null;

            // Abre o link em nova aba
            window.open(link, '_blank');

            // Completa a missão no backend
            try {
                await completeMission(missionId, e.target);
            } catch (error) {
                console.error('Erro ao completar missão:', error);
                e.target.innerHTML = 'Tentar novamente';
                e.target.classList.remove('completed');
                e.target.style.background = '';
                e.target.style.cursor = 'pointer';
            }
        }
    });
}

// Cria novo usuário no banco de dados
async function createNewUser(walletAddress) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .insert({
                wallet_address: walletAddress,
                total_points: 0,
                sun_balance: 0,
                total_missions_completed: 0,
                streak: 0
            })
            .select()
            .single();

        if (error) throw error;

        userData = user;
        currentUser = user;
        localStorage.setItem('sunaryumUserId', user.id);

        updateUserUI();
    } catch (error) {
        console.error('Erro ao criar novo usuário:', error);
    }
}

async function loadAchievements() {
    try {
        if (!achievementsGrid) return;

        achievementsGrid.innerHTML = '<p class="loading-achievements">Carregando conquistas...</p>';

        // Buscar apenas conquistas COMPLETADAS pelo usuário
        const { data: userAchievements, error: uaError } = await supabase
            .from('user_achievements')
            .select(`
                achievements:achievements (
                    id, name, description, icon, points_reward,
                    condition_type, condition_value
                )
            `)
            .eq('user_id', userData.id);

        if (uaError) throw uaError;

        // Extrair conquistas do resultado
        const achievements = userAchievements.map(ua => ua.achievements);

        // Limpar grid
        achievementsGrid.innerHTML = '';

        if (!achievements || achievements.length === 0) {
            achievementsGrid.innerHTML = `
                <div class="empty-message">
                    <i class="fas fa-trophy"></i>
                    <p>Nenhuma conquista completada ainda</p>
                    <p>Complete missões para desbloquear conquistas!</p>
                </div>
            `;
            return;
        }

        // Adicionar conquistas à UI
        achievements.forEach(achievement => {
            // CORREÇÃO: Criar o elemento corretamente
            const achievementCard = document.createElement('div');
            achievementCard.className = 'achievement-card completed';
            
            achievementCard.innerHTML = `
                <div class="achievement-icon">
                    <i class="${achievement.icon || 'fas fa-trophy'}"></i>
                </div>
                <h3>${achievement.name}</h3>
                <p>${achievement.description}</p>
                <div class="achievement-reward">
                    <i class="fas fa-award"></i> Recompensa: ${achievement.points_reward} pontos
                    <i class="fas fa-check completed-badge"></i>
                </div>
            `;

            achievementsGrid.appendChild(achievementCard);
        });
    } catch (error) {
        console.error('Erro ao carregar conquistas:', error);
        achievementsGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erro ao carregar conquistas</p>
            </div>
        `;
    }
}





async function checkAchievements() {
    try {
        // Buscar conquistas
        const { data: achievements, error } = await supabase
            .from('achievements')
            .select('id, condition_type, condition_value')
            .eq('is_active', true);

        if (error) throw error;

        // Verificar cada conquista
        for (const achievement of achievements) {
            if (!achievement.condition_type) continue;

            let conditionMet = false;

            switch (achievement.condition_type) {
                case 'streak':
                    conditionMet = userData.streak >= achievement.condition_value;
                    break;
                case 'missions_completed':
                    conditionMet = userData.total_missions_completed >= achievement.condition_value;
                    break;
                case 'points':
                    conditionMet = userData.total_points >= achievement.condition_value;
                    break;
                case 'sun_balance':
                    conditionMet = userData.sun_balance >= achievement.condition_value;
                    break;
            }

            if (conditionMet) {
                await grantAchievement(achievement.id);
            }
        }
    } catch (error) {
        console.error('Erro ao verificar conquistas:', error);
    }
}
// Conceder conquista
async function grantAchievement(achievementId) {
    try {
        // Verificar se já foi concedida
        const { data: existing, error: checkError } = await supabase
            .from('user_achievements')
            .select()
            .eq('user_id', userData.id)
            .eq('achievement_id', achievementId);
        
        if (checkError) {
            console.warn('Erro ao verificar conquista:', checkError);
            return;
        }
        
        if (existing && existing.length > 0) {
            console.log(`Conquista ${achievementId} já concedida ao usuário`);
            return;
        }
        
        // Buscar dados da conquista
        const { data: achievement, error: achievementError } = await supabase
            .from('achievements')
            .select('*')
            .eq('id', achievementId)
            .single();
        
        if (achievementError) throw achievementError;
        
        // Conceder conquista
        const { error } = await supabase
            .from('user_achievements')
            .insert({
                user_id: userData.id,
                achievement_id: achievementId,
                achieved_at: new Date().toISOString()
            });
        
        if (error) throw error;
        
        // ATUALIZAR PONTOS DO USUÁRIO
        const { error: userError } = await supabase
            .from('users')
            .update({
                total_points: (userData.total_points || 0) + achievement.points_reward,
                updated_at: new Date().toISOString()
            })
            .eq('id', userData.id);
        
        if (userError) throw userError;
        
        // Atualizar dados locais do usuário
        userData.total_points = (userData.total_points || 0) + achievement.points_reward;
        updateUserUI();
        
        // Mostrar notificação
        showAchievementNotification(achievement);
        
        // Recarregar conquistas
        await loadAchievements();
        
        console.log(`Conquista concedida: +${achievement.points_reward} pontos`);
    } catch (error) {
        console.error('Erro ao conceder conquista:', error);
    }
}
// Mostrar notificação de conquista
function showAchievementNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas fa-trophy"></i>
        </div>
        <div class="notification-content">
            <h3>Conquista Desbloqueada!</h3>
            <p>${achievement.name}</p>
            <p class="reward-amount">+ ${achievement.points_reward} pontos</p>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 5000);
}
// Configura os listeners de eventos
function setupEventListeners() {
    // Logout
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    // Check-in diário
    if (checkinBtn) {
        checkinBtn.addEventListener('click', handleDailyCheckin);
    }

    // Completar missão (delegação de evento)
    if (missionsGrid) {
        missionsGrid.addEventListener('click', async (e) => {
            if (e.target.classList.contains('mission-action') && !isProcessingMission) {
                const missionId = e.target.dataset.id;
                await completeMission(missionId, e.target);
            }
        });
    }

    // Dropdown da carteira
    const walletDropdown = document.getElementById('wallet-dropdown');
    const dropdownMenu = document.getElementById('dropdown-menu');

    if (walletDropdown && dropdownMenu) {
        walletDropdown.addEventListener('click', () => {
            dropdownMenu.classList.toggle('active');
        });
    }
}

// Completa uma missão específica
async function completeMission(missionId, button) {
    if (!currentUser || !userData || isProcessingMission) return;

    isProcessingMission = true;

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // Busca os dados da missão
        const { data: mission, error: missionError } = await supabase
            .from('missions')
            .select('*')
            .eq('id', missionId)
            .single();

        if (missionError) throw missionError;

        // Registra missão completada
        const { error: completedError } = await supabase
            .from('completed_missions')
            .insert({
                user_id: userData.id,
                mission_id: missionId,
                completed_at: new Date().toISOString()
            });

        if (completedError) {
            console.error('Erro ao completar missão (RLS):', completedError);
            throw completedError;
        }

        // Atualiza pontos do usuário
        const { error: userError } = await supabase
            .from('users')
            .update({
                total_points: (userData.total_points || 0) + mission.points_reward,
                sun_balance: (userData.sun_balance || 0) + mission.sun_reward,
                total_missions_completed: (userData.total_missions_completed || 0) + 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', userData.id);

        if (userError) throw userError;

        // Recarrega dados do servidor
        await loadUserData();
        await loadMissions();
        await checkAchievements();

        // Feedback visual
        button.innerHTML = 'Completo <i class="fas fa-check"></i>';
        triggerConfettiEffect();

        console.log('Missão completada com sucesso!');
    } catch (error) {
        console.error('Erro ao completar missão:', error);
        button.innerHTML = 'Tentar novamente';
        button.disabled = false;
    } finally {
        isProcessingMission = false;
    }
}

async function handleDailyCheckin() {
    if (!currentUser || !userData || hasCheckedInToday()) return;

    try {
        checkinBtn.disabled = true;
        checkinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        checkinBtn.classList.add('processing');

        const now = new Date().toISOString();
        const newStreak = calculateNewStreak(userData.last_checkin);
        
        // CALCULA PONTOS COM BASE NO STREAK
        const basePoints = 10;
        const streakMultiplier = Math.min(Math.floor(newStreak / 7), 5);
        const pointsEarned = basePoints * (1 + streakMultiplier * 0.5);

        // Verificação correta do primeiro login
        const isFirstCheckin = userData.total_checkins === 0 || 
                              (!userData.last_checkin && userData.streak === 0);

        // Atualiza no Supabase
        const { error } = await supabase
            .from('users')
            .update({
                last_checkin: now,
                streak: newStreak,
                total_points: (userData.total_points || 0) + pointsEarned,
                total_checkins: (userData.total_checkins || 0) + 1,
                updated_at: now
            })
            .eq('id', userData.id);

        if (error) throw error;

        // Atualiza dados locais imediatamente
        userData.last_checkin = now;
        userData.streak = newStreak;
        userData.total_points = (userData.total_points || 0) + pointsEarned;
        userData.total_checkins = (userData.total_checkins || 0) + 1;
        updateUserUI();

        // Concede a conquista de primeiro login se for o caso
        if (isFirstCheckin) {
            await grantAchievement('a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
        }

        // Recarrega dados do servidor para garantir sincronização
        await loadUserData();
        await checkAchievements();
        
        // Feedback visual
        checkinBtn.innerHTML = `<i class="fas fa-check-circle"></i> Check-in realizado!`;
        checkinBtn.classList.remove('processing');
        checkinBtn.classList.add('success');
        triggerConfettiEffect();
        
        // Resetar o botão após 5 segundos
        setTimeout(() => {
            checkinBtn.classList.remove('success');
            updateCheckinButtonState();
        }, 5000);
    } catch (error) {
        console.error('Erro ao fazer check-in:', error);
        checkinBtn.innerHTML = 'Tentar novamente';
        checkinBtn.classList.remove('processing');
        checkinBtn.disabled = false;
    }
}

// Calcula o novo streak baseado no last_checkin
function calculateNewStreak(lastCheckin) {
    if (!lastCheckin) return 1;

    const lastDate = new Date(lastCheckin);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Resetar horas para comparar apenas a data
    lastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);

    // Se o último check-in foi hoje, retorna o mesmo streak
    if (lastDate.getTime() === today.getTime()) {
        return userData.streak || 1;
    }

    // Se o último check-in foi ontem, incrementa
    if (lastDate.getTime() === yesterday.getTime()) {
        return (userData.streak || 0) + 1;
    }

    // Se não, reseta para 1
    return 1;
}

// Faz logout do usuário
function logout() {
    localStorage.removeItem('sunaryumWalletAddress');
    localStorage.removeItem('sunaryumUserId');
    window.location.href = "/home/";
}

// Efeito de confete
function triggerConfettiEffect() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = 150;

    // Criar partículas
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            radius: Math.random() * 5 + 2,
            density: Math.random() * particleCount,
            color: `hsl(${Math.random() * 50 + 20}, 100%, 50%)`,
            speed: Math.random() * 5 + 2
        });
    }

    function drawParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(particle => {
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fillStyle = particle.color;
            ctx.fill();
            ctx.closePath();

            particle.y += particle.speed;

            // Resetar partícula quando sair da tela
            if (particle.y > canvas.height) {
                particle.y = -10;
                particle.x = Math.random() * canvas.width;
            }
        });

        requestAnimationFrame(drawParticles);
    }

    drawParticles();

    // Parar após 5 segundos
    setTimeout(() => {
        cancelAnimationFrame(drawParticles);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 5000);
}
