export function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, service: 'link-fixer' }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
