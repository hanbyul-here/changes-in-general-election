import { thresholds, demColors, repColors } from "../Map/constant"

let legendThreshold = [...thresholds]
legendThreshold.shift();
let dLegendColors = [...demColors];
dLegendColors.shift();
let rLegendColors = [...repColors];
rLegendColors.shift();

export default function Legend({ selectedOption }) {
  return <div className="grid w-[22rem] rounded-sm bg-gray-200 p-2">
  <div className="grid grid-cols-10 h-5 text-xs" >
  {[...legendThreshold].reverse().map((n, i) => {
      if (i%2==0) {
        return <div key={`${n}-trr`} > {`${parseInt(n*selectedOption?.multiplier * 100)}%`} </div>
      } else {
        return <div key={`${n}-tr`} />
      }
         
    })
    }
  {legendThreshold.map((n, i) => {
      if (i%2==0) {
        return <div className="text-right" key={`${n}-tr`} > {`${parseInt(n*selectedOption?.multiplier*100)}%`}  </div>
      } else {
        return <div key={`${n}-tr`} />
      }
         
    })
    }
  </div>
  <div className="grid grid-cols-10 h-3" >
    {[...dLegendColors].reverse().map((n,i) => {
      return (
        <div key={`${n}-b`} style={{backgroundColor: `hsl(220,100%,${50 + i*10}%)`}} />
      )
    })
    }
    
    {rLegendColors.map((n,i) => {
      return (
        <div key={`${n}-r`} style={{backgroundColor: `hsl(0,100%,${90 - i*10}%)`}} />
      )
    })
    }
  </div>
  <div className="grid grid-cols-2 h-3 text-xs" >
    <div>민주당계열</div>
    <div className="text-right">국힘당계열</div>
  </div>

</div>
}