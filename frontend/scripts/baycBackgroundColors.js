/** BAYC background colors sampled from BAYC collection images */
export const BAYC_BACKGROUNDS = [
  { name: 'Aquamarine', hex: '#22e2ac', r: 34, g: 226, b: 172 },
  { name: 'Army Green', hex: '#757541', r: 117, g: 117, b: 65 },
  { name: 'Blue', hex: '#9dddeb', r: 157, g: 221, b: 235 },
  { name: 'Gray', hex: '#b4cdc0', r: 180, g: 205, b: 192 },
  { name: 'New Punk Blue', hex: '#426c79', r: 66, g: 108, b: 121 },
  { name: 'Orange', hex: '#e09a3c', r: 224, g: 154, b: 60 },
  { name: 'Purple', hex: '#6d6173', r: 109, g: 97, b: 115 },
  { name: 'Yellow', hex: '#d2d299', r: 210, g: 210, b: 153 },
];

export function backgroundLuminance({ r, g, b }) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function faceColorForBackground(bg) {
  return backgroundLuminance(bg) > 150
    ? { r: 13, g: 15, b: 18 }
    : { r: 255, g: 255, b: 255 };
}
