import { PureComponent } from 'react';

import {useMemo} from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { demColors, repColors } from "../Map/constant"

// schema
// { "adm_cd": "1101053", "adm_nm": "서울특별시 종로구 사직동", "읍면동명": "사직동", "선거인수": 8202, "투표수": 5284, "dem_sum": 3119, "pop_ratio": 1.1039030955585465, "w_dem_ratio_": 0.50442256399476038, "w_rep_ratio_": 0.28575640678105296, "rep_sum": 2067, "etc_sum": 38, "null_sum": 60, "dong_cleaned": "사직동", "year": 2016 }


function formatAttribute(data, key, key_w) {
  return {
    // ['e' + year.toString()]: ratio,
    [key]: parseFloat((data[key_w] * 100).toFixed(2))
  }
}

function formatData(input) {
  try {
    const data16 = input.find(e => e.year === 2016)
    const data24 = input.find(e => e.year === 2024)
    const toReturn = [
      {
        name: '민주당계열',
        ...formatAttribute(data16, '2016총선', 'w_dem_ratio_'),
        ...formatAttribute(data24, '2024총선', 'w_dem_ratio_'),
        color: demColors[1]
      },
      {
        name: '국힘당계열',
        ...formatAttribute(data16, '2016총선', 'w_rep_ratio_', demColors[1]),
        ...formatAttribute(data24, '2024총선', 'w_rep_ratio_', repColors[1]),
        color: repColors[1]
      }
    ]
    return toReturn;
  } catch (e) {
    console.error(e);
  }

}

class Chart extends PureComponent {
  
  render() {
    return (
      <ResponsiveContainer width="100%" height="90%">
      <BarChart
        width={500}
        height={300}
        data={this.props.data}
        margin={{
          top: 20,
          right: 10,
          left: 0,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip formatter={(val) => val+'%'} />
        {/* <Bar dataKey="e2016" stackId="a" fill="#8884d8" /> */}
        <Bar dataKey="2016총선" >
        {/* <Bar dataKey="e2024" stackId="b" fill="#8884d8" /> */}
          {this.props.data.map((entry) => {return <Cell key={JSON.stringify(entry)} fill={entry.color} />;})}
        </Bar>
        <Bar dataKey="2024총선">
          {this.props.data.map((entry) => {return <Cell key={JSON.stringify(entry)} fill={entry.color} />;})}
        </Bar>
      </BarChart>
      </ResponsiveContainer>
    )
  }
}



export default function Panel({ selectedFeature}) {
  const dataForChart = useMemo(() => {
    if(!selectedFeature) return null
    return formatData(selectedFeature)
  },[selectedFeature])
  return (<div className="w-[20rem] bg-gray-200 p-2 rounded-sm" style={dataForChart? {height: '350px'}: {}}>
    {selectedFeature &&<div className="text-center"> 2016, 2024 총선 정당계열별 득표율 변화 (%) <br /><strong>{selectedFeature[0].name}</strong></div>}
    {dataForChart && <Chart data={dataForChart} />}

  
    
  {!dataForChart && <div>행정동을 선택하세요</div>}
  </div>)
}