import HomeClient from "./HomeClient";

export default async function Page({ searchParams }) {
  const params = await searchParams;
  const token = params?.token;
  return <HomeClient token={token} pageId={params?.id} />;
}
