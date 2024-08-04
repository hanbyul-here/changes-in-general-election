import { useState, useEffect, useMemo } from 'react'
import './App.css'

import Map from './Map'
import Dropdown from './Dropdown'
import Panel from './Panel';
import Legend from './Legend';

export const keywordOptions = [  {
  value: 'result',
  displayName: '2024년 득표율',
  multiplier: 2.5,
  keywords: ['w_dem_ratio_', 'w_rep_ratio_']
}, {
  value: 'change',
  displayName: '2016년-2024년 변화',
  multiplier: 1,
  keywords: ['w_dem_ratio_change', 'w_rep_ratio_change']
}]

export const join_key = 'adm_cd'
const baseUrl = import.meta.env.BASE_URL?? '/';

function App() {
  const [rawDongs, setRawDongs] = useState([])
  const [selectedDong, setSelectedDong] = useState(null)
  const [hoverInfo, setHoverInfo] = useState(null)
  const [keyword, setKeyword] = useState(keywordOptions[0])

  useEffect(() => {
    async function load() {
      try {
        const rawData = await fetch(`${baseUrl}data/everything.geojson`)
        const jsonResponse = await rawData.json();
        const changeRawData = await fetch(`${baseUrl}data/change.json`)
        const changeJson = await changeRawData.json();
        
        const withChange = jsonResponse.features.map((feature) => {
          const matchedChange = changeJson.find(e => e[join_key] == feature.properties[join_key]);
          return {...feature, 
            properties: {
              ...feature.properties, 
              name: feature.properties['adm_nm'].split(' ').filter((_,i) => i!== 0).join(' '),
              gu_code: feature.properties['adm_cd'].slice(0, -2),
              ...matchedChange }}
        })
        setRawDongs(withChange)
      } catch(e) {
        console.error(e)
      }
    }
    load();
  },[])
    
  const dongs = useMemo(() => {
    if (!rawDongs.length) return []
    return rawDongs.filter(e => e.properties.year === 2024)
  }, [rawDongs])
  

  const selectedDongForPanel = useMemo(() => {
    if (!rawDongs || !selectedDong) return null
    const matchingDongAcrossTime = rawDongs.filter(f => f.properties[join_key] === selectedDong.properties[join_key]).map(f => f.properties);
    return matchingDongAcrossTime
  },[selectedDong, rawDongs])

  return (
      <div className="relative">
        <Map 
          className="absolute" 
          dongs={dongs} 
          keyword={keyword} 
          selectedFeature={selectedDong}
          setSelectedFeature={setSelectedDong} 
          setHoverInfo={setHoverInfo} 
          hoverInfo={hoverInfo}
        />
        {hoverInfo && 
          <div className="absolute text-xs bg-gray-100 p-1" style={{left: hoverInfo.x + 10, top: hoverInfo.y}}>
            {hoverInfo.name} <br />
            {(hoverInfo.value*100).toFixed(2) + '%'}
          </div>
          }
        <div className="absolute top-2 right-0 m-2 rounded-sm bg-gray-200">
          <div className="bg-gray-200 p-2 text-center"><strong>총선 비례대표 정당계열별 득표율 </strong></div>
          <Dropdown options={keywordOptions} selectedOption={keyword} onChange={setKeyword} />
          <Legend selectedOption={keyword} />
        </div>
        <div className="absolute bottom-2 right-0 m-2">
          <Panel selectedFeature={selectedDongForPanel} />
        </div>
      </div>
  )
}
export default App