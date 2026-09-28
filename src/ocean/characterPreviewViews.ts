export const CHARACTER_VIEWS = { FRONT: "正面", SIDE: "侧面", BACK: "背面", FACE: "面部近景" } as const;
export type CharacterView = keyof typeof CHARACTER_VIEWS;

export function characterCamera(view: CharacterView, height: number, face: [number, number, number]) {
  const distance = height * 1.9;
  const target: [number, number, number] = view === "FACE" ? [...face] : [0, height * 0.51, 0];
  const position: [number, number, number] = view === "FACE" ? [face[0], face[1], face[2] + 0.85]
    : view === "SIDE" ? [distance, target[1], 0]
      : view === "BACK" ? [0, target[1], -distance] : [0, target[1], distance];
  return { position, target };
}
