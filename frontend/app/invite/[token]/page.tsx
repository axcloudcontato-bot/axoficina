import { AcceptInviteForm } from '@/features/auth/components/AcceptInviteForm';

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-text">Aceitar convite</h1>
        <p className="mt-1 text-sm text-text-muted">Defina sua senha para ativar sua conta.</p>
        <div className="mt-6">
          <AcceptInviteForm inviteToken={token} />
        </div>
      </div>
    </main>
  );
}
