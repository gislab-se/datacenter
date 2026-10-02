const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'outputs/datacentermap_sweden_enriched/datacentermap_sweden_facilities_enriched.geojson');
const folder = path.join(root, 'outputs/maps/assets');
const municipalities = JSON.parse(fs.readFileSync(path.join(folder, 'municipalities.geojson'), 'utf8'));
const counties = JSON.parse(fs.readFileSync(path.join(folder, 'counties.geojson'), 'utf8'));
const countyNames = Object.fromEntries(counties.features.map(f => [f.properties.code, f.properties.name]));
const kommunNames = Object.fromEntries(municipalities.features.map(f => [f.properties.code, f.properties.name]));
const original = JSON.parse(fs.readFileSync(source, 'utf8'));
const points = original.features.map(f => {
 const p = f.properties, kommun = String(p.kommunkod).padStart(4, '0'), county = String(p.lanskod).padStart(2, '0');
 if (!kommunNames[kommun] || !countyNames[county]) throw new Error('Administrativ kod saknas för ' + p.dc_id);
 if (f.geometry.type !== 'Point' || !f.geometry.coordinates.every(Number.isFinite)) throw new Error('Koordinater saknas för ' + p.dc_id);
 return { id: String(p.dc_id), name: p.facility_name_detail_page || p.facility_name_market_page,
  operator: p.operator_final || '', market: p.market_name_detail_page || p.market_name_market_page || '',
  address: p.street_address_detail_page || '', postal: p.postal_detail_page || '', city: p.city_detail_page || '',
  type: p.capacity_type || '', stage: p.stage_label || '', url: p.detail_url || '',
  description: p.description || '', municipality: kommunNames[kommun], kommun: kommun, county: county,
  region: countyNames[county], lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
});
if (new Set(points.map(p => p.id)).size !== points.length) throw new Error('Dubblerade anläggnings-id.');
const stats = { facilities: points.length, operators: new Set(points.map(p => p.operator).filter(Boolean)).size,
 municipalities: new Set(points.map(p => p.kommun)).size, counties: new Set(points.map(p => p.county)).size };
fs.writeFileSync(path.join(folder, 'facilities.json'), JSON.stringify({source: 'DataCenterMap – befintlig GISLab-export', collectionDate: null, facilities: points, stats: stats}), 'utf8');
console.log('Byggt datacenterunderlag: ' + JSON.stringify(stats));