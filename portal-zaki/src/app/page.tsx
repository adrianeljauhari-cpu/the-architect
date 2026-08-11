import { redirect } from "next/navigation";

/** Root sends visitors into the shop; the auth guard bounces anonymous users to /entrar. */
export default function Home() {
  redirect("/catalogo");
}
