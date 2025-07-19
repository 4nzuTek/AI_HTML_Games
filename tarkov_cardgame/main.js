// サンプルデータ削除
// const enemies = ...
// const loot = ...
// const inventory = ...

let itemMaster = [];
let loot = [];
let inventory = [];
let enemyMaster = [];
let nextInvIndex = 0; // 追加: invIndex管理用

// 敵画像ファイル一覧（初期化時に取得）
const ENEMY_IMAGE_LIST = [
    'mon_001.bmp', 'mon_002.bmp', 'mon_003.bmp', 'mon_004.bmp', 'mon_005.bmp', 'mon_006.bmp', 'mon_007.bmp', 'mon_008.bmp', 'mon_009.bmp', 'mon_010.bmp', 'mon_011.bmp', 'mon_012.bmp', 'mon_013.bmp', 'mon_014.bmp', 'mon_015.bmp', 'mon_016.bmp', 'mon_017.bmp', 'mon_018.bmp', 'mon_019.bmp', 'mon_020.bmp', 'mon_021.bmp', 'mon_022.bmp', 'mon_023.bmp', 'mon_024.bmp', 'mon_025.bmp', 'mon_026.bmp', 'mon_027.bmp', 'mon_028.bmp', 'mon_029.bmp', 'mon_030.bmp', 'mon_031.bmp', 'mon_032.bmp', 'mon_033.bmp', 'mon_034.bmp', 'mon_035.bmp', 'mon_036.bmp', 'mon_037.bmp', 'mon_038.bmp', 'mon_039.bmp', 'mon_040.bmp', 'mon_041.bmp', 'mon_042.bmp', 'mon_043.bmp', 'mon_044.bmp', 'mon_045.bmp', 'mon_046.bmp', 'mon_047.bmp', 'mon_048.bmp', 'mon_049.bmp', 'mon_050.bmp'
];

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
    },
    statuses: [] // 状態異常配列を追加
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
        // --- エネミー画像（Canvasで抜き色処理） ---
        const randImg = ENEMY_IMAGE_LIST[Math.floor(Math.random() * ENEMY_IMAGE_LIST.length)];
        const img = new window.Image();
        img.src = 'images/enemy/' + randImg;
        img.onload = function () {
            const cardW = Math.max(50, img.width);
            const cardH = Math.max(80, img.height);
            const canvas = document.createElement('canvas');
            canvas.width = cardW;
            canvas.height = cardH;
            canvas.style.width = cardW + 'px';
            canvas.style.height = cardH + 'px';
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false; // 補間無効
            // まず一旦元サイズでdrawImage（左上配置、scale=1）
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = img.width;
            tmpCanvas.height = img.height;
            const tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.drawImage(img, 0, 0);
            const imageData = tmpCtx.getImageData(0, 0, img.width, img.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (
                    data[i] === 129 && // R
                    data[i + 1] === 121 && // G
                    data[i + 2] === 125    // B
                ) {
                    data[i + 3] = 0; // 透明化
                }
            }
            tmpCtx.putImageData(imageData, 0, 0);
            // カード中央に描画
            const offsetX = Math.floor((cardW - img.width) / 2);
            const offsetY = Math.floor((cardH - img.height) / 2);
            ctx.drawImage(tmpCanvas, offsetX, offsetY);
            card.appendChild(canvas);
            card.style.width = cardW + 'px';
            card.style.height = cardH + 'px';
            // --- ここからHP表示 ---
            const hpDiv = document.createElement('div');
            hpDiv.style.position = 'absolute';
            hpDiv.style.top = '0px';
            hpDiv.style.right = '2px';
            hpDiv.style.fontSize = '0.75em';
            hpDiv.style.color = '#222';
            hpDiv.style.background = 'none';
            hpDiv.style.padding = '0';
            hpDiv.textContent = `${e.hp}/${e.maxHp}`;
            card.appendChild(hpDiv);
            // --- ここまでHP表示 ---
        };
        img.onerror = function () {
            // 読み込み失敗時は何も表示しない
        };
        // --- エネミー情報のツールチップ ---
        card.addEventListener('mouseenter', function () {
            const desc =
                `<b>【${e.name}】</b><br>` +
                `HP: <b>${e.hp}</b> / ${e.maxHp}<br>` +
                `攻撃力: <b>${e.attack}</b><br>` +
                `発生確率:<br>&emsp;炎: <b>${Math.round((e.attackChance[0] || 0) * 100)}%</b>　水: <b>${Math.round((e.attackChance[1] || 0) * 100)}%</b><br>&emsp;風: <b>${Math.round((e.attackChance[2] || 0) * 100)}%</b>　地: <b>${Math.round((e.attackChance[3] || 0) * 100)}%</b><br>` +
                `防御力:<br>&emsp;炎: <b>${e.defence[0] || 0}</b>　水: <b>${e.defence[1] || 0}</b>　風: <b>${e.defence[2] || 0}</b>　地: <b>${e.defence[3] || 0}</b>`;
            onCardMouseEnter(desc, card);
        });
        card.addEventListener('mouseleave', function () { onCardMouseLeave(); });
        card.addEventListener('contextmenu', function (e) { showActionMenu(e, 'enemy', e, card); });
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
    // --- 状態表示を追加 ---
    const statusElem = document.getElementById('status');
    if (statusElem) {
        if (player.statuses && player.statuses.length > 0) {
            statusElem.textContent = player.statuses.join(' / ');
        } else {
            statusElem.textContent = '-';
        }
    }
    checkGameOver();
}

function updateWeight() {
    document.getElementById('weight').textContent = `${inventory.length}/20`;
}

