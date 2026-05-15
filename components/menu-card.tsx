"use client";

import Link from "next/link";

type MenuCardProps = {
  title: string;
  description: string;
  href: string;
};

export function MenuCard({ title, description, href }: MenuCardProps) {
  return (
    <Link
      href={href}
      className="panel card-glow flex min-h-30 flex-col justify-between p-5 transition duration-200"
    >
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      <p className="text-sm text-slate-300">{description}</p>
    </Link>
  );
}
