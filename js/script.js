// 1. 頁面切換
function goToHome() {
    window.location.href = 'index.html';
}

function goToGame() {
    window.location.href = 'settings.html';
}

function goToRules() {
    window.location.href = 'rule.html';
}

// 行動定義
const ACTIONS = {
    charge: { label: '充能', cost: 0 },
    shoot: { label: '打死你', cost: 1 },
    defend: { label: '保護我', cost: 1 },
    reflect: { label: '反彈', cost: 1 },
    bazooka: { label: '大砲', cost: 3 },
};

// 全域變數
let players = [];
let round = 1;
let userPendingAction = null; // 暫存玩家選擇的攻擊動作 (打死你/大砲)

// 2. 遊戲初始化
function initGame(userName = '玩家', botCount = 3) {
    players = [];
    round = 1;
    userPendingAction = null;
    document.getElementById('roundDisplay').innerText = round;
    document.getElementById('gameLog').innerHTML = '遊戲開始！<br>所有玩家圍成一圈...';

    // 建立玩家 (User)
    players.push(createPlayer(0, userName, true));

    // 建立電腦 (Bots)
    for (let i = 1; i <= botCount; i++) {
        players.push(createPlayer(i, `電腦 ${i}`, false));
    }

    renderArena();
    updateControls();
}

function createPlayer(id, name, isUser) {
    return {
        id,
        name,
        isUser,
        hp: 1, // 1: 存活, 0: 淘汰
        energy: 0,
        lastAction: null,
        targetId: null,
    };
}

// 3. 渲染畫面 (更新 UI)
function renderArena() {
    const arena = document.getElementById('arena');
    arena.innerHTML = '';

    players.forEach((p) => {
        const div = document.createElement('div');
        div.className = `player-card ${p.isUser ? 'user' : ''} ${p.hp === 0 ? 'dead' : ''}`;

        // 狀態顯示
        let statusIcon = p.hp > 0 ? '😊' : '💀';
        if (p.hp > 0 && p.lastAction) {
            if (p.lastAction === 'charge') statusIcon = '🖐 充能';
            if (p.lastAction === 'shoot') statusIcon = '🔫 開槍';
            if (p.lastAction === 'defend') statusIcon = '🛡️ 防禦';
            if (p.lastAction === 'reflect') statusIcon = '🤞 反彈';
            if (p.lastAction === 'bazooka') statusIcon = '🚀 大砲';
        }

        div.innerHTML = `
            <div style="font-size:24px">${statusIcon}</div>
            <strong>${p.name}</strong>
            <div class="stats">
                <span class="stat-badge">能量: ${p.energy}</span>
            </div>
        `;
        arena.appendChild(div);
    });

    // 檢查是否有贏家
    return checkWinner();
}

function updateControls() {
    const user = players[0];
    const controls = document.getElementById('controls');

    if (user.hp === 0) {
        controls.innerHTML = "<h3>你已經被淘汰了... 觀戰模式</h3><button class='btn-primary' onclick='processRound()'>觀看下一回合</button>";
        return;
    }

    controls.innerHTML = `
        <h3>選擇你的動作：</h3>
        <div class="action-buttons">
            <button class="btn-action" id="btnCharge" onclick="playerAction('charge')"> 🖐 充能<br /><small>(能量 +1)</small> </button>
            <button class="btn-action" id="btnDefend" onclick="playerAction('defend')"> 🛡️ 保護我<br /><small>(耗1能)</small> </button>
            <button class="btn-action" id="btnReflect" onclick="playerAction('reflect')"> 🤞 反彈<br /><small>(耗1能)</small> </button>
            <button class="btn-action btn-danger" id="btnShoot" onclick="prepareAttack('shoot')"> 🔫 打死你<br /><small>(耗1能)</small> </button>
            <button class="btn-action btn-purple" id="btnBazooka" onclick="prepareAttack('bazooka')"> 🚀 大砲<br /><small>(耗3能)</small> </button>
        </div>
        <div id="targetSelector" style="display: none; margin-top: 15px">
            <p>要攻擊誰？</p>
            <div id="targetButtons"></div>
            <button class="btn-small" onclick="cancelAttack()">取消</button>
        </div>
    `;

    document.getElementById('btnDefend').disabled = user.energy < ACTIONS.defend.cost;
    document.getElementById('btnReflect').disabled = user.energy < ACTIONS.reflect.cost;
    document.getElementById('btnShoot').disabled = user.energy < ACTIONS.shoot.cost;
    document.getElementById('btnBazooka').disabled = user.energy < ACTIONS.bazooka.cost;
}

