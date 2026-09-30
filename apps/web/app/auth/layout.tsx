import Link from "next/link";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        Task & Time Tracker
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
