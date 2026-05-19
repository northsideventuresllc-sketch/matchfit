import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy invite links used `/trainer/sign-up`; canonical route is `/trainer/signup`. */
export default async function TrainerSignUpLegacyRedirectPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
  }
  const qs = params.toString();
  redirect(qs ? `/trainer/signup?${qs}` : "/trainer/signup");
}
