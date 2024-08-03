export const thresholds = [0, 0.05, 0.1, 0.15, 0.2, 0.25];
export const demColors = new Array(thresholds.length).fill(0).map((_e, idx)=> {
  return `hsl(220, 100%, ${90-idx*10}%)`
});

export const repColors = new Array(thresholds.length).fill(0).map((_e, idx) => {
  return `hsl(0, 100%, ${90 - idx*10}%)`
});