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
    if (rotation === 0) {
        return 1.0;
    }
    var width = size.width;
    var height = size.height;
    var scaleX = width / height;
    var scaleY = height / width;
    return Math.max(scaleX, scaleY);
}

function setItemImage(element, itemType, rotation, scale) {
    var config = getItemConfig(itemType);
    if (!config) return;
    element.innerHTML = '';
    var img = document.createElement('img');
    img.src = config.imagePath;
    img.className = 'item-image';
    var transform = '';
    if (rotation === 90) transform = 'rotate(90deg)';
    if (scale !== 1.0) transform += ' scale(' + scale + ')';
    img.style.transform = transform;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.minWidth = '100%';
    img.style.minHeight = '100%';
    element.appendChild(img);
    element.dataset.rotation = rotation.toString();
    element.dataset.scale = scale.toString();
}

window.parseSize = parseSize;
window.getItemType = getItemType;
window.getItemConfig = getItemConfig;
window.calculateScaleForRotation = calculateScaleForRotation;
window.setItemImage = setItemImage; 