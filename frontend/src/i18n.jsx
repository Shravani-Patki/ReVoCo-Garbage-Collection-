/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useSyncExternalStore } from 'react';
import api from './api';
import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import kn from './locales/kn.json';
import bn from './locales/bn.json';
import gu from './locales/gu.json';
import ur from './locales/ur.json';

export const LANGUAGES = [
    { code: 'en', locale: 'en-IN', label: 'English', direction: 'ltr' },
    { code: 'hi', locale: 'hi-IN', label: 'हिन्दी', direction: 'ltr' },
    { code: 'mr', locale: 'mr-IN', label: 'मराठी', direction: 'ltr' },
    { code: 'ta', locale: 'ta-IN', label: 'தமிழ்', direction: 'ltr' },
    { code: 'te', locale: 'te-IN', label: 'తెలుగు', direction: 'ltr' },
    { code: 'kn', locale: 'kn-IN', label: 'ಕನ್ನಡ', direction: 'ltr' },
    { code: 'bn', locale: 'bn-IN', label: 'বাংলা', direction: 'ltr' },
    { code: 'gu', locale: 'gu-IN', label: 'ગુજરાતી', direction: 'ltr' },
    { code: 'ur', locale: 'ur-IN', label: 'اردو', direction: 'rtl' },
];

const dictionaries = { en, hi, mr, ta, te, kn, bn, gu, ur };
const CACHE_KEY = 'revoco.i18n.cache.v1';
const cache = (() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch { return {}; }
})();
const pending = new Map();
const failedUntil = new Map();
let localeSnapshot = { language: 'en', revision: 0 };
const localeSubscribers = new Set();
let updateTimer = null;

const subscribeLocale = (listener) => {
    localeSubscribers.add(listener);
    return () => localeSubscribers.delete(listener);
};

const getLocaleSnapshot = () => localeSnapshot;

const publishLocaleChange = (nextSnapshot) => {
    localeSnapshot = nextSnapshot;
    localeSubscribers.forEach(listener => listener());
};

const setActiveLanguage = (language) => {
    if (localeSnapshot.language !== language) publishLocaleChange({ ...localeSnapshot, language });
};

const eventDispatch = () => publishLocaleChange({ ...localeSnapshot, revision: localeSnapshot.revision + 1 });

const getUser = () => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
};

const translationCacheKey = (language, text) => `${language}\n${text}`;

const flushTranslations = async (language) => {
    const texts = [...(pending.get(language) || [])];
    pending.delete(language);
    if (!texts.length || language === 'en') return;
    try {
        for (let offset = 0; offset < texts.length; offset += 20) {
            const batch = texts.slice(offset, offset + 20);
            try {
                const response = await api.post('/api/i18n/translate', {
                    texts: batch,
                    target_language: language,
                });
                const result = response.data;
                for (const [source, translated] of Object.entries(result.translations || {})) {
                    if (typeof translated === 'string' && translated.trim()) {
                        cache[translationCacheKey(language, source)] = translated;
                        failedUntil.delete(translationCacheKey(language, source));
                    }
                }
            } catch {
                batch.forEach(text => failedUntil.set(translationCacheKey(language, text), Date.now() + 60000));
            }
        }
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* Cache is optional. */ }
        eventDispatch?.();
    } catch {
        texts.forEach(text => failedUntil.set(translationCacheKey(language, text), Date.now() + 60000));
    }
};

const requestTranslation = (text, language) => {
    if (!text || language === 'en' || !/\p{L}/u.test(text)) return;
    const key = translationCacheKey(language, text);
    if (cache[key] || dictionaries[language]?.[text] || (failedUntil.get(key) || 0) > Date.now()) return;
    if (!pending.has(language)) pending.set(language, new Set());
    pending.get(language).add(text);
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => flushTranslations(language), 80);
};

export const t = (key, values = {}) => {
    const source = String(key ?? '');
    const language = localeSnapshot.language;
    const translated = dictionaries[language]?.[source]
        || cache[translationCacheKey(language, source)]
        || source;
    if (translated === source) requestTranslation(source, language);
    return translated.replace(/\{\{(\w+)\}\}/gu, (_, name) => String(values[name] ?? `{{${name}}}`));
};

