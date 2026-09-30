import Link from "next/link";
import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <Link
        href="/"
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Brand />
      </Link>
      <div className="w-full max-w-sm animate-fade-up">{children}</div>
    </div>
  );
}
