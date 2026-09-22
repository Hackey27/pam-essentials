export const dynamic = "force-dynamic";

export default function Home() {
  const deployedAt = new Date().toISOString();
  return (
    <main>
      <h1>PAM Essentials</h1>
      <p>The store is being set up. Products will appear here soon.</p>
      <p><a href="/admin">Go to the admin dashboard</a></p>
      <p className="status">
        Deployment check: this page was served by Cloud Run at {deployedAt}.
      </p>
    </main>
  );
}
