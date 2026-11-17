// Runs once when the server starts. Node-only work lives in instrumentation-node.ts; the
// `NEXT_RUNTIME === "nodejs"` check must wrap the import so the Edge build leaves it out.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}
