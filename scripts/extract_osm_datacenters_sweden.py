from __future__ import annotations

import argparse
from pathlib import Path

import geopandas as gpd
import pandas as pd


DEFAULT_OSM_DIR = Path(r"C:\Users\henri\data\osm")
DEFAULT_BUILDINGS = DEFAULT_OSM_DIR / "gis_osm_buildings_a_free_1.shp"
DEFAULT_PLACES = DEFAULT_OSM_DIR / "gis_osm_places_free_1.shp"
DEFAULT_OUTPUT_DIR = Path("outputs") / "osm_datacenters_sweden"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract Swedish OSM datacenter buildings from local Geofabrik shapefiles."
    )
    parser.add_argument(
        "--buildings",
        type=Path,
        default=DEFAULT_BUILDINGS,
        help="Path to gis_osm_buildings_a_free_1.shp",
    )
    parser.add_argument(
        "--places",
        type=Path,
        default=DEFAULT_PLACES,
        help="Path to gis_osm_places_free_1.shp",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory for extracted outputs",
    )
    return parser.parse_args()


def load_datacenters(buildings_path: Path) -> gpd.GeoDataFrame:
    if not buildings_path.exists():
        raise FileNotFoundError(f"Buildings file not found: {buildings_path}")

    datacenters = gpd.read_file(buildings_path, where="type = 'data_center'")
    if datacenters.empty:
        raise ValueError(f"No OSM datacenters found in: {buildings_path}")

    return datacenters


def load_places(places_path: Path) -> gpd.GeoDataFrame:
    if not places_path.exists():
        raise FileNotFoundError(f"Places file not found: {places_path}")

    places = gpd.read_file(places_path)
    keep_classes = ["city", "town", "village", "suburb", "hamlet", "locality"]
    return places[places["fclass"].isin(keep_classes)].copy()


def enrich_with_place_context(
    datacenters: gpd.GeoDataFrame, places: gpd.GeoDataFrame
) -> gpd.GeoDataFrame:
    datacenters_3006 = datacenters.to_crs(3006)
    places_3006 = places.to_crs(3006)

    joined = gpd.sjoin_nearest(
        datacenters_3006[["osm_id", "code", "fclass", "name", "type", "geometry"]],
        places_3006[["name", "fclass", "geometry"]],
        how="left",
        distance_col="nearest_place_dist_m",
        lsuffix="dc",
        rsuffix="place",
    ).rename(
        columns={
            "name_dc": "datacenter_name",
            "fclass_dc": "datacenter_fclass",
            "name_place": "nearest_place",
            "fclass_place": "nearest_place_class",
        }
    )

    joined["area_m2"] = joined.geometry.area.round(0)
    representative_points = joined.geometry.representative_point().to_crs(4326)
    joined["lon"] = representative_points.x.round(6)
    joined["lat"] = representative_points.y.round(6)

    return joined


def write_outputs(datacenters_3006: gpd.GeoDataFrame, output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)

    gpkg_path = output_dir / "osm_datacenters_sweden.gpkg"
    csv_path = output_dir / "osm_datacenters_sweden.csv"

    datacenters_3006.to_file(gpkg_path, driver="GPKG")

    csv_columns = [
        "osm_id",
        "code",
        "datacenter_fclass",
        "datacenter_name",
        "type",
        "nearest_place",
        "nearest_place_class",
        "nearest_place_dist_m",
        "area_m2",
        "lon",
        "lat",
    ]
    csv_df = pd.DataFrame(datacenters_3006[csv_columns]).copy()
    csv_df["nearest_place_dist_m"] = csv_df["nearest_place_dist_m"].round(1)
    csv_df.to_csv(csv_path, index=False, encoding="utf-8")

    return gpkg_path, csv_path


def main() -> None:
    args = parse_args()

    datacenters = load_datacenters(args.buildings)
    places = load_places(args.places)
    enriched = enrich_with_place_context(datacenters, places)

    gpkg_path, csv_path = write_outputs(enriched, args.output_dir)

    summary_columns = [
        "osm_id",
        "datacenter_name",
        "nearest_place",
        "nearest_place_class",
        "area_m2",
        "lon",
        "lat",
    ]

    print(f"Found {len(enriched)} OSM datacenter building(s) in Sweden.")
    print(f"GPKG: {gpkg_path.resolve()}")
    print(f"CSV:  {csv_path.resolve()}")
    print()
    print(enriched[summary_columns].to_string(index=False))


if __name__ == "__main__":
    main()
