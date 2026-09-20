export function supportsOceanWebGL(): boolean {
  try {
    const context = document.createElement("canvas").getContext("webgl2");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    // Context creation can throw when the browser disables GPU rendering.
    return false;
  }
}
