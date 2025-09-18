# MVP 要件定義書（Dash + Plotly 版） — demo-day-vibe-coding

最終更新: 2025-09-18 / 作成者: プロダクトチーム

本書は README の MVP コンセプトを Dash + Plotly を用いた実装前提に具体化した要件定義です。対象は「今の時点の熱中症（WBGT 近似）／凍結リスクを、長崎市の三次メッシュ上でコロプレス表示する」最小機能です。

## 1. 目的・背景・ゴール

- 目的: 「今、この場所がどれくらい危険か？」を、地図を開いた瞬間に直感的に理解できる状態を提供する。
- 対象エリア: 長崎市全域（e-Stat の三次メッシュ ≒ 約 1km 四方）。
- 指標: 2 種類
  - 熱中症リスク（WBGT 近似）
  - 凍結リスク（気温ベース）
- ゴール（MVP）: 現在時刻のリスクを Plotly の Mapbox ベースのコロプレス図で表示し、基本的な地図操作・凡例・現在地表示・メッシュタップでの詳細表示ができること（Dash コンポーネントで提供）。

## 2. スコープ／非スコープ

### 2.1 スコープ（Must-Have）

- 現在時刻のリスク算出（熱中症 WBGT 近似／凍結）
- メッシュ単位の色分け表示（コロプレス）
- 地図のパン／ズーム
- 現在地表示ボタン（ブラウザの Geolocation API）
- 凡例（常時表示）
- メッシュタップの詳細ポップアップ（リスクレベル、現在の気温など）
  - Dash の `clickData` をトリガに `dbc.Modal` もしくは右下カード表示で実装

### 2.2 非スコープ（Not in MVP）

- 予報・タイムスライダー・アニメーション
- 検索（住所・施設）
- ユーザー登録、マイ地点、通知（プッシュ等）

## 3. 想定ユーザーとユースケース

- 市民・来訪者が、屋外活動の直前／最中に「いま」のリスクを把握。
- 市内のエリア比較（パン・ズームで確認）。
- 現在地近辺のリスク把握（現在地ボタン）。

## 4. 機能要件（Functional Requirements）

FR-1 地図表示（Dash + Plotly 実装）

- 長崎市の三次メッシュ GeoJSON を Plotly の `choropleth_mapbox`（または `go.Choroplethmapbox`）で表示。
- メッシュごとにリスクレベル（カテゴリ）に応じた離散色で塗り分け。
- ズーム・パンは Plotly 標準の Mapbox 操作で可能。
- 背景タイルは `mapbox_style="open-street-map"` を既定（トークン不要）。
- 初期中心・ズーム: 長崎市中心に合わせた `mapbox.center` と `mapbox.zoom` を指定。

FR-2 レイヤー切替

- 表示する指標を「熱中症（WBGT 近似）」と「凍結」の 2 つから切替可能（`dcc.RadioItems` または `dcc.Dropdown`）。
- 切替時に図と凡例を同期更新（同一コールバック、または連鎖コールバック）。

FR-3 凡例（レジェンド）

- 画面右下（または右上）に常時表示する HTML レジェンドを `html.Div` で実装（Plotly の colorbar ではなく、離散カテゴリ用の独自 UI）。
- 色とラベル（リスクレベル）を一致させる。
- 現在表示中の指標に応じて凡例内容を切り替える。

FR-4 現在地表示

- 現在地ボタン（`html.Button`）でブラウザの位置情報許可を促し、現在地を地図上にマーカー表示。
- 取得は Dash のクライアントサイドコールバック（`assets/geolocation.js`）で `navigator.geolocation` を利用し、座標を `dcc.Store` に保存。
- サーバ保存は行わず、クライアントの `dcc.Store` を参照して `scattermapbox` レイヤ（マーカー）を重畳表示。

FR-5 詳細ポップアップ

- `Graph(clickData)` をトリガに `dbc.Modal`（または右下固定カード）で詳細を表示。
- 表示項目（例）:
  - 共通: メッシュ ID、最終更新時刻（データ時刻）
  - 熱中症: リスクレベル、WBGT 近似値（小数 1 桁）、気温、相対湿度、短波放射、風速
  - 凍結: リスクレベル、気温（小数 1 桁）
