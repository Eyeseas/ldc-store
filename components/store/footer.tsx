import Link from "next/link";

interface FooterProps {
  siteName?: string;
}

export function Footer({ siteName = "LDC Store" }: FooterProps) {
  return (
    <footer className="border-t">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} {siteName}</span>
        <Link href="/order/query" className="hover:text-foreground transition-colors">
          订单查询
        </Link>
      </div>
    </footer>
  );
}
