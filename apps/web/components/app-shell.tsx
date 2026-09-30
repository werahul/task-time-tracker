"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser, useLogout } from "@/features/auth/use-auth";
import { ActiveTimerBanner } from "@/features/time-tracking/components/active-timer-banner";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/time-logs", label: "Time logs" },
];

/**
 * Layout for signed-in pages. This client-side guard is a UX redirect only —
 * the API enforces authentication and ownership on every request.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isPending, isError, isFetching, refetch } = useCurrentUser();

  useEffect(() => {
    if (!isPending && !isError && !user) router.replace("/auth/login");
  }, [isPending, isError, user, router]);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      {/* The dashboard has its own "Currently working" card. */}
      {user && pathname !== "/dashboard" && <ActiveTimerBanner />}
      <main className="flex flex-1 flex-col">
        {isError ? (
          <div role="alert" className="grid justify-items-center gap-3 p-8 text-center text-sm">
            <p className="text-destructive">
              We couldn&apos;t reach the server. Check your connection and try again.
            </p>
            <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
              {isFetching ? "Retrying..." : "Try again"}
            </Button>
          </div>
        ) : user ? (
          children
        ) : (
          <div className="mx-auto grid w-full max-w-3xl gap-3 px-4 py-8 sm:px-6" aria-busy>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </main>
    </div>
  );
}

function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border">
      {/* Phones: brand + account menu on one row, nav full-width below. sm+: one row. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href="/dashboard"
          className="order-1 rounded-sm text-sm font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Task & Time Tracker
        </Link>
        <nav
          aria-label="Main"
          className="order-3 -mx-2.5 flex w-full items-center gap-1 overflow-x-auto sm:order-2 sm:mx-0 sm:w-auto"
        >
          {NAV_ITEMS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="order-2 ml-auto sm:order-3">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function UserMenu() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Account menu" />}
      >
        <UserRound />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="grid text-foreground">
            <span className="truncate font-medium">{user.name}</span>
            <span className="truncate font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, { onSettled: () => router.replace("/auth/login") })
          }
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
