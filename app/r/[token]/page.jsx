import { redirect } from 'next/navigation';

export default async function RetailerTokenPage({ params }) {
  const { token } = await params;
  
  // Redirect to the API Route Handler to safely perform database validation and cookie modifications
  redirect(`/api/retailer/auth?token=${token}`);
}

