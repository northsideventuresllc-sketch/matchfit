export async function postTrainerLogout(): Promise<Response> {
  return fetch("/api/trainer/logout", { method: "POST" });
}
