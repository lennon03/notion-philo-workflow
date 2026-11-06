import { cookies } from "next/headers";
import HomeClient from "./HomeClient";
import { TOKEN_COOKIE } from "../lib/auth";

export default async function Page({ searchParams }) {
  const [params, jar] = await Promise.all([searchParams, cookies()]);
  return <HomeClient urlToken={params?.token} pageId={params?.id} hasSavedToken={jar.has(TOKEN_COOKIE)} />;
}
