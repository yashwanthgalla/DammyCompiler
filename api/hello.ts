export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  const response = await fetch('https://api.vercel.app/products');
  const products = await response.json();
  return new Response(JSON.stringify(products), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
