import Link from "next/link";
import { ConnectionStatus } from "@/components/connection-status";
import { Icon } from "@/components/icon";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">ප්‍රධාන අන්තර්ගතයට යන්න</a>
      <aside className="sidebar" aria-label="අධ්‍යයන අවකාශය">
        <Link className="brand" href="/" aria-label="අකුර මුල් පිටුව">
          <span className="brand-symbol">අ</span>
          <span><strong>අකුර</strong><small>ඔබේ අධ්‍යයන සහායක</small></span>
        </Link>
        <p className="nav-caption">මගේ අවකාශය</p>
        <nav aria-label="ප්‍රධාන මෙනුව">
          <Link href="/" className="nav-item active" aria-current="page"><Icon name="home" />දළ විශ්ලේෂණය</Link>
          <a href="#library" className="nav-item"><Icon name="book" />මගේ ලේඛන</a>
          <a href="#study-method" className="nav-item"><Icon name="chat" />ප්‍රශ්න හා පිළිතුරු</a>
          <a href="#practice" className="nav-item"><Icon name="quiz" />ප්‍රශ්න පුහුණුව</a>
        </nav>
        <div className="sidebar-note">
          <Icon name="leaf" size={24} />
          <p>පුංචි පියවරක්.<br /><strong>අලුත් දැනුමක්.</strong></p>
          <span>සෑම පාඩමක්ම ඔබේම වේගයෙන්.</span>
        </div>
        <ConnectionStatus />
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>ඉගෙනීමට ඔබේම තැනක්</span>
          <span className="language-label"><span aria-hidden="true">අ</span>සිංහල</span>
        </header>
        <main id="main" tabIndex={-1}>{children}</main>
        <footer className="footer"><span>අකුර</span><p>ඔබේ ලේඛන ඇසුරින්. ඔබේ දැනුම වෙනුවෙන්.</p></footer>
      </div>
    </div>
  );
}
