import Link from "next/link";
import { Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="py-20 text-center">
      <p className="text-5xl">🌱</p>
      <h1 className="mt-4 text-2xl font-bold text-brand-700">Page not found</h1>
      <p className="mt-2 text-muted">This page doesn&apos;t exist or you don&apos;t have access to it.</p>
      <Link href="/" className="btn-primary mt-6">
        Go home
      </Link>
    </Container>
  );
}
