import React, { useRef, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { getLanguage, LANGUAGES, t, useI18n } from "../i18n";

const VoiceLanguageControls = () => {
    const { language, changeLanguage } = useI18n();
    const [listening, setListening] = useState(false);
    const recognitionRef = useRef(null);

    const handleLanguageChange = (event) => {
        changeLanguage(event.target.value);
    };

    const readPage = () => {
        if (!window.speechSynthesis) return toast.error(t("Text to speech is not supported in this browser."));
        const text = document.querySelector('main')?.innerText?.trim();
        if (!text) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text.slice(0, 12000));
        utterance.lang = getLanguage(language).locale;
        window.speechSynthesis.speak(utterance);
    };

    const dictate = () => {
        if (listening) {
            recognitionRef.current?.stop();
            setListening(false);
            return;
        }
        const input = document.activeElement;
        if (!input || !['INPUT', 'TEXTAREA'].includes(input.tagName) || input.disabled || input.readOnly) {
            toast.info(t("Focus a text field before using speech to text."));
            return;
        }
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) return toast.error(t("Speech recognition is not supported in this browser."));

        const recognition = new Recognition();
        recognition.lang = getLanguage(language).locale;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
            setter?.call(input, `${input.value}${input.value ? ' ' : ''}${transcript}`);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        recognition.onerror = () => toast.error(t("Speech recognition could not capture speech."));
        recognition.onend = () => setListening(false);
        recognitionRef.current = recognition;
        setListening(true);
        recognition.start();
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select aria-label={t('Language')} title={t('Language')} value={language} onChange={handleLanguageChange} style={{ maxWidth: 140, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text-dark)', background: 'var(--color-surface)' }}>
                {LANGUAGES.map(option => <option key={option.code} value={option.code}>{t(option.label)}</option>)}
            </select>
            <button type="button" className="btn" aria-label={t("Read page aloud")} title={t("Read page aloud")} onClick={readPage} style={{ padding: 8, background: 'transparent', color: 'var(--color-text-dark)' }}><Volume2 size={18} /></button>
            <button type="button" className="btn" aria-label={listening ? 'Stop speech input' : 'Speech to text'} title={listening ? 'Stop speech input' : 'Speech to text'} onClick={dictate} style={{ padding: 8, background: listening ? 'var(--pastel-green)' : 'transparent', color: 'var(--color-text-dark)' }}><Mic size={18} /></button>
        </div>
    );
};

export default VoiceLanguageControls;