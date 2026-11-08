"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/icon";

export function StudyOverview() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="overview">
      <section className="page-intro" aria-labelledby="welcome-heading">
        <p className="welcome">ආයුබෝවන්!</p>
        <h1 id="welcome-heading">අද අපි මොනවද ඉගෙන ගන්නේ?</h1>
        <p>ඔබේ සටහන් හා ප්‍රශ්න පත්‍ර සමඟ, දැනුම තවත් පැහැදිලි කරගන්න.</p>
      </section>

      <motion.section className="hero-panel" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} aria-labelledby="hero-heading">
        <div className="hero-copy">
          <span className="hero-kicker"><span className="tiny-book"><Icon name="book" size={16} /></span>ඔබේ පාඩමට ළඟින්ම</span>
          <h2 id="hero-heading">දැනුම ගොඩනගන්න.<br />විශ්වාසයෙන් ඉදිරියට යන්න.</h2>
          <p>සටහනක් කියවන්න. ප්‍රශ්නයක් අහන්න.<br />පිළිතුර හමු වූ පිටුවත් සමඟම තේරුම් ගන්න.</p>
          <a className="primary-button" href="#study-method">ඉගෙන ගන්නා ආකාරය<Icon name="arrow" size={18} /></a>
        </div>
        <div className="study-art" role="img" aria-label="සිංහල සටහන් පොතක් සහ ප්‍රශ්න පත්‍රයක්">
          <div className="art-orbit" />
          <div className="paper-sheet paper-back"><span>ප්‍රශ්න පත්‍ර</span><i /><i /><i /><i /><div className="paper-checkboxes"><b /><b /><b /></div></div>
          <div className="notebook"><div className="notebook-spine" /><div className="notebook-content"><span>මගේ</span><strong>සටහන්</strong><div className="notebook-emblem"><Icon name="leaf" size={35} /></div><small>දැනුමට නව පිටුවක්</small></div></div>
          <div className="art-bookmark" />
          <div className="art-source"><span><Icon name="check" size={16} /></span>පිටුවෙන් පිටුව, පැහැදිලිව</div>
        </div>
      </motion.section>

      <section id="study-method" className="method-section" aria-labelledby="method-heading">
        <div className="section-heading"><h2 id="method-heading">පාඩමෙන් අවබෝධයට</h2><span>පියවර තුනකින්</span></div>
        <div className="method-grid">
          <article><span className="method-icon blue"><Icon name="document" /></span><div><h3>ලේඛන එකතු කරන්න</h3><p>ඔබේ සිංහල සටහන් සහ පසුගිය ප්‍රශ්න පත්‍ර එක තැනකට ගන්න.</p></div></article>
          <article><span className="method-icon green"><Icon name="chat" /></span><div><h3>සිංහලෙන් ප්‍රශ්න අහන්න</h3><p>ඔබේ පාඩමේ අපැහැදිලි තැන්, ඔබේම වචනවලින් විමසන්න.</p></div></article>
          <article><span className="method-icon amber"><Icon name="source" /></span><div><h3>මූලාශ්‍රයත් බලන්න</h3><p>පිළිතුරට අදාළ ලේඛනය සහ පිටුව සමඟ නැවත කියවා බලන්න.</p></div></article>
        </div>
      </section>

      <div className="lower-grid">
        <section id="library" className="library-panel" aria-labelledby="library-heading">
          <div className="section-heading"><h2 id="library-heading">ඔබේ ලේඛන එකතුව</h2><Icon name="book" size={20} /></div>
          <div className="library-empty"><span className="empty-illustration"><Icon name="document" size={31} /><span>+</span></span><h3>අලුත් පාඩමකට ඉඩක්</h3><p>ඔබේ සටහන් සහ ප්‍රශ්න පත්‍ර සඳහා<br />වෙන් වූ අධ්‍යයන අවකාශය.</p></div>
          <p className="library-footnote"><Icon name="check" size={15} />පිළිතුරු ඔබේ ලේඛන ඇසුරින් පමණයි</p>
        </section>
        <section id="practice" className="practice-panel" aria-labelledby="practice-heading">
          <span className="practice-icon"><Icon name="quiz" size={26} /></span>
          <h2 id="practice-heading">කියවූ දේ මතකද?</h2>
          <p>පාඩම අවසානයේ ප්‍රශ්න පුහුණුවෙන් ඔබේ අවබෝධය පරීක්ෂා කරගන්න.</p>
          <div className="practice-detail"><span><Icon name="check" size={16} />බහුවරණ ප්‍රශ්න</span><span><Icon name="check" size={16} />පැහැදිලි කිරීම් සහ මූලාශ්‍ර</span></div>
          <p className="practice-note">ඔබේ සටහන්, ඔබේ පුහුණුවේ පදනමයි.</p>
        </section>
      </div>
    </div>
  );
}
