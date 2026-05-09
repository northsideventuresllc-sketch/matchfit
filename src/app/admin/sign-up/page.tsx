import { AdminSignUpClient } from "./admin-sign-up-client";

type PageProps = { searchParams: Promise<{ decision?: string }> };

export default async function AdminSignUpPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  return <AdminSignUpClient decision={sp.decision} />;
}
