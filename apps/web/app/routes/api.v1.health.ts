export function loader() {
  return Response.json({ ok: true, service: "no-advice-needed", version: "v1" });
}