// 4. 玩家動作處理
function prepareAttack(type) {
    const user = players[0];
    if (user.hp === 0) return;
    if (user.energy < ACTIONS[type].cost) {
        addLog(`⚠️ 能量不足，無法使用${ACTIONS[type].label}`);
        return;
    }

    userPendingAction = type;
    const btnContainer = document.getElementById('targetButtons');
    btnContainer.innerHTML = '';

    const aliveTargets = players.filter((p) => !p.isUser && p.hp > 0);
    if (aliveTargets.length === 0) {
        addLog('⚠️ 沒有可攻擊的對象');
        return;
    }

    // 只有一個對手時自動鎖定，不需選擇
    if (aliveTargets.length === 1) {
        players[0].targetId = aliveTargets[0].id;
        playerAction(type);
        return;
    }

    aliveTargets.forEach((p) => {
        const btn = document.createElement('button');
        btn.className = 'btn-small';
        btn.style.margin = '5px';
        btn.innerText = p.name;
        btn.onclick = () => {
            players[0].targetId = p.id;
            playerAction(userPendingAction); // 執行動作
        };
        btnContainer.appendChild(btn);
    });

    document.getElementById('targetSelector').style.display = 'block';
}

function cancelAttack() {
    userPendingAction = null;
    document.getElementById('targetSelector').style.display = 'none';
}

function playerAction(action) {
    const user = players[0];
    if (user.hp === 0) return;

    const cost = ACTIONS[action]?.cost ?? 0;
    if (user.energy < cost) {
        addLog(`⚠️ 能量不足，無法使用${ACTIONS[action].label}`);
        return;
    }

    // 如果是充能/防禦/反彈，不需要目標
    if (action !== 'shoot' && action !== 'bazooka') {
        user.targetId = null;
        cancelAttack();
    } else {
        // 攻擊類行動需要目標
        const target = players.find((p) => p.id === user.targetId && p.hp > 0);
        if (!target) {
            document.getElementById('targetSelector').style.display = 'block';
            addLog('⚠️ 請選擇一個存活的目標');
            return;
        }
        cancelAttack();
    }

    user.lastAction = action;
    processRound();
}

// 5. 電腦 AI 與回合結算 (核心邏輯)
function processRound() {
    const log = document.getElementById('gameLog');
    const user = players[0];

    // 若玩家存活但未選動作，不進行
    if (user.hp > 0 && !user.lastAction) {
        addLog('⚠️ 請先選擇行動');
        return;
    }

    // A. 電腦決定動作
    players.forEach((p) => {
        if (!p.isUser && p.hp > 0) {
            decideBotAction(p);
        }
    });

    // B. 扣能量 & 檢查非法行動
    const roundInvalids = [];
    players.forEach((p) => {
        if (p.hp === 0 || !p.lastAction) return;
        const cost = ACTIONS[p.lastAction]?.cost ?? 0;
        if (p.energy < cost) {
            roundInvalids.push(`${p.name} 能量不足，行動被取消`);
            p.lastAction = 'charge';
        }
        p.energy = Math.max(0, p.energy - (ACTIONS[p.lastAction]?.cost ?? 0));
    });

    // C. 顯示動作 (Log)
    let roundMsg = `<br>--- 第 ${round} 回合 ---<br>`;
    players.forEach((p) => {
        if (p.hp > 0 && p.lastAction) {
            const targetName = p.targetId !== null && p.targetId !== undefined ? ` -> ${players.find((t) => t.id === p.targetId)?.name ?? ''}` : '';
            let actionName = '';
            switch (p.lastAction) {
                case 'charge':
                    actionName = '充能';
                    break;
                case 'shoot':
                    actionName = '打死你';
                    break;
                case 'defend':
                    actionName = '保護我';
                    break;
                case 'reflect':
                    actionName = '反彈';
                    break;
                case 'bazooka':
                    actionName = '大砲';
                    break;
            }
            roundMsg += `${p.name}: ${actionName}${targetName}<br>`;
        }
    });
    if (roundInvalids.length > 0) {
        roundMsg += roundInvalids.map((m) => `⚠️ ${m}`).join('<br>') + '<br>';
    }
    log.innerHTML += roundMsg;

    // D. 結算傷害 (Resolution)
    const deaths = new Set();
    const reflectHits = new Map(); // targetId -> [attackerIds]

    resolveBazooka(deaths, log);
    resolveShoot(deaths, reflectHits, log);
    resolveReflect(deaths, reflectHits, log);
    applyDeaths(deaths, log);
    applyCharge(log);

    // E. 準備下一回合
    round++;
    document.getElementById('roundDisplay').innerText = round;
    players.forEach((p) => {
        p.targetId = null;
        if (p.hp > 0) {
            // 保留 lastAction 供 UI 顯示，不清空
        }
    });
    if (renderArena()) {
        return;
    }
    updateControls();

    // 捲動 log 到最下方
    log.scrollTop = log.scrollHeight;
}

