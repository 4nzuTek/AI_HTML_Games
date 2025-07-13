// サイズ文字列をパース
function parseSize(sizeStr) {
    var arr = sizeStr.split('x').map(Number);
    return { width: arr[0], height: arr[1] };
}

function getItemType(itemId) {
    return itemId.split('_')[0];
}

function getItemConfig(itemType) {
    return window.ITEM_CONFIGS[itemType] || null;
}

function calculateScaleForRotation(size, rotation) {
    // スケールを常に1.0固定にする
    return 1.0;
}

function setItemImage(element, itemType, rotation, scale) {
    var config = getItemConfig(itemType);
    if (!config) return;
    element.innerHTML = '';

    // アイテムのサイズを取得
    var size = window.parseSize(element.dataset.size || '1x1');
    var maxDimension = Math.max(size.width, size.height);
    var squareSize = maxDimension * 40; // 40pxはセルサイズ

    // 正方形のコンテナを作成
    var container = document.createElement('div');
    container.className = 'item-image-container';
    container.style.width = squareSize + 'px';
    container.style.height = squareSize + 'px';

    var img = document.createElement('img');
    img.src = config.imagePath;
    img.className = 'item-image';
    var transform = '';
    if (rotation === 90) transform = 'rotate(90deg)';
    // スケールは常に1.0固定のため、スケール変換は適用しない
    img.style.transform = transform;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.objectPosition = 'center';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';

    container.appendChild(img);
    element.appendChild(container);
    element.dataset.rotation = rotation.toString();
    element.dataset.scale = scale.toString();
}

window.parseSize = parseSize;
window.getItemType = getItemType;
window.getItemConfig = getItemConfig;
window.calculateScaleForRotation = calculateScaleForRotation;
window.setItemImage = setItemImage; 