import { useCallback, useMemo } from 'react'

import 'maplibre-gl/dist/maplibre-gl.css'
import { Map, Source, Layer } from 'react-map-gl/maplibre';

import {join_key} from '../App'
import { thresholds, demColors, repColors } from './constant';

const createCaseArray = (keyword, thresholds, colors, multiplier) => {
  return thresholds.map((threshold, index) => {
    const condition = ['all', ['>=', ['get', keyword], threshold * multiplier]];
    if (threshold !== thresholds[thresholds.length-1]) {
      condition.push(['<', ['get', keyword], thresholds[index + 1] * multiplier]);
    }
    return [condition, colors[index]];
  }).flat();
};

function getLayerStyle(dem_keyword, rep_keyword, multiplier = 1) {  
  const demCases = createCaseArray(dem_keyword, thresholds, demColors, multiplier);
  const repCases = createCaseArray(rep_keyword, thresholds, repColors, multiplier);
  
  const fillColor = [
    'case',
    ['>', ['get', dem_keyword], ['get', rep_keyword]],
    ['case', ...demCases, 'grey'],
    ['<', ['get', dem_keyword], ['get', rep_keyword]],
    ['case', ...repCases, 'grey'],
    'grey'
  ];
  
  return {
    id: "dong-layer",
    type: 'fill',
    paint: {
      'fill-outline-color': "#ccc",
      'fill-opacity': 0.8,
      'fill-color': fillColor
    }
  };
  
}
// Viewport settings
const INITIAL_VIEW_STATE = {
  longitude: 126.9761,
  latitude: 37.5749,
  zoom: 13,
  pitch: 0,
  bearing: 0
};

const MAP_CONTAINER_STYLE = { 
  width: '100vw',
  height: '100vh'
}

export default function BaseMap(props) {
  const { dongs, hoverInfo, setHoverInfo, keyword, selectedFeature, setSelectedFeature } = props;


  const onHover = useCallback(event => {
    const county = event.features && event.features[0];
    if (county) {
      const [kv1, kv2 ] = [county.properties[keyword.keywords[0]], county.properties[keyword.keywords[1]]];
      setHoverInfo({
        x: event.point.x,
        y: event.point.y,
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        name: county && county.properties.name,
        gu_code: county && county.properties.gu_code,
        [join_key]: county && county.properties[join_key],
        value: county && (kv1 > kv2? kv1: kv2)
      });
    } else {
      setHoverInfo(null)
    }
  }, [keyword, setHoverInfo]);

  const onClick =  useCallback(evt => { 
    const county = evt.features && evt.features[0];
    if (county) {
      setSelectedFeature(county);
    } else {
      setHoverInfo(null)
    }
  },[setSelectedFeature, setHoverInfo])
  
  const selectedCounty = (hoverInfo && hoverInfo[join_key]) || '';
  
  const clickedDong = useMemo(() => {
    if (!selectedFeature) return 'PREVENT_WARNING';
    if (selectedFeature && !hoverInfo) return selectedFeature.properties[join_key];
    if (selectedFeature && hoverInfo) {
      if (hoverInfo[join_key] !== selectedFeature.properties[join_key]) return selectedFeature.properties[join_key];
      else return 'PREVENT_WARNING';
    }
  },[selectedFeature, hoverInfo]);
  
  const selectedGu = (hoverInfo && hoverInfo.gu_code) || '';
  const testFilter = useMemo(() =>  ["any",
    ['in', 'gu_code', selectedGu],
    ['in', join_key, clickedDong]
 ], [selectedGu, clickedDong]);

 const selectedCountyStyle = useMemo(() => {
  return {
    "id": "dong-highlight",
    "source": "dong",
    "type": 'line',
    "paint": {
      "line-color": "#333",
      "line-opacity": [
        'match',
        ['get', join_key],
        selectedCounty,
        0.8,
        clickedDong,
        1.0,
        /* other */ 0.25
    ],
      "line-width": [
        'match',
        ['get', join_key],
        selectedCounty,
        3,
        /* other */ 2
    ]
    }
  }
 }, [selectedCounty, clickedDong])
 
 
  const multiplier = keyword.multiplier;
  const layerStyle = useMemo(() => getLayerStyle(keyword.keywords[0], keyword.keywords[1], multiplier),[keyword])
  
  const dongGeojson =  useMemo(() => {
    if (!dongs) return null;
    return {type: 'FeatureCollection',
      features: dongs
      }
  },[dongs]) 

  return (
    <Map
      initialViewState={INITIAL_VIEW_STATE}
      style={MAP_CONTAINER_STYLE}
      onClick={onClick}
      maxBounds={[126.684927,37.423433,127.261022,37.702655]}
      onMouseMove={onHover}
      interactiveLayerIds={['dong-layer']}
    >

      <Source id="dong-data" type="geojson" data={dongGeojson}>
        <Layer {...layerStyle} id="dong-layer" />
        <Layer {...selectedCountyStyle} filter={testFilter} />
      </Source>

    </Map>

  );
}