// アイテムタイプマスタを先に読み込む
fetch('json/itemType.json')
    .then(res => {
        if (!res.ok) throw new Error('itemType.jsonの読み込みに失敗しました');
        return res.json();
    })
    .then(data => {
        window.itemTypeMaster = data;
        // itemTypeMasterのロード後にitemMasterをロード
        return fetch('json/item.json');
    })
    .then(res => {
        if (!res.ok) throw new Error('item.jsonの読み込みに失敗しました');
        return res.json();
    })
    .then(data => {
        itemMaster = data;
        console.log('itemMaster:', itemMaster); // データ確認用
        // loot/inventoryにcurrentDurabilityとinvIndexを持たせてランダムに10個ずつ生成
        function getRandomItems(arr, n) {
            const result = [];
            for (let i = 0; i < n; i++) {
                const idx = Math.floor(Math.random() * arr.length);
                const base = arr[idx];
                // 武器ならisLoaded初期化
                let extra = {};
                if (base.itemTypeID === 1) extra.isLoaded = false;
                result.push({ ...base, currentDurability: base.maxDurability, invIndex: nextInvIndex++, ...extra });
            }
            return result;
        }
        loot = getRandomItems(itemMaster, 10);
        inventory = getRandomItems(itemMaster, 10);
        renderLoot();
        renderInventory();
        updatePlayerStatus();
        updateWeight();
    })
    .catch(err => {
        alert('アイテムデータまたはタイプデータの読み込みに失敗しました: ' + err.message);
        console.error(err);
    });

// --- 敵マスタを読み込む ---
fetch('json/enemy.json')
    .then(res => {
        if (!res.ok) throw new Error('enemy.jsonの読み込みに失敗しました');
        return res.json();
    })
    .then(data => {
        enemyMaster = data;
        console.log('enemyMaster:', enemyMaster); // データ確認用
        // ゲーム開始時にID=1001の敵をスポーン
        const enemy1001 = enemyMaster.find(e => e.enemyID === 1001);
        if (enemy1001) {
            enemies = [{
                id: enemy1001.enemyID,
                name: enemy1001.enemyName,
                hp: enemy1001.maxHp,
                maxHp: enemy1001.maxHp,
                attack: enemy1001.attack,
                attackChance: [enemy1001.attackChance_attr01, enemy1001.attackChance_attr02, enemy1001.attackChance_attr03, enemy1001.attackChance_attr04],
                defence: [enemy1001.defence_attr01, enemy1001.defence_attr02, enemy1001.defence_attr03, enemy1001.defence_attr04]
            }];
        }
        renderEnemies();
    })
    .catch(err => {
        alert('エネミーデータの読み込みに失敗しました: ' + err.message);
        console.error(err);
    });

// --- 追加: ツールチップ制御用の変数 ---
let tooltipTargetCard = null; // 現在ツールチップを表示しているカード要素
let tooltipMenuOpen = false; // アクションメニュー上にマウスがあるか
let tooltipCardHover = false; // カード上にマウスがあるか
let tooltipHideTimer = null; // チップ消去用タイマー
let actionMenuTargetCard = null; // 現在アクションメニューを表示しているカード要素
let actionMenuForceOpen = false; // チップ強制オープンフラグ
let currentTooltipTargetItem = null; // 現在ターゲット中のアイテム情報

