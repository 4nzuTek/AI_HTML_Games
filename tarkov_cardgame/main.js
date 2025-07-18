// サンプルデータ削除
// const enemies = ...
// const loot = ...
// const inventory = ...

let itemMaster = [];
let loot = [];
let inventory = [];

// プレイヤーステータス
let player = {
    hp: 100,
    energy: 100,
    water: 100,
    // 属性ごとの防御力を追加
    defense: {
        1: 0, // 炎
        2: 0, // 水
        3: 0, // 風
        4: 0  // 地
    }
};

let floor = 1;
function updateFloor() {
    document.getElementById('floor').textContent = `B${floor}F`;
}

// 敵データ仮（本来はitemMaster等から生成）
let enemies = [];
function randomEnemies() {
    // 今は敵を出さない（空配列）
    enemies = [];
}
function renderEnemies() {
    const area = document.getElementById('enemies');
    area.innerHTML = '';
    enemies.forEach(e => {
        const card = document.createElement('div');
        card.className = 'card enemy-card';
        card.dataset.id = e.id;
        card.dataset.type = 'enemy';
        card.textContent = e.name;
        area.appendChild(card);
    });
}

function updatePlayerStatus() {
    // 0-100に制限
    player.hp = Math.max(0, Math.min(player.hp, 100));
    player.energy = Math.max(0, Math.min(player.energy, 100));
    player.water = Math.max(0, Math.min(player.water, 100));
    document.getElementById('hp').textContent = player.hp;
    document.getElementById('energy').textContent = player.energy;
    document.getElementById('water').textContent = player.water;
    document.getElementById('hp-bar').value = player.hp;
    document.getElementById('energy-bar').value = player.energy;
    document.getElementById('water-bar').value = player.water;
    // --- 防御力の表記を更新するだけに修正 ---
    const defenseText = `防御力：炎:${player.defense[1]} 水:${player.defense[2]} 風:${player.defense[3]} 地:${player.defense[4]}`;
    const defenseElem = document.getElementById('defense');
    if (defenseElem) defenseElem.textContent = defenseText;
}

function updateWeight() {
    document.getElementById('weight').textContent = `${inventory.length}/20`;
}

// アイテムマスタを読み込む
fetch('json/item.json')
    .then(res => {
        if (!res.ok) throw new Error('item.jsonの読み込みに失敗しました');
        return res.json();
    })
    .then(data => {
        itemMaster = data;
        console.log('itemMaster:', itemMaster); // データ確認用
        // loot/inventoryにcurrentDurabilityを持たせる
        loot = itemMaster.slice(0, 10).map(item => ({ ...item, currentDurability: item.maxDurability }));
        inventory = itemMaster.slice(10, 20).map(item => ({ ...item, currentDurability: item.maxDurability }));
        renderLoot();
        renderInventory();
        updatePlayerStatus();
        updateWeight();
    })
    .catch(err => {
        alert('アイテムデータの読み込みに失敗しました: ' + err.message);
        console.error(err);
    });

// --- 追加: ツールチップ制御用の変数 ---
let tooltipTargetCard = null; // 現在ツールチップを表示しているカード要素
let tooltipMenuOpen = false; // アクションメニュー上にマウスがあるか
let tooltipCardHover = false; // カード上にマウスがあるか
let tooltipHideTimer = null; // チップ消去用タイマー
let actionMenuTargetCard = null; // 現在アクションメニューを表示しているカード要素

