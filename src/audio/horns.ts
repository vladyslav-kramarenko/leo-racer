export const HORNS = [
  { name: 'Double beep', type: 'square', notes: [[392, 494], [392, 494]], spacing: 0.26, decay: 0.2, cutoff: 1800 },
  { name: 'Truck', type: 'sawtooth', notes: [[146, 185]], spacing: 0.3, decay: 0.65, cutoff: 650 },
  { name: 'Bicycle bell', type: 'sine', notes: [[1047, 1568], [1047, 1568]], spacing: 0.2, decay: 0.45, cutoff: 2400 },
  { name: 'Happy melody', type: 'triangle', notes: [[392], [494], [587], [784]], spacing: 0.15, decay: 0.18, cutoff: 2000 },
  { name: 'High-low', type: 'square', notes: [[659], [440], [659], [440]], spacing: 0.18, decay: 0.17, cutoff: 1400 },
  { name: 'Cartoon toot', type: 'triangle', notes: [[523, 659], [392, 494], [262, 330]], spacing: 0.2, decay: 0.25, cutoff: 1500 },
] as const;