function resolveBazooka(deaths, log) {
    players.forEach((attacker) => {
        if (attacker.hp === 0 || deaths.has(attacker.id) || attacker.lastAction !== 'bazooka') return;
        const target = players.find((p) => p.id === attacker.targetId);
        if (!target || target.hp === 0 || deaths.has(target.id)) return;

        // 大砲互打抵銷
        if (target.lastAction === 'bazooka' && target.targetId === attacker.id) {
            if (attacker.id < target.id) {
                log.innerHTML += `&nbsp;&nbsp;🚀 ${attacker.name} 與 ${target.name} 大砲對轟，互相抵銷！<br>`;
            }
            return;
        }

        if (target.lastAction === 'defend') {
            log.innerHTML += `&nbsp;&nbsp;🛡️ ${target.name} 擋下了 ${attacker.name} 的大砲！<br>`;
            return;
        }

        log.innerHTML += `&nbsp;&nbsp;🚀 ${attacker.name} 的大砲擊中 ${target.name}！<br>`;
        deaths.add(target.id);
    });
}

function resolveShoot(deaths, reflectHits, log) {
    const mutualShootPairs = new Set();
    players.forEach((attacker) => {
        if (attacker.hp === 0 || deaths.has(attacker.id) || attacker.lastAction !== 'shoot') return;
        const target = players.find((p) => p.id === attacker.targetId);
        if (!target || target.hp === 0 || deaths.has(target.id)) return;
        if (target.lastAction === 'shoot' && target.targetId === attacker.id) {
            const key = [Math.min(attacker.id, target.id), Math.max(attacker.id, target.id)].join('-');
            mutualShootPairs.add(key);
        }
    });

    players.forEach((attacker) => {
        if (attacker.hp === 0 || deaths.has(attacker.id) || attacker.lastAction !== 'shoot') return;
        const target = players.find((p) => p.id === attacker.targetId);
        if (!target || target.hp === 0 || deaths.has(target.id)) return;

        const key = [Math.min(attacker.id, target.id), Math.max(attacker.id, target.id)].join('-');
        if (mutualShootPairs.has(key)) {
            if (attacker.id < target.id) {
                log.innerHTML += `&nbsp;&nbsp;🔫 ${attacker.name} 與 ${target.name} 互射，子彈抵銷！<br>`;
            }
            return;
        }

        if (target.lastAction === 'defend') {
            log.innerHTML += `&nbsp;&nbsp;🛡️ ${target.name} 擋下了 ${attacker.name} 的子彈！<br>`;
            return;
        }

        if (target.lastAction === 'reflect') {
            if (!reflectHits.has(target.id)) reflectHits.set(target.id, []);
            reflectHits.get(target.id).push(attacker.id);
            log.innerHTML += `&nbsp;&nbsp;🤞 ${target.name} 反彈準備中，${attacker.name} 子彈被彈回！<br>`;
            return;
        }

        log.innerHTML += `&nbsp;&nbsp;🔫 ${attacker.name} 擊殺 ${target.name}！<br>`;
        deaths.add(target.id);
    });
}

