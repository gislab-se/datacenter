from __future__ import annotations

from pathlib import Path

import folium
import geopandas as gpd
import pandas as pd
from branca.colormap import linear
from folium import plugins


BASE_DIR = Path(__file__).resolve().parents[1]
FACILITIES_CSV = (
    BASE_DIR
    / 'outputs'
    / 'datacentermap_sweden_enriched'
    / 'datacentermap_sweden_facilities_enriched.csv'
)
ADMIN_GPKG = Path(r'C:\Users\henri\data\administrativindelning_sverige\administrativindelning_sverige.gpkg')
OUTPUT_HTML = BASE_DIR / 'outputs' / 'maps' / 'datacentermap_sweden_interactive_map.html'
LANSNAMN = {
    '01': 'Stockholms l\u00e4n',
    '03': 'Uppsala l\u00e4n',
    '04': 'S\u00f6dermanlands l\u00e4n',
    '05': '\u00d6sterg\u00f6tlands l\u00e4n',
    '06': 'J\u00f6nk\u00f6pings l\u00e4n',
    '07': 'Kronobergs l\u00e4n',
    '08': 'Kalmar l\u00e4n',
    '09': 'Gotlands l\u00e4n',
    '10': 'Blekinge l\u00e4n',
    '12': 'Sk\u00e5ne l\u00e4n',
    '13': 'Hallands l\u00e4n',
    '14': 'V\u00e4stra G\u00f6talands l\u00e4n',
    '17': 'V\u00e4rmlands l\u00e4n',
    '18': '\u00d6rebro l\u00e4n',
    '19': 'V\u00e4stmanlands l\u00e4n',
    '20': 'Dalarnas l\u00e4n',
    '21': 'G\u00e4vleborgs l\u00e4n',
    '22': 'V\u00e4sternorrlands l\u00e4n',
    '23': 'J\u00e4mtlands l\u00e4n',
    '24': 'V\u00e4sterbottens l\u00e4n',
    '25': 'Norrbottens l\u00e4n',
}


def load_points() -> pd.DataFrame:
    df = pd.read_csv(FACILITIES_CSV, encoding='utf-8-sig')
    df['kommunkod'] = df['kommunkod'].astype('string').str.zfill(4)
    df['lanskod'] = df['lanskod'].astype('string').str.zfill(2)
    df['lansnamn'] = df['lanskod'].map(LANSNAMN).fillna(df['lansnamn'])
    return df


def load_polygons(layer: str, code_field: str, simplify_tolerance_m: float) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(ADMIN_GPKG, layer=layer)[[code_field, 'geometry']].copy()
    gdf[code_field] = gdf[code_field].astype('string')
    gdf = gdf.to_crs(3006)
    gdf['geometry'] = gdf.geometry.simplify(simplify_tolerance_m, preserve_topology=True)
    return gdf.to_crs(4326)


def build_kommun_layer(municipalities: gpd.GeoDataFrame, facilities: pd.DataFrame):
    counts = (
        facilities.groupby(['kommunkod', 'kommunnamn'], dropna=False)
        .size()
        .reset_index(name='antal_datacenter')
    )
    merged = municipalities.merge(counts, on='kommunkod', how='left')
    merged['kommunnamn'] = merged['kommunnamn'].fillna('Ingen tr\u00e4ff')
    merged['antal_datacenter'] = merged['antal_datacenter'].fillna(0).astype(int)
    cmap = linear.YlOrRd_09.scale(0, max(1, int(merged['antal_datacenter'].max())))
    cmap.caption = 'Antal datacenter per kommun'
    return merged, cmap


def build_lan_layer(counties: gpd.GeoDataFrame, facilities: pd.DataFrame):
    counts = (
        facilities.groupby(['lanskod', 'lansnamn'], dropna=False)
        .size()
        .reset_index(name='antal_datacenter')
    )
    merged = counties.merge(counts, on='lanskod', how='left')
    merged['lansnamn'] = merged['lansnamn'].fillna('Ingen tr\u00e4ff')
    merged['antal_datacenter'] = merged['antal_datacenter'].fillna(0).astype(int)
    cmap = linear.Blues_09.scale(0, max(1, int(merged['antal_datacenter'].max())))
    cmap.caption = 'Antal datacenter per l\u00e4n'
    return merged, cmap


