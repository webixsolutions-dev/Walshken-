import { CustomerAccess } from "@/components/walshken/customer-pages";

export const metadata = { title: "Customer sign in" };

export default async function CustomerSignInPage({ searchParams }: { searchParams: Promise<{ changed?: string }> }) {
  return <CustomerAccess mode="sign-in" changed={(await searchParams).changed === "1"}/>;
}
