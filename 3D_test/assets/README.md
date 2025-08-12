# 素材フォルダ構成

## 📁 フォルダ説明

### 🌌 skybox/
スカイボックス（空）の素材

#### `cubemap/`
- **形式**: 6枚の画像（px, nx, py, ny, pz, nz）
- **サイズ**: 512x512 または 1024x1024 推奨
- **対応拡張子**: .png (推奨), .jpg, .jpeg, .webp
- **命名例**: 
  - `px.png` (右) - **おすすめ**
  - `nx.png` (左)
  - `py.png` (上)
  - `ny.png` (下)
  - `pz.png` (前)
  - `nz.png` (後)

#### `hdr/`
- **形式**: .hdr ファイル
- **利点**: 最高品質、リアルな光源
- **例**: `sky.hdr`

#### `equirectangular/`
- **形式**: 360度パノラマ画像
- **サイズ**: 2048x1024 または 4096x2048
- **対応拡張子**: .png (推奨), .jpg, .jpeg, .webp
- **対応ファイル名**: 
  - `sky.png` (推奨)
  - `skybox.png`
  - `panorama.png`
  - `equirectangular.png`

### 🎨 textures/
テクスチャ素材（壁、床、武器など）

### 🎮 models/
3Dモデル（.gltf, .fbx, .objなど）

### 🔊 sounds/
音声素材（射撃音、効果音、BGMなど）

## 🌟 おすすめスカイボックス素材サイト

### 無料
- **Poly Haven**: https://polyhaven.com/hdris
- **HDRI Haven**: https://hdrihaven.com/
- **OpenGameArt**: https://opengameart.org/

### 商用可
- **Sketchfab**: https://sketchfab.com/
- **Unity Asset Store**: https://assetstore.unity.com/

## 📋 使用例

```javascript
// Cubemap読み込み
const loader = new THREE.CubeTextureLoader();
const texture = loader.load([
    'assets/skybox/cubemap/px.jpg',
    'assets/skybox/cubemap/nx.jpg',
    'assets/skybox/cubemap/py.jpg',
    'assets/skybox/cubemap/ny.jpg',
    'assets/skybox/cubemap/pz.jpg',
    'assets/skybox/cubemap/nz.jpg'
]);
scene.background = texture;
```