- ホバーには `hovertemplate` で主要指標のサマリを表示し、クリックで詳細を開く二段構え。

FR-6 データ更新

- アプリ起動時に `/api/mesh-risk?index=...`（同一 Dash サーバ内の Flask ルート）から最新 GeoJSON を取得し、`dcc.Store` に保持。
- 手動リフレッシュ用のボタンを提供（`dcc.Loading` で状態表示）。自動ポーリングは `dcc.Interval` により任意。
- サーバ側は 10 分キャッシュ（`flask-caching`）で Open-Meteo へのリクエストを集約。

- データ未取得／API 障害時は `dbc.Toast` で非侵襲に通知し、地図はグレー塗り（`risk_level: no-data`）でフォールバック。

## 5. UI/UX 要件

- 最初の描画で 3〜5 色の色分けが視認できる対比を確保。
- 色覚多様性に配慮した配色（推奨パレットを後述）。
- モバイル優先。主要 UI（凡例・トグル・現在地ボタン）は親指で届く位置に配置。
- 地図キャンバスを最大化し、サイドバーは持たない（MVP）。
- レイアウトは Dash の `dbc.Container` / `dbc.Row` / `dbc.Col`（または素の `html.Div`）でシンプルに構成。凡例・現在地ボタンは `position: fixed` で地図上にオーバーレイ。

## 6. 指標の算出ロジック（Contract）

入力（共通）

- 緯度経度（メッシュ重心）: (lat, lon)
- 現在時刻の気象データ（Open-Meteo）:
  - 気温: T [°C]（2m）
  - 相対湿度: RH [%]
  - 短波放射（水平面）: GHI [W/m²]
  - 風速: U [m/s]（10m）

出力（共通）

- 各メッシュのプロパティ:
  - risk_index: "heat" | "freeze"
  - risk_level: 離散カテゴリ（後述）
  - score: 指標の連続値（WBGT 近似[°C] または 気温[°C]）
  - observed_at: ISO8601
  - source: "open-meteo"

### 6.1 熱中症リスク（WBGT 近似）

注意: 本近似は簡易推定であり、医学的判断や業務上の安全管理の代替ではありません。

1. 水蒸気圧の近似（hPa）

$$
\begin{aligned}
e &= \frac{RH}{100} \cdot e_s(T) \\
e_s(T) &= 6.1078 \cdot \exp\left(\frac{17.2694\,T}{237.3+T}\right)
\end{aligned}
$$

2. 室内 WBGT 近似（Steadman 系の近似式を簡略化）

$$\mathrm{WBGT}_{in} \approx 0.567\,T + 0.393\,e + 3.94$$

3. 日射・風の補正（屋外簡易補正）

$$\mathrm{adj}_{solar} = \min\bigl(3.0,\; 0.0025 \times \mathrm{GHI}\bigr)$$

$$
\mathrm{adj}_{wind} = \begin{cases}
0.5 & (U \ge 5\,\mathrm{m/s}) \\
0 & (U < 5\,\mathrm{m/s})
\end{cases}
$$

最終値:

$$\mathrm{WBGT} = \mathrm{WBGT}_{in} + \mathrm{adj}_{solar} - \mathrm{adj}_{wind}$$

4. リスクレベル区分（環境省の区分に準拠した近似）

- 危険: WBGT ≥ 31
- 厳重警戒: 28 ≤ WBGT < 31
- 警戒: 25 ≤ WBGT < 28
- 注意: 21 ≤ WBGT < 25
- 低: WBGT < 21

推奨配色（例・色覚配慮版）

- 危険: #8B0000（深紅）
- 厳重警戒: #E64A19（ディープオレンジ 700）
- 警戒: #FFA726（オレンジ 400）
- 注意: #FFD54F（アンバー 300）
- 低: #66BB6A（グリーン 400）

表示値

- ポップアップには WBGT（小数 1 桁）と T, RH, GHI, U を併記。

### 6.2 凍結リスク（気温ベース）

最終値: score = 気温 T [°C]

区分（道路凍結リスクの簡易判断）

- 危険（凍結確実）: T ≤ -2.0
- 厳重警戒: -2.0 < T ≤ -0.5
- 警戒: -0.5 < T ≤ 0.5
- 低: T > 0.5