export const getLanguage = (code = localeSnapshot.language) => LANGUAGES.find(language => language.code === code) || LANGUAGES[0];

export const formatNumber = (value, options = {}) => new Intl.NumberFormat(getLanguage().locale, options).format(Number(value) || 0);
export const formatCurrency = (value, currency = 'INR') => new Intl.NumberFormat(getLanguage().locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
export const formatDate = (value, options = { dateStyle: 'medium' }) => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(getLanguage().locale, options).format(date);
};

const userLanguageStorageKey = (user) => user?.id ? `revoco.language.user.${user.id}` : 'revoco.language.anonymous';

const initialLanguage = () => {
    const user = getUser();
    const saved = localStorage.getItem(userLanguageStorageKey(user)) || user?.language || localStorage.getItem('revoco.language.anonymous') || 'en';
    return dictionaries[saved] ? saved : 'en';
};

export const I18nProvider = ({ children }) => {
    const { language } = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleSnapshot);

    useEffect(() => { setActiveLanguage(initialLanguage()); }, []);

    useEffect(() => {
        const selected = getLanguage(language);
        document.documentElement.lang = selected.locale;
        document.documentElement.dir = selected.direction;
        document.documentElement.dataset.language = selected.code;
    }, [language]);

    useEffect(() => {
        const syncAccountLanguage = () => {
            const user = getUser();
            const saved = localStorage.getItem(userLanguageStorageKey(user)) || user?.language || 'en';
            setActiveLanguage(dictionaries[saved] ? saved : 'en');
        };
        window.addEventListener('revoco-user-changed', syncAccountLanguage);
        return () => window.removeEventListener('revoco-user-changed', syncAccountLanguage);
    }, []);

    useEffect(() => {
        const observer = new MutationObserver(records => {
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (node.nodeType === Node.TEXT_NODE) translateVisibleNode(node, language);
                    else if (node.nodeType === Node.ELEMENT_NODE) {
                        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
                        let child;
                        while ((child = walker.nextNode())) translateVisibleNode(child, language);
                    }
                }
                if (record.type === 'characterData') translateVisibleNode(record.target, language);
            }
        });
        if (document.body) {
            observer.observe(document.body, { childList: true, characterData: true, subtree: true });
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) translateVisibleNode(node, language);
        }
        return () => observer.disconnect();
    }, [language]);

    return children;
};

export const useI18n = () => {
    const { language } = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleSnapshot);
    const changeLanguage = (nextLanguage) => {
        if (!dictionaries[nextLanguage]) return;
        setActiveLanguage(nextLanguage);
        const user = getUser();
        localStorage.setItem(userLanguageStorageKey(user), nextLanguage);
        if (!user?.id || !user?.token) return;
        api.post('/api/auth/language', { language: nextLanguage }).catch(() => {});
    };
    return { language, changeLanguage };
};

const translatedNodes = new WeakMap();
const translateVisibleNode = (node, language) => {
    if (!node?.nodeValue?.trim()) return;
    const parent = node.parentElement;
    if (!parent || parent.closest('script,style,noscript,textarea,input,select,[data-no-auto-translate]')) return;
    const previous = translatedNodes.get(node);
    const currentText = node.nodeValue;
    if (language === 'en') {
        if (previous?.translated === currentText) node.nodeValue = previous.source;
        translatedNodes.delete(node);
        return;
    }
    const source = previous?.translated === currentText ? previous.source : currentText.trim();
    if (!/\p{L}/u.test(source) || (previous?.language === language && previous.translated === currentText)) return;
    requestTranslation(source, language);
    const translated = dictionaries[language]?.[source] || cache[translationCacheKey(language, source)];
    if (!translated) return;
    const leading = currentText.match(/^\s*/u)?.[0] || '';
    const trailing = currentText.match(/\s*$/u)?.[0] || '';
    const output = `${leading}${translated}${trailing}`;
    translatedNodes.set(node, { source, language, translated: output });
    node.nodeValue = output;
};
