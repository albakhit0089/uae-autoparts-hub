import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-x flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-navy-200">404</p>
      <h1 className="text-2xl font-bold">Page not found · الصفحة غير موجودة</h1>
      <div className="flex gap-2">
        <Link href="/" className="btn-navy">Home</Link>
        <Link href="/search/" className="btn-primary">Find parts</Link>
      </div>
    </div>
  );
}
