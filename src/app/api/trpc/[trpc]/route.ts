export const GET = async () => {
  return new Response(
    JSON.stringify({ message: "tRPC endpoint" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};