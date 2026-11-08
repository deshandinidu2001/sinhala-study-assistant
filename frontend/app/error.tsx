"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="message-page"><h1>පිටුව පෙන්විය නොහැක</h1><p>නැවත උත්සාහ කර බලන්න.</p><button className="primary-button" onClick={reset}>නැවත උත්සාහ කරන්න</button></div>;
}
