import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { Suspense } from "react";
import { LoginForm } from "@/components/forms/login-form";
import { isAuthEnabled } from "@/lib/auth";
import { SHOP } from "@/lib/constants";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage(props: PageProps<"/login">) {
  if (!isAuthEnabled()) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Store className="size-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold">{SHOP.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the shop password to continue.</p>
        </div>
        <Suspense fallback={<LoginForm next="/" />}>
          <LoginFormWithNext searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function LoginFormWithNext({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const sp = await searchParams;
  return <LoginForm next={firstParam(sp.next) ?? "/"} />;
}
