export default function HomePage() {
  return (
    <main>
      <h1>Behaive Arena</h1>
      <p className="muted">
        Hosted research platform for on-chain behavioral-economics experiments with AI agents.
      </p>
      <p>
        The platform is in active development. Public runs will appear at
        <code> /run/[slug]</code> once experiments start streaming.
      </p>
      <p>
        <a href="/login">Sign in to create experiments</a>
      </p>
    </main>
  );
}