function renderLoot() {
    const area = document.getElementById('loot');
    area.innerHTML = '';
    loot.forEach(i => {
        const card = document.createElement('div');
        card.className = 'card loot-card';
        const img = document.createElement('img');
        img.src = 'icon/' + i.imageName;
        img.alt = i.itemName;
        card.appendChild(img);
        card.dataset.id = i.itemID;
        card.dataset.type = i.itemTypeID;
        card.addEventListener('mouseenter', function (e) { onCardMouseEnter(i.itemName, card); });
        card.addEventListener('mouseleave', function (e) { onCardMouseLeave(); });
        card.addEventListener('contextmenu', function (e) { showActionMenu(i, 'loot', e, card); });
        area.appendChild(card);
    });
}
function renderInventory() {
    const area = document.getElementById('inventory');
    area.innerHTML = '';
    inventory.forEach(i => {
        const card = document.createElement('div');
        card.className = 'card inventory-card';
        card.style.position = 'relative'; // 耐久値表示用
        const img = document.createElement('img');
        img.src = 'icon/' + i.imageName;
        img.alt = i.itemName;
        card.appendChild(img);
        card.dataset.id = i.itemID;
        card.dataset.type = i.itemTypeID;
        card.addEventListener('mouseenter', function (e) { onCardMouseEnter(i.itemName + (i.currentDurability !== undefined ? `（耐久:${i.currentDurability}/${i.maxDurability}）` : ''), card); });
        card.addEventListener('mouseleave', function (e) { onCardMouseLeave(); });
        card.addEventListener('contextmenu', function (e) { showActionMenu(i, 'inventory', e, card); });
        // 耐久値表示（右上、ぎちぎち・シンプル表示）
        if (i.maxDurability > 0 && i.currentDurability !== undefined) {
            const dura = document.createElement('div');
            dura.style.position = 'absolute';
            dura.style.top = '0px';
            dura.style.right = '2px';
            dura.style.fontSize = '0.75em';
            dura.style.color = '#222';
            dura.style.background = 'none';
            dura.style.padding = '0';
            dura.textContent = `${i.currentDurability}/${i.maxDurability}`;
            card.appendChild(dura);
        }
        area.appendChild(card);
    });
    updateWeight();
}
function onCardMouseEnter(desc, card) {
    // 今表示中のカードと異なるカードに乗った場合のみアクションメニューを閉じる
    if (actionMenuTargetCard && actionMenuTargetCard !== card) {
        const menu = document.getElementById('action-menu');
        if (menu) menu.style.display = 'none';
        actionMenuTargetCard = null;
    }
    tooltipCardHover = true;
    showTooltip(desc, card);
    if (tooltipHideTimer) {
        clearTimeout(tooltipHideTimer);
        tooltipHideTimer = null;
    }
}
function onCardMouseLeave() {
    tooltipCardHover = false;
    tryHideTooltipWithDelay();
}
function showTooltip(desc, cardOrEvent) {
    const tooltip = document.getElementById('tooltip');
    tooltip.textContent = desc;
    tooltip.style.display = 'block';
    // 脱出ボタンの注意チップはボタン要素基準（左上と左下を合わせる）
    if (cardOrEvent && cardOrEvent instanceof HTMLElement && cardOrEvent.id === 'escape-btn') {
        const rect = cardOrEvent.getBoundingClientRect();
        const left = rect.left;
        const top = rect.top;
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        tooltip.style.left = (left + scrollX) + 'px';
        tooltip.style.top = (top + scrollY - tooltip.offsetHeight) + 'px';
        tooltipTargetCard = null;
        return;
    }
    // 通常はカード基準
    if (cardOrEvent && cardOrEvent.getBoundingClientRect) {
        const rect = cardOrEvent.getBoundingClientRect();
        // 枠線クラス付与（先に付与してからスタイル取得）
        if (tooltipTargetCard && tooltipTargetCard !== cardOrEvent) {
            tooltipTargetCard.classList.remove('card-tooltip-focus');
        }
        if (cardOrEvent.classList) {
            cardOrEvent.classList.add('card-tooltip-focus');
        }
        // outline幅をCSSから動的に取得
        let outlineWidth = 0;
        if (cardOrEvent.classList && cardOrEvent.classList.contains('card-tooltip-focus')) {
            const style = window.getComputedStyle(cardOrEvent);
            outlineWidth = parseInt(style.outlineWidth) || 0;
        }
        const left = rect.left - outlineWidth;
        const top = rect.top;
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        tooltip.style.left = (left + scrollX) + 'px';
        tooltip.style.top = (top + scrollY - tooltip.offsetHeight) + 'px';
        tooltipTargetCard = cardOrEvent;
    } else {
        tooltip.style.left = '0px';
        tooltip.style.top = '0px';
        if (tooltipTargetCard && tooltipTargetCard.classList) {
            tooltipTargetCard.classList.remove('card-tooltip-focus');
        }
        tooltipTargetCard = null;
    }
}
function tryHideTooltipWithDelay() {
    if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
    tooltipHideTimer = setTimeout(function () {
        if (!tooltipCardHover && !tooltipMenuOpen) {
            hideTooltip();
        }
    }, 100); // 0.1秒の猶予
}
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.display = 'none';
    if (tooltipTargetCard && tooltipTargetCard.classList) {
        tooltipTargetCard.classList.remove('card-tooltip-focus');
    }
    tooltipTargetCard = null;
    tooltipHideTimer = null;
    // アクションメニューも同時に消す
    const menu = document.getElementById('action-menu');
    if (menu) menu.style.display = 'none';
    actionMenuTargetCard = null;
}
function showActionMenu(card, area, e, cardElem) {
    e.preventDefault();
    const menu = document.getElementById('action-menu');
    menu.innerHTML = '';
    let actions = [];
    if (area === 'enemy') {
        // 敵カードのアクション
    } else if (area === 'loot') {
        // インベントリが20枚未満なら拾うボタン有効、20枚ならグレーアウト
        const isFull = inventory.length >= 20;
        actions.push({
            label: '拾う',
            handler: () => { if (!isFull) addToInventory(card); },
            disabled: isFull
        });
    } else if (area === 'inventory') {
        // 全てのアイテムで「使用する」ボタンを表示
        actions.push({ label: '使用する', handler: () => useItem(card) });
        actions.push({ label: '捨てる', handler: () => dropItem(card) });
    }
    actions.forEach(act => {
        const btn = document.createElement('button');
        btn.textContent = act.label;
        btn.onclick = () => { menu.style.display = 'none'; if (!act.disabled) act.handler(); };
        if (act.disabled) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        }
        menu.appendChild(btn);
    });
    if (actions.length === 0) return;
    menu.style.display = 'flex';
    if (cardElem && cardElem.getBoundingClientRect) {
        const rect = cardElem.getBoundingClientRect();
        const right = rect.right;
        let top = rect.top;
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        // outline幅をCSSから動的に取得
        let outlineWidth = 0;
        if (cardElem.classList && cardElem.classList.contains('card-tooltip-focus')) {
            const style = window.getComputedStyle(cardElem);
            outlineWidth = parseInt(style.outlineWidth) || 0;
        }
        top = top - outlineWidth;
        // アクションメニューの左上をカードの右上に合わせる（上にオフセット）
        menu.style.left = (right + scrollX) + 'px';
        menu.style.top = (top + scrollY) + 'px';
    } else {
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
    }
    // --- アクションメニューのマウスイベント ---
    menu.onmouseenter = function () {
        tooltipMenuOpen = true;
        if (tooltipHideTimer) {
            clearTimeout(tooltipHideTimer);
            tooltipHideTimer = null;
        }
    };
    menu.onmouseleave = function () {
        tooltipMenuOpen = false;
        tryHideTooltipWithDelay();
    };
    actionMenuTargetCard = cardElem;
    document.addEventListener('click', hideActionMenu, { once: true });
}
function hideActionMenu() {
    document.getElementById('action-menu').style.display = 'none';
}
function addToInventory(card) {
    if (inventory.length >= 20) return; // 21枚以上は追加しない
    inventory.push({ ...card });
    const idx = loot.findIndex(i => i.itemID === card.itemID);
    if (idx !== -1) loot.splice(idx, 1);
    renderLoot();
    renderInventory();
    addLog(`${card.itemName}を拾った。`, 'action');
}
function useItem(card) {
    // 使用前の値を保存
    const before = { hp: player.hp, energy: player.energy, water: player.water };
    // 先に使用ログ（アクション）
    addLog(`${card.itemName}を使用した。`, 'action');
    // HP,エネルギー,水分をitemデータに従い増減
    if (typeof card.hpRecov === 'number') player.hp += card.hpRecov;
    if (typeof card.eneRecov === 'number') player.energy += card.eneRecov;
    if (typeof card.waterRecov === 'number') player.water += card.waterRecov;
    // 0-100に制限
    player.hp = Math.max(0, Math.min(player.hp, 100));
    player.energy = Math.max(0, Math.min(player.energy, 100));
    player.water = Math.max(0, Math.min(player.water, 100));
    updatePlayerStatus();
    // 増減ログ（詳細）
    const after = { hp: player.hp, energy: player.energy, water: player.water };
    let changed = false;
    if (after.hp > before.hp) { addLog(`HPが<span style="color:green; font-weight:bold;">${after.hp - before.hp}</span>回復した！`, 'detail', true); changed = true; }
    if (after.hp < before.hp) { addLog(`HPが<span style="color:red; font-weight:bold;">${before.hp - after.hp}</span>減少した…`, 'detail', true); changed = true; }
    if (after.energy > before.energy) { addLog(`エネルギーが<span style="color:green; font-weight:bold;">${after.energy - before.energy}</span>回復した！`, 'detail', true); changed = true; }
    if (after.energy < before.energy) { addLog(`エネルギーが<span style="color:red; font-weight:bold;">${before.energy - after.energy}</span>減少した…`, 'detail', true); changed = true; }
    if (after.water > before.water) { addLog(`水分が<span style="color:green; font-weight:bold;">${after.water - before.water}</span>回復した！`, 'detail', true); changed = true; }
    if (after.water < before.water) { addLog(`水分が<span style="color:red; font-weight:bold;">${before.water - after.water}</span>減少した…`, 'detail', true); changed = true; }
    // 何も変動しなかった場合
    if (!changed) {
        addLog('しかし、何も起こらなかった...', 'detail');
    }
    // 耐久値を減らす
    const idx = inventory.findIndex(i => i.itemID === card.itemID);
    if (idx !== -1) {
        if (inventory[idx].currentDurability > 1) {
            inventory[idx].currentDurability--;
        } else {
            inventory.splice(idx, 1); // 0になったら削除
        }
        renderInventory();
    }
}
function useWeapon(card) {
    // エネミー選択メニューを表示
    const menu = document.getElementById('action-menu');
    menu.innerHTML = '<div style="padding:8px;">攻撃対象を選択:</div>';
    enemies.forEach(e => {
        const btn = document.createElement('button');
        btn.textContent = `${e.name} (HP:${e.hp})`;
        btn.onclick = () => {
            menu.style.display = 'none';
            attackEnemy(card, e);
        };
        menu.appendChild(btn);
    });
    menu.style.display = 'flex';
}
function dropItem(card) {
    const idx = inventory.findIndex(i => i.itemID === card.itemID);
    if (idx !== -1) inventory.splice(idx, 1);
    renderInventory();
    addLog(`${card.itemName}を捨てた。`, 'action');
}
function attackEnemy(weapon, enemy) {
    addLog(`${enemy.name}に${weapon.name}で攻撃した！`);
}
function addLog(msg, type = 'action', isHtml = false) {
    const log = document.getElementById('log');
    const div = document.createElement('div');
    if (type === 'detail') {
        if (isHtml) {
            div.innerHTML = '　　' + '　' + msg; // 全角3つ
        } else {
            div.textContent = '　　' + '　' + msg;
        }
    } else if (type === 'action') {
        if (isHtml) {
            div.innerHTML = '　　' + msg; // 全角2つ
        } else {
            div.textContent = '　　' + msg;
        }
    } else {
        // 仕切り線やフロア到達などは空白なし
        if (isHtml) {
            div.innerHTML = msg;
        } else {
            div.textContent = msg;
        }
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}
function nextFloor() {
    // 仕切り線
    addLog('----------------------', 'floor');
    // 1. フロア番号を進める
    floor++;
    updateFloor();
    addLog(`B${floor}Fに到達した。`, 'floor');
    // 2. 重量ペナルティ
    const penalty = inventory.length - 10;
    if (penalty > 0) {
        player.energy -= penalty;
        player.water -= penalty;
        // 0-100に制限
        player.energy = Math.max(0, Math.min(player.energy, 100));
        player.water = Math.max(0, Math.min(player.water, 100));
        addLog(`荷物が重い...。エネルギー・水分が<span style="color:red; font-weight:bold;">${penalty}</span>減少した…`, 'detail', true);
        updatePlayerStatus();
    }
    // 3. 敵ダメージ
    if (enemies.length > 0) {
        // 新フロアにも敵がいる場合（今回は毎回生成）
        const totalAtk = enemies.reduce((sum, e) => sum + (e.attack || 0), 0);
        player.hp -= totalAtk;
        // 0-100に制限
        player.hp = Math.max(0, Math.min(player.hp, 100));
        addLog(`敵の攻撃！HPが<span style="color:red; font-weight:bold;">${totalAtk}</span>減少した…`, 'detail', true);
        updatePlayerStatus();
    }
    // 4. ルートアイテム再生成
    const lootNum = Math.floor(Math.random() * 10) + 1;
    loot = [];
    for (let i = 0; i < lootNum; i++) {
        const idx = Math.floor(Math.random() * itemMaster.length);
        loot.push({ ...itemMaster[idx], currentDurability: itemMaster[idx].maxDurability });
    }
    renderLoot();
    // 5. 敵も再生成
    randomEnemies();
    renderEnemies();
}
window.onload = function () {
    updateFloor();
    randomEnemies(); // 初期化時も敵なし
    renderEnemies();
    renderLoot();
    renderInventory();
    updatePlayerStatus();
    updateWeight();
    document.getElementById('next-floor-btn').onclick = nextFloor;
    // 脱出ボタン制御
    const escapeBtn = document.getElementById('escape-btn');
    function updateEscapeBtn() {
        if (enemies.length === 0 && floor % 5 === 0) {
            escapeBtn.disabled = false;
        } else {
            escapeBtn.disabled = true;
        }
    }
    // 初期化時・フロア移動時・敵再生成時に呼ぶ
    const origRenderEnemies = renderEnemies;
    renderEnemies = function () {
        origRenderEnemies();
        updateEscapeBtn();
    };
    const origNextFloor = nextFloor;
    nextFloor = function () {
        origNextFloor();
        updateEscapeBtn();
    };
    updateEscapeBtn();
    // 脱出ボタンのマウスオーバー時のイベントを修正
    escapeBtn.addEventListener('mouseover', function (e) {
        if (escapeBtn.disabled) {
            showTooltip('脱出するには敵がいない状態で5の倍数の階層にいる必要があります。', escapeBtn);
        }
    });
    escapeBtn.addEventListener('mouseout', hideTooltip);
    // 脱出ボタン押下時
    escapeBtn.onclick = function () {
        if (!escapeBtn.disabled) {
            addLog('脱出に成功した！ゲームクリア！', 'action');
            // ここでゲームクリア処理等を追加可能
        }
    };
    // 初期ログに「B1Fに到達」だけ表示
    const log = document.getElementById('log');
    log.innerHTML = '';
    addLog('B1Fに到達した。', 'floor');
    // 右クリックメニュー無効化
    const gameCanvas = document.getElementById('game-canvas');
    if (gameCanvas) {
        gameCanvas.addEventListener('contextmenu', function (e) {
            e.preventDefault();
        });
    }
    // アクションメニュー上でも右クリックメニュー無効化
    const actionMenu = document.getElementById('action-menu');
    if (actionMenu) {
        actionMenu.addEventListener('contextmenu', function (e) {
            e.preventDefault();
        });
    }
}; 