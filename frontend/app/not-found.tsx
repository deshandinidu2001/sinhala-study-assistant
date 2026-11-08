import Link from "next/link";

export default function NotFound() {
  return <div className="message-page"><h1>මෙම පිටුව හමු නොවීය</h1><p>මුල් පිටුවට ගොස් නැවත උත්සාහ කරන්න.</p><Link className="primary-button" href="/">මුල් පිටුවට යන්න</Link></div>;
}
