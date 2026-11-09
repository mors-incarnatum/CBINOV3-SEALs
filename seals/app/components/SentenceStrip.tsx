"use client";
import { useSentenceContext } from "@/viewmodels/useBoardShellViewModel";
/* eslint-disable @next/next/no-img-element */
import { iconPath } from "@/lib/board";
import { palette } from "@/app/theme";
export default function SentenceStrip() {
    const { state: s, actions: a } = useSentenceContext();
    return <section className="sentence-strip" aria-label="Sentence strip">
  <div className="sentence-tokens" aria-live="polite" aria-relevant="additions removals">
   {s.isEmpty && <span className="sentence-placeholder">Tap words to build a sentence</span>}
   {s.tokens.map((t, i) => <button key={t.instanceId} style={palette[t.colorKey]} onClick={() => a.removeAt(i)} aria-label={`Remove ${t.label} at position ${i + 1}`}>{iconPath(t.iconName) && <img src={iconPath(t.iconName)} alt=""/>}{t.label}</button>)}
  </div>
  <div className="sentence-actions"><button className="primary" disabled={s.isEmpty} onClick={a.speakAll} aria-label="Speak sentence">🔊 Speak</button>{s.isSpeaking && <button onClick={a.stopSpeaking}>Stop</button>}<button disabled={s.isEmpty} onClick={a.backspace} aria-label="Backspace">⌫</button><button disabled={s.isEmpty} onClick={a.clear} aria-label="Clear sentence">✕</button></div>
  {s.error && <span role="status" className="speech-error">{s.error}</span>}
 </section>;
}
