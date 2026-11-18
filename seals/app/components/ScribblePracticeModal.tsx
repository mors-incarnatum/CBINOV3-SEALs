"use client";
import { useScribblePracticeViewModel } from "@/viewmodels/useScribblePracticeViewModel";
import Modal from "./Modal";

export default function ScribblePracticeModal({ onClose }: { onClose: () => void }) {
    const { canvasRef, state: s, actions: a } = useScribblePracticeViewModel(onClose);

    return (
        <Modal label="Scribble practice prototype" onClose={onClose} className="editor-modal">
            <div className="modal-heading">
                <h2>Scribble practice (Prototype)</h2>
                <button type="button" onClick={onClose} aria-label="Close scribble practice">
                    ✕
                </button>
            </div>
            <p>
                Practice handwriting here. Review and edit the recognized word before adding it to your sentence.
                (Mock OCR prototype — no external OCR service is called.)
            </p>
            <canvas
                ref={canvasRef}
                width={360}
                height={160}
                style={{ border: "1px solid #cbd5e1", borderRadius: 8, touchAction: "none", background: "#fff" }}
                onPointerDown={a.startDraw}
                onPointerMove={a.moveDraw}
                onPointerUp={a.endDraw}
                onPointerLeave={a.endDraw}
            />
            <div className="field-row">
                <button type="button" onClick={a.clearCanvas}>
                    Clear pad
                </button>
                <button type="button" disabled={!s.hasStroke} onClick={a.mockRecognize}>
                    Recognize (mock)
                </button>
            </div>
            <label>
                Review / edit text
                <input
                    value={s.recognizedText}
                    onChange={e => a.setRecognizedText(e.target.value)}
                    placeholder="Type or review recognized word"
                />
            </label>
            <button type="button" className="primary" disabled={!s.recognizedText.trim()} onClick={a.addToSentence}>
                Add to sentence
            </button>
            {s.drafts.length > 0 && (
                <p>Recent practice drafts: {s.drafts.slice(-5).join(", ")}</p>
            )}
        </Modal>
    );
}
