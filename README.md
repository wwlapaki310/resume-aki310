# resume-aki310 v2 — JSON-driven Resume Builder

ポジションごとに文面を調整できる、データ・テンプレート分離型のレジュメ管理システム。

---

## アーキテクチャ

```
resume-aki310/
├── data/
│   ├── base.json              ← ★ 唯一の編集場所（全情報のマスターデータ）
│   └── profiles/
│       ├── general.json       ← 汎用版の設定（密度・セクション順・サマリーキー）
│       ├── google.json        ← Google向け差分（サマリー上書き・タグフィルタ）
│       └── ja.json            ← 日本語版（WIP）
├── template/
│   └── resume.hbs             ← Handlebarsテンプレート（見た目の定義）
├── dist/                      ← ★ 生成物（CI/CDで自動更新）
│   ├── resume-general.html
│   └── resume-google.html
├── build.js                   ← ビルドスクリプト
├── package.json
└── .github/workflows/
    └── generate.yml           ← data/ or template/ 変更時に自動ビルド
```

---

## クイックスタート

```bash
npm install
npm run build              # dist/resume-general.html + dist/resume-google.html を生成
```

PDF出力（ローカル）:
```bash
npm install --include=dev  # Puppeteer をインストール
npm run build:pdf          # dist/resume-*.pdf を生成
```

---

## 日常メンテ

### 経歴・スキルを更新する

`data/base.json` **のみ**を編集。次回 `npm run build` で全プロファイルに反映。

### 新しいポジション向けバリアントを追加する

1. `data/profiles/new-company.json` を作成（差分のみ記述）:
   ```json
   {
     "meta": {
       "title": "SWE Resume – NewCo",
       "density": "compact",
       "summary_key": "newco",
       "highlight_tags": ["edge-ai", "systems-programming", "team-lead"]
     },
     "basics": { "label": "Systems Engineer" }
   }
   ```
2. `data/base.json` の `summaries` に `"newco": "..."` を追加
3. `node build.js --profile=new-company` で確認

### A4に収めたい

`density` を変えるだけ（`template/resume.hbs` や CSS は触らない）:
- `"density": "normal"`  — デフォルト
- `"density": "compact"` — フォント0.9x・余白縮小
- `"density": "tight"`   — フォント0.85x・さらに縮小

---

## highlights のタグ設計

```json
{ "text": "Deployed multi-camera edge–cloud AI systems...", "tags": ["edge-ai", "cloud", "distributed"] }
```

`profiles/google.json` の `highlight_tags` に含まれるタグを持つ bullet のみが表示される。  
タグなしの bullet は常に表示。

利用中のタグ一覧:  
`edge-ai` / `cloud` / `team-lead` / `customer` / `oss` / `international` / `genai` / `cv` / `ml` / `solutions` / `enterprise` / `embedded` / `hardware` / `distributed` / `automation`

---

## PDF生成（ブラウザ印刷）

```
dist/resume-*.html をブラウザで開く
→ Ctrl+P（Mac: Cmd+P）
→ 送信先: PDFに保存 / 余白: なし / 背景グラフィック: オフ
```

---

## Links

- Portfolio: https://wwlapaki310.github.io/
- GitHub: https://github.com/wwlapaki310
- LinkedIn: https://www.linkedin.com/in/satoru-akita-6070a4145/
