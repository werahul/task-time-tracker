"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ChevronsUpDown,
  History,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { Brand } from "@/components/brand";
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
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/time-logs", label: "Time logs", icon: History },
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
    <div className="flex flex-1">
      {/* Desktop: a fixed sidebar. Phones/tablets get the same content in a drawer. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl md:flex">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <MobileHeader />
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
            // Keyed by route so each page fades in as you navigate.
            <div key={pathname} className="flex flex-1 animate-fade-up flex-col">
              {children}
            </div>
          ) : (
            <div className="mx-auto grid w-full max-w-3xl gap-3 px-4 py-8 sm:px-6" aria-busy>
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex w-full flex-col gap-6 p-4">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="rounded-lg px-2 pt-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Brand />
      </Link>

      <nav aria-label="Main" className="grid gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-white/[0.06] font-medium text-foreground"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              {/* Active indicator: a glowing ember bar on the left edge. */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-opacity duration-150",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
              <Icon
                aria-hidden
                className={cn(
                  "size-4 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <UserMenu />
      </div>
    </div>
  );
}

function MobileHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/75 px-4 py-3 backdrop-blur-xl md:hidden">
      <Link
        href="/dashboard"
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Brand />
      </Link>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger
          render={<Button variant="outline" size="icon" aria-label="Open navigation" />}
        >
          <Menu />
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] border-r border-sidebar-border bg-sidebar shadow-2xl outline-none duration-300 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <SidebarContent onNavigate={() => setOpen(false)} />
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-4 right-3"
                  aria-label="Close navigation"
                />
              }
            >
              <X />
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </header>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}

function UserMenu() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5 text-left outline-none transition-colors hover:border-white/15 hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-white/[0.06]"
          />
        }
      >
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-foreground"
        >
          {initials(user.name)}
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8}>
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
