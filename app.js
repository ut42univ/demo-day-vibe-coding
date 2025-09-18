/*
  今日の天気予報（1日サマリー）を選択地点で取得して表示する。
  - 地図: Leaflet
  - 天気: Open‑Meteo (API キー不要)
*/

const map = L.map("map").setView([32.7503, 129.8777], 11); // 長崎市中心付近

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
};

function setStatus(text) {
  els.status.textContent = text;
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
}

const weatherCodeMap = {
  0: "快晴",
  1: "ほぼ晴れ",
  2: "一部曇り",
  3: "曇り",
  45: "霧",
  48: "霧（霧氷）",
  51: "霧雨（弱）",
  53: "霧雨（中）",
  55: "霧雨（強）",
  56: "着氷性霧雨（弱）",
  57: "着氷性霧雨（強）",
  61: "雨（弱）",
  63: "雨（中）",
  65: "雨（強）",
  66: "着氷性雨（弱）",
  67: "着氷性雨（強）",
  71: "雪（弱）",
  73: "雪（中）",
  75: "雪（強）",
  77: "ひょう",
  80: "にわか雨（弱）",
  81: "にわか雨（中）",
  82: "にわか雨（強）",
  85: "にわか雪（弱）",
  86: "にわか雪（強）",
  95: "雷雨（弱〜中）",
  96: "雷雨（ひょう弱）",
  99: "雷雨（ひょう強）",
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
  // 1) まず Open‑Meteo の逆ジオを試す
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
    // noop → フォールバックへ
  }

  // 2) フォールバック: Nominatim (OSM)
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
        // ブラウザからは適切な Referer が付きます。明示ヘッダは最小限に。
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const a = json?.address ?? {};

    // 優先度順にローカリティ名を拾う（町名/地区→市区町村）
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

    // 都道府県等（Nominatim は state/province いずれかになることがある）
    const admin = a.state || a.province || a.region || "";

    let label = [locality, admin].filter(Boolean).join("、");
    if (!label) {
      // 最低限の表示名フォールバック（先頭2要素程度に間引き）
      const disp = json?.display_name || "";
      if (disp) {
        label = disp
          .split(",")
          .slice(0, 2)
          .map((s) => s.trim())
          .join("、");
      }
    }

    // 日本語中の不自然な空白を軽減（CJK を含む場合は空白を除去）
    function normalizeJa(s) {
      if (!s) return s;
      if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(s)) return s.replace(/\s+/g, "");
      return s.replace(/\s{2,}/g, " ");
    }

    return label ? normalizeJa(label) : null;
  } catch (_) {
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
    place: "-",
    lat,
    lon,
    date: "-",
    tmax: null,
    tmin: null,
    prcp: null,
    wx: "-",
  });
  setStatus("取得中...");
  try {
    const [json, place] = await Promise.all([
      fetchTodayForecast(lat, lon),
      reverseGeocode(lat, lon),
    ]);
    const s = extractTodaySummary(json);
    if (!s) {
      setSummary({
        place: place ?? "-",
        lat,
        lon,
        date: "-",
        tmax: null,
        tmin: null,
        prcp: null,
        wx: "-",
      });
      setStatus("データが見つかりません");
      return;
    }
    const wx = weatherCodeMap[s.wxCode] ?? `天気コード ${s.wxCode}`;
    setSummary({
      place: place ?? "-",
      lat,
      lon,
      date: s.date,
      tmax: s.tmax,
      tmin: s.tmin,
      prcp: s.prcp,
      wx,
    });
    setStatus("");
  } catch (err) {
    console.error(err);
    try {
      const place = await reverseGeocode(lat, lon);
      setSummary({
        place: place ?? "-",
        lat,
        lon,
        date: "-",
        tmax: null,
        tmin: null,
        prcp: null,
        wx: "-",
      });
    } catch (_) {}
    setStatus("取得に失敗しました");
  }
}

map.on("click", (e) => {
  handleSelect(e.latlng);
});

els.locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation がサポートされていません");
    return;
  }
  setStatus("現在地取得中...");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const latlng = L.latLng(latitude, longitude);
      handleSelect(latlng);
    },
    (err) => {
      console.error(err);
      setStatus("現在地の取得に失敗しました");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});
