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

// 全域變數
let players = [];
let round = 1;
let userPendingAction = null; // 暫存玩家選擇的攻擊動作 (打死你/大砲)

// 2. 遊戲初始化
function initGame(userName = "玩家", botCount = 3) {
    
    players = [];
    round = 1;
    document.getElementById('roundDisplay').innerText = round;
    document.getElementById('gameLog').innerHTML = "遊戲開始！<br>所有玩家圍成一圈...";

    // 建立玩家 (User)
    players.push(createPlayer(0, userName, true));

    // 建立電腦 (Bots)
    for(let i=1; i<=botCount; i++) {
        players.push(createPlayer(i, `電腦 ${i}`, false));
    }

    renderArena();
    updateControls();
}

function createPlayer(id, name, isUser) {
    return {
        id: id,
        name: name,
        isUser: isUser,
        hp: 1, // 1: 存活, 0: 淘汰
        ammo: 0,
        charge: 0, // 集氣次數
        lastAction: '',
        targetId: null
    };
}

// 3. 渲染畫面 (更新 UI)
function renderArena() {
    const arena = document.getElementById('arena');
    arena.innerHTML = ''; //初始化 清空

    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-card ${p.isUser ? 'user' : ''} ${p.hp === 0 ? 'dead' : ''}`;
        
        // 狀態顯示
        let statusIcon = p.hp > 0 ? '😊' : '💀';
        if (p.hp > 0 && p.lastAction) {
            // 顯示上回合動作圖示
            if(p.lastAction === 'load') statusIcon = '🖐 裝彈';
            if(p.lastAction === 'shoot') statusIcon = '🔫 開槍';
            if(p.lastAction === 'defend') statusIcon = '🛡️ 防禦';
            if(p.lastAction === 'reflect') statusIcon = '🤞 反彈';
            if(p.lastAction === 'bazooka') statusIcon = '🚀 大砲';
        }

        div.innerHTML = `
            <div style="font-size:24px">${statusIcon}</div>
            <strong>${p.name}</strong>
            <div class="stats">
                <span class="stat-badge">彈: ${p.ammo}</span>
                <span class="stat-badge" style="background:${p.charge >=3 ? '#ffeb3b': '#ddd'}">氣: ${p.charge}</span>
            </div>
        `;
        arena.appendChild(div);
    });

    // 檢查是否有贏家
    return checkWinner();
}

function updateControls() {
    const user = players[0];
    if (user.hp === 0) {
        document.getElementById('controls').innerHTML = "<h3>你已經被淘汰了... 觀戰模式</h3><button class='btn-primary' onclick='processRound()'>觀看下一回合</button>";
        return;
    }

    // 檢查按鈕狀態
    document.getElementById('btnShoot').disabled = (user.ammo <= 0);
    document.getElementById('btnBazooka').disabled = (user.charge < 3); // 規則：需集氣3次，第4次可用
    
    // 重置攻擊選單
    document.getElementById('targetSelector').style.display = 'none';
}

// 4. 玩家動作處理
function prepareAttack(type) {
    // 顯示目標選擇按鈕
    userPendingAction = type;
    const btnContainer = document.getElementById('targetButtons');
    btnContainer.innerHTML = '';
    
    players.forEach(p => {
        // 只能攻擊活著的其他人
        if (!p.isUser && p.hp > 0) {
            const btn = document.createElement('button');
            btn.className = 'btn-small';
            btn.style.margin = '5px';
            btn.innerText = p.name;
            btn.onclick = () => {
                players[0].targetId = p.id;
                playerAction(userPendingAction); // 執行動作
            };
            btnContainer.appendChild(btn);
        }
    });
    
    document.getElementById('targetSelector').style.display = 'block';
}

function cancelAttack() {
    document.getElementById('targetSelector').style.display = 'none';
}

function playerAction(action) {
    const user = players[0];
    user.lastAction = action;

    // 扣除消耗
    if (action === 'shoot') user.ammo--;
    // 大砲不扣子彈，只看集氣，規則沒說扣氣，這裡假設大砲發射後集氣歸零，避免連續大砲
    if (action === 'bazooka') user.charge = 0; 

    // 如果是裝彈/防禦/反彈，不需要目標
    if (action !== 'shoot' && action !== 'bazooka') {
        user.targetId = null;
    }

    processRound(); // 進入回合結算
}

// 5. 電腦 AI 與回合結算 (核心邏輯)
function processRound() {
    const log = document.getElementById('gameLog');
    
    // A. 電腦決定動作
    players.forEach(p => {
        if (!p.isUser && p.hp > 0) {
            decideBotAction(p);
        }
    });

    // B. 顯示動作 (Log)
    let roundMsg = `<br>--- 第 ${round} 回合 ---<br>`;
    players.forEach(p => {
        if (p.hp > 0) {
            let targetName = p.targetId !== null ? ` -> ${players[p.targetId].name}` : "";
            let actionName = "";
            switch(p.lastAction) {
                case 'load': actionName = "裝子彈"; break;
                case 'shoot': actionName = "打死你"; break;
                case 'defend': actionName = "保護我"; break;
                case 'reflect': actionName = "反彈"; break;
                case 'bazooka': actionName = "發射大砲"; break;
            }
            roundMsg += `${p.name}: ${actionName}${targetName}<br>`;
        }
    });
    log.innerHTML += roundMsg;

    // C. 結算傷害 (Resolution)
    // 先處理裝彈效果
    players.forEach(p => {
        if(p.hp > 0 && p.lastAction === 'load') {
            p.ammo++;
            p.charge++;
        }
    });

    // 處理攻擊
    let deaths = []; // 紀錄誰死了

    players.forEach(attacker => {
        if (attacker.hp > 0 && (attacker.lastAction === 'shoot' || attacker.lastAction === 'bazooka')) {
            const target = players.find(t => t.id === attacker.targetId);
            
            if (target && target.hp > 0) {
                let isDead = false;
                let isReflected = false;

                // 規則判定
                if (attacker.lastAction === 'shoot') {
                    // 普通開槍
                    if (target.lastAction === 'defend') {
                        log.innerHTML += `&nbsp;&nbsp;🛡️ ${target.name} 擋下了 ${attacker.name} 的子彈！<br>`;
                    } else if (target.lastAction === 'reflect') {
                        log.innerHTML += `&nbsp;&nbsp;🤞 ${target.name} 反彈！${attacker.name} 自爆了！<br>`;
                        isReflected = true; // 攻擊者死
                    } else {
                        isDead = true; // 目標死
                    }
                } else if (attacker.lastAction === 'bazooka') {
                    // 大砲 (無視反彈，但可防禦)
                    if (target.lastAction === 'defend') {
                        log.innerHTML += `&nbsp;&nbsp;🛡️ ${target.name} 驚險擋下了 ${attacker.name} 的大砲！<br>`;
                    } else {
                        // 即使反彈也無效，目標死
                        if (target.lastAction === 'reflect') {
                            log.innerHTML += `&nbsp;&nbsp;🚀 反彈無效！${target.name} 被大砲炸飛！<br>`;
                        }
                        isDead = true;
                    }
                }

                if (isDead) {
                    if(!deaths.includes(target.id)) deaths.push(target.id);
                    log.innerHTML += `&nbsp;&nbsp;💀 ${target.name} 淘汰！<br>`;
                }
                if (isReflected) {
                    if(!deaths.includes(attacker.id)) deaths.push(attacker.id);
                    log.innerHTML += `&nbsp;&nbsp;💀 ${attacker.name} 淘汰！<br>`;
                }
            }
        }
    });

    // 移除死亡玩家
    deaths.forEach(id => {
        const p = players.find(p => p.id === id);
        if(p) p.hp = 0;
    });

    // D. 準備下一回合
    round++;
    document.getElementById('roundDisplay').innerText = round;
    if (renderArena()) {
        return;
    }
    updateControls();
    
    // 捲動 log 到最下方
    log.scrollTop = log.scrollHeight;
}

function decideBotAction(bot) {
    // 簡單 AI 邏輯
    let availableActions = ['load', 'defend'];
    
    // 有子彈才能射擊
    if (bot.ammo > 0) availableActions.push('shoot');
    
    // 有子彈且為了平衡，偶爾會反彈
    availableActions.push('reflect'); 

    // 氣滿了可以用大砲
    if (bot.charge >= 3) availableActions.push('bazooka');

    // 隨機選擇動作
    const action = availableActions[Math.floor(Math.random() * availableActions.length)];
    bot.lastAction = action;

    // 隨機選擇攻擊目標 (如果是攻擊動作)
    if (action === 'shoot' || action === 'bazooka') {
        bot.ammo = (action === 'shoot') ? bot.ammo - 1 : bot.ammo; // 大砲不扣彈? 這裡假設不扣
        if (action === 'bazooka') bot.charge = 0;

        // 找出活著的對手
        const targets = players.filter(p => p.id !== bot.id && p.hp > 0);
        if (targets.length > 0) {
            const randomTarget = targets[Math.floor(Math.random() * targets.length)];
            bot.targetId = randomTarget.id;
        } else {
            bot.lastAction = 'defend'; // 沒人可打就防禦
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
        rounds: rounds
    };
    records.unshift(newRecord);
    localStorage.setItem('gameRecords', JSON.stringify(records));
}

function checkWinner() {
    const survivors = players.filter(p => p.hp > 0);
    
    if (survivors.length <= 1) {
        let winnerName = survivors.length === 1 ? survivors[0].name : "無人生還";
        
        const user = players[0];
        const result = (survivors.length === 1 && survivors[0].isUser) ? '勝利' : '失敗';
        if (user.hp > 0 || result === '失敗') {
            saveRecord(user.name, result, round);
        }

        document.getElementById('gameLog').innerHTML += `<br>🎉🎉 遊戲結束！優勝者是：${winnerName} 🎉🎉`;
        
        const cards = document.querySelectorAll('.player-card');
        cards.forEach(c => {
             if(survivors.length === 1 && c.innerText.includes(survivors[0].name)) {
                 c.classList.add('winner');
             }
        });
        
        document.getElementById('controls').innerHTML = "<button class='btn-primary' onclick='location.reload()'>重新開始</button>";
        
        return true;
    }
    
    return false;
}
