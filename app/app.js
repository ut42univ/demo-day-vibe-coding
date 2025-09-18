/*
  🌤️ お天気マップ - 地図で確認する今日の天気
  
  機能:
  - 地図上の任意の地点をクリックして天気予報を表示
  - 現在地ボタンで自動的に現在地の天気を取得
  - レスポンシブデザインでスマートフォンにも対応
  
  使用技術:
  - 地図: Leaflet (OpenStreetMap)
  - 天気データ: Open‑Meteo API (無料・APIキー不要)
  - 位置情報: Geolocation API / Nominatim逆ジオコーディング
*/

const map = L.map("map").setView([32.7503, 129.8777], 11); // 長崎市中心部を初期表示

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const state = {
  marker: null,
};

const els = {
  status: document.getElementById("status"),
  place: document.getElementById("place"),
  lat: document.getElementById("lat"),
  lon: document.getElementById("lon"),
  date: document.getElementById("date"),
  tmax: document.getElementById("tmax"),
  tmin: document.getElementById("tmin"),
  prcp: document.getElementById("prcp"),
  wx: document.getElementById("wx"),
  locateBtn: document.getElementById("locateBtn"),
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
};

function setStatus(text, isLoading = false) {
  els.status.textContent = text;
  if (isLoading) {
    els.status.classList.add("loading");
  } else {
    els.status.classList.remove("loading");
  }
}

function setSummary({ place, lat, lon, date, tmax, tmin, prcp, wx }) {
  if (place !== undefined) {
    els.place.textContent = place ?? "-";
  }
  els.lat.textContent = lat.toFixed(4);
  els.lon.textContent = lon.toFixed(4);
  els.date.textContent = date ?? "-";
  els.tmax.textContent = tmax != null ? `${tmax.toFixed(1)} °C` : "-";
  els.tmin.textContent = tmin != null ? `${tmin.toFixed(1)} °C` : "-";
  els.prcp.textContent = prcp != null ? `${prcp.toFixed(1)} mm` : "-";
  els.wx.textContent = wx ?? "-";

  // パネルにアニメーションを適用
  const panel = document.getElementById("infoPanel");
  panel.style.animation = "none";
  panel.offsetHeight; // リフロー強制
  panel.style.animation = null;
}

const weatherCodeMap = {
  0: "☀️ 快晴",
  1: "🌤️ ほぼ晴れ",
  2: "⛅ 一部曇り",
  3: "☁️ 曇り",
  45: "🌫️ 霧",
  48: "🌫️ 霧（霧氷あり）",
  51: "🌦️ 弱い霧雨",
  53: "🌦️ 霧雨",
  55: "🌧️ 強い霧雨",
  56: "🧊 弱い着氷性霧雨",
  57: "🧊 強い着氷性霧雨",
  61: "🌧️ 弱い雨",
  63: "🌧️ 雨",
  65: "🌧️ 強い雨",
  66: "🧊 弱い着氷性雨",
  67: "🧊 強い着氷性雨",
  71: "❄️ 弱い雪",
  73: "❄️ 雪",
  75: "❄️ 強い雪",
  77: "🧊 ひょう",
  80: "🌦️ 弱いにわか雨",
  81: "🌦️ にわか雨",
  82: "⛈️ 強いにわか雨",
  85: "🌨️ 弱いにわか雪",
  86: "🌨️ 強いにわか雪",
  95: "⛈️ 雷雨",
  96: "⛈️ 雷雨（ひょう注意）",
  99: "⛈️ 激しい雷雨（ひょう警戒）",
};

async function fetchTodayForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode",
    timezone: "auto",
    forecast_days: "1",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function reverseGeocode(lat, lon) {
  // 1) まず Open‑Meteo の逆ジオコーディングを試行
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      language: "ja",
      count: "1",
    });
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?${params.toString()}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      const r = json?.results?.[0];
      if (r) {
        const parts = [r.name, r.admin1].filter(Boolean);
        const s = parts.join("、") || r.country || null;
        if (s) return s;
      }
    }
  } catch (_) {
    // エラー時はフォールバックへ進む
  }

  // 2) フォールバック: Nominatim (OpenStreetMap) の逆ジオコーディング
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: lat.toString(),
      lon: lon.toString(),
      "accept-language": "ja",
      addressdetails: "1",
    });
    const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        // ブラウザから適切なRefererが送信されます
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const a = json?.address ?? {};

    // 優先度順に地名を取得（町名/地区 → 市区町村）
    const locality =
      a.suburb ||
      a.quarter ||
      a.village ||
      a.town ||
      a.city_district ||
      a.city ||
      a.municipality ||
      a.county ||
      "";

    // 都道府県などの上位行政区画
    const admin = a.state || a.province || a.region || "";

    let label = [locality, admin].filter(Boolean).join("、");
    if (!label) {
      // 最低限の表示名フォールバック（先頭2要素程度を使用）
      const disp = json?.display_name || "";
      if (disp) {
        label = disp
          .split(",")
          .slice(0, 2)
          .map((s) => s.trim())
          .join("、");
      }
    }

    // 日本語文字列の不自然な空白を除去
    function normalizeJa(s) {
      if (!s) return s;
      // CJK文字を含む場合は空白をすべて除去
      if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(s)) return s.replace(/\s+/g, "");
      return s.replace(/\s{2,}/g, " ");
    }

    return label ? normalizeJa(label) : null;
  } catch (_) {
    return null;
  }
}

