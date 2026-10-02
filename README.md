# Datacenter i Sverige

[Öppna den interaktiva kartan](https://gislab-se.github.io/datacenter/outputs/maps/datacentermap_sweden_interactive_map.html).

Uppfräschad 2026-10-02 med GISLabs formspråk, sökning, filter och anläggningsinformation.
Den befintliga exportens 114 anläggningar är bevarade.

## Kartans funktioner

- Sök anläggning, operatör, kommun, län, marknad eller ort.
- Filtrera på län, kommun, operatör, typ och status.
- Visa grupperade anläggningspunkter, antal per kommun eller antal per län.
  Summeringar och färgförklaring följer det aktuella urvalet.
- Välj anläggning för adress, registerstatus, beskrivning och DataCenterMap-länk.
- Växla mellan OpenStreetMap och satellit, använd helskärm och exportera urval som CSV.
- Gränssnittet fungerar på mobil och med tangentbord via sökning och resultatlista.

## Underlag

Kartan använder `outputs/datacentermap_sweden_enriched/datacentermap_sweden_facilities_enriched.geojson`.
Registret innehåller 114 anläggningar, 50 operatörer, 44 kommuner och 15 län med träff.
Statusfördelningen i exporten är 99 i drift, 9 planerade, 5 under byggnad och 1 vilande.

Insamlingsdatum är inte dokumenterat. Underlaget fanns i Git-historiken den
17 mars 2026. Uppgifterna har inte kontrollerats på nytt hos operatörerna under
uppfräschningen. Källan är [DataCenterMap](https://www.datacentermap.com/sweden/).

Kommun- och länsgeometrierna är bevarade från den tidigare kartan.
Kommunnamn för områden utan registerträff har kompletterats via kommunkoder och
GISLabs DeSO 2025-underlag. Felkodade lännamn i punktregistret rättas i kartans
visningsdata via länskoderna; den ursprungliga exporten är kvar oförändrad.
Noll i kartan betyder ingen träff i registret eller urvalet. Antal är registerposter,
inte MW, elbehov eller kapacitet.

## Utveckling och verifiering

Kartan är statisk och publiceras av GitHub Pages. Node.js används för byggning
och lokal förhandsvisning; ingen egen server behövs i drift.

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
npm.cmd run test:browser
npm.cmd run preview
```

Förhandsvisning:
<http://127.0.0.1:4181/outputs/maps/datacentermap_sweden_interactive_map.html>.

Webbläsartesterna använder lokalt installerad Chrome. De ersätter externa kartplattor
med en testbild för att inte belasta OpenStreetMaps servrar.

- `scripts/build_datacenter_data.cjs` bygger normaliserade visningsdata.
- `scripts/make_datacentermap_sweden_map.py` är en Python-ingång till samma byggsteg.
- `outputs/maps/datacentermap_sweden_interactive_map.html` är kartans HTML.
- `outputs/maps/assets/` innehåller CSS, JavaScript, data, geometrier och lokala bibliotek.
- `scripts/extract_osm_datacenters_sweden.py` är det separata verktyget för OSM-data.
- `outputs/maps/nordic_area_demand_demo.html` är den befintliga nordiska demonstrationen.

Redigera kartans HTML, CSS och JavaScript direkt. Byggsteget uppdaterar visningsdata
och skriver inte över gränssnittet. Lägg till nya data i källexporten och granska
verifieringar och källinformation när registret uppdateras.

## Publicering

Granska lokalt, kör testerna och för ändringarna till `main`; GitHub Pages uppdaterar
de befintliga adresserna. Startsidan fortsätter att leda till kartan.

Kollegieportalens katalogpost `app-02` länkar till den publika kartan.
Portalen finns i `C:/gislab/hemsida/gislab_hemsida/.private-portal` och publiceras separat.
Kartan är fortsatt publik och dess drift kräver inte portalinloggning.

## Bibliotek och säkerhetskopia

Leaflet 1.9.4 och Leaflet.markercluster 1.5.3 lagras lokalt; licenser finns i
`outputs/maps/assets/vendor/`. OpenStreetMap-plattor hämtas i webbläsaren med
synlig attribution, normal cache och referrer på domännivå. Satellitlagret är
den tidigare Esri-tjänsten med bevarad attribution.

Ursprunglig HTML, byggskript och README finns lokalt under
`.backups/datacenter-refresh-2026-10-02/`; säkerhetskopior och testbilder publiceras inte.