配色（例・コールドスキーム）

- 危険: #0D47A1
- 厳重警戒: #1976D2
- 警戒: #64B5F6
- 低: #B3E5FC

表示値

- ポップアップには T（小数 1 桁）を表示。

### 6.3 Python 実装インタフェース（推奨）

- 計算関数（純粋関数）
  - `compute_wbgt(T: float, RH: float, GHI: float, U: float) -> float`
  - `classify_heat(wbgt: float) -> Literal["危険","厳重警戒","警戒","注意","低"]`
  - `classify_freeze(T: float) -> Literal["危険","厳重警戒","警戒","低"]`
- メッシュ単位の計算
  - `enrich_features(features: list[dict], index: Literal["heat","freeze"], obs: WeatherObs) -> list[dict]`
  - 入力 GeoJSON Feature の `properties` に上記出力（score, risk_level, observed_at など）を付与。
- 単体テスト（最小）
  - 境界値（しきい値）でのクラス分けが仕様通りであること。

## 7. データ要件 / API

データソース

- 気象: Open-Meteo API（現在値）
  - 例: temperature_2m, relative_humidity_2m, shortwave_radiation, wind_speed_10m
- 地図: e-Stat 三次メッシュ（長崎市、GeoJSON 化）

取得・更新

- バックエンド（推奨）で 10 分間隔で最新値を集約し、メッシュごとに計算してキャッシュ。
- フロントは単一の GeoJSON（またはベクタタイル）を取得して描画。

API（MVP の最小例。Dash/Flask ルート）

- GET `/api/mesh-risk?index=heat|freeze`
  - 応答: GeoJSON FeatureCollection（UTF-8, application/json）
  - Feature.properties: { mesh_id, risk_index, risk_level, score, observed_at, T, RH, GHI, U }
  - 送信量目安: 長崎市全域で数百〜千数百メッシュ。GeoJSON 数 MB 程度（gzip/deflate 圧縮推奨）。
- キャッシュ
  - 10 分 TTL のサーバ側キャッシュ（`flask-caching`）。
  - ETag/Last-Modified を付与し、クライアントの再取得を効率化。

フロント取得フロー（Dash）

- 初回ロード時、`clientside_callback` もしくは `@callback` 内で `/api/mesh-risk` を取得し、`dcc.Store(id="mesh-store")` に保存。
- 図は `mesh-store.data` とレイヤ切替（`index-toggle.value`）から再描画。

GeoJSON（メッシュ）

- ファイル配置例: `data/mesh/nagasaki_3rd_mesh.geojson`
- 参照キー: `featureidkey="properties.mesh_id"`

エッジケース

- 夜間（GHI≈0）の場合、adj_solar≈0。
- 測定欠損のメッシュは補間（最近傍）または "no-data" とし、グレー表示。

## 8. アーキテクチャ（MVP 推奨最小構成／Dash 構成）

- 単一アプリ: Dash（Flask 同居）
  - 可視化: Plotly（`choropleth_mapbox` + `scattermapbox`）
  - UI: Dash Core Components（`dcc.Graph`, `dcc.Store`, `dcc.RadioItems`, `dcc.Loading`）
  - スタイル: Dash Bootstrap Components（`dbc`）
  - 現在地: assets のクライアント JS + `dcc.Store`
- バックエンド（同一プロセス内）
  - Flask ルート `/api/mesh-risk` が Open-Meteo から集約・計算・キャッシュして応答
  - 定期更新（任意）: プロセス内スケジューラ（`APScheduler`）または外部 Cron が `warmup` エンドポイントを叩く
- 配信
  - 本番: Gunicorn + gevent/uvicorn（WSGI/ASGI は要件に応じて）
  - 逆プロキシ: Nginx で gzip/HTTP/2 有効化

推奨ディレクトリ構成（案）

- `app.py`（Dash エントリポイント）
- `assets/`（`styles.css`, `geolocation.js`）
- `components/`（UI 分割する場合）
- `services/open_meteo.py`（外部 API 呼出）
- `services/risk.py`（WBGT/凍結算出と区分）
- `routes/api.py`（Flask ルート: `/api/mesh-risk`）
- `data/mesh/nagasaki_3rd_mesh.geojson`
- `tests/`（境界値テスト）

