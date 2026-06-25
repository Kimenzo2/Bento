import Link from 'next/link';
import { createClient, getAuthenticatedUser } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PricingSuccessPage() {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();

  let status = 'pending';
  let plan = 'your selected plan';
  let email = user?.email ?? '';

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_plan_code, user_tier')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      status = data.subscription_status ?? 'pending';
      plan = data.subscription_plan_code ?? data.user_tier ?? 'your selected plan';
    }
  }

  return (
    <main className="pricing-success">
      <section className="pricing-success__card">
        <p className="pricing-success__eyebrow">Payment received</p>
        <h1>Thanks. We&apos;re waiting for the Paystack webhook.</h1>
        <p className="pricing-success__copy">
          {email
            ? `We checked the Bento account for ${email}. The current subscription state is ${status}.`
            : 'Your payment was sent successfully and Bento will refresh as soon as the webhook lands.'}
        </p>
        <p className="pricing-success__copy">
          Current plan hint: <strong>{plan}</strong>. The desktop app will update automatically once
          Supabase receives Paystack&apos;s event.
        </p>
        <div className="pricing-success__actions">
          <Link href="/pricing" className="pricing-success__primary">
            Back to pricing
          </Link>
          <Link href="/" className="pricing-success__secondary">
            Go home
          </Link>
        </div>
      </section>

      <style>{`
        .pricing-success {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 2rem;
          background:
            radial-gradient(circle at top, rgba(184,92,58,0.08), transparent 30%),
            linear-gradient(180deg, #fefcf8 0%, #fcf7f0 100%);
          color: #2c2418;
        }

        .pricing-success__card {
          width: min(720px, 100%);
          border-radius: 28px;
          border: 1px solid rgba(44,36,24,0.08);
          background: rgba(254,252,248,0.9);
          box-shadow: 0 20px 50px rgba(44,36,24,0.06);
          padding: clamp(1.5rem, 5vw, 3rem);
        }

        .pricing-success__eyebrow {
          display: inline-block;
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #b85c3a;
          margin-bottom: 1rem;
        }

        .pricing-success h1 {
          margin: 0;
          font-size: clamp(2rem, 4vw, 3.4rem);
          line-height: 1.06;
          letter-spacing: -0.04em;
        }

        .pricing-success__copy {
          margin-top: 1rem;
          color: #6b5e53;
          line-height: 1.7;
          font-size: 1.04rem;
        }

        .pricing-success__actions {
          margin-top: 1.6rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.8rem;
        }

        .pricing-success__primary,
        .pricing-success__secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.9rem 1.2rem;
          border-radius: 999px;
          text-decoration: none;
          font-weight: 700;
        }

        .pricing-success__primary {
          background: #2c2418;
          color: #fff;
        }

        .pricing-success__secondary {
          border: 1px solid rgba(44,36,24,0.12);
          color: #2c2418;
          background: transparent;
        }
      `}</style>
    </main>
  );
}
