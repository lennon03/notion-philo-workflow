import HomeClient from "../HomeClient";

// Dedicated stable path for Notion's Embed block.
export default async function Embed({ searchParams }) {
  const params = await searchParams;
  const token = params?.token;
  return <HomeClient token={token} pageId={params?.id} />;
}
