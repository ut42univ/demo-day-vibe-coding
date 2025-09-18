# demo-day-vibe-coding

マップ上で選択した地点の「今日の天気予報」を取得・表示できる最小構成の Web アプリです。

## 1. MVP のコアコンセプト 💡

地図をクリック（またはタップ）した場所について、今日 1 日の予報サマリーをすぐに見られること。

## 2. 最小限の機能要件 (Must-Have)

✅ 含むもの

- 地図クリックで地点選択（Leaflet）
- 選択地点の今日の予報取得（Open‑Meteo）
  - 最高/最低気温、降水量合計、天気コード（→ 日本語の天気説明）
- 情報パネルでサマリー表示（選択緯度経度、日付、予報指標）
- 情報パネルでサマリー表示（地点名、選択緯度経度、日付、予報指標）
- 現在地へ移動ボタン（ブラウザの Geolocation を利用）
- ローディング状態と簡易エラー表示

❌ 含めないもの（MVP 外）

- 過去/未来の時系列アニメーションや複数日予報
- 住所検索やお気に入り保存、通知などのアカウント機能
- コロプレス図やメッシュ解析などの高度な可視化

## 3. 対象データ

- Open‑Meteo API（CORS 対応・無料・API キー不要）
  - エンドポイント例: `https://api.open-meteo.com/v1/forecast`
  - リクエスト（例）: `daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto&forecast_days=1`
  - 逆ジオコーディング: `https://geocoding-api.open-meteo.com/v1/reverse?latitude=...&longitude=...&language=ja`

## 4. セットアップと実行

このリポジトリは静的サイト（HTML/CSS/JS）のみで構成されます。Geolocation は HTTPS もしくは localhost でのみ動作するため、ローカルサーバで起動してください。

手順（macOS, zsh）

1. リポジトリを開く（このフォルダ直下に `index.html` がある想定）
2. 簡易サーバを起動（どちらか一つ）

- Python
  - `python3 -m http.server 5500`
- Node.js があれば（任意）
  - `npx serve -l 5500` など

3. ブラウザで表示: `http://localhost:5500`

## 5. 使い方

- 地図をクリックして地点を選択すると、右下のパネルに「今日の予報（最高/最低気温、降水量合計、天気）」が表示されます。
- 画面左上の「現在地」ボタンで、現在地へ地図を移動できます（ブラウザの位置情報許可が必要）。

## 6. ライセンス / タイル

- 地図タイル: OpenStreetMap（© OpenStreetMap contributors）
- 天気データ: Open‑Meteo（利用規約に従う）