def add_points_layer(m: folium.Map, facilities: pd.DataFrame) -> None:
    points_group = folium.FeatureGroup(name='Datacenterpunkter', show=True)
    cluster = plugins.MarkerCluster(name='Datacenterpunkter').add_to(points_group)

    for _, row in facilities.sort_values(['lansnamn', 'kommunnamn', 'facility_name_detail_page']).iterrows():
        popup_html = f"""
        <div style="width: 320px;">
          <strong>{row['facility_name_detail_page']}</strong><br>
          Operat\u00f6r: {row['operator_final']}<br>
          Marknad: {row['market_name_detail_page']}<br>
          Kommun: {row['kommunnamn']}<br>
          L\u00e4n: {row['lansnamn']}<br>
          Adress: {row['street_address_detail_page']}, {row['postal_detail_page']} {row['city_detail_page']}<br>
          Typ: {row['capacity_type']}<br>
          Status: {row['stage_label']}<br>
          <a href="{row['detail_url']}" target="_blank">DataCenterMap-profil</a>
        </div>
        """
        tooltip = f"{row['facility_name_detail_page']} | {row['kommunnamn']}, {row['lansnamn']}"
        folium.CircleMarker(
            location=[row['latitude'], row['longitude']],
            radius=5,
            color='#164c7e',
            weight=1,
            fill=True,
            fill_color='#2d7fb8',
            fill_opacity=0.9,
            popup=folium.Popup(popup_html, max_width=350),
            tooltip=tooltip,
        ).add_to(cluster)

    points_group.add_to(m)


def add_choropleth_layer(
    m: folium.Map,
    gdf: gpd.GeoDataFrame,
    layer_name: str,
    name_field: str,
    code_field: str,
    count_field: str,
    cmap: linear,
    show: bool,
) -> None:
    group = folium.FeatureGroup(name=layer_name, show=show)

    def style_function(feature: dict) -> dict:
        value = feature['properties'][count_field]
        if value in (None, 0):
            fill = '#f1f1f1'
        else:
            fill = cmap(value)
        return {
            'fillColor': fill,
            'color': '#5f6368',
            'weight': 0.6,
            'fillOpacity': 0.72,
        }

    folium.GeoJson(
        gdf,
        style_function=style_function,
        highlight_function=lambda _: {
            'weight': 2.0,
            'color': '#111111',
            'fillOpacity': 0.85,
        },
        tooltip=folium.GeoJsonTooltip(
            fields=[name_field, code_field, count_field],
            aliases=['Namn', 'Kod', 'Antal datacenter'],
            localize=True,
            sticky=False,
            labels=True,
        ),
    ).add_to(group)

    group.add_to(m)
    cmap.add_to(m)


def build_map() -> folium.Map:
    facilities = load_points()
    municipalities = load_polygons('kommunyta', 'kommunkod', simplify_tolerance_m=250)
    counties = load_polygons('lansyta', 'lanskod', simplify_tolerance_m=600)

    kommun_layer, kommun_cmap = build_kommun_layer(municipalities, facilities)
    lan_layer, lan_cmap = build_lan_layer(counties, facilities)

    m = folium.Map(
        location=[62.0, 15.0],
        zoom_start=5,
        tiles=None,
        control_scale=True,
    )

    folium.TileLayer(
        tiles='CartoDB positron',
        name='Ljus bakgrund',
        overlay=False,
        control=True,
        show=True,
    ).add_to(m)
    folium.TileLayer(
        tiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr='Tiles © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        name='Satellit',
        overlay=False,
        control=True,
        show=False,
        max_zoom=19,
    ).add_to(m)

    add_points_layer(m, facilities)
    add_choropleth_layer(
        m,
        kommun_layer,
        layer_name='Koropleth kommun',
        name_field='kommunnamn',
        code_field='kommunkod',
        count_field='antal_datacenter',
        cmap=kommun_cmap,
        show=False,
    )
    add_choropleth_layer(
        m,
        lan_layer,
        layer_name='Koropleth l\u00e4n',
        name_field='lansnamn',
        code_field='lanskod',
        count_field='antal_datacenter',
        cmap=lan_cmap,
        show=False,
    )

    plugins.Fullscreen(position='topright').add_to(m)
    folium.LayerControl(collapsed=False).add_to(m)
    return m


def main() -> None:
    OUTPUT_HTML.parent.mkdir(parents=True, exist_ok=True)
    m = build_map()
    m.save(OUTPUT_HTML)
    print(f'Saved interactive map to: {OUTPUT_HTML}')


if __name__ == '__main__':
    main()