## 9. 非機能要件（NFR）

- パフォーマンス
  - ファーストレンダー: モバイル 4G で 3 秒以内（目標）
  - パン／ズームの操作は 60fps 目標（モバイル Safari/Chrome）
  - 図再描画は 300ms 以内を目安（レイヤ切替）
- 可用性
  - 99%（MVP 段階の目標）
- セキュリティ／プライバシー
  - 現在地は端末内でのみ使用し、サーバ送信・保存しない。
  - API 鍵不要（Open-Meteo 想定）。第三者への過度なリクエスト集中を避けるため、サーバ側集約を推奨。
  - 背景地図は `open-street-map` スタイルを使用（トークン不要）。
- 対応環境
  - iOS Safari 最新版、Android Chrome 最新版、デスクトップ Chrome/Edge/Safari 最新版
- アクセシビリティ
  - 色覚多様性対応（凡例テキスト必須、彩度/明度差を十分に）
  - ボタンのタップ領域は 44px 以上

## 10. 受入基準（Acceptance Criteria）

AC-1 地図表示と操作

- アプリ起動で長崎市のメッシュコロプレスが表示される（`dcc.Graph` の Mapbox 図）。
- パン・ズームがスムーズに機能する。

AC-2 レイヤー切替

- `dcc.RadioItems`（または `dcc.Dropdown`）で熱中症／凍結の切替ができ、凡例（HTML）が同期して切り替わる。

AC-3 凡例（常時表示）

- 表示中の指標に対応した色とラベルが正しく表示される（固定配置の `html.Div`）。

AC-4 現在地表示

- 位置情報許可時に現在地マーカーが表示され、許可拒否時は `dbc.Toast` 等で丁寧なメッセージが出る。

AC-5 ポップアップ

- 任意メッシュをタップすると、`clickData` を元に `dbc.Modal` が開き、定義済み項目が表示される。単位・丸めが期待通りである。

AC-6 データ更新

- 初回ロード時に `/api/mesh-risk` から最新データが取得される。データ時刻がポップアップで確認できる。

AC-7 エラー時挙動

- API 障害・データ欠損時にフォールバック表示（灰色）とトーストが出る。

## 11. Dash レイアウトとコールバック（設計指針）

主要コンポーネント（id は一例）

- `dcc.Store(id="mesh-store")` … 取得した GeoJSON を保持
- `dcc.RadioItems(id="index-toggle", options=[{"label":"熱中症","value":"heat"},{"label":"凍結","value":"freeze"}], value="heat")`
- `html.Button(id="locate-btn", children="現在地")`
- `dcc.Store(id="geoloc-store")` … 現在地（{lat, lon, timestamp}）
- `dcc.Graph(id="map-graph")` … choropleth_mapbox + scattermapbox
- `html.Div(id="legend", className="legend")` … HTML 凡例
- `dbc.Modal(id="detail-modal")` … 詳細ポップアップ

代表的なコールバック

- 初回ロード/レイヤ切替 → `map-graph.figure` と `legend.children` を更新
- `locate-btn.n_clicks`（clientside）→ `geoloc-store.data` を更新
- `map-graph.clickData` → `detail-modal` を開き内容を更新
- リフレッシュボタン（任意）→ `/api/mesh-risk` 再取得し `mesh-store` を更新

スタイル/配置

- `assets/styles.css` で凡例・ボタンの固定配置とレスポンシブを定義
- モバイルでは凡例とボタンが地図の重要領域を覆わないように可読性を確保

## 12. 配色とマッピング（Dash 実装）

熱中症（離散カテゴリ用 `color_discrete_map`）

- 危険: #8B0000
- 厳重警戒: #E64A19
- 警戒: #FFA726
- 注意: #FFD54F
- 低: #66BB6A

凍結（離散カテゴリ用 `color_discrete_map`）

- 危険: #0D47A1
- 厳重警戒: #1976D2
- 警戒: #64B5F6
- 低: #B3E5FC

Plotly 図のポイント

- `px.choropleth_mapbox(geojson=..., locations="mesh_id", featureidkey="properties.mesh_id", color="risk_level", color_discrete_map=...)`
- ホバーは `hover_data` または `hovertemplate` で整形（小数 1 桁丸め）
- 現在地は `go.Scattermapbox(mode="markers")` を `fig.add_trace` で重畳

