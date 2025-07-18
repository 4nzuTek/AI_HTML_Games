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
    water: 100
};

function updatePlayerStatus() {
    document.getElementById('hp').textContent = player.hp;
    document.getElementById('energy').textContent = player.energy;
    document.getElementById('water').textContent = player.water;
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

function renderEnemies() {
    const area = document.getElementById('enemies');
    area.innerHTML = '';
    enemies.forEach(e => {
        const card = document.createElement('div');
        card.className = 'card enemy-card';
        const img = document.createElement('img');
        img.src = e.img;
        img.alt = e.name;
        card.appendChild(img);
        card.dataset.id = e.id;
        card.dataset.type = 'enemy';
        card.addEventListener('mouseover', showTooltip.bind(null, e.desc));
        card.addEventListener('mouseout', hideTooltip);
        card.addEventListener('contextmenu', showActionMenu.bind(null, e, 'enemy'));
        area.appendChild(card);
    });
}
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
        card.addEventListener('mouseover', showTooltip.bind(null, i.itemName));
        card.addEventListener('mouseout', hideTooltip);
        card.addEventListener('contextmenu', showActionMenu.bind(null, i, 'loot'));
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
        card.addEventListener('mouseover', showTooltip.bind(null, i.itemName + (i.currentDurability !== undefined ? `（耐久:${i.currentDurability}/${i.maxDurability}）` : '')));
        card.addEventListener('mouseout', hideTooltip);
        card.addEventListener('contextmenu', showActionMenu.bind(null, i, 'inventory'));
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
function showTooltip(desc, e) {
    const tooltip = document.getElementById('tooltip');
    tooltip.textContent = desc;
    tooltip.style.display = 'block';
    tooltip.style.left = (e.pageX + 12) + 'px';
    tooltip.style.top = (e.pageY + 12) + 'px';
}
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.display = 'none';
}
function showActionMenu(card, area, e) {
    e.preventDefault();
    hideTooltip();
    const menu = document.getElementById('action-menu');
    menu.innerHTML = '';
    let actions = [];
    if (area === 'enemy') {
        // 敵カードのアクション
    } else if (area === 'loot') {
        actions.push({ label: '拾う', handler: () => addToInventory(card) });
    } else if (area === 'inventory') {
        // 全てのアイテムで「使用する」ボタンを表示
        actions.push({ label: '使用する', handler: () => useItem(card) });
        actions.push({ label: '捨てる', handler: () => dropItem(card) });
    }
    actions.forEach(act => {
        const btn = document.createElement('button');
        btn.textContent = act.label;
        btn.onclick = () => { menu.style.display = 'none'; act.handler(); };
        menu.appendChild(btn);
    });
    if (actions.length === 0) return;
    menu.style.display = 'flex';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    document.addEventListener('click', hideActionMenu, { once: true });
}
function hideActionMenu() {
    document.getElementById('action-menu').style.display = 'none';
}
function addToInventory(card) {
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
    // 0未満/最大値制限（必要なら）
    player.hp = Math.max(0, Math.min(player.hp, 999));
    player.energy = Math.max(0, Math.min(player.energy, 999));
    player.water = Math.max(0, Math.min(player.water, 999));
    updatePlayerStatus();
    // 増減ログ（詳細）
    const after = { hp: player.hp, energy: player.energy, water: player.water };
    if (after.hp > before.hp) addLog(`HPが<span style="color:green; font-weight:bold;">${after.hp - before.hp}</span>回復した！`, 'detail', true);
    if (after.hp < before.hp) addLog(`HPが<span style="color:red; font-weight:bold;">${before.hp - after.hp}</span>減少した…`, 'detail', true);
    if (after.energy > before.energy) addLog(`エネルギーが<span style="color:green; font-weight:bold;">${after.energy - before.energy}</span>回復した！`, 'detail', true);
    if (after.energy < before.energy) addLog(`エネルギーが<span style="color:red; font-weight:bold;">${before.energy - after.energy}</span>減少した…`, 'detail', true);
    if (after.water > before.water) addLog(`水分が<span style="color:green; font-weight:bold;">${after.water - before.water}</span>回復した！`, 'detail', true);
    if (after.water < before.water) addLog(`水分が<span style="color:red; font-weight:bold;">${before.water - after.water}</span>減少した…`, 'detail', true);
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
            div.innerHTML = '　' + msg;
        } else {
            div.textContent = '　' + msg;
        }
    } else {
        if (isHtml) {
            div.innerHTML = msg;
        } else {
            div.textContent = msg;
        }
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}
window.onload = function () {
    renderEnemies();
    renderLoot();
    renderInventory();
    // ログのサンプル表示
    const log = document.getElementById('log');
    log.innerHTML = '------------------------------\nB1Fに到達\nパンを使用した。\nパンを捨てた。\n回復薬を拾った。\nナイフを拾った。\n回復薬を使用した。\nナイフを捨てた。\n回復薬を捨てた。';
}; 