import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardApp from "../components/DashboardApp";

export default function DashboardPage() {
  const isSignedIn = Boolean(cookies().get("session_user_id"));
  if (!isSignedIn) redirect("/");

  return <DashboardApp />;
}
