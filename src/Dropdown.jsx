
export default function Dropdown({options, selectedOption, onChange}) {
  return <div className="grid w-[22rem] grid-cols-2 rounded-sm bg-gray-200 p-2">
    {options.map(o => {
      return (
        <div key={o.displayName}>
        <input type="radio" 
        name="option" 
        id={o.value} 
        value={o.value} 
        className="peer hidden" 
        checked={(selectedOption.value === o.value)} 
        onChange={() => {
          onChange(o);
          }}/>
        <label htmlFor={o.value} className="block cursor-pointer select-none rounded-sm p-1 text-center peer-checked:bg-blue-500 peer-checked:font-bold peer-checked:text-white">{o.displayName} </label>
    </div>
      )
    })}


</div>
}