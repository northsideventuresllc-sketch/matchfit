export async function postClientLogout(): Promise<Response> {
  return fetch("/api/client/logout", { method: "POST" });
}
