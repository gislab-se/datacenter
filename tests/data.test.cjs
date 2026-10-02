const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const points = JSON.parse(fs.readFileSync('outputs/maps/assets/facilities.json','utf8')).facilities;
const kommun = JSON.parse(fs.readFileSync('outputs/maps/assets/municipalities.geojson','utf8'));
const counties = JSON.parse(fs.readFileSync('outputs/maps/assets/counties.geojson','utf8'));
const original = JSON.parse(fs.readFileSync('outputs/datacentermap_sweden_enriched/datacentermap_sweden_facilities_enriched.geojson','utf8')).features;

test('all original facilities retain identity, source link and coordinates; names join administrative codes', () => {
 assert.equal(points.length,114); assert.equal(new Set(points.map(p=>p.id)).size,114);
 assert.equal(kommun.features.length,290); assert.equal(counties.features.length,21);
 for(const p of points){
  const old=original.find(f=>String(f.properties.dc_id)===p.id);
  assert.deepEqual([p.lng,p.lat],old.geometry.coordinates);
  assert.equal(p.url,old.properties.detail_url);
  assert.equal(p.stage,old.properties.stage_label);
  assert.equal(p.description,old.properties.description || '');
  assert.equal(p.municipality,kommun.features.find(f=>f.properties.code===p.kommun).properties.name);
  assert.equal(p.region,counties.features.find(f=>f.properties.code===p.county).properties.name);
  assert.ok(!p.region.includes('?'));
 }
 assert.ok(kommun.features.every(f=>f.properties.name && f.properties.name!=='Ingen träff'));
});
test('source counts remain consistent for status, operators and geographic areas', () => {
 assert.equal(new Set(points.map(p=>p.operator)).size,50);
 assert.equal(new Set(points.map(p=>p.kommun)).size,44);
 assert.equal(new Set(points.map(p=>p.county)).size,15);
 for(const [stage,count] of [['operational',99],['planned',9],['under_construction',5],['shelved',1]]) assert.equal(points.filter(p=>p.stage===stage).length,count);
 assert.equal(points.filter(p=>p.county==='01').length,49);
 assert.equal(points.filter(p=>p.operator==='Microsoft').length,18);
});