function resolveReflect(deaths, reflectHits, log) {
    reflectHits.forEach((attackers, targetId) => {
        const target = players.find((p) => p.id === targetId);
        if (!target || target.hp === 0 || deaths.has(target.id)) return; // 大砲先殺了就無法反彈

        attackers.forEach((attackerId) => {
            const attacker = players.find((p) => p.id === attackerId);
            if (!attacker || attacker.hp === 0 || deaths.has(attacker.id)) return;
            log.innerHTML += `&nbsp;&nbsp;💥 ${target.name} 的反彈擊殺了 ${attacker.name}！<br>`;
            deaths.add(attacker.id);
        });
    });
}

function applyDeaths(deaths, log) {
    deaths.forEach((id) => {
        const p = players.find((pl) => pl.id === id);
        if (p) {
            p.hp = 0;
            log.innerHTML += `&nbsp;&nbsp;💀 ${p.name} 淘汰！<br>`;
        }
    });
}

function applyCharge(log) {
    players.forEach((p) => {
        if (p.hp === 0) return;
        if (p.lastAction === 'charge') {
            p.energy += 1;
            log.innerHTML += `&nbsp;&nbsp;⚡ ${p.name} 獲得 1 能量（現有 ${p.energy}）。<br>`;
        }
    });
}

function decideBotAction(bot) {
    // 依據能量決定可用行動
    const available = ['charge'];
    if (bot.energy >= ACTIONS.defend.cost) available.push('defend');
    if (bot.energy >= ACTIONS.reflect.cost) available.push('reflect');
    if (bot.energy >= ACTIONS.shoot.cost) available.push('shoot');
    if (bot.energy >= ACTIONS.bazooka.cost) available.push('bazooka');

    const action = available[Math.floor(Math.random() * available.length)];
    bot.lastAction = action;

    if (action === 'shoot' || action === 'bazooka') {
        const targets = players.filter((p) => p.id !== bot.id && p.hp > 0);
        if (targets.length > 0) {
            const randomTarget = targets[Math.floor(Math.random() * targets.length)];
            bot.targetId = randomTarget.id;
        } else {
            bot.lastAction = 'charge';
            bot.targetId = null;
        }
    } else {
        bot.targetId = null;
    }
}

// 6. 紀錄功能 (Record Functionality)
function saveRecord(playerName, result, rounds) {
    const records = JSON.parse(localStorage.getItem('gameRecords')) || [];
    const newRecord = {
        date: new Date().toLocaleString('zh-TW', { hour12: false }),
        playerName: playerName,
        result: result,
        rounds: rounds,
    };
    records.unshift(newRecord);
    localStorage.setItem('gameRecords', JSON.stringify(records));
}

function checkWinner() {
    const survivors = players.filter((p) => p.hp > 0);

    if (survivors.length <= 1) {
        const winnerName = survivors.length === 1 ? survivors[0].name : '無人生還';

        const user = players[0];
        const result = survivors.length === 1 && survivors[0].isUser ? '勝利' : '失敗';
        if (user.hp > 0 || result === '失敗') {
            saveRecord(user.name, result, round);
        }

        document.getElementById('gameLog').innerHTML += `<br>🎉🎉 遊戲結束！優勝者是：${winnerName} 🎉🎉`;

        const cards = document.querySelectorAll('.player-card');
        cards.forEach((c) => {
            if (survivors.length === 1 && c.innerText.includes(survivors[0].name)) {
                c.classList.add('winner');
            }
        });

        document.getElementById('controls').innerHTML = "<button class='btn-primary' onclick='location.reload()'>重新開始</button>";

        return true;
    }

    return false;
}

function addLog(message) {
    const log = document.getElementById('gameLog');
    log.innerHTML += `${message}<br>`;
    log.scrollTop = log.scrollHeight;
}
