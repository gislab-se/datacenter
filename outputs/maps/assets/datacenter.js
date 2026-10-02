(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const escape = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const normalize = value => String(value || "").toLocaleLowerCase("sv").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const stageLabels = { operational: "I drift", planned: "Planerad", under_construction: "Under byggnad", shelved: "Vilande" };
  const stageColors = { operational: "#286b53", planned: "#c67a4d", under_construction: "#6996a4", shelved: "#8a8b82" };
  const emptyDetail = $("detail").innerHTML;
  let ready = false, mode = "facilities", all = [], filtered = [], selected = null, selectedArea = null, areaLayers = {}, areaCounts = {}, markers = new Map(), countyData;
  const map = L.map("map", { maxZoom: 18, scrollWheelZoom: true, zoomControl: true });
  const backgrounds = {
    osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' }),
    satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18, attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community' })
  };
  backgrounds.osm.addTo(map);
  for (const layer of Object.values(backgrounds)) layer.on("tileerror", () => { $("map-error").hidden = false; $("map-error").textContent = "Bakgrundskartan kunde inte hämtas. Anläggningar och urval fungerar fortfarande."; });
  const cluster = L.markerClusterGroup({ animate: false, showCoverageOnHover: false, maxClusterRadius: 42,
    iconCreateFunction: group => L.divIcon({ className: "dc-cluster" + (group.getChildCount() >= 10 ? " large" : ""), html: String(group.getChildCount()), iconSize: [group.getChildCount() >= 10 ? 42 : 33, group.getChildCount() >= 10 ? 42 : 33] })
  });
  const fields = ["region", "municipality", "operator", "type", "status"];
  function matches(p) {
    const query = normalize($("search").value.trim());
    return (!query || normalize([p.name, p.operator, p.municipality, p.region, p.market, p.city].join(" ")).includes(query))
      && (!$("region").value || p.county === $("region").value)
      && (!$("municipality").value || p.kommun === $("municipality").value)
      && (!$("operator").value || p.operator === $("operator").value)
      && (!$("type").value || p.type === $("type").value)
      && (!$("status").value || p.stage === $("status").value);
  }
  function icon(p) {
    const stage = Object.hasOwn(stageColors, p.stage) ? p.stage : "shelved";
    return L.divIcon({ className: "dc-marker" + (selected === p.id ? " is-selected" : ""), html: '<span class="dc-dot ' + stage + '"></span>', iconSize: [14, 14], iconAnchor: [7, 7] });
  }
  function countColor(count) { return count === 0 ? "#e7ebe2" : count <= 2 ? "#b6cfa9" : count <= 7 ? "#7aa477" : count <= 19 ? "#3e7d5f" : "#18513e"; }
  function areaStyle(feature, kind) {
    const count = areaCounts[kind]?.[feature.properties.code] || 0;
    const active = selectedArea && selectedArea.kind === kind && selectedArea.code === feature.properties.code;
    return { color: active ? "#152f27" : "#778575", weight: active ? 2.4 : .6, fillColor: countColor(count), fillOpacity: count ? .83 : .32, opacity: .6 };
  }
  function safeLink(url, label, className) {
    try { const target = new URL(url); if (target.protocol !== "https:" || target.username || target.password) return ""; return '<a class="' + escape(className || "plan-link") + '" href="' + escape(target.href) + '" target="_blank" rel="noopener noreferrer">' + escape(label) + " ↗</a>"; } catch (_) { return ""; }
  }
  function refresh() {
    if (!ready) return;
    filtered = all.filter(matches);
    if (selected && !filtered.some(p => p.id === selected)) { selected = null; $("detail").innerHTML = emptyDetail; }
    areaCounts = { municipalities: {}, counties: {} };
    for (const p of filtered) { areaCounts.municipalities[p.kommun] = (areaCounts.municipalities[p.kommun] || 0) + 1; areaCounts.counties[p.county] = (areaCounts.counties[p.county] || 0) + 1; }
    $("stat-facilities").textContent = filtered.length;
    $("stat-operators").textContent = new Set(filtered.map(p => p.operator).filter(Boolean)).size;
    $("stat-counties").textContent = new Set(filtered.map(p => p.county)).size;
    $("result-count").textContent = filtered.length + " av " + all.length + " anläggningar";
    $("clear").hidden = !$("search").value && fields.every(field => !$(field).value);
    $("download").disabled = !filtered.length;
    cluster.clearLayers();
    if (map.hasLayer(cluster)) map.removeLayer(cluster);
    for (const kind of ["municipalities", "counties"]) {
      if (map.hasLayer(areaLayers[kind])) map.removeLayer(areaLayers[kind]);
      areaLayers[kind].eachLayer(layer => {
        layer.setStyle(areaStyle(layer.feature, kind));
        const p = layer.feature.properties, count = areaCounts[kind][p.code] || 0;
        layer.setTooltipContent("<strong>" + escape(p.name) + "</strong><br>" + count + " anläggningar i urvalet");
      });
    }
    if (mode === "facilities") { cluster.addLayers(filtered.map(p => { const marker = markers.get(p.id); marker.setIcon(icon(p)); return marker; })); cluster.addTo(map); }
    else areaLayers[mode].addTo(map);
    $("results").replaceChildren();
    if (!filtered.length) $("results").textContent = "Inga anläggningar matchar. Prova ett annat urval.";
    filtered.slice().sort((a, b) => a.name.localeCompare(b.name, "sv")).slice(0, 50).forEach(p => {
      const button = document.createElement("button");
      button.className = "result" + (p.id === selected ? " selected" : "");
      button.innerHTML = "<strong>" + escape(p.name) + "</strong><span>" + escape(p.operator) + " · " + escape(p.municipality) + "</span>";
      button.addEventListener("click", () => selectFacility(p.id, true, true));
      $("results").appendChild(button);
    });
    if (filtered.length > 50) {
      const note = document.createElement("p"); note.className = "results-meta"; note.textContent = "De första 50 visas. Alla matchande anläggningar finns i kartan.";
      $("results").appendChild(note);
    }
    legend();
    if (selectedArea) renderArea(selectedArea.kind, selectedArea.code);
  }
  function legend() {
    const pointMode = mode === "facilities";
    $("map-title").textContent = pointMode ? "Registrerade anläggningar" : mode === "municipalities" ? "Antal per kommun" : "Antal per län";
    const entries = pointMode ? Object.keys(stageLabels).map(stage => [stageLabels[stage], stageColors[stage]]) : [["Ingen träff", "#e7ebe2"], ["1–2", "#b6cfa9"], ["3–7", "#7aa477"], ["8–19", "#3e7d5f"], ["20 eller fler", "#18513e"]];
    $("legend").innerHTML = "<h2>" + (pointMode ? "Status i registret" : "Anläggningar i urvalet") + "</h2>" + entries.map(([text, color]) => '<div class="legend-row"><span class="swatch" style="background:' + color + '"></span><span>' + escape(text) + "</span></div>").join("") + "<p>" + (pointMode ? "Siffran i en grupp anger antalet punkter." : "Summeringen följer sökning och filter.") + "</p>";
  }
  function chooseMode(next) {
    mode = next;
    if (selectedArea) $("detail").innerHTML = emptyDetail;
    selectedArea = null;
    document.querySelectorAll("[data-layer]").forEach(button => { const active = button.dataset.layer === mode; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); });
    refresh(); legend();
  }
  function selectFacility(id, zoom, focus) {
    const p = all.find(p => p.id === id); if (!p) return;
    selectedArea = null; selected = id;
    if (mode !== "facilities") chooseMode("facilities"); else refresh();
    const row = (label, value) => '<div><dt>' + escape(label) + "</dt><dd>" + escape(value || "Ej angivet") + "</dd></div>";
    $("detail").innerHTML = '<p class="municipality-kicker">' + escape(p.municipality) + " / " + escape(p.region) + '</p><h2 class="facility-name" tabindex="-1">' + escape(p.name) + '</h2><p class="facility-operator">' + escape(p.operator || "Operatör ej angiven") + '</p><span class="pill ' + (p.stage === "operational" ? "" : "no") + '">' + escape(stageLabels[p.stage] || p.stage || "Status saknas") + '</span><dl class="info-list">' +
      row("Typ", p.type) + row("Marknad", p.market) + row("Adress", [p.address, [p.postal, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")) + row("Kommun", p.municipality + " · " + p.kommun) + row("Län", p.region) + "</dl>" +
      safeLink(p.url, "Öppna DataCenterMap-profil", "facility-source") +
      (p.description ? '<details class="description-toggle"><summary>Beskrivning från registret</summary><p class="facility-description">' + escape(p.description) + "</p></details>" : "") +
      '<p class="detail-footnote">Status, adress och beskrivning återger det befintliga registret. Uppgifterna har inte verifierats på nytt hos operatören.</p>';
    const marker = markers.get(id);
    marker.setIcon(icon(p));
    if (zoom) { map.setView(marker.getLatLng(), 13, { animate: false }); cluster.zoomToShowLayer(marker, () => marker.openTooltip()); }
    if (focus) $("detail").querySelector("h2").focus({ preventScroll: false });
  }
  function renderArea(kind, code) {
    const layer = areaLayers[kind].getLayers().find(layer => layer.feature.properties.code === code);
    const count = areaCounts[kind][code] || 0;
    $("detail").innerHTML = '<p class="eyebrow">' + (kind === "counties" ? "LÄN I DITT URVAL" : "KOMMUN I DITT URVAL") + "</p><h2>" + escape(layer.feature.properties.name) + '</h2><p class="area-count">' + count + '</p><p class="plan-caption">registrerade anläggningar i urvalet</p><p class="plan-note">Antalet följer dina filter. Ingen träff betyder noll registerposter i urvalet.</p><button class="area-action" id="area-filter">Visa områdets anläggningar</button>';
    $("area-filter").addEventListener("click", () => {
      $("search").value = "";
      if (kind === "counties") { $("region").value = code; $("municipality").value = ""; }
      else { $("municipality").value = code; $("region").value = code.slice(0, 2); }
      selectedArea = null; $("detail").innerHTML = emptyDetail; chooseMode("facilities"); fitSelection();
    });
  }
  function fitSelection() {
    if (!ready) return;
    if (filtered.length) map.fitBounds(L.latLngBounds(filtered.map(p => [p.lat, p.lng])), { padding: [55, 70], maxZoom: 12, animate: false });
    else map.fitBounds(L.geoJSON(countyData).getBounds(), { padding: [30, 60], animate: false });
  }
  document.querySelectorAll("[data-layer]").forEach(button => button.addEventListener("click", () => chooseMode(button.dataset.layer)));
  $("search").addEventListener("input", refresh);
  $("search").addEventListener("keydown", event => { if (event.key === "Enter" && filtered.length === 1) { event.preventDefault(); selectFacility(filtered[0].id, true, true); } });
  for (const field of fields) $(field).addEventListener("change", refresh);
  $("clear").addEventListener("click", () => { $("search").value = ""; fields.forEach(field => $(field).value = ""); selectedArea = null; refresh(); fitSelection(); $("search").focus(); });
  $("fit").addEventListener("click", fitSelection);
  $("background").addEventListener("change", () => { for (const layer of Object.values(backgrounds)) if (map.hasLayer(layer)) map.removeLayer(layer); backgrounds[$("background").value].addTo(map); document.querySelector(".map-panel").classList.toggle("satellite", $("background").value === "satellite"); $("map-error").hidden = true; });
  $("fullscreen").addEventListener("click", async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector(".map-panel").requestFullscreen(); });
  document.addEventListener("fullscreenchange", () => { $("fullscreen").setAttribute("aria-label", document.fullscreenElement ? "Avsluta helskärm" : "Visa kartan i helskärm"); map.invalidateSize(); });
  $("sources-open").addEventListener("click", () => $("sources").showModal());
  $("sources-close").addEventListener("click", () => $("sources").close());
  $("download").addEventListener("click", () => {
    const csvCell = value => { let text = String(value == null ? "" : value); if (/^[=+\-@\t\r]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; };
    const rows = [["ID", "Anläggning", "Operatör", "Kommun", "Län", "Typ", "Status", "Latitud", "Longitud", "Källa"], ...filtered.map(p => [p.id, p.name, p.operator, p.municipality, p.region, p.type, stageLabels[p.stage] || p.stage, p.lat, p.lng, p.url])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "datacenter-urval.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  async function load(url) { const response = await fetch(url); if (!response.ok) throw new Error("Kartunderlag kunde inte hämtas."); return response.json(); }
  Promise.all([load("assets/facilities.json"), load("assets/municipalities.geojson"), load("assets/counties.geojson")]).then(([data, kommun, counties]) => {
    all = data.facilities; countyData = counties;
    const sortedRegions = counties.features.map(f => f.properties).sort((a, b) => a.name.localeCompare(b.name, "sv"));
    for (const p of sortedRegions) $("region").appendChild(new Option(p.name, p.code));
    for (const feature of kommun.features.slice().sort((a,b) => a.properties.name.localeCompare(b.properties.name, "sv"))) $("municipality").appendChild(new Option(feature.properties.name, feature.properties.code));
    [...new Set(all.map(p => p.operator).filter(Boolean))].sort((a, b) => a.localeCompare(b, "sv")).forEach(operator => $("operator").appendChild(new Option(operator, operator)));
    for (const p of all) {
      const marker = L.marker([p.lat, p.lng], { icon: icon(p), title: p.name, keyboard: true }).bindTooltip("<strong>" + escape(p.name) + "</strong><br>" + escape(p.operator), { direction: "top" });
      marker.on("click", () => selectFacility(p.id, false, false)); markers.set(p.id, marker);
    }
    for (const [kind, geo] of [["municipalities", kommun], ["counties", counties]]) areaLayers[kind] = L.geoJSON(geo, {
      style: feature => areaStyle(feature, kind),
      onEachFeature: (feature, layer) => { layer.bindTooltip(escape(feature.properties.name), { sticky: true }); layer.on("click", () => { selected = null; selectedArea = { kind: kind, code: feature.properties.code }; refresh(); }); }
    });
    ready = true; refresh();
    map.fitBounds(L.geoJSON(counties).getBounds(), { padding: [30, 60], animate: false });
    new ResizeObserver(() => map.invalidateSize({ pan: false })).observe($("map"));
    window.DatacenterMap = { map: map, cluster: cluster, markers: markers, areaLayers: areaLayers, get filtered() { return filtered; }, get counts() { return areaCounts; }, get selected() { return selected; }, get mode() { return mode; } };
  }).catch(error => { $("result-count").textContent = error.message; $("map-error").hidden = false; $("map-error").textContent = "Kartdata kunde inte laddas. Försök ladda om sidan."; });
}());