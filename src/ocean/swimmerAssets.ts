import type { GameAvatarStyle } from "../game";
import maleUrl from "./assets/swimmer-male.glb?url";
import femaleUrl from "./assets/swimmer-female.glb?url";

export function swimmerAsset(avatarStyle?: GameAvatarStyle) {
  return avatarStyle === "FEMALE" ? femaleUrl : maleUrl;
}
