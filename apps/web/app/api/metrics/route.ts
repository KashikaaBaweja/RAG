import { metricsRegistry } from "@/lib/telemetry/metrics";

export const runtime = "nodejs";

/**
 * Prometheus text exposition. Keep off the public internet or protect via network ACL / auth proxy.
 */
export async function GET() {
  const body = await metricsRegistry.metrics();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": metricsRegistry.contentType,
      "Cache-Control": "no-store",
    },
  });
}
