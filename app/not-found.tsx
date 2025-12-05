export default function NotFound() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <p className="mt-2 text-gray-600">Page not found</p>
        <a
          href="/"
          className="mt-4 inline-block text-blue-600 hover:text-blue-700"
        >
          Go back home
        </a>
      </div>
    </div>
  );
}