## 13. 運用・監視（MVP）

- 更新ジョブの失敗監視（失敗時に通知：メール/Slack 等）
- API 応答の健全性チェック（200 率、応答時間）
- フロントエンドのエラーログ（Sentry 等は任意）

## 14. 制約・リスク・前提

- WBGT 近似は簡易推定であり、正確な WBGT（黒球温度等を用いる）とは異なる。
- Open-Meteo の空間分解能と地形特性により、局所的な誤差が生じ得る。
- メッシュ境界で値が不連続になる可能性（補間戦略の簡易性による）。
- クライアントから Open-Meteo へ大量の同時リクエストは行わない（集約サーバで対処）。
- 背景地図は `open-street-map` を既定とし、Mapbox トークン不要で運用可能（別スタイルを使う場合はトークン要）。

## 15. 用語集

- WBGT: Wet Bulb Globe Temperature（暑さ指数）。本 MVP では簡易近似を表示。
- GHI: Global Horizontal Irradiance（短波放射・水平面日射量）
- 三次メッシュ: 約 1km 四方の格子（日本の地域メッシュ）

---

付録 A: カラーパレット（代替案）

- 熱中症（高コントラスト案）
  - 危険: #B71C1C, 厳重警戒: #F4511E, 警戒: #FB8C00, 注意: #FFEE58, 低: #81C784
- 凍結（色弱配慮案）
  - 危険: #102A83, 厳重警戒: #1E88E5, 警戒: #90CAF9, 低: #E3F2FD

付録 B: プロパティ仕様（例）

```json
{
  "mesh_id": "5235-12-45",
  "risk_index": "heat",
  "risk_level": "厳重警戒",
  "score": 29.4,
  "observed_at": "2025-09-18T04:30:00Z",
  "T": 31.2,
  "RH": 62,
  "GHI": 720,
  "U": 3.1
}
```

付録 C: 既知の限界

- 日射・風補正は経験的な係数であり、季節・地表面条件で誤差が増える可能性。
- 凍結は路面状態（濡れ/日陰/放射冷却）を考慮していないため、近似的な注意喚起に留まる。

## 11. 運用・監視（MVP）

- 更新ジョブの失敗監視（失敗時に通知：メール/Slack 等）
- API 応答の健全性チェック（200 率、応答時間）
- フロントエンドのエラーログ（Sentry 等は任意）

## 12. 制約・リスク・前提

- WBGT 近似は簡易推定であり、正確な WBGT（黒球温度等を用いる）とは異なる。
- Open-Meteo の空間分解能と地形特性により、局所的な誤差が生じ得る。
- メッシュ境界で値が不連続になる可能性（補間戦略の簡易性による）。
- クライアントから Open-Meteo へ大量の同時リクエストは行わない（集約サーバで対処）。

## 13. 用語集

- WBGT: Wet Bulb Globe Temperature（暑さ指数）。本 MVP では簡易近似を表示。
- GHI: Global Horizontal Irradiance（短波放射・水平面日射量）
- 三次メッシュ: 約 1km 四方の格子（日本の地域メッシュ）

---

付録 A: カラーパレット（代替案）

- 熱中症（高コントラスト案）
  - 危険: #B71C1C, 厳重警戒: #F4511E, 警戒: #FB8C00, 注意: #FFEE58, 低: #81C784
- 凍結（色弱配慮案）
  - 危険: #102A83, 厳重警戒: #1E88E5, 警戒: #90CAF9, 低: #E3F2FD

付録 B: プロパティ仕様（例）

```json
{
  "mesh_id": "5235-12-45",
  "risk_index": "heat",
  "risk_level": "厳重警戒",
  "score": 29.4,
  "observed_at": "2025-09-18T04:30:00Z",
  "T": 31.2,
  "RH": 62,
  "GHI": 720,
  "U": 3.1
}
```

付録 C: 既知の限界

- 日射・風補正は経験的な係数であり、季節・地表面条件で誤差が増える可能性。
- 凍結は路面状態（濡れ/日陰/放射冷却）を考慮していないため、近似的な注意喚起に留まる。