function getItemTooltip(item) {
    // アイテム種別名を取得
    let itemTypeName = '';
    let typeColor = '';
    if (window.itemTypeMaster && item.itemTypeID) {
        const t = window.itemTypeMaster.find(t => t.tileTypeID === item.itemTypeID);
        if (t) {
            itemTypeName = t.tileTypeName;
            if (t.color) typeColor = `#${t.color}`;
        }
    }
    // 属性名を取得
    let attrName = '';
    if (item.attrID !== null && item.attrID !== undefined) {
        if (item.attrID === 1) attrName = '炎';
        else if (item.attrID === 2) attrName = '水';
        else if (item.attrID === 3) attrName = '風';
        else if (item.attrID === 4) attrName = '地';
    }
    // 耐久値
    let durability = '';
    if (item.maxDurability > 0 && item.currentDurability !== undefined) {
        durability = `<span class="tooltip-durability">${item.currentDurability}/${item.maxDurability}</span>`;
    }
    // パラメータ表
    let paramRows = '';
    if (item.eneRecov !== null && item.eneRecov !== undefined && item.eneRecov !== 0) paramRows += `<tr><td>エネルギー回復量</td><td>${item.eneRecov}</td></tr>`;
    if (item.waterRecov !== null && item.waterRecov !== undefined && item.waterRecov !== 0) paramRows += `<tr><td>水分回復量</td><td>${item.waterRecov}</td></tr>`;
    if (item.hpRecov !== null && item.hpRecov !== undefined && item.hpRecov !== 0) paramRows += `<tr><td>HP回復量</td><td>${item.hpRecov}</td></tr>`;
    // 攻撃力
    if (item.attack !== null && item.attack !== undefined && item.attack !== 0) paramRows += `<tr><td>攻撃力</td><td>${item.attack}</td></tr>`;
    // 防御力
    if (item.defence !== null && item.defence !== undefined && item.defence !== 0) paramRows += `<tr><td>防御力</td><td>${item.defence}</td></tr>`;
    // 命中率
    if (item.accuracy !== null && item.accuracy !== undefined && item.accuracy !== 0) paramRows += `<tr><td>命中率</td><td>${Math.round(item.accuracy * 100)}%</td></tr>`;
    // クリティカル率
    if (item.critical !== null && item.critical !== undefined && item.critical !== 0) paramRows += `<tr><td>クリティカル率</td><td>${Math.round(item.critical * 100)}%</td></tr>`;
    if (item.paralysisCure) paramRows += `<tr><td>麻痺回復</td><td>○</td></tr>`;
    if (item.poisonCure) paramRows += `<tr><td>毒回復</td><td>○</td></tr>`;
    if (item.curseCure) paramRows += `<tr><td>呪い回復</td><td>○</td></tr>`;
    if (item.blessing) paramRows += `<tr><td>加護付与</td><td>○</td></tr>`;
    // 画像
    const img = `<div class="tooltip-imgbox"><img src="images/item/${item.imageName}" alt="${item.itemName}" class="tooltip-img"></div>`;
    // HTML組み立て
    return `
    <div class="tooltip-cardbox"${typeColor ? ` style=\"background:${typeColor};\"` : ''}>
      <div class="tooltip-header">
        <b class="tooltip-title">${item.itemName}</b>
        ${durability ? `<span class="tooltip-durability">${durability}</span>` : ''}
      </div>
      <div class="tooltip-type">${itemTypeName}${attrName ? `（${attrName}）` : ''}</div>
      ${img}
      <div class="tooltip-divider"></div>
      <table class="tooltip-paramtable">${paramRows}</table>
    </div>
    `;
}
function renderLoot() {
    const area = document.getElementById('loot');
    area.innerHTML = '';
    loot.forEach(i => {
        const card = document.createElement('div');
        card.className = 'card loot-card';
        card.style.position = 'relative'; // 耐久値表示用
        // === タイプごとの背景色 ===
        let bgColor = '';
        if (window.itemTypeMaster && i.itemTypeID) {
            const t = window.itemTypeMaster.find(t => t.tileTypeID == i.itemTypeID);
            if (t && t.color) bgColor = t.color;
        }
        if (bgColor) card.style.backgroundColor = `#${bgColor}`;
        const img = document.createElement('img');
        img.src = 'images/item/' + i.imageName;
        img.alt = i.itemName;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        card.appendChild(img);
        card.dataset.id = i.itemID;
        card.dataset.type = i.itemTypeID;
        card.dataset.index = i.invIndex; // 追加
        card.addEventListener('mouseenter', function (e) { onCardMouseEnter(getItemTooltip(i), card); });
        card.addEventListener('mouseleave', function (e) { onCardMouseLeave(); });
        card.addEventListener('contextmenu', function (e) { showActionMenu(i, 'loot', e, card); });
        // 耐久値表示（右上、シンプル表示）
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
        // 枠線再付与
        if (currentTooltipTargetItem && currentTooltipTargetItem.itemID == i.itemID && currentTooltipTargetItem.invIndex == i.invIndex) {
            card.classList.add('card-tooltip-focus');
            void card.offsetWidth;
            // console.log(`[tooltip] 枠線再付与(renderLoot): cardID=${i.itemID}, invIndex=${i.invIndex}`);
        }
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
        // === タイプごとの背景色 ===
        let bgColor = '';
        if (window.itemTypeMaster && i.itemTypeID) {
            const t = window.itemTypeMaster.find(t => t.tileTypeID == i.itemTypeID);
            if (t && t.color) bgColor = t.color;
        }
        if (bgColor) card.style.backgroundColor = `#${bgColor}`;
        const img = document.createElement('img');
        img.src = 'images/item/' + i.imageName;
        img.alt = i.itemName;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        card.appendChild(img);
        card.dataset.id = i.itemID;
        card.dataset.type = i.itemTypeID;
        card.dataset.index = i.invIndex; // 追加
        card.addEventListener('mouseenter', function (e) { onCardMouseEnter(getItemTooltip(i), card); });
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
        // 枠線再付与
        if (currentTooltipTargetItem && currentTooltipTargetItem.itemID == i.itemID && currentTooltipTargetItem.invIndex == i.invIndex) {
            card.classList.add('card-tooltip-focus');
            void card.offsetWidth;
            // console.log(`[tooltip] 枠線再付与(renderInventory): cardID=${i.itemID}, invIndex=${i.invIndex}`);
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
    // ターゲット情報セット＋枠線付与
    if (card && card.dataset && card.dataset.id && card.dataset.index) {
        const id = Number(card.dataset.id);
        const invIndex = Number(card.dataset.index);
        currentTooltipTargetItem = inventory.find(i => i.itemID == id && i.invIndex == invIndex) || loot.find(i => i.itemID == id && i.invIndex == invIndex) || null;
        if (currentTooltipTargetItem) {
            // console.log(`[tooltip] ターゲット設定: itemID=${currentTooltipTargetItem.itemID}, invIndex=${currentTooltipTargetItem.invIndex}`);
        } else {
            // console.log('[tooltip] ターゲット設定: null');
        }
        if (card.classList && !card.classList.contains('card-tooltip-focus')) {
            card.classList.add('card-tooltip-focus');
            void card.offsetWidth;
            // console.log('[tooltip] 枠線付与');
        }
    } else {
        currentTooltipTargetItem = null;
        // console.log('[tooltip] ターゲット設定: null（カード情報なし）');
    }
}
function onCardMouseLeave() {
    tooltipCardHover = false;
    tryHideTooltipWithDelay();
}
function showTooltip(desc, cardOrEvent) {
    const tooltip = document.getElementById('tooltip');
    tooltip.innerHTML = desc;
    tooltip.style.display = 'block';
    // 枠線制御: 情報チップ表示時は必ず枠線を付与
    if (cardOrEvent && cardOrEvent.classList && !cardOrEvent.classList.contains('card-tooltip-focus')) {
        cardOrEvent.classList.add('card-tooltip-focus');
        void cardOrEvent.offsetWidth;
        // console.log('[tooltip] 枠線付与(showTooltip)');
    }
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
    // --- エネミーカードの場合は右上基準 ---
    if (cardOrEvent && cardOrEvent.classList && cardOrEvent.classList.contains('enemy-card')) {
        const rect = cardOrEvent.getBoundingClientRect();
        // 枠線・outline幅をCSSから取得
        let borderW = 0, outlineW = 0;
        const style = window.getComputedStyle(cardOrEvent);
        borderW = parseInt(style.borderRightWidth) || 0;
        outlineW = parseInt(style.outlineWidth) || 0;
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        // アイテムアクションメニューと同じロジックで補正
        // console.log('enemy-card outlineW:', outlineW);
        const left = rect.right + scrollX;
        const top = rect.top - outlineW + scrollY;
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        // 枠線クラス付与（注目中）
        if (tooltipTargetCard && tooltipTargetCard !== cardOrEvent) {
            tooltipTargetCard.classList.remove('card-tooltip-focus');
        }
        if (cardOrEvent.classList) {
            cardOrEvent.classList.add('card-tooltip-focus');
            void cardOrEvent.offsetWidth;
        }
        setTimeout(() => {
            const style = window.getComputedStyle(cardOrEvent);
            borderW = parseInt(style.borderRightWidth) || 0;
            outlineW = parseInt(style.outlineWidth) || 0;
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.pageYOffset || window.scrollY;
            // console.log('enemy-card outlineW:', outlineW);
            const left = rect.right + scrollX;
            const top = rect.top - outlineW + scrollY;
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            // 枠線クラス付与（注目中）
            if (tooltipTargetCard && tooltipTargetCard !== cardOrEvent) {
                tooltipTargetCard.classList.remove('card-tooltip-focus');
            }
            tooltipTargetCard = cardOrEvent;
        }, 0);
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
            void cardOrEvent.offsetWidth; // 強制リフロー
        }
        const style = window.getComputedStyle(cardOrEvent);
        outlineW = parseInt(style.outlineWidth) || 0;
        // console.log('item-card outlineW:', outlineW);
        const left = rect.left - outlineW;
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
    if (actionMenuForceOpen) {
        // console.log('[actionMenu] 強制オープン中のためhideTooltipを無視');
        return;
    }
    const tooltip = document.getElementById('tooltip');
    tooltip.style.display = 'none';
    // 枠線制御: 情報チップ非表示時は必ず枠線を除去
    if (tooltipTargetCard && tooltipTargetCard.classList && tooltipTargetCard.classList.contains('card-tooltip-focus')) {
        const cardId = tooltipTargetCard.dataset && tooltipTargetCard.dataset.id ? tooltipTargetCard.dataset.id : 'unknown';
        tooltipTargetCard.classList.remove('card-tooltip-focus');
        // console.log(`[tooltip] 枠線除去(hideTooltip): cardID=${cardId}`);
    }
    // 追加: 全カードから枠線クラスを除去（耐久が残っている時の枠線残り対策）
    document.querySelectorAll('.card-tooltip-focus').forEach(card => {
        card.classList.remove('card-tooltip-focus');
    });
    // ターゲット解除＋枠線除去
    if (currentTooltipTargetItem) {
        // console.log(`[tooltip] ターゲット解除: itemID=${currentTooltipTargetItem.itemID}`);
    } else {
        // console.log('[tooltip] ターゲット解除: null');
    }
    currentTooltipTargetItem = null;
    tooltipTargetCard = null;
    tooltipHideTimer = null;
    // アクションメニューも同時に消す
    const menu = document.getElementById('action-menu');
    if (menu) menu.style.display = 'none';
    actionMenuTargetCard = null;
    // console.log('[actionMenu] hideTooltip: チップを閉じた');
}
function showActionMenu(card, area, e, cardElem) {
    e.preventDefault();
    const menu = document.getElementById('action-menu');
    menu.innerHTML = '';
    let actions = [];
    // === ここから背景色設定 ===
    let typeColor = '';
    if ((area === 'loot' || area === 'inventory') && window.itemTypeMaster && card.itemTypeID) {
        const t = window.itemTypeMaster.find(t => t.tileTypeID == card.itemTypeID);
        if (t && t.color) typeColor = `#${t.color}`;
    }
    menu.style.background = typeColor ? typeColor : '#fff';
    // === ここまで背景色設定 ===
    // --- ここからアクション生成 ---
    if (area === 'loot') {
        // ルートエリアは「拾う」だけ
        const isFull = inventory.length >= 20;
        actions.push({
            label: '拾う',
            handler: () => { if (!isFull) addToInventory(card); },
            disabled: isFull
        });
    } else if (area === 'inventory') {
        let actionList = [];
        if (window.itemTypeMaster && card.itemTypeID) {
            const t = window.itemTypeMaster.find(t => t.tileTypeID == card.itemTypeID);
            if (t && t.action) {
                actionList = t.action.split(',').map(s => s.trim());
            }
        }
        actionList.forEach(act => {
            if (act === '使用' || act === '使用する') {
                actions.push({ label: '使用する', handler: () => useItem(card) });
            } else if (act === '捨てる') {
                actions.push({ label: '捨てる', handler: () => dropItem(card) });
            } else if (act === '攻撃') {
                // 装填済みでない場合はグレーアウト
                const widx = inventory.findIndex(i => i.itemID === card.itemID && i.invIndex === card.invIndex);
                const isLoaded = (widx !== -1 && inventory[widx].isLoaded);
                actions.push({
                    label: '攻撃',
                    handler: () => {
                        if (isLoaded) {
                            actionMenuForceOpen = true;
                            setTimeout(() => { actionMenuForceOpen = false; }, 0);
                            showWeaponAttackMenu(card);
                        }
                    },
                    disabled: !isLoaded
                });
            } else if (act === 'マナ装填') {
                // 装填済みならグレーアウト
                const widx = inventory.findIndex(i => i.itemID === card.itemID && i.invIndex === card.invIndex);
                const isLoaded = (widx !== -1 && inventory[widx].isLoaded);
                actions.push({
                    label: 'マナ装填', handler: () => {
                        if (!isLoaded) {
                            actionMenuForceOpen = true;
                            setTimeout(() => { actionMenuForceOpen = false; }, 0);
                            showManaLoadMenu(card);
                        }
                    }, disabled: isLoaded
                });
            } else if (act === '装備') {
                actions.push({ label: '装備', handler: () => alert('装備は未実装です') });
            } else {
                actions.push({ label: act, handler: () => alert(`${act}は未実装です`) });
            }
        });
    } else if (area === 'enemy') {
        // 敵カードのアクション（現状なし）
    }
    actions.forEach(act => {
        const btn = document.createElement('button');
        btn.textContent = act.label;
        btn.onclick = () => {
            // 「使用する」ボタンの場合は事前に耐久チェック
            if (act.label === '使用する' && !act.disabled) {
                const idx = inventory.findIndex(i => i.itemID === card.itemID && i.invIndex === card.invIndex);
                if (idx !== -1 && inventory[idx].currentDurability > 1) {
                    actionMenuForceOpen = true;
                    setTimeout(() => {
                        actionMenuForceOpen = false;
                    }, 0);
                }
            }
            hideActionMenu();
            if (!act.disabled) act.handler();
            // --- 情報チップの耐久値だけを直接更新 ---
            if (act.label === '使用する' && tooltipTargetCard) {
                const duraDiv = Array.from(tooltipTargetCard.childNodes).find(n => n && n.textContent && n.textContent.match(/\d+\/\d+/));
                if (duraDiv) {
                    const idx = inventory.findIndex(i => i.itemID === card.itemID && i.invIndex === card.invIndex);
                    if (idx !== -1) {
                        duraDiv.textContent = `${inventory[idx].currentDurability}/${inventory[idx].maxDurability}`;
                    }
                }
                const tooltipDura = document.querySelector('#tooltip .tooltip-durability');
                if (tooltipDura) {
                    const idx = inventory.findIndex(i => i.itemID === card.itemID && i.invIndex === card.invIndex);
                    if (idx !== -1) {
                        tooltipDura.textContent = `${inventory[idx].currentDurability}/${inventory[idx].maxDurability}`;
                    }
                }
                if (tooltipTargetCard.classList && !tooltipTargetCard.classList.contains('card-tooltip-focus')) {
                    tooltipTargetCard.classList.add('card-tooltip-focus');
                    void tooltipTargetCard.offsetWidth;
                }
            }
        };
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
        let outlineWidth = 0;
        if (cardElem.classList && cardElem.classList.contains('card-tooltip-focus')) {
            const style = window.getComputedStyle(cardElem);
            outlineWidth = parseInt(style.outlineWidth) || 0;
        }
        top = top - outlineWidth;
        menu.style.left = (right + scrollX) + 'px';
        menu.style.top = (top + scrollY) + 'px';
    } else {
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
    }
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
    if (actionMenuForceOpen) {
        // console.log('[actionMenu] 強制オープン中のためhideActionMenuを無視');
        return;
    }
    document.getElementById('action-menu').style.display = 'none';
    // console.log('[actionMenu] hideActionMenu: チップを閉じた');
}
function addToInventory(card) {
    if (inventory.length >= 20) return; // 21枚以上は追加しない
    const newCard = { ...card, invIndex: nextInvIndex++ };
    inventory.push(newCard);
    // lootからもinvIndexで削除
    const idx = loot.findIndex(i => i.itemID === card.itemID && i.invIndex === card.invIndex);
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
    // --- 状態異常回復 ---
    let cured = [];
    if (card.paralysisCure && player.statuses.includes('痺れ')) {
        player.statuses = player.statuses.filter(s => s !== '痺れ');
        cured.push('痺れ');
    }
    if (card.poisonCure && player.statuses.includes('毒')) {
        player.statuses = player.statuses.filter(s => s !== '毒');
        cured.push('毒');
    }
    if (card.curseCure && player.statuses.includes('呪い')) {
        player.statuses = player.statuses.filter(s => s !== '呪い');
        cured.push('呪い');
    }
    if (cured.length > 0) {
        addLog(`<span style=\"color:#06c; font-weight:bold;\">${cured.join('・')}が回復した！</span>`, 'detail', true);
        updatePlayerStatus();
    }
    // --- 加護付与 ---
    if (card.blessing && !player.statuses.includes('加護')) {
        player.statuses.push('加護');
        addLog('<span style="color:#06c; font-weight:bold;">加護状態になった！</span>', 'detail', true);
        updatePlayerStatus();
    }
    // --- 呪い: HP回復無効 ---
    let hpRecov = (typeof card.hpRecov === 'number') ? card.hpRecov : 0;
    if (player.statuses.includes('呪い') && !player.statuses.includes('加護') && hpRecov > 0) {
        hpRecov = 0;
        addLog('<span style="color:#800; font-weight:bold;">呪いのためHPは回復しなかった！</span>', 'detail', true);
    }
    // HP,エネルギー,水分をitemデータに従い増減
    if (typeof card.hpRecov === 'number') player.hp += hpRecov;
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
    if (after.hp > before.hp) { addLog(`HPが<span style=\"color:green; font-weight:bold;\">${after.hp - before.hp}</span>回復した！`, 'detail', true); changed = true; }
    if (after.hp < before.hp) { addLog(`HPが<span style=\"color:red; font-weight:bold;\">${before.hp - after.hp}</span>減少した…`, 'detail', true); changed = true; }
    if (after.energy > before.energy) { addLog(`エネルギーが<span style=\"color:green; font-weight:bold;\">${after.energy - before.energy}</span>回復した！`, 'detail', true); changed = true; }
    if (after.energy < before.energy) { addLog(`エネルギーが<span style=\"color:red; font-weight:bold;\">${before.energy - after.energy}</span>減少した…`, 'detail', true); changed = true; }
    if (after.water > before.water) { addLog(`水分が<span style=\"color:green; font-weight:bold;\">${after.water - before.water}</span>回復した！`, 'detail', true); changed = true; }
    if (after.water < before.water) { addLog(`水分が<span style=\"color:red; font-weight:bold;\">${before.water - after.water}</span>減少した…`, 'detail', true); changed = true; }
    // 何も変動しなかった場合
    if (!changed) {
        addLog('しかし、何も起こらなかった...', 'detail');
    }
    // 耐久値を減らす
    const idx = inventory.findIndex(i => i.itemID === card.itemID && i.invIndex === card.invIndex);
    let willRemain = false;
    if (idx !== -1) {
        if (inventory[idx].currentDurability > 1) {
            inventory[idx].currentDurability--;
            willRemain = true;
        } else {
            inventory.splice(idx, 1); // 0になったら削除
        }
        renderInventory();
    }
    // --- チップ閉じ制御 ---
    // （ここは削除）
    // checkGameOver(); // HP減少の直後にゲームオーバーチェック
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
    const idx = inventory.findIndex(i => i.itemID === card.itemID && i.invIndex === card.invIndex);
    if (idx !== -1) inventory.splice(idx, 1);
    renderInventory();
    addLog(`${card.itemName}を捨てた。`, 'action');
}
function attackEnemy(weapon, enemy) {
    // 属性名をログに表示（例：風攻撃）
    let attrName = '';
    let attr = weapon.attrID;
    if (attr === 1) attrName = '炎攻撃';
    else if (attr === 2) attrName = '水攻撃';
    else if (attr === 3) attrName = '風攻撃';
    else if (attr === 4) attrName = '地攻撃';
    else attrName = '';
    // 攻撃値（属性ごとに分かれていればそちらを優先）
    let attackValue = 0;
    if (weapon.attack_attr01 !== undefined && weapon.attack_attr02 !== undefined && weapon.attack_attr03 !== undefined && weapon.attack_attr04 !== undefined) {
        attackValue = weapon[`attack_attr0${attr}`];
    } else {
        attackValue = weapon.attack;
    }
    // --- 痺れ: 命中率-25% ---
    let accuracy = (typeof weapon.accuracy === 'number') ? weapon.accuracy : 1.0;
    if (player.statuses.includes('痺れ') && !player.statuses.includes('加護')) {
        accuracy -= 0.25;
        if (accuracy < 0) accuracy = 0;
    }
    // 命中判定
    let hit = true;
    if (accuracy < 1.0) {
        hit = Math.random() < accuracy;
    }
    // 敵の防御力
    const defenseValue = enemy.defence[attr - 1] || 0;
    // ダメージ計算
    let dmg = hit ? Math.max(0, attackValue - defenseValue) : 0;
    // HP減少
    if (hit) {
        enemy.hp -= dmg;
        if (enemy.hp < 0) enemy.hp = 0;
    }
    // ログ
    addLog(`${enemy.name}に${weapon.itemName}${attrName ? '（' + attrName + '）' : ''}で攻撃した！`, 'action');
    if (!hit) {
        addLog(`<span style=\"color:#888; font-weight:bold;\">攻撃は外れた！</span>（命中率${Math.round(accuracy * 100)}%）`, 'detail', true);
    } else {
        addLog(`→ ダメージ: <span style=\"color:red; font-weight:bold;\">${dmg}</span>　敵HP: ${enemy.hp} / ${enemy.maxHp}`, 'detail', true);
    }
    // --- 毒: 攻撃時10ダメージ ---
    if (player.statuses.includes('毒') && !player.statuses.includes('加護')) {
        player.hp -= 10;
        addLog('<span style="color:#090; font-weight:bold;">毒のダメージで10失った！</span>', 'detail', true);
        if (player.hp < 0) player.hp = 0;
        updatePlayerStatus();
    }
    renderEnemies();
    // 武器の耐久値を減らす＆未装填に戻す
    const widx = inventory.findIndex(i => i.itemID === weapon.itemID && i.invIndex === weapon.invIndex);
    if (widx !== -1) {
        if (inventory[widx].currentDurability > 1) {
            inventory[widx].currentDurability--;
            inventory[widx].isLoaded = false;
        } else {
            inventory.splice(widx, 1); // 0になったら削除
        }
        renderInventory();
    }
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
    // 3. 敵ダメージ（属性ごとにランダム決定＆ログ出力）
    if (enemies.length > 0) {
        let totalAtk = 0;
        const attrNames = ['炎', '水', '風', '地'];
        enemies.forEach(e => {
            // 属性決定
            const r = Math.random();
            let sum = 0, attr = 0;
            for (let i = 0; i < 4; i++) {
                sum += e.attackChance[i] || 0;
                if (r < sum) { attr = i; break; }
            }
            // 属性ごとの攻撃値を取得（なければe.attack）
            let attackValue = 0;
            if (e.attack_attr01 !== undefined && e.attack_attr02 !== undefined && e.attack_attr03 !== undefined && e.attack_attr04 !== undefined) {
                attackValue = e[`attack_attr0${attr + 1}`];
            } else {
                attackValue = e.attack;
            }
            // プレイヤーの防御力
            const defenseValue = player.defense[attr + 1] || 0;
            // ダメージ計算
            const dmg = Math.max(0, attackValue - defenseValue);
            totalAtk += dmg;
            // アクションログ（攻撃宣言）
            addLog(`${e.name}の${attrNames[attr]}攻撃！`, 'action');
            // 詳細ログ（ダメージ or 完全防御）
            let detailMsg = `HPが<span style=\"color:red; font-weight:bold;\">${dmg}</span>減少した…`;
            if (dmg === 0) {
                detailMsg = `<span style=\"color:green; font-weight:bold;\">ただし完全にダメージを防いだ！</span>`;
            }
            addLog(detailMsg, 'detail', true);
            // --- 状態異常付与判定 ---
            if (!player.statuses.includes('加護')) {
                // 10% 痺れ
                if (Math.random() < 0.10 && !player.statuses.includes('痺れ')) {
                    player.statuses.push('痺れ');
                    addLog('<span style="color:#00c; font-weight:bold;">痺れ状態になった！</span>', 'detail', true);
                }
                // 7% 毒
                if (Math.random() < 0.07 && !player.statuses.includes('毒')) {
                    player.statuses.push('毒');
                    addLog('<span style="color:#090; font-weight:bold;">毒状態になった！</span>', 'detail', true);
                }
                // 5% 呪い
                if (Math.random() < 0.05 && !player.statuses.includes('呪い')) {
                    player.statuses.push('呪い');
                    addLog('<span style="color:#800; font-weight:bold;">呪い状態になった！</span>', 'detail', true);
                }
            }
        });
        player.hp -= totalAtk;
        // 0-100に制限
        player.hp = Math.max(0, Math.min(player.hp, 100));
        updatePlayerStatus();
    }
    // 4. ルートアイテム再生成
    const lootNum = Math.floor(Math.random() * 10) + 1;
    loot = [];
    for (let i = 0; i < lootNum; i++) {
        const idx = Math.floor(Math.random() * itemMaster.length);
        loot.push({ ...itemMaster[idx], currentDurability: itemMaster[idx].maxDurability, invIndex: nextInvIndex++ });
    }
    renderLoot();
    // 5. 敵は再生成しない（消さない）
    renderEnemies();
}
// ===== ゲームオーバー制御 =====
let isGameOver = false;
function showGameOver() {
    isGameOver = true;
    // ログにゲームオーバー
    addLog('<span style="color:#a00; font-weight:bold; font-size:1.2em;">=== ゲームオーバー ===</span>', 'action', true);
    // ダイアログとマスク表示
    document.getElementById('gameover-dialog').style.display = 'block';
    document.getElementById('gameover-mask').style.display = 'block';
    // すべてのボタン・入力を無効化
    Array.from(document.querySelectorAll('button')).forEach(btn => {
        if (btn.id !== 'retry-btn') btn.disabled = true;
    });
    // キー入力も無効化
    document.addEventListener('keydown', blockAllKey, true);
}
function hideGameOver() {
    isGameOver = false;
    document.getElementById('gameover-dialog').style.display = 'none';
    document.getElementById('gameover-mask').style.display = 'none';
    // ボタン再有効化
    Array.from(document.querySelectorAll('button')).forEach(btn => {
        btn.disabled = false;
    });
    document.removeEventListener('keydown', blockAllKey, true);
}
function blockAllKey(e) {
    if (!isGameOver) return;
    if (e.target.id === 'retry-btn') return;
    e.stopPropagation();
    e.preventDefault();
}
// リトライボタン
window.addEventListener('DOMContentLoaded', function () {
    document.getElementById('retry-btn').onclick = function () {
        hideGameOver();
        restartGame();
    };
});
function restartGame() {
    // プレイヤー初期化
    player.hp = 100;
    player.energy = 100;
    player.water = 100;
    player.defense = { 1: 0, 2: 0, 3: 0, 4: 0 };
    player.statuses = []; // 状態異常リセット
    // フロア初期化
    floor = 1;
    updateFloor();
    // 敵・アイテム再生成
    // itemMaster, enemyMasterはfetch済み前提
    function getRandomItems(arr, n) {
        const result = [];
        for (let i = 0; i < n; i++) {
            const idx = Math.floor(Math.random() * arr.length);
            const base = arr[idx];
            // 武器ならisLoaded初期化
            let extra = {};
            if (base.itemTypeID === 1) extra.isLoaded = false;
            result.push({ ...base, currentDurability: base.maxDurability, invIndex: nextInvIndex++, ...extra });
        }
        return result;
    }
    loot = getRandomItems(itemMaster, 10);
    inventory = getRandomItems(itemMaster, 10);
    const enemy1001 = enemyMaster.find(e => e.enemyID === 1001);
    if (enemy1001) {
        enemies = [{
            id: enemy1001.enemyID,
            name: enemy1001.enemyName,
            hp: enemy1001.maxHp,
            maxHp: enemy1001.maxHp,
            attack: enemy1001.attack,
            attackChance: [enemy1001.attackChance_attr01, enemy1001.attackChance_attr02, enemy1001.attackChance_attr03, enemy1001.attackChance_attr04],
            defence: [enemy1001.defence_attr01, enemy1001.defence_attr02, enemy1001.defence_attr03, enemy1001.defence_attr04]
        }];
    } else {
        enemies = [];
    }
    renderLoot();
    renderInventory();
    renderEnemies();
    updatePlayerStatus();
    updateWeight();
    // ログ初期化
    const log = document.getElementById('log');
    log.innerHTML = '';
    addLog('B1Fに到達した。', 'floor');
}
// HPが0になったらゲームオーバー
function checkGameOver() {
    if (!isGameOver && player.hp <= 0) {
        player.hp = 0;
        showGameOver();
    }
}
window.onload = function () {
    updateFloor();
    // randomEnemies(); // 初期化時も敵なし
    // renderEnemies();
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
// ===== デバッグウィンドウ制御 =====
(function () {
    let debugVisible = false;
    const debugWindow = document.getElementById('debug-window');
    const debugForm = document.getElementById('debug-form');
    const debugCancel = document.getElementById('debug-cancel');
    // フォームに現在値をセット
    function setDebugFormValues() {
        document.getElementById('debug-hp').value = player.hp;
        document.getElementById('debug-energy').value = player.energy;
        document.getElementById('debug-water').value = player.water;
        document.getElementById('debug-def1').value = player.defense[1];
        document.getElementById('debug-def2').value = player.defense[2];
        document.getElementById('debug-def3').value = player.defense[3];
        document.getElementById('debug-def4').value = player.defense[4];
        // 状態異常チェックボックス
        document.getElementById('debug-status-paralysis').checked = player.statuses.includes('痺れ');
        document.getElementById('debug-status-poison').checked = player.statuses.includes('毒');
        document.getElementById('debug-status-curse').checked = player.statuses.includes('呪い');
        document.getElementById('debug-status-bless').checked = player.statuses.includes('加護');
    }
    // フォーム送信で値を反映
    debugForm.onsubmit = function (e) {
        e.preventDefault();
        player.hp = Number(document.getElementById('debug-hp').value);
        player.energy = Number(document.getElementById('debug-energy').value);
        player.water = Number(document.getElementById('debug-water').value);
        player.defense[1] = Number(document.getElementById('debug-def1').value);
        player.defense[2] = Number(document.getElementById('debug-def2').value);
        player.defense[3] = Number(document.getElementById('debug-def3').value);
        player.defense[4] = Number(document.getElementById('debug-def4').value);
        // 状態異常チェックボックス
        const statuses = [];
        if (document.getElementById('debug-status-paralysis').checked) statuses.push('痺れ');
        if (document.getElementById('debug-status-poison').checked) statuses.push('毒');
        if (document.getElementById('debug-status-curse').checked) statuses.push('呪い');
        if (document.getElementById('debug-status-bless').checked) statuses.push('加護');
        player.statuses = statuses;
        updatePlayerStatus();
        toggleDebugWindow(false);
    };
    // キャンセルボタン
    debugCancel.onclick = function () {
        toggleDebugWindow(false);
    };
    // Dキーでトグル
    document.addEventListener('keydown', function (e) {
        if (e.key === 'd' || e.key === 'D') {
            toggleDebugWindow();
        }
    });
    function toggleDebugWindow(force) {
        if (typeof force === 'boolean') debugVisible = force;
        else debugVisible = !debugVisible;
        if (debugVisible) {
            setDebugFormValues();
            debugWindow.style.display = 'block';
        } else {
            debugWindow.style.display = 'none';
        }
    }
    const debugLootGen = document.getElementById('debug-lootgen');
    if (debugLootGen) {
        debugLootGen.onclick = function () {
            // ルートアイテムをランダム生成（10個）
            if (itemMaster && itemMaster.length > 0) {
                loot = [];
                for (let i = 0; i < 10; i++) {
                    const idx = Math.floor(Math.random() * itemMaster.length);
                    loot.push({ ...itemMaster[idx], currentDurability: itemMaster[idx].maxDurability, invIndex: nextInvIndex++ });
                }
                renderLoot();
            }
        };
    }
})();
// ===== 武器のマナ装填メニュー =====
function showManaLoadMenu(weaponCard) {
    console.log('[マナ装填] showManaLoadMenu呼び出し', weaponCard);
    const menu = document.getElementById('action-menu');
    menu.innerHTML = '<div class="mana-select-title">装填するマナを選択</div>';
    // 武器属性
    const attrID = weaponCard.attrID;
    console.log('[マナ装填] 武器attrID:', attrID);
    // インベントリから同じ属性のマナを抽出
    const manaList = inventory.filter(i => i.itemTypeID === 2 && i.attrID === attrID);
    console.log('[マナ装填] 候補マナ:', manaList);
    if (manaList.length === 0) {
        const div = document.createElement('div');
        div.textContent = '同属性マナ無し';
        div.className = 'mana-select-noitem';
        menu.appendChild(div);
    } else {
        manaList.forEach(mana => {
            const btn = document.createElement('button');
            btn.textContent = `${mana.itemName} (${mana.currentDurability}/${mana.maxDurability})`;
            // インラインスタイル削除。CSSで統一。
            btn.onclick = () => {
                console.log('[マナ装填] 選択マナ:', mana);
                // マナの耐久値を1減らす
                const idx = inventory.findIndex(i => i.itemID === mana.itemID && i.invIndex === mana.invIndex);
                if (idx !== -1) {
                    inventory[idx].currentDurability--;
                    console.log('[マナ装填] マナ耐久値減少:', inventory[idx]);
                    if (inventory[idx].currentDurability <= 0) {
                        console.log('[マナ装填] マナ削除:', inventory[idx]);
                        inventory.splice(idx, 1);
                    }
                }
                // 武器を装填済みに
                const widx = inventory.findIndex(i => i.itemID === weaponCard.itemID && i.invIndex === weaponCard.invIndex);
                if (widx !== -1) {
                    inventory[widx].isLoaded = true;
                    console.log('[マナ装填] 武器を装填済みに:', inventory[widx]);
                }
                renderInventory();
                hideActionMenu();
                addLog(`${weaponCard.itemName}に${mana.itemName}を装填した。`, 'action');
            };
            menu.appendChild(btn);
        });
    }
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    menu.style.gap = '4px';
    console.log('[マナ装填] メニュー表示完了');
}
function showWeaponAttackMenu(weaponCard) {
    const menu = document.getElementById('action-menu');
    menu.innerHTML = '<div class="mana-select-title">攻撃対象を選択</div>';
    if (enemies.length === 0) {
        const div = document.createElement('div');
        div.textContent = '敵がいません';
        div.className = 'mana-select-noitem';
        menu.appendChild(div);
    } else {
        enemies.forEach(e => {
            const btn = document.createElement('button');
            btn.textContent = `${e.name} (HP:${e.hp})`;
            btn.onclick = () => {
                menu.style.display = 'none';
                attackEnemy(weaponCard, e);
            };
            menu.appendChild(btn);
        });
    }
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    menu.style.gap = '4px';
} 