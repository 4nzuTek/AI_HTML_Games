// サンプルデータ
const enemies = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: '敵' + (i + 1), hp: 30, desc: '敵の説明' + (i + 1) }));
const loot = Array.from({ length: 10 }, (_, i) => ({ id: 101 + i, name: 'アイテム' + (i + 1), type: 'item', desc: 'アイテムの説明' + (i + 1) }));
const inventory = Array.from({ length: 20 }, (_, i) => ({ id: 201 + i, name: '所持' + (i + 1), type: 'item', desc: '所持品の説明' + (i + 1) }));

function renderEnemies() {
    const area = document.getElementById('enemies');
    area.innerHTML = '';
    enemies.forEach(e => {
        const card = document.createElement('div');
        card.className = 'card enemy-card';
        card.textContent = '';
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
        card.textContent = '';
        card.dataset.id = i.id;
        card.dataset.type = i.type;
        card.addEventListener('mouseover', showTooltip.bind(null, i.desc));
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
        card.textContent = '';
        card.dataset.id = i.id;
        card.dataset.type = i.type;
        card.addEventListener('mouseover', showTooltip.bind(null, i.desc));
        card.addEventListener('mouseout', hideTooltip);
        card.addEventListener('contextmenu', showActionMenu.bind(null, i, 'inventory'));
        area.appendChild(card);
    });
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
        if (card.type === 'item') actions.push({ label: '使用する', handler: () => useItem(card) });
        if (card.type === 'weapon') actions.push({ label: '使用する', handler: () => useWeapon(card) });
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
    inventory.push(card);
    const idx = loot.findIndex(i => i.id === card.id);
    if (idx !== -1) loot.splice(idx, 1);
    renderLoot();
    renderInventory();
    addLog(`${card.name}を拾った。`);
}
function useItem(card) {
    addLog(`${card.name}を使用した。`);
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
    const idx = inventory.findIndex(i => i.id === card.id);
    if (idx !== -1) inventory.splice(idx, 1);
    renderInventory();
    addLog(`${card.name}を捨てた。`);
}
function attackEnemy(weapon, enemy) {
    addLog(`${enemy.name}に${weapon.name}で攻撃した！`);
}
function addLog(msg) {
    const log = document.getElementById('log');
    const div = document.createElement('div');
    div.textContent = msg;
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