async function searchLocation(query) {
  // Nominatim API を使用して地名から座標を検索
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      q: query,
      limit: "5",
      "accept-language": "ja",
      addressdetails: "1",
    });
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const results = await res.json();

    if (!results || results.length === 0) {
      return null;
    }

    // 最初の結果を使用
    const result = results[0];
    return {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      displayName: result.display_name,
    };
  } catch (error) {
    console.error("Location search error:", error);
    return null;
  }
}

function extractTodaySummary(json) {
  const d = json.daily;
  if (!d || !d.time || d.time.length === 0) return null;
  return {
    date: d.time[0],
    tmax: d.temperature_2m_max?.[0],
    tmin: d.temperature_2m_min?.[0],
    prcp: d.precipitation_sum?.[0],
    wxCode: d.weathercode?.[0],
  };
}

function ensureMarker(latlng) {
  if (!state.marker) {
    state.marker = L.marker(latlng).addTo(map);
  } else {
    state.marker.setLatLng(latlng);
  }
}

async function handleSelect(latlng) {
  const { lat, lng: lon } = latlng;
  ensureMarker(latlng);
  map.panTo(latlng);
  setSummary({
    place: "📍 地点を選択中...",
    lat,
    lon,
    date: "-",
    tmax: null,
    tmin: null,
    prcp: null,
    wx: "⏳ 待機中",
  });
  setStatus("📡 天気データを取得中...", true);
  try {
    const [json, place] = await Promise.all([
      fetchTodayForecast(lat, lon),
      reverseGeocode(lat, lon),
    ]);
    const s = extractTodaySummary(json);
    if (!s) {
      setSummary({
        place: place ?? "📍 不明な地点",
        lat,
        lon,
        date: "-",
        tmax: null,
        tmin: null,
        prcp: null,
        wx: "❓ データなし",
      });
      setStatus("⚠️ 天気データが見つかりませんでした");
      return;
    }
    const wx = weatherCodeMap[s.wxCode] ?? `❓ 天気コード ${s.wxCode}`;
    setSummary({
      place: place ?? "📍 不明な地点",
      lat,
      lon,
      date: s.date,
      tmax: s.tmax,
      tmin: s.tmin,
      prcp: s.prcp,
      wx,
    });
    setStatus("✅ 天気データを取得しました");
    // ステータスメッセージを3秒後に更新
    setTimeout(() => setStatus("🌤️ 他の場所も確認してみてください"), 3000);
  } catch (err) {
    console.error(err);
    try {
      const place = await reverseGeocode(lat, lon);
      setSummary({
        place: place ?? "📍 不明な地点",
        lat,
        lon,
        date: "-",
        tmax: null,
        tmin: null,
        prcp: null,
        wx: "❓ データなし",
      });
    } catch (_) {}
    setStatus("❌ 天気データの取得に失敗しました");
  }
}

// 地図クリック時の処理
map.on("click", (e) => {
  handleSelect(e.latlng);
});

// 現在地ボタンの処理
els.locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("❌ このブラウザでは現在地機能がサポートされていません");
    return;
  }
  setStatus("📍 現在地を取得中...", true);
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const latlng = L.latLng(latitude, longitude);
      handleSelect(latlng);
    },
    (err) => {
      console.error(err);
      let errorMessage = "❌ 現在地の取得に失敗しました";
      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMessage = "❌ 位置情報の利用が許可されていません";
          break;
        case err.POSITION_UNAVAILABLE:
          errorMessage = "❌ 位置情報が利用できません";
          break;
        case err.TIMEOUT:
          errorMessage = "❌ 位置情報の取得がタイムアウトしました";
          break;
      }
      setStatus(errorMessage);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

// 検索機能の処理
async function handleSearch() {
  const query = els.searchInput.value.trim();
  if (!query) {
    setStatus("🔍 検索したい地名を入力してください");
    els.searchInput.focus();
    return;
  }

  // ボタンを無効化
  els.searchBtn.disabled = true;
  els.searchBtn.textContent = "🔍 検索中...";
  setStatus("🔍 地点を検索中...", true);

  try {
    const result = await searchLocation(query);

    if (!result) {
      setStatus(
        `❌ "${query}" が見つかりませんでした。別の地名を試してください`
      );
      els.searchInput.focus();
      els.searchInput.select();
      return;
    }

    // 検索結果の座標で天気を取得
    const latlng = L.latLng(result.lat, result.lon);
    await handleSelect(latlng);

    // 地図を検索結果の位置に移動
    map.setView(latlng, 12);

    // 検索ボックスをクリア（オプション）
    // els.searchInput.value = "";
  } catch (error) {
    console.error("Search error:", error);
    setStatus(
      "❌ 検索中にエラーが発生しました。しばらく後にもう一度お試しください"
    );
  } finally {
    // ボタンを有効化
    els.searchBtn.disabled = false;
    els.searchBtn.textContent = "🔍 検索";
  }
}

// 検索ボタンのクリック処理
els.searchBtn.addEventListener("click", handleSearch);

// Enterキーでの検索処理
els.searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleSearch();
  }
});
