import Link from 'next/link';
import { getAuthenticatedUser } from '../../../lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

function getPaystackSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured.');
  return key;
}

async function verifyTransaction(reference: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${getPaystackSecretKey()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    const body = await res.json();
    return body?.status === true && body?.data?.status === 'success';
  } catch {
    return false;
  }
}

type SearchParams = Record<string, string | string[] | undefined>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function PricingSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const reference = firstString(params.reference) ?? firstString(params.trxref) ?? '';

  if (!reference) {
    redirect('/pricing?error=unknown');
  }

  const verified = await verifyTransaction(reference);
  if (!verified) {
    redirect('/pricing?error=paystack');
  }

  const user = await getAuthenticatedUser();
  let email = user?.email ?? '';

  return (
    <main className="pricing-success">
      <section className="pricing-success__card">
        <p className="pricing-success__eyebrow">Payment received</p>
        <h1>Thanks for subscribing.</h1>
        <p className="pricing-success__copy text-body">
          {email
            ? `We sent a confirmation to ${email}.`
            : 'Your payment was successful.'}
        </p>
        <p className="pricing-success__copy text-body">
          Your apps will unlock automatically in the desktop app. This usually takes a minute.
        </p>
        <div className="pricing-success__actions">
          <Link href="/pricing" data-slot="button" className="pricing-success__primary btn-accent">
            Back to pricing
          </Link>
          <Link href="/" data-slot="button" className="pricing-success__secondary">
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
          background: #131211;
          color: #dce0e6;
        }

        .pricing-success__card {
          width: min(720px, 100%);
          border-radius: 1.5rem;
          background: #1b1c1d;
          padding: clamp(1.5rem, 5vw, 3rem);
        }

        .pricing-success__eyebrow {
          display: inline-block;
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #7a9bb5;
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
          padding: 0 18px;
          border-radius: 0.75rem;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.875rem;
          height: 36px;
          transition: background 0.2s ease, box-shadow 0.15s ease;
        }

        .pricing-success__primary {
          background: #7a9bb5;
          color: #131211;
        }

        .pricing-success__secondary {
          border: none;
          color: rgba(220,224,230,0.8);
          background: rgba(255,255,255,0.06);
        }

        .pricing-success__secondary:hover {
          background: rgba(255,255,255,0.1) !important;
        }
      `}</style>
    </main>
  );
}
