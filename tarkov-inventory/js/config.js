// アイテム設定管理
var ITEM_CONFIGS = {
    gun: {
        imagePath: 'images/Gun.png',
        defaultRotation: 0,
        defaultScale: 1.0,
        name: 'AK-74M',
        description: '信頼性の高い自動小銃。高い精度と火力を備えている。'
    },
    medkit: {
        imagePath: 'images/medical_kit.png',
        defaultRotation: 0,
        defaultScale: 1.0,
        name: '医療キット',
        description: '怪我の治療に使用される医療用品。出血を止め、体力を回復させる。'
    }
};

// アイテム情報データ
var ITEM_INFO = {
    medkit: {
        name: '医療キット',
        description: '怪我の治療に使用される医療用品。出血を止め、体力を回復させる。',
        imagePath: 'images/medical_kit.png'
    },
    ammo: {
        name: '5.45x39mm弾薬',
        description: 'AK-74M用の標準弾薬。30発入りのマガジン。',
        imagePath: null
    },
    weapon: {
        name: 'AK-74M',
        description: '信頼性の高い自動小銃。高い精度と火力を備えている。',
        imagePath: 'images/Gun.png'
    },
    food: {
        name: '缶詰',
        description: '保存食。体力回復に効果的だが、開封に時間がかかる。',
        imagePath: null
    },
    backpack: {
        name: '軍用バックパック',
        description: '大容量の軍用バックパック。多くのアイテムを収納できる。',
        imagePath: null
    },
    gun: {
        name: 'AK-74M',
        description: '信頼性の高い自動小銃。高い精度と火力を備えている。',
        imagePath: 'images/Gun.png'
    }
};

// グリッド設定
var GRID_CONFIG = {
    size: 10,
    cellSize: 40,
    gridGap: 1
};

// 初期アイテム設定
var INITIAL_ITEMS = [
    { id: 'medkit', row: 0, col: 0, size: '2x2', content: '医療キット' },
    { id: 'ammo', row: 2, col: 2, size: '1x1', content: '弾薬' },
    { id: 'food', row: 0, col: 3, size: '1x2', content: '食料' },
    { id: 'gun', row: 3, col: 0, size: '4x2', content: '銃' }
];

window.ITEM_CONFIGS = ITEM_CONFIGS;
window.ITEM_INFO = ITEM_INFO;
window.GRID_CONFIG = GRID_CONFIG;
window.INITIAL_ITEMS = INITIAL_ITEMS; 